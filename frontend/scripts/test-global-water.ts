/**
 * Test script to verify global water detection works at various locations
 */

import { isLikelyInOcean } from '../app/lib/terrain/globalWaterHeuristics';
import { isInMajorWater, isInMajorWaterBody } from '../app/lib/terrain/majorWaterBodies';

interface TestCase {
  name: string;
  lat: number;
  lng: number;
  expectedWater: boolean;
}

// Test cases from around the world
const testCases: TestCase[] = [
  // === OCEANS (should be water) ===
  { name: 'Pacific Ocean (off California)', lat: 37.5, lng: -123.5, expectedWater: true },
  { name: 'Pacific Ocean (off Japan)', lat: 35.0, lng: 142.0, expectedWater: true },
  { name: 'Atlantic Ocean (off NYC)', lat: 40.5, lng: -72.0, expectedWater: true },
  { name: 'Atlantic Ocean (off Portugal)', lat: 38.0, lng: -11.0, expectedWater: true },
  { name: 'Indian Ocean', lat: 10.0, lng: 75.0, expectedWater: true },
  { name: 'Arctic Ocean', lat: 80.0, lng: 0.0, expectedWater: true },
  { name: 'Antarctic Ocean', lat: -65.0, lng: 0.0, expectedWater: true },

  // === MAJOR LAKES/BAYS (should be water) ===
  { name: 'Lake Michigan (center)', lat: 43.0, lng: -87.0, expectedWater: true },
  { name: 'Lake Superior', lat: 47.5, lng: -88.0, expectedWater: true },
  { name: 'Lake Erie', lat: 42.0, lng: -81.0, expectedWater: true },
  { name: 'SF Bay (center)', lat: 37.7, lng: -122.25, expectedWater: true },
  { name: 'Chesapeake Bay', lat: 38.5, lng: -76.0, expectedWater: true },
  { name: 'Baltic Sea', lat: 58.0, lng: 20.0, expectedWater: true },
  { name: 'Lake Baikal', lat: 53.0, lng: 108.0, expectedWater: true },
  { name: 'Lake Victoria', lat: -1.0, lng: 33.0, expectedWater: true },

  // === CITIES (should be land) ===
  { name: 'San Francisco (downtown)', lat: 37.79, lng: -122.40, expectedWater: false },
  { name: 'New York City', lat: 40.75, lng: -73.98, expectedWater: false },
  { name: 'Los Angeles', lat: 34.05, lng: -118.25, expectedWater: false },
  { name: 'London', lat: 51.5, lng: -0.1, expectedWater: false },
  { name: 'Paris', lat: 48.85, lng: 2.35, expectedWater: false },
  { name: 'Tokyo', lat: 35.68, lng: 139.75, expectedWater: false },
  { name: 'Sydney', lat: -33.87, lng: 151.21, expectedWater: false },
  { name: 'Berlin', lat: 52.52, lng: 13.40, expectedWater: false },
  { name: 'Moscow', lat: 55.75, lng: 37.62, expectedWater: false },
  { name: 'Beijing', lat: 39.90, lng: 116.40, expectedWater: false },
  { name: 'Mumbai', lat: 19.08, lng: 72.88, expectedWater: false },
  { name: 'Cairo', lat: 30.04, lng: 31.24, expectedWater: false },
  { name: 'Buenos Aires', lat: -34.60, lng: -58.38, expectedWater: false },
  { name: 'São Paulo', lat: -23.55, lng: -46.63, expectedWater: false },
  { name: 'Mexico City', lat: 19.43, lng: -99.13, expectedWater: false },
  { name: 'Chicago (inland)', lat: 41.88, lng: -87.65, expectedWater: false },
  { name: 'Miami (inland)', lat: 25.78, lng: -80.20, expectedWater: false },
  { name: 'Seattle (inland)', lat: 47.60, lng: -122.33, expectedWater: false },
  { name: 'Denver', lat: 39.74, lng: -104.99, expectedWater: false },
  { name: 'Phoenix', lat: 33.45, lng: -112.07, expectedWater: false },

  // === EDGE CASES ===
  { name: 'Oakland (across from SF)', lat: 37.80, lng: -122.27, expectedWater: false },
  { name: 'Alameda (SF Bay island)', lat: 37.76, lng: -122.25, expectedWater: false },
  { name: 'Santa Cruz', lat: 36.97, lng: -122.03, expectedWater: false },
  { name: 'Vancouver BC', lat: 49.28, lng: -123.12, expectedWater: false },
  { name: 'Boston', lat: 42.36, lng: -71.06, expectedWater: false },
  { name: 'Amsterdam', lat: 52.37, lng: 4.90, expectedWater: false },
];

function runTests() {
  console.log('Testing Global Water Detection\n');
  console.log('=' .repeat(60));

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const test of testCases) {
    const pos = { lat: test.lat, lng: test.lng };

    // Check each layer
    const inOcean = isLikelyInOcean(pos);
    const inMajorWater = isInMajorWater(pos);
    const waterBodyName = isInMajorWaterBody(pos);

    const isWater = inOcean || inMajorWater;

    const status = isWater === test.expectedWater ? '✓' : '✗';

    if (isWater === test.expectedWater) {
      passed++;
      console.log(`${status} ${test.name}: ${isWater ? 'WATER' : 'LAND'}`);
    } else {
      failed++;
      const details = `expected ${test.expectedWater ? 'WATER' : 'LAND'}, got ${isWater ? 'WATER' : 'LAND'}`;
      failures.push(`${test.name} (${test.lat}, ${test.lng}): ${details}`);
      console.log(`${status} ${test.name}: ${details}`);
      if (inOcean) console.log(`   -> Detected as ocean`);
      if (waterBodyName) console.log(`   -> Detected as: ${waterBodyName}`);
    }
  }

  console.log('\n' + '=' .repeat(60));
  console.log(`Results: ${passed}/${testCases.length} passed, ${failed} failed`);

  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  - ${f}`));
  }

  return failed === 0;
}

// Run tests
const success = runTests();
process.exit(success ? 0 : 1);
