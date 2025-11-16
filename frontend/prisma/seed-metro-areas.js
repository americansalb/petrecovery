const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Top US Metro Areas with coordinates
const metroAreas = [
  // Major Metro Areas
  { name: 'New York Metro Area', scope: 'New York, NY', lat: 40.7128, lng: -74.0060, zips: ['10001', '10002', '10003', '10004', '10005'] },
  { name: 'Los Angeles Metro Area', scope: 'Los Angeles, CA', lat: 34.0522, lng: -118.2437, zips: ['90001', '90002', '90003', '90004', '90005'] },
  { name: 'Chicago Metro Area', scope: 'Chicago, IL', lat: 41.8781, lng: -87.6298, zips: ['60601', '60602', '60603', '60604', '60605'] },
  { name: 'Dallas-Fort Worth Metro Area', scope: 'Dallas, TX', lat: 32.7767, lng: -96.7970, zips: ['75201', '75202', '75203', '75204', '75205'] },
  { name: 'Houston Metro Area', scope: 'Houston, TX', lat: 29.7604, lng: -95.3698, zips: ['77001', '77002', '77003', '77004', '77005'] },
  { name: 'Washington DC Metro Area', scope: 'Washington, DC', lat: 38.9072, lng: -77.0369, zips: ['20001', '20002', '20003', '20004', '20005'] },
  { name: 'Miami Metro Area', scope: 'Miami, FL', lat: 25.7617, lng: -80.1918, zips: ['33101', '33102', '33109', '33125', '33126'] },
  { name: 'Philadelphia Metro Area', scope: 'Philadelphia, PA', lat: 39.9526, lng: -75.1652, zips: ['19019', '19102', '19103', '19104', '19106'] },
  { name: 'Atlanta Metro Area', scope: 'Atlanta, GA', lat: 33.7490, lng: -84.3880, zips: ['30301', '30302', '30303', '30304', '30305'] },
  { name: 'Phoenix Metro Area', scope: 'Phoenix, AZ', lat: 33.4484, lng: -112.0740, zips: ['85001', '85002', '85003', '85004', '85006'] },
  { name: 'Boston Metro Area', scope: 'Boston, MA', lat: 42.3601, lng: -71.0589, zips: ['02101', '02102', '02103', '02104', '02105'] },
  { name: 'San Francisco Bay Area', scope: 'San Francisco, CA', lat: 37.7749, lng: -122.4194, zips: ['94102', '94103', '94104', '94105', '94107'] },
  { name: 'Riverside-San Bernardino Metro', scope: 'Riverside, CA', lat: 33.9533, lng: -117.3962, zips: ['92501', '92502', '92503', '92504', '92505'] },
  { name: 'Detroit Metro Area', scope: 'Detroit, MI', lat: 42.3314, lng: -83.0458, zips: ['48201', '48202', '48203', '48204', '48205'] },
  { name: 'Seattle Metro Area', scope: 'Seattle, WA', lat: 47.6062, lng: -122.3321, zips: ['98101', '98102', '98103', '98104', '98105'] },
  { name: 'Minneapolis-St. Paul Metro', scope: 'Minneapolis, MN', lat: 44.9778, lng: -93.2650, zips: ['55401', '55402', '55403', '55404', '55405'] },
  { name: 'San Diego Metro Area', scope: 'San Diego, CA', lat: 32.7157, lng: -117.1611, zips: ['92101', '92102', '92103', '92104', '92105'] },
  { name: 'Tampa-St. Petersburg Metro', scope: 'Tampa, FL', lat: 27.9506, lng: -82.4572, zips: ['33601', '33602', '33603', '33604', '33605'] },
  { name: 'Denver Metro Area', scope: 'Denver, CO', lat: 39.7392, lng: -104.9903, zips: ['80201', '80202', '80203', '80204', '80205'] },
  { name: 'St. Louis Metro Area', scope: 'St. Louis, MO', lat: 38.6270, lng: -90.1994, zips: ['63101', '63102', '63103', '63104', '63105'] },
  { name: 'Baltimore Metro Area', scope: 'Baltimore, MD', lat: 39.2904, lng: -76.6122, zips: ['21201', '21202', '21203', '21205', '21206'] },
  { name: 'Charlotte Metro Area', scope: 'Charlotte, NC', lat: 35.2271, lng: -80.8431, zips: ['28201', '28202', '28203', '28204', '28205'] },
  { name: 'Orlando Metro Area', scope: 'Orlando, FL', lat: 28.5383, lng: -81.3792, zips: ['32801', '32802', '32803', '32804', '32805'] },
  { name: 'San Antonio Metro Area', scope: 'San Antonio, TX', lat: 29.4241, lng: -98.4936, zips: ['78201', '78202', '78203', '78204', '78205'] },
  { name: 'Portland Metro Area', scope: 'Portland, OR', lat: 45.5152, lng: -122.6784, zips: ['97201', '97202', '97203', '97204', '97205'] },
  { name: 'Sacramento Metro Area', scope: 'Sacramento, CA', lat: 38.5816, lng: -121.4944, zips: ['94203', '94204', '94205', '94206', '94207'] },
  { name: 'Pittsburgh Metro Area', scope: 'Pittsburgh, PA', lat: 40.4406, lng: -79.9959, zips: ['15201', '15202', '15203', '15204', '15205'] },
  { name: 'Las Vegas Metro Area', scope: 'Las Vegas, NV', lat: 36.1699, lng: -115.1398, zips: ['89101', '89102', '89103', '89104', '89105'] },
  { name: 'Austin Metro Area', scope: 'Austin, TX', lat: 30.2672, lng: -97.7431, zips: ['78701', '78702', '78703', '78704', '78705'] },
  { name: 'Cincinnati Metro Area', scope: 'Cincinnati, OH', lat: 39.1031, lng: -84.5120, zips: ['45201', '45202', '45203', '45204', '45205'] },
  { name: 'Kansas City Metro Area', scope: 'Kansas City, MO', lat: 39.0997, lng: -94.5786, zips: ['64101', '64102', '64105', '64106', '64108'] },
  { name: 'Columbus Metro Area', scope: 'Columbus, OH', lat: 39.9612, lng: -82.9988, zips: ['43201', '43202', '43203', '43204', '43205'] },
  { name: 'Indianapolis Metro Area', scope: 'Indianapolis, IN', lat: 39.7684, lng: -86.1581, zips: ['46201', '46202', '46203', '46204', '46205'] },
  { name: 'Cleveland Metro Area', scope: 'Cleveland, OH', lat: 41.4993, lng: -81.6944, zips: ['44101', '44102', '44103', '44104', '44105'] },
  { name: 'Nashville Metro Area', scope: 'Nashville, TN', lat: 36.1627, lng: -86.7816, zips: ['37201', '37202', '37203', '37204', '37205'] },
];

async function main() {
  console.log('🌆 Starting metro areas seed...\n');

  // Get admin user
  const admin = await prisma.user.findUnique({
    where: { email: 'contact@aalb.org' }
  });

  if (!admin) {
    console.error('❌ Admin user not found. Please run main seed first.');
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const metro of metroAreas) {
    // Check if already exists
    const existing = await prisma.community.findUnique({
      where: { name: metro.name }
    });

    if (existing) {
      console.log(`⏭️  Skipping ${metro.name} (already exists)`);
      skipped++;
      continue;
    }

    // Create the metro area
    await prisma.community.create({
      data: {
        name: metro.name,
        description: `Pet recovery community for the ${metro.scope} metropolitan area`,
        type: 'METRO_AREA',
        geographicScope: metro.scope,
        zipCodes: JSON.stringify(metro.zips),
        centerLatitude: metro.lat,
        centerLongitude: metro.lng,
        isActive: true,
        createdById: admin.id,
        approvedById: admin.id,
        approvedAt: new Date()
      }
    });

    console.log(`✅ Created ${metro.name}`);
    created++;
  }

  console.log(`\n🎉 Metro areas seed complete!`);
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total: ${metroAreas.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding metro areas:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
