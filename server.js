require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { buildAll } = require('./build-articles');

const app = express();
const PORT = 3000;

const articlesDir = path.join(__dirname, 'articles');
const enquiriesDir = path.join(__dirname, 'enquiries');

if (!fs.existsSync(enquiriesDir)) fs.mkdirSync(enquiriesDir, { recursive: true });

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH;
const SESSION_SECRET = process.env.SESSION_SECRET;
// Base32 TOTP secret. When set, a valid authenticator code is required at login
// (second factor). Generate one with: node generate-mfa.js
const ADMIN_TOTP_SECRET = process.env.ADMIN_TOTP_SECRET;

// Per-user admin accounts. Each entry: { username, passHash, totpSecret?, disabled? }.
// Managed with: node manage-users.js. Falls back to the single env-based admin
// (ADMIN_USER/ADMIN_PASS_HASH/ADMIN_TOTP_SECRET) when this file is absent/empty.
const ADMIN_USERS_FILE = process.env.ADMIN_USERS_FILE || path.join(__dirname, 'admin-users.json');
const AUDIT_LOG = path.join(__dirname, 'admin-audit.log');

function loadUsers() {
  try {
    if (fs.existsSync(ADMIN_USERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(ADMIN_USERS_FILE, 'utf-8'));
      if (Array.isArray(data) && data.length) return data;
    }
  } catch (e) {
    console.error('Failed to read admin users file:', e.message);
  }
  return null;
}

// Constant hash to compare against when a username is unknown, so response
// timing doesn't reveal whether the account exists.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);

function audit(req, action) {
  const line = JSON.stringify({
    at: new Date().toISOString(),
    user: (req.session && req.session.username) || 'anonymous',
    ip: req.ip || null,
    action
  }) + '\n';
  fs.appendFile(AUDIT_LOG, line, (err) => {
    if (err) console.error('Audit log write failed:', err.message);
  });
}

// Fail fast rather than fall back to known/default secrets baked into source.
const hasUserStore = !!loadUsers();
const missingSecrets = [];
if (!SESSION_SECRET) missingSecrets.push('SESSION_SECRET');
if (!hasUserStore && !ADMIN_PASS_HASH) missingSecrets.push('ADMIN_PASS_HASH (or create admin-users.json via "node manage-users.js add <name>")');
if (missingSecrets.length) {
  console.error(`Refusing to start: missing required config: ${missingSecrets.join(', ')}.`);
  console.error('Set secrets in .env (see .env.example). Use a long random SESSION_SECRET.');
  process.exit(1);
}

if (hasUserStore) {
  const noMfa = loadUsers().filter(u => !u.disabled && !u.totpSecret).map(u => u.username);
  if (noMfa.length) {
    console.warn(`WARNING: admin account(s) without MFA: ${noMfa.join(', ')}. Re-add with "node manage-users.js" to set a TOTP secret.`);
  }
} else if (!ADMIN_TOTP_SECRET) {
  console.warn('WARNING: ADMIN_TOTP_SECRET not set — admin login is single-factor.');
  console.warn('Run "node generate-mfa.js" and set ADMIN_TOTP_SECRET in .env to enable MFA.');
}

// Set SECURE_COOKIES=true when serving over HTTPS (e.g. behind a reverse proxy).
const SECURE_COOKIES = process.env.SECURE_COOKIES === 'true';
// Origins permitted to make state-changing requests (CSRF guard). Comma-separated.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || `http://localhost:${PORT}`)
  .split(',').map(s => s.trim()).filter(Boolean);

if (SECURE_COOKIES) app.set('trust proxy', 1);
app.disable('x-powered-by');

// ── Security headers ──
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (SECURE_COOKIES) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(express.json({ limit: '1mb' }));

// ── CSRF defence: reject cross-origin state-changing requests ──
app.use((req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  let source = req.headers.origin;
  if (!source && req.headers.referer) {
    try { source = new URL(req.headers.referer).origin; } catch { source = null; }
  }
  if (!source || !ALLOWED_ORIGINS.includes(source)) {
    return res.status(403).json({ error: 'Cross-origin request blocked' });
  }
  next();
});

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: SECURE_COOKIES,
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000
  }
}));

// ── Login rate limiting (in-memory, per IP) ──
const RL_WINDOW_MS = 15 * 60 * 1000;
const RL_MAX_ATTEMPTS = 10;
const loginAttempts = new Map();

function loginRateLimit(req, res, next) {
  const now = Date.now();
  const ip = req.ip || 'unknown';
  // Opportunistically prune expired entries to bound memory.
  for (const [key, rec] of loginAttempts) {
    if (now - rec.first >= RL_WINDOW_MS) loginAttempts.delete(key);
  }
  const rec = loginAttempts.get(ip);
  if (rec && now - rec.first < RL_WINDOW_MS) {
    if (rec.count >= RL_MAX_ATTEMPTS) {
      res.setHeader('Retry-After', Math.ceil((RL_WINDOW_MS - (now - rec.first)) / 1000));
      return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
    }
    rec.count++;
  } else {
    loginAttempts.set(ip, { count: 1, first: now });
  }
  next();
}

// ── TOTP (RFC 6238) verification, dependency-free ──
function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = (input || '').replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  let bits = '';
  for (const ch of clean) {
    const val = alphabet.indexOf(ch);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function totpCode(secret, counter) {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) |
               ((hmac[offset + 1] & 0xff) << 16) |
               ((hmac[offset + 2] & 0xff) << 8) |
               (hmac[offset + 3] & 0xff);
  return (code % 1000000).toString().padStart(6, '0');
}

function verifyTotp(secret, token) {
  if (!/^\d{6}$/.test(token || '')) return false;
  const counter = Math.floor(Date.now() / 1000 / 30);
  // Allow +/- 1 step (30s) for clock drift.
  for (let w = -1; w <= 1; w++) {
    const expected = totpCode(secret, counter + w);
    if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return true;
  }
  return false;
}

function requireSession(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    return res.redirect('/login.html');
  }
  return res.status(401).json({ error: 'Not authenticated' });
}

function sanitiseSlug(slug) {
  return slug.replace(/[^a-zA-Z0-9_-]/g, '');
}

function sanitiseFrontmatterValue(value) {
  return (value || '').replace(/[\n\r]/g, ' ').trim();
}

function rebuildArticles() {
  if (!fs.existsSync(articlesDir)) return;
  const articles = buildAll(articlesDir);
  console.log(`Rebuilt articles.json + ${articles.length} HTML pages`);
}

if (fs.existsSync(articlesDir)) {
  // OneDrive sync can fire bursts of events on the articles dir; coalesce
  // so a burst produces one rebuild rather than one per event.
  let pendingRebuild = null;
  fs.watch(articlesDir, (event, filename) => {
    if (filename && filename.endsWith('.md')) {
      console.log(`Detected change: ${filename}`);
      clearTimeout(pendingRebuild);
      pendingRebuild = setTimeout(rebuildArticles, 200);
    }
  });
}

// ── Public routes ──
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.post('/api/login', loginRateLimit, async (req, res) => {
  const { username, password, token } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Resolve the account from the per-user store, or the env single-admin fallback.
  const users = loadUsers();
  let account = null;
  if (users) {
    account = users.find(u => u.username === username && !u.disabled) || null;
  } else if (username === ADMIN_USER) {
    account = { username: ADMIN_USER, passHash: ADMIN_PASS_HASH, totpSecret: ADMIN_TOTP_SECRET };
  }

  // Always run a compare (dummy hash when unknown) to keep timing uniform.
  const valid = await bcrypt.compare(password, account ? account.passHash : DUMMY_HASH);
  if (!account || !valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  // Second factor — enforced when the account has a TOTP secret.
  if (account.totpSecret && !verifyTotp(account.totpSecret, token)) {
    return res.status(401).json({ error: 'Invalid authenticator code', mfaRequired: true });
  }
  loginAttempts.delete(req.ip || 'unknown');
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.authenticated = true;
    req.session.username = account.username;
    audit(req, 'login');
    res.json({ ok: true, username: account.username });
  });
});

app.post('/api/logout', (req, res) => {
  audit(req, 'logout');
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get('/api/me', requireSession, (req, res) => {
  res.json({ username: req.session.username || null });
});

app.get('/admin.html', requireSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.use(express.static(__dirname));

// ── Admin API ──

app.get('/api/articles', (req, res) => {
  const jsonPath = path.join(articlesDir, 'articles.json');
  if (!fs.existsSync(jsonPath)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(jsonPath, 'utf-8')));
});

app.get('/api/articles/:slug', (req, res) => {
  const safe = sanitiseSlug(req.params.slug);
  const filePath = path.join(articlesDir, safe + '.md');
  if (!filePath.startsWith(path.resolve(articlesDir))) return res.status(400).json({ error: 'Invalid slug' });
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });

  const content = fs.readFileSync(filePath, 'utf-8');
  const body = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');

  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  const fm = {};
  if (match) {
    for (const line of match[1].split('\n')) {
      const colon = line.indexOf(':');
      if (colon === -1) continue;
      fm[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
    }
  }

  res.json({ ...fm, slug: safe, body });
});

app.post('/api/articles', requireSession, (req, res) => {
  const { slug, title, date, dateModified, og_image, author, category, featured, summary, body } = req.body;
  if (!slug || !title || !date) return res.status(400).json({ error: 'slug, title, date required' });

  const safeName = sanitiseSlug(slug);
  const meta = {
    slug: safeName,
    title: sanitiseFrontmatterValue(title),
    date: sanitiseFrontmatterValue(date),
    dateModified: sanitiseFrontmatterValue(dateModified) || sanitiseFrontmatterValue(date),
    ogImage: sanitiseFrontmatterValue(og_image),
    author: sanitiseFrontmatterValue(author) || 'Naomi Alefelder',
    category: sanitiseFrontmatterValue(category) || 'General',
    featured: !!featured,
    summary: sanitiseFrontmatterValue(summary)
  };

  const frontmatterLines = [
    '---',
    `title: ${meta.title}`,
    `date: ${meta.date}`
  ];
  if (meta.dateModified && meta.dateModified !== meta.date) {
    frontmatterLines.push(`dateModified: ${meta.dateModified}`);
  }
  if (meta.ogImage) {
    frontmatterLines.push(`og_image: ${meta.ogImage}`);
  }
  frontmatterLines.push(
    `author: ${meta.author}`,
    `category: ${meta.category}`,
    `featured: ${meta.featured ? 'true' : 'false'}`,
    `summary: ${meta.summary}`,
    '---'
  );
  const frontmatter = frontmatterLines.join('\n');

  const fileContent = frontmatter + '\n\n' + (body || '');
  const filePath = path.join(articlesDir, safeName + '.md');
  if (!filePath.startsWith(path.resolve(articlesDir))) return res.status(400).json({ error: 'Invalid slug' });
  fs.writeFileSync(filePath, fileContent);

  rebuildArticles();
  audit(req, `save-article:${safeName}`);
  res.json({ ok: true, slug: safeName });
});

app.delete('/api/articles/:slug', requireSession, (req, res) => {
  const safe = sanitiseSlug(req.params.slug);
  const mdPath = path.join(articlesDir, safe + '.md');
  const htmlPath = path.join(articlesDir, safe + '.html');
  if (!mdPath.startsWith(path.resolve(articlesDir))) return res.status(400).json({ error: 'Invalid slug' });
  if (!fs.existsSync(mdPath)) return res.status(404).json({ error: 'Not found' });
  fs.unlinkSync(mdPath);
  if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
  rebuildArticles();
  audit(req, `delete-article:${safe}`);
  res.json({ ok: true });
});

app.get('/api/resources', (req, res) => {
  const resourcesPath = path.join(articlesDir, 'resources.json');
  if (!fs.existsSync(resourcesPath)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(resourcesPath, 'utf-8')));
});

app.post('/api/resources', requireSession, (req, res) => {
  const resources = req.body;
  fs.writeFileSync(path.join(articlesDir, 'resources.json'), JSON.stringify(resources, null, 2) + '\n');
  audit(req, 'save-resources');
  res.json({ ok: true });
});

app.get('/api/updates', (req, res) => {
  const updatesPath = path.join(articlesDir, 'updates.json');
  if (!fs.existsSync(updatesPath)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(updatesPath, 'utf-8')));
});

app.post('/api/updates', requireSession, (req, res) => {
  const updates = req.body;
  fs.writeFileSync(path.join(articlesDir, 'updates.json'), JSON.stringify(updates, null, 2) + '\n');
  audit(req, 'save-updates');
  res.json({ ok: true });
});

app.get('/api/enquiries', requireSession, (req, res) => {
  if (!fs.existsSync(enquiriesDir)) return res.json([]);
  const files = fs.readdirSync(enquiriesDir).filter(f => f.endsWith('.json') && f !== 'subscribers.json');
  const enquiries = files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(enquiriesDir, f), 'utf-8'));
    return { ...data, _file: f };
  }).sort((a, b) => new Date(b.receivedAt || b.submittedAt || 0) - new Date(a.receivedAt || a.submittedAt || 0));
  res.json(enquiries);
});

app.delete('/api/enquiries/:file', requireSession, (req, res) => {
  const safe = req.params.file.replace(/[^a-zA-Z0-9_.-]/g, '');
  const filePath = path.join(enquiriesDir, safe);
  if (!filePath.startsWith(path.resolve(enquiriesDir))) return res.status(400).json({ error: 'Invalid file' });
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  fs.unlinkSync(filePath);
  audit(req, `delete-enquiry:${safe}`);
  res.json({ ok: true });
});

app.get('/api/subscribers', requireSession, (req, res) => {
  const subsFile = path.join(enquiriesDir, 'subscribers.json');
  if (!fs.existsSync(subsFile)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(subsFile, 'utf-8')));
});

// ── Start ──
rebuildArticles();

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Dashboard at    http://localhost:${PORT}/admin.html`);
  console.log(`Login at        http://localhost:${PORT}/login.html`);
});
