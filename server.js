require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { buildAll } = require('./build-articles');

const app = express();
const PORT = 3000;

const articlesDir = path.join(__dirname, 'articles');
const enquiriesDir = path.join(__dirname, 'enquiries');

if (!fs.existsSync(enquiriesDir)) fs.mkdirSync(enquiriesDir, { recursive: true });

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH || '$2b$10$YGBgKUVVgGfcJim81fi74ugo5raH2ZmI5rxitHxQVJsfzt5yxSace';

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    maxAge: 8 * 60 * 60 * 1000
  }
}));

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
  fs.watch(articlesDir, (event, filename) => {
    if (filename && filename.endsWith('.md')) {
      console.log(`Detected change: ${filename}`);
      setTimeout(rebuildArticles, 200);
    }
  });
}

// ── Public routes ──
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

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
  fs.writeFileSync(path.join(articlesDir, safeName + '.md'), fileContent);

  rebuildArticles();
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
