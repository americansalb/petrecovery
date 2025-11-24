#!/usr/bin/env node

const fs = require('fs');

const csv = fs.readFileSync('/tmp/geo_data.csv', 'utf-8');
const lines = csv.trim().split('\n');
const rows = lines.slice(1); // Skip header

const zipMap = new Map();

rows.forEach(line => {
  const parts = line.split(',');
  const zip = parts[3];
  const city = parts[5];

  if (!zip || !city) return;

  if (!zipMap.has(zip)) {
    zipMap.set(zip, new Set());
  }

  zipMap.get(zip).add(city);
});

// Find multi-city ZIPs
const multiCityZips = [];
zipMap.forEach((cities, zip) => {
  if (cities.size > 1) {
    multiCityZips.push({ zip, cities: Array.from(cities) });
  }
});

console.log(`Total ZIPs: ${zipMap.size}`);
console.log(`Multi-city ZIPs: ${multiCityZips.length}\n`);

console.log('First 30 multi-city ZIPs:');
multiCityZips.slice(0, 30).forEach(({ zip, cities }) => {
  console.log(`  ${zip}: ${cities.join(', ')}`);
});

// Check 60411
console.log('\nZIP 60411:');
const zip60411 = zipMap.get('60411');
if (zip60411) {
  console.log(`  Cities: ${Array.from(zip60411).join(', ')}`);
}
