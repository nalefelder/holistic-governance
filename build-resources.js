const fs = require('fs');
const path = require('path');
const https = require('https');

const SITE_URL = 'https://hg-au.com';
const API_URL = 'https://hg-proposals-1010766137344.australia-southeast1.run.app/api/holistic-governance/resources';
const HTML_PATH = path.join(__dirname, 'resources.html');

const TYPE_ICONS = {
  'Standard': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>',
  'Framework': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  'Best Practice': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
  'White Paper': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
  'Regulatory': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>'
};

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s) { return escapeHtml(s); }

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 20000 }, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`${url} returned ${res.statusCode}`));
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject).on('timeout', function () { this.destroy(new Error('timeout')); });
  });
}

function renderCard(r) {
  const icon = TYPE_ICONS[r.type] || TYPE_ICONS['Standard'];
  const cats = (r.sectors || [])
    .map((s) => `<span class="resource-cat">${escapeHtml(s)}</span>`)
    .join('');
  const url = escapeAttr(r.url || '#');
  return `<div class="resource-card">
  <div class="resource-card-header">
    <div class="resource-icon">${icon}</div>
    <div><span class="resource-type-label">${escapeHtml(r.type || 'Resource')}</span></div>
  </div>
  <h4>${escapeHtml(r.title || '')}</h4>
  <p>${escapeHtml(r.description || '')}</p>
  <div class="resource-meta">${escapeHtml(r.source || '')}</div>
  <div class="resource-categories">${cats}</div>
  <a href="${url}" target="_blank" rel="noopener" class="resource-link">View Resource &rarr;</a>
</div>`;
}

function renderJsonLd(resources) {
  const items = resources.map((r, i) => ({
    '@type': 'ListItem',
    'position': i + 1,
    'item': {
      '@type': 'LearningResource',
      'name': r.title || '',
      'description': r.description || '',
      'url': r.url || '',
      'learningResourceType': r.type || 'Resource',
      'about': r.sectors || [],
      ...(r.source ? { 'provider': { '@type': 'Organization', 'name': r.source } } : {})
    }
  }));
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'name': 'Holistic Governance Resource Library',
    'description': 'Curated standards, frameworks, white papers, and best practice documents for board directors, governance professionals, and healthcare leaders.',
    'url': `${SITE_URL}/resources.html`,
    'numberOfItems': resources.length,
    'itemListElement': items
  };
  return `<script type="application/ld+json">
${JSON.stringify(payload, null, 2)}
</script>`;
}

function replaceBetweenMarkers(html, startMarker, endMarker, replacement) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  if (start === -1 || end === -1) {
    throw new Error(`Markers not found: ${startMarker} / ${endMarker}`);
  }
  return html.slice(0, start + startMarker.length) + '\n' + replacement + '\n  ' + html.slice(end);
}

async function main() {
  console.log(`[build-resources] fetching ${API_URL}`);
  let resources;
  try {
    resources = await fetchJson(API_URL);
  } catch (e) {
    console.error(`[build-resources] fetch failed: ${e.message}`);
    process.exit(1);
  }
  if (!Array.isArray(resources)) {
    console.error('[build-resources] API did not return an array');
    process.exit(1);
  }
  console.log(`[build-resources] ${resources.length} resources fetched`);

  const sorted = resources.slice().sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));

  const gridHtml = sorted.map(renderCard).join('\n');
  const jsonLd = renderJsonLd(sorted);

  let html = fs.readFileSync(HTML_PATH, 'utf-8');
  html = replaceBetweenMarkers(
    html,
    '<!-- RESOURCES_GRID_START -->',
    '<!-- RESOURCES_GRID_END -->',
    `<div class="resources-grid" id="resourcesGrid">\n${gridHtml}\n  </div>`
  );
  html = replaceBetweenMarkers(
    html,
    '<!-- RESOURCES_JSONLD_START -->',
    '<!-- RESOURCES_JSONLD_END -->',
    jsonLd
  );

  fs.writeFileSync(HTML_PATH, html);
  console.log(`[build-resources] wrote ${HTML_PATH} (grid: ${sorted.length} cards, JSON-LD: ${sorted.length} items)`);
}

main();
