const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const articlesDir = path.join(__dirname, 'articles');
const articlesJson = path.join(articlesDir, 'articles.json');
const enquiriesDir = path.join(__dirname, 'enquiries');

// Create enquiries directory if it doesn't exist
if (!fs.existsSync(enquiriesDir)) fs.mkdirSync(enquiriesDir);

// Admin credentials — change these or set via environment variables
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'HolisticGov2026!';

app.use(express.json());

// ── Basic auth middleware for admin routes ──
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).json({ error: 'Authentication required' });
  }
  const decoded = Buffer.from(auth.split(' ')[1], 'base64').toString();
  const [user, pass] = decoded.split(':');
  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Admin"');
  return res.status(401).json({ error: 'Invalid credentials' });
}

// ── Slug sanitisation helper ──
function sanitiseSlug(slug) {
  return slug.replace(/[^a-zA-Z0-9_-]/g, '');
}

function sanitiseFrontmatterValue(value) {
  return (value || '').replace(/[\n\r]/g, ' ').trim();
}

// ── Serve admin.html behind auth ──
app.get('/admin.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Serve all other static files
app.use(express.static(__dirname));

// ── Build articles.json from .md frontmatter ──
function buildArticles() {
  const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.md'));
  const articles = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(articlesDir, file), 'utf-8');
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
  fs.writeFileSync(articlesJson, JSON.stringify(articles, null, 2) + '\n');
  console.log(`Rebuilt articles.json — ${articles.length} articles`);
}

// ── Watch for .md file changes ──
fs.watch(articlesDir, (event, filename) => {
  if (filename && filename.endsWith('.md')) {
    console.log(`Detected change: ${filename}`);
    setTimeout(buildArticles, 200);
  }
});

// ── API: List all articles (public) ──
app.get('/api/articles', (req, res) => {
  const articles = JSON.parse(fs.readFileSync(articlesJson, 'utf-8'));
  res.json(articles);
});

// ── API: Get single article content (public) ──
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

// ── API: Create or update article (auth required) ──
app.post('/api/articles', requireAuth, (req, res) => {
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
  fs.writeFileSync(path.join(articlesDir, safeName + '.md'), fileContent);
  buildArticles();
  res.json({ ok: true, slug: safeName });
});

// ── API: Delete article (auth required) ──
app.delete('/api/articles/:slug', requireAuth, (req, res) => {
  const safe = sanitiseSlug(req.params.slug);
  const filePath = path.join(articlesDir, safe + '.md');
  if (!filePath.startsWith(path.resolve(articlesDir))) return res.status(400).json({ error: 'Invalid slug' });
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  fs.unlinkSync(filePath);
  buildArticles();
  res.json({ ok: true });
});

// ── API: List sector updates (public) ──
app.get('/api/updates', (req, res) => {
  const updates = JSON.parse(fs.readFileSync(path.join(articlesDir, 'updates.json'), 'utf-8'));
  res.json(updates);
});

// ── API: Save sector updates (auth required) ──
app.post('/api/updates', requireAuth, (req, res) => {
  const updates = req.body;
  fs.writeFileSync(path.join(articlesDir, 'updates.json'), JSON.stringify(updates, null, 2) + '\n');
  res.json({ ok: true });
});

// ── API: Receive enquiry forms ──
app.post('/api/enquiry', (req, res) => {
  const data = { ...req.body, receivedAt: new Date().toISOString() };
  const filename = `enquiry-${Date.now()}.json`;
  fs.writeFileSync(path.join(enquiriesDir, filename), JSON.stringify(data, null, 2));
  console.log(`Enquiry received: ${filename}`);
  res.json({ ok: true });
});

app.post('/api/competitor-enquiry', (req, res) => {
  const data = { ...req.body, receivedAt: new Date().toISOString() };
  const filename = `competitor-enquiry-${Date.now()}.json`;
  fs.writeFileSync(path.join(enquiriesDir, filename), JSON.stringify(data, null, 2));
  console.log(`Competitor enquiry received: ${filename}`);
  res.json({ ok: true });
});

// ── Start ──
buildArticles();
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Admin panel at  http://localhost:${PORT}/admin.html`);
  console.log(`Watching articles/ for changes...`);
});
