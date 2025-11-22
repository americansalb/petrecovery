#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const cities = JSON.parse(fs.readFileSync(path.join(__dirname, '../app/lib/uscities.full.json'), 'utf-8'));

console.log(`Total cities: ${cities.length}\n`);

// Check for all lowercase cities
const allLower = cities.filter(c => c.city === c.city.toLowerCase());
console.log(`All lowercase: ${allLower.length}`);
if (allLower.length > 0) {
  console.log('Examples:', allLower.slice(0, 10).map(c => c.city));
}

// Check for missing proper capitalization
const improperCaps = cities.filter(c => {
  const words = c.city.split(' ');
  const hasLowercaseStart = words.some(w => w.length > 0 && w[0] === w[0].toLowerCase());
  return hasLowercaseStart;
});
console.log(`\nImproper capitalization: ${improperCaps.length}`);
if (improperCaps.length > 0) {
  console.log('Examples:', improperCaps.slice(0, 20).map(c => `"${c.city}"`).join(', '));
}

// Check specific known issues
const knownIssues = [
  'Lake in the hill',
  'St. petersburg',
  'Fort worth',
  'San antonio',
  'New york'
];

console.log('\nKnown problematic cities:');
knownIssues.forEach(name => {
  const found = cities.find(c => c.city.toLowerCase() === name.toLowerCase());
  if (found) {
    console.log(`  "${name}" → "${found.city}"`);
  }
});
