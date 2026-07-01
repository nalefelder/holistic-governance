// Manage per-user admin accounts for the dashboard. Dependency-free
// (uses bcryptjs, already a project dependency, + Node built-ins).
//
// Usage:
//   node manage-users.js add <username>       Create a user (prompts for password, mints TOTP secret)
//   node manage-users.js list                 List users (no secrets shown)
//   node manage-users.js passwd <username>    Change a user's password
//   node manage-users.js remove <username>    Delete a user
//   node manage-users.js disable <username>   Disable login without deleting
//   node manage-users.js enable <username>    Re-enable a disabled user
//
// Accounts are stored in admin-users.json (gitignored). While this file exists
// and is non-empty, the server uses it instead of the env-based single admin.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const USERS_FILE = process.env.ADMIN_USERS_FILE || path.join(__dirname, 'admin-users.json');

function load() {
  if (fs.existsSync(USERS_FILE)) {
    try {
      const d = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      if (Array.isArray(d)) return d;
    } catch (e) {
      console.error(`Could not parse ${USERS_FILE}: ${e.message}`);
      process.exit(1);
    }
  }
  return [];
}

function save(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2) + '\n', { mode: 0o600 });
}

function base32Encode(buf) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += alphabet[parseInt(bits.slice(i, i + 5), 2)];
  const rem = bits.length % 5;
  if (rem) out += alphabet[parseInt(bits.slice(bits.length - rem).padEnd(5, '0'), 2)];
  return out;
}

function promptHidden(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let muted = false;
    rl._writeToOutput = (str) => { if (!muted) rl.output.write(str); };
    rl.question(query, (value) => {
      rl.close();
      process.stdout.write('\n');
      resolve(value);
    });
    muted = true; // question already printed; suppress the typed echo
  });
}

function printOtpauth(username, secret) {
  const issuer = 'Holistic Governance';
  const uri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(username)}` +
    `?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  console.log('\nMFA — add to an authenticator app (scan a QR of this URI, or enter the secret):');
  console.log(uri);
  console.log(`Secret: ${secret} | digits 6 | period 30s\n`);
}

async function readPasswordTwice() {
  const pw1 = await promptHidden('Password: ');
  const pw2 = await promptHidden('Confirm password: ');
  if (pw1 !== pw2) { console.error('Passwords do not match.'); process.exit(1); }
  if (pw1.length < 12) { console.error('Use at least 12 characters.'); process.exit(1); }
  return pw1;
}

async function main() {
  const [cmd, username] = process.argv.slice(2);
  const users = load();

  switch (cmd) {
    case 'add': {
      if (!username) { console.error('Usage: node manage-users.js add <username>'); process.exit(1); }
      if (users.find(u => u.username === username)) { console.error(`User "${username}" already exists.`); process.exit(1); }
      const pw = await readPasswordTwice();
      const totpSecret = base32Encode(crypto.randomBytes(20));
      users.push({ username, passHash: bcrypt.hashSync(pw, 12), totpSecret, disabled: false, createdAt: new Date().toISOString() });
      save(users);
      console.log(`Created user "${username}".`);
      printOtpauth(username, totpSecret);
      break;
    }
    case 'passwd': {
      const u = users.find(x => x.username === username);
      if (!u) { console.error(`No such user: ${username}`); process.exit(1); }
      const pw = await readPasswordTwice();
      u.passHash = bcrypt.hashSync(pw, 12);
      save(users);
      console.log(`Password updated for "${username}".`);
      break;
    }
    case 'remove': {
      const next = users.filter(u => u.username !== username);
      if (next.length === users.length) { console.error(`No such user: ${username}`); process.exit(1); }
      save(next);
      console.log(`Removed "${username}".`);
      break;
    }
    case 'disable':
    case 'enable': {
      const u = users.find(x => x.username === username);
      if (!u) { console.error(`No such user: ${username}`); process.exit(1); }
      u.disabled = cmd === 'disable';
      save(users);
      console.log(`${cmd === 'disable' ? 'Disabled' : 'Enabled'} "${username}".`);
      break;
    }
    case 'list': {
      if (!users.length) { console.log('No users. Add one with: node manage-users.js add <username>'); break; }
      console.log('Admin users:');
      for (const u of users) {
        console.log(`  - ${u.username}${u.disabled ? ' (disabled)' : ''}${u.totpSecret ? ' [MFA]' : ' [NO MFA]'}`);
      }
      break;
    }
    default:
      console.log('Usage: node manage-users.js <add|list|passwd|remove|disable|enable> [username]');
      process.exit(cmd ? 1 : 0);
  }
}

main();
