#!/usr/bin/env node

const fs = require('fs');
const readline = require('readline');

async function processData() {
  console.log('📊 Processing complete US cities database (treating aliases as cities)...\n');

  const citiesMap = new Map(); // "city-state" -> city data
  const zipsMap = new Map();   // zip -> Set of "city-state" keys

  const fileStream = fs.createReadStream('/tmp/us_cities_zips_complete.csv');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineNum = 0;
  let skippedHeader = false;

  for await (const line of rl) {
    lineNum++;

    if (!skippedHeader) {
      skippedHeader = true;
      continue;
    }

    const parts = line.split('|');
    if (parts.length !== 6) continue;

    const [mainCity, stateShort, stateFull, county, cityAlias, zipCodes] = parts.map(p => p.trim());

    if (!cityAlias || !stateShort || !zipCodes) continue;

    // Use the ALIAS as the city name (this is the actual searchable name)
    const city = cityAlias;
    const cityKey = `${city.toLowerCase()}-${stateShort.toLowerCase()}`;

    // Parse ZIP codes
    const zips = zipCodes.split(/\s+/).filter(z => /^\d{5}$/.test(z));
    if (zips.length === 0) continue;

    // Add or update city
    if (!citiesMap.has(cityKey)) {
      citiesMap.set(cityKey, {
        city: city,
        state_id: stateShort,
        state_name: stateFull,
        county: county,
        zips: new Set(zips),
        main_city: mainCity !== city ? mainCity : null
      });
    } else {
      // Merge zips
      const existing = citiesMap.get(cityKey);
      zips.forEach(z => existing.zips.add(z));
    }

    // Track ZIP -> cities mapping
    zips.forEach(zip => {
      if (!zipsMap.has(zip)) {
        zipsMap.set(zip, new Set());
      }
      zipsMap.get(zip).add(cityKey);
    });
  }

  console.log(`✅ Processed ${lineNum.toLocaleString()} lines`);
  console.log(`📍 Found ${citiesMap.size.toLocaleString()} searchable cities (including aliases)`);
  console.log(`📮 Found ${zipsMap.size.toLocaleString()} unique ZIP codes\n`);

  // Convert to final format
  const cities = Array.from(citiesMap.entries()).map(([key, data]) => ({
    id: key,
    city: data.city,
    state_id: data.state_id,
    state_name: data.state_name,
    county: data.county,
    zips: Array.from(data.zips).sort(),
    main_city: data.main_city
  }));

  const zips = Array.from(zipsMap.entries()).map(([zip, cityKeys]) => ({
    zip: zip,
    city_ids: Array.from(cityKeys).sort()
  }));

  // Check multi-city ZIPs
  const multiCityZips = zips.filter(z => z.city_ids.length > 1);
  console.log(`🏙️  Multi-city ZIPs: ${multiCityZips.length.toLocaleString()}\n`);

  console.log('First 10 multi-city ZIPs:');
  multiCityZips.slice(0, 10).forEach(z => {
    const cityNames = z.city_ids.slice(0, 5).map(id => {
      const city = citiesMap.get(id);
      return `${city.city}, ${city.state_id}`;
    });
    const more = z.city_ids.length > 5 ? ` + ${z.city_ids.length - 5} more` : '';
    console.log(`  ${z.zip}: ${cityNames.join(', ')}${more}`);
  });

  // Check 60411
  console.log('\n🔍 ZIP 60411:');
  const zip60411 = zips.find(z => z.zip === '60411');
  if (zip60411) {
    console.log(`  ${zip60411.city_ids.length} searchable cities:`);
    zip60411.city_ids.slice(0, 15).forEach(id => {
      const city = citiesMap.get(id);
      console.log(`    - ${city.city}, ${city.state_id}${city.main_city ? ` (area of ${city.main_city})` : ''}`);
    });
    if (zip60411.city_ids.length > 15) {
      console.log(`    ... and ${zip60411.city_ids.length - 15} more`);
    }
  }

  // Save
  console.log('\n💾 Saving to JSON files...');

  fs.writeFileSync(
    'frontend/app/lib/cities.complete.json',
    JSON.stringify(cities, null, 2)
  );

  fs.writeFileSync(
    'frontend/app/lib/zips.complete.json',
    JSON.stringify(zips, null, 2)
  );

  console.log(`✅ Saved ${cities.length.toLocaleString()} cities to cities.complete.json`);
  console.log(`✅ Saved ${zips.length.toLocaleString()} ZIPs to zips.complete.json`);

  // Create sample for testing
  console.log('\n📝 Sample cities:');
  const sampleCities = ['Lynwood', 'Sauk Village', 'Chicago Heights', 'Springfield'].map(name => {
    const matches = cities.filter(c => c.city === name && c.state_id === 'IL');
    return matches[0];
  }).filter(Boolean);

  sampleCities.forEach(c => {
    console.log(`  ${c.city}, ${c.state_id}: ${c.zips.length} ZIPs${c.main_city ? ` (area of ${c.main_city})` : ''}`);
  });
}

processData().catch(console.error);
