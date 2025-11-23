#!/usr/bin/env node

// Find all multi-city ZIPs

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
    zipToCities.get(zip).add(`${city.city}, ${city.state_id}`);
  });
});

// Count by number of cities per ZIP
const countsBySize = new Map();
zipToCities.forEach((cities, zip) => {
  const size = cities.size;
  if (!countsBySize.has(size)) {
    countsBySize.set(size, []);
  }
  if (size > 1 && countsBySize.get(size).length < 5) {
    countsBySize.get(size).push({ zip, cities: Array.from(cities) });
  }
});

console.log('📊 Distribution of cities per ZIP code:\n');
console.log('='.repeat(70));

[...countsBySize.keys()].sort((a, b) => b - a).forEach(size => {
  const zips = countsBySize.get(size);
  const total = Array.from(zipToCities.values()).filter(cities => cities.size === size).length;

  console.log(`\n${size} cities per ZIP: ${total} ZIP codes`);

  if (zips.length > 0) {
    console.log('Examples:');
    zips.forEach(item => {
      console.log(`  • ${item.zip}: ${item.cities.join(', ')}`);
    });
  }
});

console.log('\n' + '='.repeat(70));

// Test a few known multi-city ZIPs
console.log('\n🧪 Testing known multi-city ZIPs:\n');

const testZips = ['60411', '90210', '10001', '33139', '48009'];
testZips.forEach(zip => {
  const cities = getCitiesByZip(zip);
  if (cities.length > 0) {
    console.log(`${zip}: ${cities.length} ${cities.length > 1 ? 'cities' : 'city'} - ${cities.map(c => c.city).join(', ')}`);
  } else {
    console.log(`${zip}: NOT IN DATABASE`);
  }
});
