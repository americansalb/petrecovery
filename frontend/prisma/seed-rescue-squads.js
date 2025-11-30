/**
 * Seed script for Rescue Squads across major US metro areas
 *
 * Creates rescue squads for major metropolitan areas to enable
 * proper squad assignment based on location.
 *
 * Run with: node prisma/seed-rescue-squads.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Major US Metro Areas with rescue squad data
const rescueSquads = [
  // Already exists - will be skipped
  {
    name: 'Chicago Rescue Squad',
    city: 'Chicago',
    state: 'IL',
    lat: 41.8781,
    lng: -87.6298,
    radiusMiles: 25,
    zips: ['60601', '60602', '60603', '60604', '60605', '60606', '60607', '60608', '60609', '60610', '60611', '60614', '60618', '60622', '60625', '60640', '60647', '60657']
  },
  // Illinois - Suburban Chicago
  {
    name: 'Northwest Suburbs Rescue Squad',
    city: 'Carpentersville',
    state: 'IL',
    lat: 42.1211,
    lng: -88.2579,
    radiusMiles: 15,
    zips: ['60110', '60118', '60120', '60123', '60124', '60156', '60175', '60195']
  },
  {
    name: 'DuPage County Rescue Squad',
    city: 'Naperville',
    state: 'IL',
    lat: 41.7508,
    lng: -88.1535,
    radiusMiles: 15,
    zips: ['60540', '60563', '60564', '60565', '60515', '60516', '60517', '60532']
  },
  {
    name: 'Lake County Rescue Squad',
    city: 'Waukegan',
    state: 'IL',
    lat: 42.3636,
    lng: -87.8448,
    radiusMiles: 15,
    zips: ['60085', '60087', '60044', '60045', '60047', '60048', '60061', '60064']
  },
  {
    name: 'South Suburbs Rescue Squad',
    city: 'Orland Park',
    state: 'IL',
    lat: 41.6303,
    lng: -87.8539,
    radiusMiles: 15,
    zips: ['60462', '60467', '60477', '60452', '60453', '60455', '60456', '60457']
  },
  // Major US Metros
  {
    name: 'New York City Rescue Squad',
    city: 'New York',
    state: 'NY',
    lat: 40.7128,
    lng: -74.0060,
    radiusMiles: 20,
    zips: ['10001', '10002', '10003', '10004', '10005', '10006', '10007', '10010', '10011', '10012']
  },
  {
    name: 'Los Angeles Rescue Squad',
    city: 'Los Angeles',
    state: 'CA',
    lat: 34.0522,
    lng: -118.2437,
    radiusMiles: 25,
    zips: ['90001', '90002', '90003', '90004', '90005', '90006', '90007', '90008', '90010', '90011']
  },
  {
    name: 'Houston Rescue Squad',
    city: 'Houston',
    state: 'TX',
    lat: 29.7604,
    lng: -95.3698,
    radiusMiles: 25,
    zips: ['77001', '77002', '77003', '77004', '77005', '77006', '77007', '77008', '77009', '77010']
  },
  {
    name: 'Phoenix Rescue Squad',
    city: 'Phoenix',
    state: 'AZ',
    lat: 33.4484,
    lng: -112.0740,
    radiusMiles: 25,
    zips: ['85001', '85002', '85003', '85004', '85006', '85007', '85008', '85009', '85012', '85013']
  },
  {
    name: 'Philadelphia Rescue Squad',
    city: 'Philadelphia',
    state: 'PA',
    lat: 39.9526,
    lng: -75.1652,
    radiusMiles: 20,
    zips: ['19102', '19103', '19104', '19106', '19107', '19109', '19111', '19112', '19114', '19115']
  },
  {
    name: 'San Antonio Rescue Squad',
    city: 'San Antonio',
    state: 'TX',
    lat: 29.4241,
    lng: -98.4936,
    radiusMiles: 25,
    zips: ['78201', '78202', '78203', '78204', '78205', '78207', '78208', '78209', '78210', '78211']
  },
  {
    name: 'San Diego Rescue Squad',
    city: 'San Diego',
    state: 'CA',
    lat: 32.7157,
    lng: -117.1611,
    radiusMiles: 20,
    zips: ['92101', '92102', '92103', '92104', '92105', '92106', '92107', '92108', '92109', '92110']
  },
  {
    name: 'Dallas Rescue Squad',
    city: 'Dallas',
    state: 'TX',
    lat: 32.7767,
    lng: -96.7970,
    radiusMiles: 25,
    zips: ['75201', '75202', '75203', '75204', '75205', '75206', '75207', '75208', '75209', '75210']
  },
  {
    name: 'Austin Rescue Squad',
    city: 'Austin',
    state: 'TX',
    lat: 30.2672,
    lng: -97.7431,
    radiusMiles: 20,
    zips: ['78701', '78702', '78703', '78704', '78705', '78721', '78722', '78723', '78724', '78725']
  },
  {
    name: 'San Francisco Bay Area Rescue Squad',
    city: 'San Francisco',
    state: 'CA',
    lat: 37.7749,
    lng: -122.4194,
    radiusMiles: 20,
    zips: ['94102', '94103', '94104', '94105', '94107', '94108', '94109', '94110', '94111', '94112']
  },
  {
    name: 'Seattle Rescue Squad',
    city: 'Seattle',
    state: 'WA',
    lat: 47.6062,
    lng: -122.3321,
    radiusMiles: 20,
    zips: ['98101', '98102', '98103', '98104', '98105', '98106', '98107', '98108', '98109', '98112']
  },
  {
    name: 'Denver Rescue Squad',
    city: 'Denver',
    state: 'CO',
    lat: 39.7392,
    lng: -104.9903,
    radiusMiles: 20,
    zips: ['80201', '80202', '80203', '80204', '80205', '80206', '80207', '80209', '80210', '80211']
  },
  {
    name: 'Boston Rescue Squad',
    city: 'Boston',
    state: 'MA',
    lat: 42.3601,
    lng: -71.0589,
    radiusMiles: 15,
    zips: ['02101', '02102', '02103', '02104', '02105', '02106', '02107', '02108', '02109', '02110']
  },
  {
    name: 'Atlanta Rescue Squad',
    city: 'Atlanta',
    state: 'GA',
    lat: 33.7490,
    lng: -84.3880,
    radiusMiles: 20,
    zips: ['30301', '30302', '30303', '30304', '30305', '30306', '30307', '30308', '30309', '30310']
  },
  {
    name: 'Miami Rescue Squad',
    city: 'Miami',
    state: 'FL',
    lat: 25.7617,
    lng: -80.1918,
    radiusMiles: 20,
    zips: ['33101', '33109', '33125', '33126', '33127', '33128', '33129', '33130', '33131', '33132']
  },
  {
    name: 'Detroit Rescue Squad',
    city: 'Detroit',
    state: 'MI',
    lat: 42.3314,
    lng: -83.0458,
    radiusMiles: 20,
    zips: ['48201', '48202', '48203', '48204', '48205', '48206', '48207', '48208', '48209', '48210']
  },
  {
    name: 'Minneapolis Rescue Squad',
    city: 'Minneapolis',
    state: 'MN',
    lat: 44.9778,
    lng: -93.2650,
    radiusMiles: 15,
    zips: ['55401', '55402', '55403', '55404', '55405', '55406', '55407', '55408', '55409', '55410']
  },
  {
    name: 'Portland Rescue Squad',
    city: 'Portland',
    state: 'OR',
    lat: 45.5152,
    lng: -122.6784,
    radiusMiles: 15,
    zips: ['97201', '97202', '97203', '97204', '97205', '97206', '97209', '97210', '97211', '97212']
  },
  {
    name: 'Las Vegas Rescue Squad',
    city: 'Las Vegas',
    state: 'NV',
    lat: 36.1699,
    lng: -115.1398,
    radiusMiles: 20,
    zips: ['89101', '89102', '89103', '89104', '89106', '89107', '89108', '89109', '89110', '89117']
  },
];

async function main() {
  console.log('🐾 Seeding Rescue Squads across the US...\n');

  let created = 0;
  let skipped = 0;

  for (const squad of rescueSquads) {
    // Check if already exists
    const existing = await prisma.rescueSquad.findUnique({
      where: { name: squad.name }
    });

    if (existing) {
      console.log(`⏭️  Skipping ${squad.name} (already exists)`);
      skipped++;
      continue;
    }

    // Create the rescue squad
    await prisma.rescueSquad.create({
      data: {
        name: squad.name,
        description: `Pet rescue coordination squad serving the ${squad.city} area`,
        city: squad.city,
        state: squad.state,
        zipCodes: JSON.stringify(squad.zips),
        coverageType: 'RADIUS',
        centerLatitude: squad.lat,
        centerLongitude: squad.lng,
        radiusMiles: squad.radiusMiles,
        specializesInDogs: true,
        specializesInCats: true,
        specializesInBirds: true,
        specializesInOther: true,
        availableWeekdays: true,
        availableWeekends: true,
        availableDay: true,
        availableNight: true,
        isActive: true,
        isAcceptingCases: true,
      }
    });

    console.log(`✅ Created ${squad.name} (${squad.city}, ${squad.state})`);
    created++;
  }

  console.log(`\n🎉 Rescue Squads seed complete!`);
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total: ${rescueSquads.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding rescue squads:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
