#!/usr/bin/env node

const fs = require('fs');
const readline = require('readline');

async function processData() {
  console.log('📊 Processing complete US cities database...\n');

  const citiesMap = new Map(); // city-state -> { city, state_id, state_name, county, zips }
  const zipsMap = new Map();   // zip -> [city-state keys]

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

    const [city, stateShort, stateFull, county, cityAlias, zipCodes] = parts.map(p => p.trim());

    if (!city || !stateShort || !zipCodes) continue;

    // Create city key
    const cityKey = `${city.toLowerCase()}-${stateShort.toLowerCase()}`;

    // Parse ZIP codes (space-separated)
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
        aliases: new Set()
      });
    } else {
      // Add zips to existing city
      const existing = citiesMap.get(cityKey);
      zips.forEach(z => existing.zips.add(z));
    }

    // Add alias if it's different from main city name
    if (cityAlias && cityAlias !== city) {
      citiesMap.get(cityKey).aliases.add(cityAlias);
    }

    // Track which cities share each ZIP
    zips.forEach(zip => {
      if (!zipsMap.has(zip)) {
        zipsMap.set(zip, new Set());
      }
      zipsMap.get(zip).add(cityKey);
    });
  }

  console.log(`✅ Processed ${lineNum.toLocaleString()} lines`);
  console.log(`📍 Found ${citiesMap.size.toLocaleString()} unique cities`);
  console.log(`📮 Found ${zipsMap.size.toLocaleString()} unique ZIP codes\n`);

  // Convert to arrays
  const cities = Array.from(citiesMap.entries()).map(([key, data]) => ({
    id: key,
    city: data.city,
    state_id: data.state_id,
    state_name: data.state_name,
    county: data.county,
    zips: Array.from(data.zips).sort(),
    aliases: Array.from(data.aliases).sort()
  }));

  const zips = Array.from(zipsMap.entries()).map(([zip, cityKeys]) => ({
    zip: zip,
    city_ids: Array.from(cityKeys).sort(),
    primary_city: Array.from(cityKeys)[0] // First one as primary
  }));

  // Check multi-city ZIPs
  const multiCityZips = zips.filter(z => z.city_ids.length > 1);
  console.log(`🏙️  Multi-city ZIPs: ${multiCityZips.length.toLocaleString()}\n`);

  console.log('First 10 multi-city ZIPs:');
  multiCityZips.slice(0, 10).forEach(z => {
    const cityNames = z.city_ids.map(id => {
      const city = citiesMap.get(id);
      return `${city.city}, ${city.state_id}`;
    });
    console.log(`  ${z.zip}: ${cityNames.join(' + ')}`);
  });

  // Check 60411
  console.log('\n🔍 ZIP 60411:');
  const zip60411 = zips.find(z => z.zip === '60411');
  if (zip60411) {
    console.log(`  ${zip60411.city_ids.length} cities:`);
    zip60411.city_ids.forEach(id => {
      const city = citiesMap.get(id);
      console.log(`    - ${city.city}, ${city.state_id}`);
      if (city.aliases.size > 0) {
        console.log(`      Aliases: ${Array.from(city.aliases).join(', ')}`);
      }
    });
  }

  // Save data
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

  // Stats
  const citiesWithMultipleZips = cities.filter(c => c.zips.length > 1).length;
  const citiesWithAliases = cities.filter(c => c.aliases.length > 0).length;

  console.log('\n📊 STATISTICS:');
  console.log(`  Cities with multiple ZIPs: ${citiesWithMultipleZips.toLocaleString()}`);
  console.log(`  Cities with aliases: ${citiesWithAliases.toLocaleString()}`);
  console.log(`  Multi-city ZIPs: ${multiCityZips.length.toLocaleString()}`);
}

processData().catch(console.error);
