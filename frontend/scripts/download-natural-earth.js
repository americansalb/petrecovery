/**
 * Download Natural Earth water data for global water detection
 * This provides authoritative ocean and lake boundaries
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data', 'natural-earth');

function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${filename}...`);

    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, filename).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        const outPath = path.join(DATA_DIR, filename);
        fs.writeFileSync(outPath, data);
        const sizeMB = (Buffer.byteLength(data, 'utf8') / 1024 / 1024).toFixed(2);
        console.log(`  Saved: ${filename} (${sizeMB} MB)`);
        resolve(data);
      });
      response.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  // Create output directory
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const baseUrl = 'https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master';

  // Download 50m resolution (good balance of size/accuracy)
  // Ocean: ~2MB, Lakes: ~500KB
  const files = [
    { url: `${baseUrl}/50m/physical/ne_50m_ocean.json`, name: 'ocean.json' },
    { url: `${baseUrl}/50m/physical/ne_50m_lakes.json`, name: 'lakes.json' },
  ];

  for (const file of files) {
    try {
      await downloadFile(file.url, file.name);
    } catch (err) {
      console.error(`Failed to download ${file.name}:`, err.message);
    }
  }

  console.log('\nDone! Natural Earth water data downloaded.');
  console.log('This data is public domain (CC0) from Natural Earth.');
}

main().catch(console.error);
