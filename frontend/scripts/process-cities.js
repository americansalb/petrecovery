#!/usr/bin/env node

/**
 * Process US cities CSV into normalized city database
 * Input: CSV with columns: state_fips,state,state_abbr,zipcode,county,city
 * Output: JSON array with shape:
 * [
 *   {
 *     "city": "Lynwood",
 *     "state_id": "IL",
 *     "state_name": "Illinois",
 *     "zips": ["60411"]
 *   }
 * ]
 */

const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2] || '/tmp/us_zip_cities.csv';
const outputFile = process.argv[3] || path.join(__dirname, '../app/lib/uscities.full.json');

console.log(`Reading from: ${inputFile}`);
console.log(`Writing to: ${outputFile}`);

// Read and parse CSV
const csvContent = fs.readFileSync(inputFile, 'utf-8');
const lines = csvContent.trim().split('\n');
const headers = lines[0].split(',');

// Parse CSV rows
const rows = lines.slice(1).map(line => {
  const values = line.split(',');
  return {
    state: values[1],
    state_abbr: values[2],
    zipcode: values[3],
    city: values[5]
  };
});

console.log(`Parsed ${rows.length} rows from CSV`);

// Group by city + state, aggregate ZIPs
const cityMap = new Map();

rows.forEach(row => {
  if (!row.city || !row.state_abbr || !row.zipcode) {
    return; // Skip incomplete rows
  }

  // Normalize city name
  const cityName = row.city.trim();
  const stateId = row.state_abbr.trim();
  const stateName = row.state.trim();
  const zip = row.zipcode.trim();

  // Create unique key for this city
  const key = `${cityName.toLowerCase()}|${stateId.toLowerCase()}`;

  if (!cityMap.has(key)) {
    cityMap.set(key, {
      city: cityName,
      state_id: stateId,
      state_name: stateName,
      zips: []
    });
  }

  const cityRecord = cityMap.get(key);

  // Add ZIP if not already present
  if (!cityRecord.zips.includes(zip)) {
    cityRecord.zips.push(zip);
  }
});

// Convert to array and sort
const cities = Array.from(cityMap.values()).sort((a, b) => {
  // Sort by state, then city name
  if (a.state_id !== b.state_id) {
    return a.state_id.localeCompare(b.state_id);
  }
  return a.city.localeCompare(b.city);
});

console.log(`Processed into ${cities.length} unique cities`);

// Write output
fs.writeFileSync(outputFile, JSON.stringify(cities, null, 2), 'utf-8');

console.log(`✅ Successfully wrote ${cities.length} cities to ${outputFile}`);

// Print some stats
const zipCounts = cities.map(c => c.zips.length);
const avgZips = zipCounts.reduce((a, b) => a + b, 0) / zipCounts.length;
const maxZips = Math.max(...zipCounts);
const cityWithMostZips = cities.find(c => c.zips.length === maxZips);

console.log(`\nStatistics:`);
console.log(`- Total cities: ${cities.length}`);
console.log(`- Average ZIPs per city: ${avgZips.toFixed(2)}`);
console.log(`- City with most ZIPs: ${cityWithMostZips.city}, ${cityWithMostZips.state_id} (${maxZips} ZIPs)`);
console.log(`- Total unique state codes: ${new Set(cities.map(c => c.state_id)).size}`);

// Verify the critical test case
const lynwoodIL = cities.find(c => c.city === 'Lynwood' && c.state_id === 'IL');
const chicagoHeightsIL = cities.find(c => c.city === 'Chicago Heights' && c.state_id === 'IL');

console.log(`\n✅ Test cases:`);
if (lynwoodIL) {
  console.log(`- Lynwood, IL: ZIPs ${lynwoodIL.zips.join(', ')}`);
}
if (chicagoHeightsIL) {
  console.log(`- Chicago Heights, IL: ZIPs ${chicagoHeightsIL.zips.join(', ')}`);
}

// Check if 60411 appears in both
const citiesWithZip60411 = cities.filter(c => c.zips.includes('60411'));
console.log(`- Cities with ZIP 60411: ${citiesWithZip60411.map(c => `${c.city}, ${c.state_id}`).join('; ')}`);
