#!/usr/bin/env node

const cities = require('../app/lib/uscities.full.json');

console.log(`Total cities: ${cities.length}\n`);

// Test major cities
const majorCities = [
  { city: 'Chicago', state: 'IL' },
  { city: 'Los Angeles', state: 'CA' },
  { city: 'Miami', state: 'FL' },
  { city: 'Seattle', state: 'WA' },
  { city: 'Boston', state: 'MA' },
  { city: 'Phoenix', state: 'AZ' },
  { city: 'Denver', state: 'CO' },
  { city: 'Atlanta', state: 'GA' },
  { city: 'Lake In The Hills', state: 'IL' },
  { city: 'San Francisco', state: 'CA' },
  { city: 'Portland', state: 'OR' },
  { city: 'Austin', state: 'TX' },
];

console.log('Major cities verification:');
majorCities.forEach(test => {
  const found = cities.find(c => c.city === test.city && c.state_id === test.state);
  if (found) {
    console.log(`  ✓ ${found.city}, ${found.state_id} (${found.zips.length} ZIPs)`);
  } else {
    console.log(`  ✗ ${test.city}, ${test.state} NOT FOUND`);
  }
});

// Check for any lowercase issues
console.log('\nChecking capitalization...');
const lowercaseIssues = cities.filter(c => {
  const words = c.city.split(' ');
  return words.some(word => word.length > 0 && word[0] !== word[0].toUpperCase());
});

console.log(`Cities with lowercase issues: ${lowercaseIssues.length}`);
if (lowercaseIssues.length > 0) {
  console.log('First 10 examples:');
  lowercaseIssues.slice(0, 10).forEach(c => console.log(`  - ${c.city}, ${c.state_id}`));
}

// File size
const fs = require('fs');
const stats = fs.statSync('../app/lib/uscities.full.json');
console.log(`\nFile size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
