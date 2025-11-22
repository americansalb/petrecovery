#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/lib/uscities.full.json');
const cities = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

console.log(`Starting with ${cities.length} entries...`);

// Filter out junk entries
const filtered = cities.filter(city => {
  // Remove ZCTA entries (ZIP Code Tabulation Areas - not real cities)
  if (city.city.toLowerCase().includes('zcta')) {
    return false;
  }

  // Remove PO Box only entries
  if (city.city.toLowerCase().includes('po box')) {
    return false;
  }

  // Remove generic "No city" entries
  if (city.city.toLowerCase() === 'not applicable' ||
      city.city.toLowerCase() === 'unknown' ||
      city.city.toLowerCase() === 'no city') {
    return false;
  }

  return true;
});

const removed = cities.length - filtered.length;
console.log(`Removed ${removed} junk entries`);
console.log(`Final count: ${filtered.length} cities`);

// Save
fs.writeFileSync(filePath, JSON.stringify(filtered), 'utf-8');
console.log(`✅ Saved to ${filePath}`);
