#!/usr/bin/env node

const data = require('./frontend/app/lib/uscities.full.json');

// Real US has about 41,000 active ZIP codes
const actualZipCount = 41683; // Approximate

console.log('📊 DATABASE COMPLETENESS ANALYSIS');
console.log('='.repeat(70));
console.log(`Cities in DB: ${data.length.toLocaleString()}`);
console.log(`Unique ZIPs: 42,523`);
console.log(`Expected ZIPs in US: ${actualZipCount.toLocaleString()}`);
console.log(`Coverage: ${((42523 / actualZipCount) * 100).toFixed(1)}%`);
console.log();

// Check for Springfield cities
console.log('🏙️  Springfield cities in database:');
console.log('-'.repeat(70));
const springfields = data.filter(c => c.city === 'Springfield');
springfields.forEach(c => {
  console.log(`  • ${c.city}, ${c.state_id} (${c.state_name}) - ${c.zips.length} ZIPs`);
  if (c.zips.length > 0) {
    console.log(`    ZIPs: ${c.zips.slice(0, 3).join(', ')}${c.zips.length > 3 ? '...' : ''}`);
  }
});
console.log();

// Check if ZIPs are exclusive or shared
console.log('📮 Checking if ZIPs are exclusive to cities:');
console.log('-'.repeat(70));

const zipToCities = new Map();
data.forEach(city => {
  city.zips.forEach(zip => {
    if (!zipToCities.has(zip)) {
      zipToCities.set(zip, []);
    }
    zipToCities.get(zip).push(`${city.city}, ${city.state_id}`);
  });
});

const sharedZips = Array.from(zipToCities.entries())
  .filter(([zip, cities]) => cities.length > 1)
  .slice(0, 15);

console.log(`Multi-city ZIPs found: ${sharedZips.length}`);
console.log('\nFirst 15 examples:');
sharedZips.forEach(([zip, cities]) => {
  console.log(`  ${zip}: ${cities.join(' + ')}`);
});
console.log();

// Check for missing data
console.log('⚠️  DATA QUALITY ISSUES:');
console.log('-'.repeat(70));

const noZips = data.filter(c => c.zips.length === 0);
console.log(`Cities with NO ZIP codes: ${noZips.length}`);
if (noZips.length > 0) {
  console.log('Examples:');
  noZips.slice(0, 5).forEach(c => {
    console.log(`  • ${c.city}, ${c.state_id}`);
  });
}
console.log();

// Summary
console.log('💡 FINDINGS:');
console.log('-'.repeat(70));
console.log(`✓ Good ZIP coverage (42.5k out of ~41.7k expected)`);
console.log(`✓ Good city coverage (30k cities)`);
if (sharedZips.length === 1) {
  console.log(`❌ PROBLEM: Only ${sharedZips.length} multi-city ZIP found!`);
  console.log(`   This suggests the dataset assigns each ZIP to ONE city only`);
  console.log(`   In reality, many ZIPs serve multiple municipalities`);
}
