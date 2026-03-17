const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const articlesDir = path.join(__dirname, 'articles');
const articlesJson = path.join(articlesDir, 'articles.json');

app.use(express.json());
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
    setTimeout(buildArticles, 200); // small delay for file write to finish
  }
});

// ── API: List all articles ──
app.get('/api/articles', (req, res) => {
  const articles = JSON.parse(fs.readFileSync(articlesJson, 'utf-8'));
  res.json(articles);
});

// ── API: Get single article content ──
app.get('/api/articles/:slug', (req, res) => {
  const filePath = path.join(articlesDir, req.params.slug + '.md');
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });

  const content = fs.readFileSync(filePath, 'utf-8');
  const body = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');

  // Parse frontmatter
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  const fm = {};
  if (match) {
    for (const line of match[1].split('\n')) {
      const colon = line.indexOf(':');
      if (colon === -1) continue;
      fm[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
    }
  }

  res.json({ ...fm, slug: req.params.slug, body });
});

// ── API: Create or update article ──
app.post('/api/articles', (req, res) => {
  const { slug, title, date, author, category, featured, summary, body } = req.body;
  if (!slug || !title || !date) return res.status(400).json({ error: 'slug, title, date required' });

  const safeName = slug.replace(/[^a-zA-Z0-9_-]/g, '');
  const frontmatter = [
    '---',
    `title: ${title}`,
    `date: ${date}`,
    `author: ${author || 'Holistic Governance'}`,
    `category: ${category || 'General'}`,
    `featured: ${featured ? 'true' : 'false'}`,
    `summary: ${summary || ''}`,
    '---'
  ].join('\n');

  const fileContent = frontmatter + '\n\n' + (body || '');
  fs.writeFileSync(path.join(articlesDir, safeName + '.md'), fileContent);
  buildArticles();
  res.json({ ok: true, slug: safeName });
});

// ── API: Delete article ──
app.delete('/api/articles/:slug', (req, res) => {
  const filePath = path.join(articlesDir, req.params.slug + '.md');
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  fs.unlinkSync(filePath);
  buildArticles();
  res.json({ ok: true });
});

// ── API: List sector updates ──
app.get('/api/updates', (req, res) => {
  const updates = JSON.parse(fs.readFileSync(path.join(articlesDir, 'updates.json'), 'utf-8'));
  res.json(updates);
});

// ── API: Save sector updates ──
app.post('/api/updates', (req, res) => {
  const updates = req.body;
  fs.writeFileSync(path.join(articlesDir, 'updates.json'), JSON.stringify(updates, null, 2) + '\n');
  res.json({ ok: true });
});

// ── Start ──
buildArticles();
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Admin panel at  http://localhost:${PORT}/admin.html`);
  console.log(`Watching articles/ for changes...`);
});
