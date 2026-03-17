const fs = require('fs');
const path = require('path');

const articlesDir = path.join(__dirname, 'articles');
const outputFile = path.join(articlesDir, 'articles.json');

const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.md'));

const articles = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(articlesDir, file), 'utf-8');

  // Parse frontmatter between --- markers
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) {
    console.warn(`Skipping ${file} — no frontmatter found`);
    continue;
  }

  const frontmatter = {};
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    frontmatter[key] = value;
  }

  if (!frontmatter.title || !frontmatter.date) {
    console.warn(`Skipping ${file} — missing title or date`);
    continue;
  }

  articles.push({
    slug: path.basename(file, '.md'),
    title: frontmatter.title,
    date: frontmatter.date,
    author: frontmatter.author || 'Holistic Governance',
    category: frontmatter.category || 'General',
    featured: frontmatter.featured === 'true',
    summary: frontmatter.summary || ''
  });
}

// Sort by date, newest first
articles.sort((a, b) => new Date(b.date) - new Date(a.date));

fs.writeFileSync(outputFile, JSON.stringify(articles, null, 2) + '\n');
console.log(`Built articles.json — ${articles.length} articles found`);
