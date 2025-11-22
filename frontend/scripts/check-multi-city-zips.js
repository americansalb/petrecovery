#!/usr/bin/env node

const data = require('/tmp/uscities_clean.json');

console.log('Checking for multi-city ZIPs in source data...\n');

// Find ZIPs that appear multiple times
const zipMap = new Map();

data.forEach(entry => {
  if (!entry.zip_code || !entry.city) return;

  const zip = String(entry.zip_code).padStart(5, '0');

  if (!zipMap.has(zip)) {
    zipMap.set(zip, []);
  }

  zipMap.get(zip).push({
    city: entry.city,
    state: entry.state,
    county: entry.county
  });
});

// Find multi-city ZIPs
const multiCityZips = [];
zipMap.forEach((cities, zip) => {
  if (cities.length > 1) {
    multiCityZips.push({ zip, cities });
  }
});

console.log(`Total ZIPs: ${zipMap.size}`);
console.log(`Multi-city ZIPs: ${multiCityZips.length}\n`);

// Show examples
console.log('First 20 multi-city ZIPs:');
multiCityZips.slice(0, 20).forEach(({ zip, cities }) => {
  console.log(`  ${zip}: ${cities.map(c => `${c.city}, ${c.state}`).join(' | ')}`);
});

// Check 60411 specifically
console.log('\nZIP 60411:');
const zip60411 = zipMap.get('60411');
if (zip60411) {
  zip60411.forEach(c => console.log(`  - ${c.city}, ${c.state} (${c.county} County)`));
} else {
  console.log('  Not found');
}
