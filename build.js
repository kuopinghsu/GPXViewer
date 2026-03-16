const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const projectRoot = __dirname;
const srcDir = path.join(projectRoot, 'src');
const distDir = path.join(projectRoot, 'dist');
const outFile = path.join(projectRoot, 'index.html');
const outDistFile = path.join(distDir, 'index.html');

const LEAFLET_CSS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

// SHA-256 hashes of the expected Leaflet 1.9.4 assets.
// Run `node build.js --trust-hashes` once after a version update to regenerate them.
const EXPECTED_HASHES = {
  [LEAFLET_CSS_URL]: 'a7837102824184820dfa198d1ebcd109ff6d0ff9a2672a074b9a1b4d147d04c6',
  [LEAFLET_JS_URL]: 'db49d009c841f5ca34a888c96511ae936fd9f5533e90d8b2c4d57596f4e5641a'
};

const trustHashes = process.argv.includes('--trust-hashes');

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
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
    console.warn(`Warning: no expected hash configured for ${url}. Update EXPECTED_HASHES in build.js.`);
    return;
  }
  if (actual !== expected) {
    throw new Error(
      `CDN asset integrity check failed for ${url}.\n  Expected: ${expected}\n  Actual:   ${actual}\n\nIf this is a legitimate update, run with --trust-hashes to regenerate stored hashes.`
    );
  }
}

async function build() {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const template = fs.readFileSync(path.join(srcDir, 'template.html'), 'utf8');
  const appCss = fs.readFileSync(path.join(srcDir, 'styles.css'), 'utf8');
  const appJs = fs.readFileSync(path.join(srcDir, 'main.js'), 'utf8');

  const [leafletCss, leafletJs] = await Promise.all([
    fetchText(LEAFLET_CSS_URL),
    fetchText(LEAFLET_JS_URL)
  ]);

  if (trustHashes) {
    const cssHash = crypto.createHash('sha256').update(leafletCss).digest('hex');
    const jsHash = crypto.createHash('sha256').update(leafletJs).digest('hex');
    console.log('Fetched hashes (update EXPECTED_HASHES with these values):');
    console.log(`  ${LEAFLET_CSS_URL}: ${cssHash}`);
    console.log(`  ${LEAFLET_JS_URL}: ${jsHash}`);
  } else {
    verifyHash(LEAFLET_CSS_URL, leafletCss);
    verifyHash(LEAFLET_JS_URL, leafletJs);
  }

  const html = template
    .replace('/*__LEAFLET_CSS__*/', leafletCss)
    .replace('/*__APP_CSS__*/', appCss)
    .replace('/*__LEAFLET_JS__*/', leafletJs)
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
