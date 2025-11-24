#!/usr/bin/env node

// Read the generated file and add missing multi-city ZIPs
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/lib/uscities.full.json');
const cities = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

// Known multi-city ZIPs that need to be added
const multiCityFixes = [
  { city: 'Lynwood', state_id: 'IL', state_name: 'Illinois', zip: '60411' },
  { city: 'Chicago Heights', state_id: 'IL', state_name: 'Illinois', zip: '60411' }
];

multiCityFixes.forEach(fix => {
  const existing = cities.find(c =>
    c.city === fix.city && c.state_id === fix.state_id
  );

  if (existing) {
    // Add ZIP if not present
    if (!existing.zips.includes(fix.zip)) {
      console.log(`Adding ZIP ${fix.zip} to existing city ${fix.city}, ${fix.state_id}`);
      existing.zips.push(fix.zip);
      existing.zips.sort();
    }
  } else {
    // Add new city
    console.log(`Adding new city ${fix.city}, ${fix.state_id} with ZIP ${fix.zip}`);
    cities.push({
      city: fix.city,
      state_id: fix.state_id,
      state_name: fix.state_name,
      zips: [fix.zip]
    });
  }
});

// Sort again
cities.sort((a, b) => {
  if (a.state_id !== b.state_id) return a.state_id.localeCompare(b.state_id);
  return a.city.localeCompare(b.city);
});

fs.writeFileSync(filePath, JSON.stringify(cities, null, 2), 'utf-8');
console.log(`✅ Updated with ${cities.length} total cities`);

// Verify
const citiesWithZip60411 = cities.filter(c => c.zips.includes('60411'));
console.log(`\nCities with ZIP 60411:`);
citiesWithZip60411.forEach(c => {
  console.log(`  - ${c.city}, ${c.state_id} (ZIPs: ${c.zips.join(', ')})`);
});
