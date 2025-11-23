#!/usr/bin/env node

// Find ZIP codes that map to exactly 2 cities

import { getCitiesByZip } from './frontend/app/lib/cities.js';
import fs from 'fs';

const allCitiesData = JSON.parse(fs.readFileSync('./frontend/app/lib/uscities.full.json', 'utf8'));

// Build a map of ZIP -> cities
const zipToCities = new Map();

allCitiesData.forEach(city => {
  city.zips.forEach(zip => {
    if (!zipToCities.has(zip)) {
      zipToCities.set(zip, new Set());
    }
    zipToCities.get(zip).add(city.city);
  });
});

// Find ZIPs with exactly 2 cities
const twoCityZips = [];
zipToCities.forEach((cities, zip) => {
  if (cities.size === 2) {
    twoCityZips.push({
      zip,
      cities: Array.from(cities)
    });
  }
});

console.log(`🔍 Found ${twoCityZips.length} ZIP codes with exactly 2 cities\n`);
console.log('='.repeat(70));
console.log('First 10 examples:\n');

twoCityZips.slice(0, 10).forEach((item, idx) => {
  console.log(`${idx + 1}. ZIP ${item.zip}:`);
  console.log(`   ${item.cities.join(' + ')}`);

  // Verify with getCitiesByZip
  const result = getCitiesByZip(item.zip);
  console.log(`   ✓ getCitiesByZip returns ${result.length} cities`);
  console.log();
});

console.log('='.repeat(70));
console.log('\n💡 User is testing with one of these 2-city ZIPs.');
console.log('If they only see 1 city, the API is filtering/dropping one.');
