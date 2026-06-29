// Generates a TOTP secret for admin MFA. Dependency-free.
//
// Usage:  node generate-mfa.js
//
// 1. Run it, then copy the printed ADMIN_TOTP_SECRET line into your .env.
// 2. Add the account to an authenticator app (Google Authenticator, Authy,
//    1Password, etc.) by either scanning a QR of the otpauth:// URI below, or
//    entering the base32 secret manually.
// 3. Restart the server. Login will then require the 6-digit code.

const crypto = require('crypto');

function base32Encode(buf) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += alphabet[parseInt(bits.slice(i, i + 5), 2)];
  }
  const rem = bits.length % 5;
  if (rem) out += alphabet[parseInt(bits.slice(bits.length - rem).padEnd(5, '0'), 2)];
  return out;
}

const secret = base32Encode(crypto.randomBytes(20)); // 160-bit secret
const issuer = 'Holistic Governance';
const account = process.env.ADMIN_USER || 'admin';
const uri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}` +
  `?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

console.log('\nAdd this line to your .env:\n');
console.log(`ADMIN_TOTP_SECRET=${secret}`);
console.log('\nAuthenticator app setup — scan a QR of this URI, or enter the secret manually:\n');
console.log(uri);
console.log('\nManual entry: secret =', secret, '| type = time-based | digits = 6 | period = 30s\n');
