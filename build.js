const fs = require('fs');
const path = require('path');
const https = require('https');

const projectRoot = __dirname;
const srcDir = path.join(projectRoot, 'src');
const distDir = path.join(projectRoot, 'dist');
const outFile = path.join(projectRoot, 'index.html');
const outDistFile = path.join(distDir, 'index.html');

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

async function build() {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const template = fs.readFileSync(path.join(srcDir, 'template.html'), 'utf8');
  const appCss = fs.readFileSync(path.join(srcDir, 'styles.css'), 'utf8');
  const appJs = fs.readFileSync(path.join(srcDir, 'main.js'), 'utf8');

  const leafletCssUrl = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  const leafletJsUrl = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

  const [leafletCss, leafletJs] = await Promise.all([
    fetchText(leafletCssUrl),
    fetchText(leafletJsUrl)
  ]);

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
