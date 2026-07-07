const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://hg-au.com';
const DEFAULT_OG_IMAGE = 'og-image-v3.png';

// AI & App Development pages are archived — all categories point to healthcare only.
const SOLUTIONS_BY_CATEGORY = {
  'Health Care':          ['healthcare'],
  'Compliance':           ['healthcare'],
  'Industry News':        ['healthcare'],
  'Data Governance':      ['healthcare'],
  'Competitor Analytics': ['healthcare']
};

const SOLUTION_LABELS = {
  'healthcare':      'Healthcare Governance',
  'ai-technology':   'AI &amp; Technology Governance',
  'app-development': 'Healthcare App Development'
};

function renderRelatedSolutions(category) {
  const keys = SOLUTIONS_BY_CATEGORY[category] || ['healthcare'];
  const items = keys.map(k =>
    `      <li><a href="../${k}.html">${SOLUTION_LABELS[k]}</a></li>`
  ).join('\n');
  return `  <aside class="related-solutions" aria-label="Related solutions">
    <h2>Related Solutions</h2>
    <ul>
${items}
    </ul>
  </aside>`;
}

function renderAuthorBio() {
  return `  <aside class="author-bio" aria-label="About the author">
    <div class="author-bio-header">
      <img src="../headshotimage.png" alt="Naomi Alefelder" width="96" height="96" />
      <div>
        <h2>About the author</h2>
        <p class="author-bio-role">Naomi Alefelder &middot; Founding Director, Holistic Governance</p>
      </div>
    </div>
    <p>Registered nurse and governance specialist with over a decade of senior leadership across aged care, hospital, day surgery, disability and community health. MBA (Charles Sturt University), AICD Foundations of Directorship, Lead Auditor (Exemplar Global). Board Director, Caladenia Dementia Care.</p>
    <p class="author-bio-links"><a href="../about.html">More about Naomi</a> &middot; <a href="https://www.linkedin.com/in/naomi-alefelder" target="_blank" rel="noopener">LinkedIn</a> &middot; <a href="../proposal-enquiry.html">Request a proposal</a></p>
  </aside>`;
}

function renderTakeaways(takeaways) {
  if (!takeaways || takeaways.length === 0) return '';
  const items = takeaways.map(t => `      <li>${inlineEscape(t)}</li>`).join('\n');
  return `  <aside class="key-takeaways" id="key-takeaways" aria-label="Key takeaways">
    <h2>Key takeaways</h2>
    <ul>
${items}
    </ul>
  </aside>`;
}

function inlineEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Pull the first `## Key takeaways` section out of the body and return both
// the takeaway strings and the remaining body (with that section removed).
function extractTakeaways(body) {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  let startIdx = -1;
  let endIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+key\s+takeaways?\s*$/i.test(lines[i])) {
      startIdx = i;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^#{1,2}\s+/.test(lines[j])) {
          endIdx = j;
          break;
        }
      }
      if (endIdx === -1) endIdx = lines.length;
      break;
    }
  }

  if (startIdx === -1) return { takeaways: [], remainingBody: body };

  const sectionLines = lines.slice(startIdx + 1, endIdx);
  const takeaways = [];
  for (const line of sectionLines) {
    const m = line.match(/^\s*[-*]\s+(.*)$/);
    if (m) takeaways.push(m[1].trim());
  }

  const remainingBodyLines = [...lines.slice(0, startIdx), ...lines.slice(endIdx)];
  return { takeaways, remainingBody: remainingBodyLines.join('\n') };
}

function buildAll(articlesDir) {
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
      dateModified: frontmatter.dateModified || frontmatter.date,
      author: frontmatter.author || 'Naomi Alefelder',
      category: frontmatter.category || 'General',
      featured: frontmatter.featured === 'true',
      summary: frontmatter.summary || '',
      ogImage: frontmatter.og_image || frontmatter.ogImage || DEFAULT_OG_IMAGE
    };

    articles.push(meta);

    const body = match[2] || '';
    const { takeaways, remainingBody } = extractTakeaways(body);
    const html = renderArticlePage(meta, remainingBody, takeaways);
    fs.writeFileSync(path.join(articlesDir, `${slug}.html`), html);
  }

  articles.sort((a, b) => new Date(b.date) - new Date(a.date));
  fs.writeFileSync(path.join(articlesDir, 'articles.json'), JSON.stringify(articles, null, 2) + '\n');
  return articles;
}

if (require.main === module) {
  const articlesDir = path.join(__dirname, 'articles');
  const articles = buildAll(articlesDir);
  console.log(`Built articles.json — ${articles.length} articles; generated ${articles.length} HTML pages`);
}

module.exports = { renderArticlePage, mdToHtml, escapeAttr, formatDate, buildAll, extractTakeaways, SITE_URL };

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

function renderArticlePage(meta, body, takeaways = []) {
  const bodyHtml = mdToHtml(body);
  const canonical = `${SITE_URL}/articles/${meta.slug}.html`;
  const ogTitle = `${meta.title} | Holistic Governance`;
  const description = meta.summary || meta.title;
  const ogImageUrl = meta.ogImage.startsWith('http')
    ? meta.ogImage
    : `${SITE_URL}/${meta.ogImage.replace(/^\/+/, '')}`;
  const dateModified = meta.dateModified || meta.date;
  const takeawaysHtml = renderTakeaways(takeaways);

  const speakableSelectors = ['.article-page h1', '.article-meta'];
  if (takeaways.length > 0) speakableSelectors.push('#key-takeaways');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: meta.title,
    description,
    image: ogImageUrl,
    author: {
      '@type': 'Person',
      '@id': `${SITE_URL}/about.html#naomi`,
      name: 'Naomi Alefelder',
      url: `${SITE_URL}/about.html`
    },
    publisher: {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Holistic Governance',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo-hg-trimmed.png` }
    },
    datePublished: meta.date,
    dateModified,
    mainEntityOfPage: canonical,
    articleSection: meta.category,
    inLanguage: 'en-AU',
    url: canonical,
    isPartOf: { '@id': `${SITE_URL}/#website` }
  };

  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${canonical}#webpage`,
    url: canonical,
    name: ogTitle,
    description,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    primaryImageOfPage: ogImageUrl,
    inLanguage: 'en-AU',
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: speakableSelectors
    }
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Resources', item: `${SITE_URL}/resources.html` },
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
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:image:width" content="2400" />
  <meta property="og:image:height" content="1260" />
  <meta property="article:published_time" content="${meta.date}" />
  <meta property="article:modified_time" content="${dateModified}" />
  <meta property="article:section" content="${escapeAttr(meta.category)}" />
  <meta property="article:author" content="${escapeAttr(meta.author)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttr(ogTitle)}" />
  <meta name="twitter:description" content="${escapeAttr(description)}" />
  <meta name="twitter:image" content="${ogImageUrl}" />
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
    .key-takeaways { margin: 0 0 2.5rem; padding: 1.5rem 1.75rem; background: rgba(56,189,248,0.06); border: 1px solid rgba(56,189,248,0.25); border-left: 3px solid var(--sky); border-radius: 4px; }
    .key-takeaways h2 { font-family: 'Cormorant Garamond', serif; font-size: 1.25rem; font-weight: 500; color: var(--white); margin: 0 0 0.75rem; letter-spacing: 0.02em; }
    .key-takeaways ul { list-style: none; padding: 0; margin: 0; }
    .key-takeaways li { color: #ffffff; font-size: 0.95rem; line-height: 1.6; padding: 0.4rem 0 0.4rem 1.5rem; position: relative; }
    .key-takeaways li::before { content: '→'; position: absolute; left: 0; top: 0.4rem; color: var(--sky); font-weight: 600; }
    .related-solutions { margin-top: 3.5rem; padding: 1.75rem; background: rgba(56,189,248,0.04); border: 1px solid var(--border); border-radius: 4px; }
    .related-solutions h2 { font-family: 'Cormorant Garamond', serif; font-size: 1.3rem; font-weight: 400; color: var(--white); margin: 0 0 0.9rem; }
    .related-solutions ul { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 0.6rem; }
    .related-solutions li { margin: 0; }
    .related-solutions a { display: inline-block; color: var(--sky); font-size: 0.9rem; text-decoration: none; border: 1px solid rgba(56,189,248,0.3); padding: 0.5rem 1rem; border-radius: 2px; transition: all 0.2s; }
    .related-solutions a:hover { background: rgba(56,189,248,0.12); border-color: var(--sky); }
    .author-bio { margin-top: 2.5rem; padding: 1.75rem; background: var(--navy-mid); border: 1px solid var(--border); border-radius: 4px; }
    .author-bio-header { display: flex; align-items: center; gap: 1.25rem; margin-bottom: 1rem; }
    .author-bio-header img { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border); flex-shrink: 0; }
    .author-bio-header h2 { font-family: 'Cormorant Garamond', serif; font-size: 1.3rem; font-weight: 400; color: var(--white); margin: 0 0 0.2rem; }
    .author-bio-role { font-size: 0.82rem; color: var(--sky); margin: 0; letter-spacing: 0.04em; }
    .author-bio p { font-size: 0.92rem; color: #ffffff; line-height: 1.7; margin: 0 0 0.8rem; }
    .author-bio-links a { color: var(--sky); text-decoration: none; border-bottom: 1px solid rgba(56,189,248,0.4); }
    .author-bio-links a:hover { border-bottom-color: var(--sky); }
    .article-footer-nav { position: static; background: none; backdrop-filter: none; border-bottom: none; z-index: auto; margin-top: 2.5rem; padding: 2rem 0 0; border-top: 1px solid var(--border); display: flex; align-items: flex-start; justify-content: flex-start; gap: 1rem; flex-wrap: wrap; }
    .article-footer-nav a { color: var(--sky); text-decoration: none; font-size: 0.85rem; letter-spacing: 0.06em; text-transform: uppercase; border: 1px solid var(--border); padding: 0.8rem 1.6rem; border-radius: 2px; transition: all 0.3s; }
    .article-footer-nav a:hover { background: var(--sky); color: var(--navy); }
    @media (max-width: 900px) { .article-page { padding: 8rem 1.5rem 3rem; } }
  </style>
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>
  <script type="application/ld+json">
${JSON.stringify(webPage, null, 2)}
  </script>
  <script type="application/ld+json">
${JSON.stringify(breadcrumb, null, 2)}
  </script>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-9PMGXF9Q9T"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-9PMGXF9Q9T');
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
        <a href="mailto:info@hg-au.com">info@hg-au.com</a>
        <a href="../proposal-enquiry.html">Submit a Proposal</a>
      </div>
    </li>
  </ul>
</nav>

<article class="article-page">
  <div class="breadcrumb"><a href="../index.html">Home</a> / <a href="../resources.html">Resources</a> / ${escapeAttr(meta.title)}</div>
  <div class="article-tag">${escapeAttr(meta.category)}</div>
  <h1>${escapeAttr(meta.title)}</h1>
  <div class="article-meta"><span>${formatDate(meta.date)}</span>${dateModified !== meta.date ? ` &middot; Updated ${formatDate(dateModified)}` : ''} &middot; ${escapeAttr(meta.author)}</div>
${takeawaysHtml}
  <div class="article-body">
${bodyHtml}
  </div>
${renderAuthorBio()}
${renderRelatedSolutions(meta.category)}
  <nav class="article-footer-nav" aria-label="Article navigation">
    <a href="../resources.html">&larr; All articles</a>
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
      <div class="footer-contact-item"><a href="mailto:info@hg-au.com">info@hg-au.com</a></div>
      <div class="footer-contact-item"><a href="tel:0405515300">0405 515 300</a></div>
      <div class="footer-contact-item" style="margin-top: 0.5rem;"><a href="../proposal-enquiry.html">Request a Proposal</a></div>
      <div class="footer-contact-item"><a href="https://www.linkedin.com/company/hg-au/" target="_blank" rel="noopener">LinkedIn</a></div>
    </div>
    <div class="footer-col">
      <h4>Where We Work</h4>
      <address style="font-style:normal; font-size:0.85rem; line-height:1.6; color:var(--text); margin-bottom:0.6rem;">Heidelberg, Victoria, Australia</address>
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
