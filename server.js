require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// ── Site configuration ──
const SITES = {
  'true-north': {
    name: 'True North Assurance',
    articlesDir: path.join(__dirname, 'articles'),
    enquiriesDir: path.join(__dirname, 'enquiries'),
  },
  'holistic-governance': {
    name: 'Holistic Governance',
    articlesDir: path.join(process.env.HG_SITE_PATH || path.resolve(__dirname, '../../holistic-governance/holistic-governance'), 'articles'),
    enquiriesDir: path.join(process.env.HG_SITE_PATH || path.resolve(__dirname, '../../holistic-governance/holistic-governance'), 'enquiries'),
  }
};

// Ensure enquiries directories exist for both sites
for (const site of Object.values(SITES)) {
  if (!fs.existsSync(site.enquiriesDir)) fs.mkdirSync(site.enquiriesDir, { recursive: true });
}

// Admin credentials
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH || '$2b$10$YGBgKUVVgGfcJim81fi74ugo5raH2ZmI5rxitHxQVJsfzt5yxSace';

app.use(express.json());

// ── Session middleware ──
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  }
}));

// ── Auth middleware ──
function requireSession(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    return res.redirect('/login.html');
  }
  return res.status(401).json({ error: 'Not authenticated' });
}

// ── Site validation middleware ──
function validateSite(req, res, next) {
  const site = SITES[req.params.site];
  if (!site) return res.status(400).json({ error: 'Unknown site' });
  req.site = site;
  next();
}

// ── Slug sanitisation helpers ──
function sanitiseSlug(slug) {
  return slug.replace(/[^a-zA-Z0-9_-]/g, '');
}

function sanitiseFrontmatterValue(value) {
  return (value || '').replace(/[\n\r]/g, ' ').trim();
}

// ── Build articles.json from .md frontmatter ──
function buildArticles(siteKey) {
  const site = SITES[siteKey];
  if (!site) return;
  const dir = site.articlesDir;
  const jsonPath = path.join(dir, 'articles.json');

  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  const articles = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf-8');
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) continue;

    const fm = {};
    for (const line of match[1].split('\n')) {
      const colon = line.indexOf(':');
      if (colon === -1) continue;
      fm[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
    }
    if (!fm.title || !fm.date) continue;

    articles.push({
      slug: path.basename(file, '.md'),
      title: fm.title,
      date: fm.date,
      author: fm.author || 'Holistic Governance',
      category: fm.category || 'General',
      featured: fm.featured === 'true',
      summary: fm.summary || ''
    });
  }

  articles.sort((a, b) => new Date(b.date) - new Date(a.date));
  fs.writeFileSync(jsonPath, JSON.stringify(articles, null, 2) + '\n');
  console.log(`[${siteKey}] Rebuilt articles.json — ${articles.length} articles`);
}

// ── Watch both sites' articles directories ──
for (const [key, site] of Object.entries(SITES)) {
  if (fs.existsSync(site.articlesDir)) {
    fs.watch(site.articlesDir, (event, filename) => {
      if (filename && filename.endsWith('.md')) {
        console.log(`[${key}] Detected change: ${filename}`);
        setTimeout(() => buildArticles(key), 200);
      }
    });
  }
}

// ── Public routes: login page ──
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// ── Auth routes ──
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (username !== ADMIN_USER) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const valid = await bcrypt.compare(password, ADMIN_PASS_HASH);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  req.session.authenticated = true;
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// ── Serve admin.html behind session auth ──
app.get('/admin.html', requireSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Serve all other static files (public pages like news.html, index.html, etc.)
app.use(express.static(__dirname));

// ══════════════════════════════════════════════
//  SITE-PARAMETERIZED API ROUTES (admin dashboard)
// ══════════════════════════════════════════════

// ── List articles (used by dashboard) ──
app.get('/api/:site/articles', validateSite, (req, res) => {
  const jsonPath = path.join(req.site.articlesDir, 'articles.json');
  if (!fs.existsSync(jsonPath)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(jsonPath, 'utf-8')));
});

// ── Get single article ──
app.get('/api/:site/articles/:slug', validateSite, (req, res) => {
  const safe = sanitiseSlug(req.params.slug);
  const filePath = path.join(req.site.articlesDir, safe + '.md');
  if (!filePath.startsWith(path.resolve(req.site.articlesDir))) return res.status(400).json({ error: 'Invalid slug' });
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

// ── Create/update article (auth required) ──
app.post('/api/:site/articles', requireSession, validateSite, (req, res) => {
  const { slug, title, date, author, category, featured, summary, body } = req.body;
  if (!slug || !title || !date) return res.status(400).json({ error: 'slug, title, date required' });

  const safeName = sanitiseSlug(slug);
  const frontmatter = [
    '---',
    `title: ${sanitiseFrontmatterValue(title)}`,
    `date: ${sanitiseFrontmatterValue(date)}`,
    `author: ${sanitiseFrontmatterValue(author) || 'Holistic Governance'}`,
    `category: ${sanitiseFrontmatterValue(category) || 'General'}`,
    `featured: ${featured ? 'true' : 'false'}`,
    `summary: ${sanitiseFrontmatterValue(summary)}`,
    '---'
  ].join('\n');

  const fileContent = frontmatter + '\n\n' + (body || '');
  fs.writeFileSync(path.join(req.site.articlesDir, safeName + '.md'), fileContent);
  buildArticles(req.params.site);
  res.json({ ok: true, slug: safeName });
});

// ── Delete article (auth required) ──
app.delete('/api/:site/articles/:slug', requireSession, validateSite, (req, res) => {
  const safe = sanitiseSlug(req.params.slug);
  const filePath = path.join(req.site.articlesDir, safe + '.md');
  if (!filePath.startsWith(path.resolve(req.site.articlesDir))) return res.status(400).json({ error: 'Invalid slug' });
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  fs.unlinkSync(filePath);
  buildArticles(req.params.site);
  res.json({ ok: true });
});

// ── List sector updates ──
app.get('/api/:site/updates', validateSite, (req, res) => {
  const updatesPath = path.join(req.site.articlesDir, 'updates.json');
  if (!fs.existsSync(updatesPath)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(updatesPath, 'utf-8')));
});

// ── Save sector updates (auth required) ──
app.post('/api/:site/updates', requireSession, validateSite, (req, res) => {
  const updates = req.body;
  fs.writeFileSync(path.join(req.site.articlesDir, 'updates.json'), JSON.stringify(updates, null, 2) + '\n');
  res.json({ ok: true });
});

// ── List enquiries (auth required) ──
app.get('/api/:site/enquiries', requireSession, validateSite, (req, res) => {
  if (!fs.existsSync(req.site.enquiriesDir)) return res.json([]);
  const files = fs.readdirSync(req.site.enquiriesDir).filter(f => f.endsWith('.json') && f !== 'subscribers.json');
  const enquiries = files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(req.site.enquiriesDir, f), 'utf-8'));
    return { ...data, _file: f };
  }).sort((a, b) => new Date(b.receivedAt || b.submittedAt || 0) - new Date(a.receivedAt || a.submittedAt || 0));
  res.json(enquiries);
});

// ── Delete enquiry (auth required) ──
app.delete('/api/:site/enquiries/:file', requireSession, validateSite, (req, res) => {
  const safe = req.params.file.replace(/[^a-zA-Z0-9_.-]/g, '');
  const filePath = path.join(req.site.enquiriesDir, safe);
  if (!filePath.startsWith(path.resolve(req.site.enquiriesDir))) return res.status(400).json({ error: 'Invalid file' });
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  fs.unlinkSync(filePath);
  res.json({ ok: true });
});

// ── List subscribers (auth required) ──
app.get('/api/:site/subscribers', requireSession, validateSite, (req, res) => {
  const subsFile = path.join(req.site.enquiriesDir, 'subscribers.json');
  if (!fs.existsSync(subsFile)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(subsFile, 'utf-8')));
});

// ══════════════════════════════════════════════
//  BACKWARD-COMPATIBLE PUBLIC ROUTES (for true-north public pages)
// ══════════════════════════════════════════════

const tnSite = SITES['true-north'];

app.get('/api/articles', (req, res) => {
  const jsonPath = path.join(tnSite.articlesDir, 'articles.json');
  if (!fs.existsSync(jsonPath)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(jsonPath, 'utf-8')));
});

app.get('/api/articles/:slug', (req, res) => {
  const safe = sanitiseSlug(req.params.slug);
  const filePath = path.join(tnSite.articlesDir, safe + '.md');
  if (!filePath.startsWith(path.resolve(tnSite.articlesDir))) return res.status(400).json({ error: 'Invalid slug' });
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

app.get('/api/updates', (req, res) => {
  const updatesPath = path.join(tnSite.articlesDir, 'updates.json');
  if (!fs.existsSync(updatesPath)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(updatesPath, 'utf-8')));
});

app.post('/api/enquiry', (req, res) => {
  const data = { ...req.body, receivedAt: new Date().toISOString() };
  const filename = `enquiry-${Date.now()}.json`;
  fs.writeFileSync(path.join(tnSite.enquiriesDir, filename), JSON.stringify(data, null, 2));
  console.log(`Enquiry received: ${filename}`);
  res.json({ ok: true });
});

app.post('/api/competitor-enquiry', (req, res) => {
  const data = { ...req.body, receivedAt: new Date().toISOString() };
  const filename = `competitor-enquiry-${Date.now()}.json`;
  fs.writeFileSync(path.join(tnSite.enquiriesDir, filename), JSON.stringify(data, null, 2));
  console.log(`Competitor enquiry received: ${filename}`);
  res.json({ ok: true });
});

app.post('/api/subscribe', (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  const subsFile = path.join(tnSite.enquiriesDir, 'subscribers.json');
  let subscribers = [];
  if (fs.existsSync(subsFile)) {
    subscribers = JSON.parse(fs.readFileSync(subsFile, 'utf-8'));
  }
  if (subscribers.some(s => s.email === email)) {
    return res.json({ ok: true, message: 'Already subscribed' });
  }
  subscribers.push({ email, subscribedAt: new Date().toISOString() });
  fs.writeFileSync(subsFile, JSON.stringify(subscribers, null, 2) + '\n');
  console.log(`New subscriber: ${email}`);
  res.json({ ok: true });
});

// ── Start ──
for (const key of Object.keys(SITES)) {
  buildArticles(key);
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Dashboard at    http://localhost:${PORT}/admin.html`);
  console.log(`Login at        http://localhost:${PORT}/login.html`);
  console.log(`Managing sites: ${Object.values(SITES).map(s => s.name).join(', ')}`);
});
