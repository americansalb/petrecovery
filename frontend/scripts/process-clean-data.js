#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load the clean US Cities JSON
const rawData = require('/tmp/uscities_clean.json');

console.log(`Processing ${rawData.length} ZIP code entries...`);

// Group by city + state, aggregate ZIPs
const cityMap = new Map();

rawData.forEach(entry => {
  // Skip entries without city or state
  if (!entry.city || !entry.state) return;

  // Skip Puerto Rico and territories if you only want 50 states
  if (['PR', 'VI', 'GU', 'AS', 'MP'].includes(entry.state)) return;

  const cityName = entry.city;
  const stateId = entry.state;
  const zipCode = String(entry.zip_code).padStart(5, '0'); // Ensure 5 digits

  // Create unique key for this city
  const key = `${cityName.toLowerCase()}|${stateId.toLowerCase()}`;

  if (!cityMap.has(key)) {
    cityMap.set(key, {
      city: cityName,
      state_id: stateId,
      state_name: getStateName(stateId),
      zips: []
    });
  }

  const cityRecord = cityMap.get(key);

  // Add ZIP if not already present
  if (!cityRecord.zips.includes(zipCode)) {
    cityRecord.zips.push(zipCode);
  }
});

// Convert to array and sort
let cities = Array.from(cityMap.values()).sort((a, b) => {
  if (a.state_id !== b.state_id) return a.state_id.localeCompare(b.state_id);
  return a.city.localeCompare(b.city);
});

console.log(`Processed into ${cities.length} unique cities`);

// Add known multi-city ZIPs
const multiCityZips = [
  { city: 'Lynwood', state_id: 'IL', state_name: 'Illinois', zip: '60411' },
  { city: 'Sauk Village', state_id: 'IL', state_name: 'Illinois', zip: '60411' },
];

multiCityZips.forEach(fix => {
  const existing = cities.find(c =>
    c.city.toLowerCase() === fix.city.toLowerCase() &&
    c.state_id === fix.state_id
  );

  if (existing) {
    if (!existing.zips.includes(fix.zip)) {
      console.log(`Adding ZIP ${fix.zip} to ${fix.city}, ${fix.state_id}`);
      existing.zips.push(fix.zip);
      existing.zips.sort();
    }
  } else {
    console.log(`Adding new city ${fix.city}, ${fix.state_id} with ZIP ${fix.zip}`);
    cities.push({
      city: fix.city,
      state_id: fix.state_id,
      state_name: fix.state_name,
      zips: [fix.zip]
    });
  }
});

// Re-sort after additions
cities.sort((a, b) => {
  if (a.state_id !== b.state_id) return a.state_id.localeCompare(b.state_id);
  return a.city.localeCompare(b.city);
});

// Write output
const outputPath = path.join(__dirname, '../app/lib/uscities.full.json');
fs.writeFileSync(outputPath, JSON.stringify(cities), 'utf-8');

console.log(`✅ Saved ${cities.length} cities to ${outputPath}`);

// Verify test cases
console.log('\n✅ Test cases:');
const testCases = [
  { city: 'Lake In The Hills', state: 'IL' },
  { city: 'Fort Worth', state: 'TX' },
  { city: 'San Antonio', state: 'TX' },
  { city: 'New York', state: 'NY' },
];

testCases.forEach(test => {
  const found = cities.find(c =>
    c.city.toLowerCase() === test.city.toLowerCase() &&
    c.state_id === test.state
  );
  if (found) {
    console.log(`  ✓ ${found.city}, ${found.state_id} (${found.zips.length} ZIPs)`);
  }
});

// Check multi-city ZIP
const zip60411 = cities.filter(c => c.zips.includes('60411'));
console.log(`\nZIP 60411 cities:`);
zip60411.forEach(c => console.log(`  - ${c.city}, ${c.state_id}`));

// State name lookup
function getStateName(stateId) {
  const states = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
    'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
    'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
    'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
    'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
    'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
    'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
    'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
    'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
    'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
    'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia'
  };
  return states[stateId] || stateId;
}
