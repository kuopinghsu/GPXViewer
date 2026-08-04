const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const zlib = require('zlib');

const projectRoot = __dirname;
const srcDir = path.join(projectRoot, 'src');
const distDir = path.join(projectRoot, 'dist');
const outFile = path.join(projectRoot, 'index.html');
const outDistFile = path.join(distDir, 'index.html');

const LEAFLET_CSS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const MAPLIBRE_CSS_URL = 'https://unpkg.com/maplibre-gl@5.23.0/dist/maplibre-gl.css';
const MAPLIBRE_JS_URL = 'https://unpkg.com/maplibre-gl@5.23.0/dist/maplibre-gl.js';

// SHA-256 hashes of the expected CDN assets.
// Run `node build.js --trust-hashes` once after a version update to regenerate them.
const EXPECTED_HASHES = {
  [LEAFLET_CSS_URL]: 'a7837102824184820dfa198d1ebcd109ff6d0ff9a2672a074b9a1b4d147d04c6',
  [LEAFLET_JS_URL]: 'db49d009c841f5ca34a888c96511ae936fd9f5533e90d8b2c4d57596f4e5641a',
  [MAPLIBRE_CSS_URL]: 'ab1e70d59ec40465bae7e7030da2f3ccf28133fd502e62bd598eefbadfd7a732',
  [MAPLIBRE_JS_URL]: 'e5b398823af45165124aef0b7e43ade5e1fc28d22807a5646da3ba38b8bfdc55'
};

const trustHashes = process.argv.includes('--trust-hashes');

function fetchText(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          if (redirectsLeft <= 0) {
            reject(new Error(`Too many redirects fetching ${url}`));
            return;
          }
          const next = new URL(res.headers.location, url).href;
          res.resume();
          resolve(fetchText(next, redirectsLeft - 1));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to fetch ${url}: status ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      })
      .on('error', reject);
  });
}

function verifyHash(url, content) {
  const actual = crypto.createHash('sha256').update(content).digest('hex');
  const expected = EXPECTED_HASHES[url];
  if (!expected) {
    if (trustHashes) return actual;
    console.warn(`Warning: no expected hash configured for ${url}. Update EXPECTED_HASHES in build.js.`);
    return actual;
  }
  if (actual !== expected) {
    throw new Error(
      `CDN asset integrity check failed for ${url}.\n  Expected: ${expected}\n  Actual:   ${actual}\n\nIf this is a legitimate update, run with --trust-hashes to regenerate stored hashes.`
    );
  }
  return actual;
}

async function build() {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const template = fs.readFileSync(path.join(srcDir, 'template.html'), 'utf8');
  const appCss = fs.readFileSync(path.join(srcDir, 'styles.css'), 'utf8');
  let appJs = fs.readFileSync(path.join(srcDir, 'main.js'), 'utf8');

  const demoGpxPath = path.join(projectRoot, 'examples', 'spain.gpx');
  if (!fs.existsSync(demoGpxPath)) {
    throw new Error(`Demo GPX not found: ${demoGpxPath}`);
  }
  const demoGpxGz = zlib.gzipSync(fs.readFileSync(demoGpxPath));
  const demoGpxB64 = demoGpxGz.toString('base64');
  appJs = appJs.replace('/*__DEMO_GPX_B64__*/', demoGpxB64);

  const assetUrls = [LEAFLET_CSS_URL, LEAFLET_JS_URL, MAPLIBRE_CSS_URL, MAPLIBRE_JS_URL];
  const [leafletCss, leafletJs, maplibreCss, maplibreJs] = await Promise.all(
    assetUrls.map((url) => fetchText(url))
  );
  const assets = [
    [LEAFLET_CSS_URL, leafletCss],
    [LEAFLET_JS_URL, leafletJs],
    [MAPLIBRE_CSS_URL, maplibreCss],
    [MAPLIBRE_JS_URL, maplibreJs]
  ];

  if (trustHashes) {
    console.log('Fetched hashes (update EXPECTED_HASHES with these values):');
    for (const [url, content] of assets) {
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      console.log(`  '${url}': '${hash}',`);
    }
  } else {
    for (const [url, content] of assets) {
      verifyHash(url, content);
    }
  }

  const html = template
    .replace('/*__LEAFLET_CSS__*/', leafletCss)
    .replace('/*__MAPLIBRE_CSS__*/', maplibreCss)
    .replace('/*__APP_CSS__*/', appCss)
    .replace('/*__LEAFLET_JS__*/', leafletJs)
    .replace('/*__MAPLIBRE_JS__*/', maplibreJs)
    .replace('/*__APP_JS__*/', appJs);

  fs.writeFileSync(outFile, html, 'utf8');
  fs.writeFileSync(outDistFile, html, 'utf8');

  console.log('Build complete:');
  console.log(`- ${outFile}`);
  console.log(`- ${outDistFile}`);
}

build().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
