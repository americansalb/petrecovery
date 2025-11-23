#!/usr/bin/env node

// Test script to verify multi-city ZIP code search

import { getCitiesByZip } from './frontend/app/lib/cities.js';

// Test with known multi-city ZIP codes
const testZips = [
  '60411', // Chicago Heights, Lynwood, Sauk Village (IL) - known multi-city
  '10001', // New York (NY)
  '90001', // Los Angeles (CA)
  '30301', // Atlanta (GA)
  '60419', // Another IL ZIP - might be multi-city
];

console.log('🧪 Testing getCitiesByZip() for multi-city ZIP codes\n');
console.log('='.repeat(70));

testZips.forEach(zip => {
  console.log(`\n📍 ZIP Code: ${zip}`);
  console.log('─'.repeat(70));

  const cities = getCitiesByZip(zip);

  console.log(`   Found ${cities.length} city/cities:`);

  if (cities.length === 0) {
    console.log('   ⚠️  No cities found for this ZIP');
  } else {
    cities.forEach((city, i) => {
      console.log(`   ${i + 1}. ${city.city}, ${city.state_id} (${city.state_name})`);
      console.log(`      All ZIPs for this city: ${city.zips.slice(0, 5).join(', ')}${city.zips.length > 5 ? '...' : ''}`);
    });
  }

  if (cities.length > 1) {
    console.log(`\n   ✅ MULTI-CITY ZIP - API should return ${cities.length} cities in results`);
  } else if (cities.length === 1) {
    console.log(`\n   ℹ️  Single-city ZIP`);
  }
});

console.log('\n' + '='.repeat(70));
console.log('✅ Test complete!');
console.log('\nKEY FINDING:');
console.log('If ZIP 60411 shows 3 cities above, but user only sees 1 in the UI,');
console.log('then the issue is in how the API processes or returns the data.');
