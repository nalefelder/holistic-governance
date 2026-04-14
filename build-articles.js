const fs = require('fs');
const path = require('path');

const articlesDir = path.join(__dirname, 'articles');
const outputFile = path.join(articlesDir, 'articles.json');
const SITE_URL = 'https://hg-au.com';

const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.md'));

const articles = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(articlesDir, file), 'utf-8');

  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
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

  const slug = path.basename(file, '.md');
  const meta = {
    slug,
    title: frontmatter.title,
    date: frontmatter.date,
    author: frontmatter.author || 'Holistic Governance',
    category: frontmatter.category || 'General',
    featured: frontmatter.featured === 'true',
    summary: frontmatter.summary || ''
  };

  articles.push(meta);

  const body = match[2] || '';
  const html = renderArticlePage(meta, body);
  fs.writeFileSync(path.join(articlesDir, `${slug}.html`), html);
}

articles.sort((a, b) => new Date(b.date) - new Date(a.date));

fs.writeFileSync(outputFile, JSON.stringify(articles, null, 2) + '\n');
console.log(`Built articles.json — ${articles.length} articles; generated ${articles.length} HTML pages`);

// ── Minimal markdown → HTML renderer (covers the subset used in articles) ──
function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  const inline = (s) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\s)_([^_]+)_(?=\s|$|[.,;:!?])/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*$/.test(line)) { i++; continue; }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    const para = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^#{1,6}\s/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
  }

  return out.join('\n');
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' });
}

function renderArticlePage(meta, body) {
  const bodyHtml = mdToHtml(body);
  const canonical = `${SITE_URL}/articles/${meta.slug}.html`;
  const ogTitle = `${meta.title} | Holistic Governance`;
  const description = meta.summary || meta.title;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: meta.title,
    description,
    author: { '@type': 'Organization', name: meta.author, url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name: 'Holistic Governance',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo-hg-trimmed.png` }
    },
    datePublished: meta.date,
    dateModified: meta.date,
    mainEntityOfPage: canonical,
    articleSection: meta.category,
    inLanguage: 'en-AU',
    url: canonical
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'News', item: `${SITE_URL}/news.html` },
      { '@type': 'ListItem', position: 3, name: meta.title, item: canonical }
    ]
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeAttr(ogTitle)}</title>
  <meta name="description" content="${escapeAttr(description)}" />
  <meta name="robots" content="index,follow" />
  <meta name="author" content="${escapeAttr(meta.author)}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Holistic Governance" />
  <meta property="og:locale" content="en_AU" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:title" content="${escapeAttr(ogTitle)}" />
  <meta property="og:description" content="${escapeAttr(description)}" />
  <meta property="og:image" content="${SITE_URL}/logo-hg-trimmed.png" />
  <meta property="article:published_time" content="${meta.date}" />
  <meta property="article:section" content="${escapeAttr(meta.category)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttr(ogTitle)}" />
  <meta name="twitter:description" content="${escapeAttr(description)}" />
  <meta name="twitter:image" content="${SITE_URL}/logo-hg-trimmed.png" />
  <link rel="icon" type="image/png" href="../favicon.png" />
  <link rel="preload" as="image" href="../logo-hg-trimmed.png" fetchpriority="high" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../styles.css" />
  <style>
    .article-page { padding: 10rem 4rem 5rem; background: var(--navy); max-width: 820px; margin: 0 auto; }
    .article-page .breadcrumb { margin-bottom: 2rem; }
    .article-page .article-tag { display: inline-block; padding: 0.3rem 0.8rem; background: rgba(56,189,248,0.08); border: 1px solid var(--border); color: var(--sky); font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; border-radius: 2px; margin-bottom: 1.2rem; }
    .article-page h1 { font-family: 'Cormorant Garamond', serif; font-size: clamp(2rem, 4vw, 3rem); font-weight: 300; color: var(--white); line-height: 1.15; margin-bottom: 1.2rem; }
    .article-page .article-meta { font-size: 0.82rem; color: var(--text-light); margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); }
    .article-page .article-meta span { color: var(--sky); }
    .article-body { color: #ffffff; font-size: 1rem; line-height: 1.9; }
    .article-body h2 { font-family: 'Cormorant Garamond', serif; font-size: 1.8rem; font-weight: 400; color: var(--white); margin: 2.5rem 0 1rem; }
    .article-body h3 { font-family: 'DM Sans', sans-serif; font-size: 1.15rem; font-weight: 500; color: var(--white); margin: 2rem 0 0.8rem; }
    .article-body p { margin-bottom: 1.2rem; }
    .article-body ul, .article-body ol { margin: 1rem 0 1.5rem 1.5rem; }
    .article-body li { margin-bottom: 0.5rem; }
    .article-body strong { color: var(--white); }
    .article-body a { color: var(--sky); text-decoration: underline; }
    .article-footer-nav { margin-top: 4rem; padding-top: 2rem; border-top: 1px solid var(--border); display: flex; gap: 1rem; flex-wrap: wrap; }
    .article-footer-nav a { color: var(--sky); text-decoration: none; font-size: 0.85rem; letter-spacing: 0.06em; text-transform: uppercase; border: 1px solid var(--border); padding: 0.8rem 1.6rem; border-radius: 2px; transition: all 0.3s; }
    .article-footer-nav a:hover { background: var(--sky); color: var(--navy); }
    @media (max-width: 900px) { .article-page { padding: 8rem 1.5rem 3rem; } }
  </style>
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>
  <script type="application/ld+json">
${JSON.stringify(breadcrumb, null, 2)}
  </script>
</head>
<body>

<nav>
  <a href="../index.html" class="logo"><img src="../logo-hg-trimmed.png" alt="Holistic Governance" width="351" height="524"><span class="logo-name">Holistic <span>Governance</span></span></a>
  <button class="hamburger" onclick="this.nextElementSibling.classList.toggle('open')">&#9776;</button>
  <ul>
    <li><a href="../about.html">About</a></li>
    <li><a href="../healthcare.html">Solutions</a></li>
    <li><a href="../resources.html">Resources</a></li>
    <li class="nav-contact-wrapper">
      <button class="nav-cta" onclick="this.nextElementSibling.classList.toggle('open')">Contact</button>
      <div class="nav-contact-popup">
        <a href="tel:0405515300">0405 515 300</a>
        <a href="mailto:naomi@hg-au.com">naomi@hg-au.com</a>
        <a href="../proposal-enquiry.html">Submit a Proposal</a>
      </div>
    </li>
  </ul>
</nav>

<article class="article-page">
  <div class="breadcrumb"><a href="../index.html">Home</a> / <a href="../news.html">News</a> / ${escapeAttr(meta.title)}</div>
  <div class="article-tag">${escapeAttr(meta.category)}</div>
  <h1>${escapeAttr(meta.title)}</h1>
  <div class="article-meta"><span>${formatDate(meta.date)}</span> &middot; ${escapeAttr(meta.author)}</div>
  <div class="article-body">
${bodyHtml}
  </div>
  <nav class="article-footer-nav" aria-label="Article navigation">
    <a href="../news.html">&larr; All articles</a>
    <a href="../proposal-enquiry.html">Request a Proposal</a>
    <a href="../healthcare.html">Our Solutions</a>
  </nav>
</article>

<footer>
  <div class="footer-inner">
    <div class="footer-brand">
      <div class="footer-logo"><img src="../logo-hg-trimmed.png" alt="Holistic Governance" width="351" height="524"><span class="logo-name">Holistic <span>Governance</span></span></div>
      <p class="footer-tagline">Improving clarity and confidence in governance through knowledge, data, and technology.</p>
    </div>
    <div class="footer-col">
      <h4>Navigate</h4>
      <ul>
        <li><a href="../index.html">Home</a></li>
        <li><a href="../about.html">About</a></li>
        <li><a href="../healthcare.html">Solutions</a></li>
        <li><a href="../resources.html">Resources</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4>Get in Touch</h4>
      <div class="footer-contact-item"><a href="mailto:naomi@hg-au.com">naomi@hg-au.com</a></div>
      <div class="footer-contact-item"><a href="tel:0405515300">0405 515 300</a></div>
      <div class="footer-contact-item" style="margin-top: 0.5rem;"><a href="../proposal-enquiry.html">Request a Proposal</a></div>
    </div>
    <div class="footer-col">
      <h4>Where We Work</h4>
      <ul><li>Australia</li><li>New Zealand</li></ul>
      <p style="font-size:0.8rem; color:var(--text-light); margin-top:0.8rem;">Remote &amp; on-site delivery</p>
    </div>
  </div>
  <div class="footer-bottom"><p>&copy; 2026 Holistic Governance. All rights reserved.</p></div>
</footer>

<script>
document.addEventListener('click', function(e) {
  document.querySelectorAll('.nav-contact-popup.open').forEach(function(popup) {
    if (!popup.parentElement.contains(e.target)) popup.classList.remove('open');
  });
});
window.addEventListener('scroll', function() {
  document.querySelector('nav').classList.toggle('scrolled', window.scrollY > 60);
});
</script>
</body>
</html>
`;
}
