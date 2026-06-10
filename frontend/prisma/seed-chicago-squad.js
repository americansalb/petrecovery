/**
 * Seed script for Chicago Rescue Force with test data
 *
 * Creates:
 * - Chicago Rescue Force
 * - 5 divisions (Lakeview, Lincoln Park, Logan Square, Wicker Park, South Loop)
 * - Test members
 * - Test cases with assignments
 * - Test activities
 *
 * Run with: npx prisma db execute --file prisma/seed-chicago-squad.js
 * Or: node prisma/seed-chicago-squad.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Chicago Rescue Force...');

  // ============================================================================
  // CREATE TEST USERS
  // ============================================================================

  const passwordHash = await bcrypt.hash('testuser123', 10);

  // Create test users for the squad
  const testUsers = [
    { email: 'david@test.com', firstName: 'David', lastName: 'L.' },
    { email: 'sarah@test.com', firstName: 'Sarah', lastName: 'K.' },
    { email: 'jennifer@test.com', firstName: 'Jennifer', lastName: 'M.' },
    { email: 'alex@test.com', firstName: 'Alex', lastName: 'P.' },
    { email: 'chris@test.com', firstName: 'Chris', lastName: 'W.' },
    { email: 'maria@test.com', firstName: 'Maria', lastName: 'G.' },
    { email: 'tom@test.com', firstName: 'Tom', lastName: 'R.' },
    { email: 'rachel@test.com', firstName: 'Rachel', lastName: 'S.' },
    { email: 'mike@test.com', firstName: 'Mike', lastName: 'T.' },
  ];

  const users = [];
  for (const userData of testUsers) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        email: userData.email,
        passwordHash,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: 'USER',
        emailVerified: new Date(),
      },
    });
    users.push(user);
    console.log(`  ✅ User: ${user.email}`);
  }

  // ============================================================================
  // CREATE CHICAGO RESCUE FORCE
  // ============================================================================

  const chicagoSquad = await prisma.rescueForce.upsert({
    where: { name: 'Chicago Rescue Force' },
    update: {
      city: 'Chicago',
      state: 'IL',
      centerLatitude: 41.8781,
      centerLongitude: -87.6298,
      radiusMiles: 15,
      isActive: true,
      isAcceptingCases: true,
    },
    create: {
      name: 'Chicago Rescue Force',
      description: 'Helping reunite lost pets with their families across the Chicagoland area.',
      city: 'Chicago',
      state: 'IL',
      zipCodes: JSON.stringify(['60601', '60602', '60603', '60604', '60605', '60606', '60607', '60608', '60609', '60610', '60611', '60613', '60614', '60615', '60616', '60617', '60618', '60619', '60620', '60621', '60622', '60623', '60624', '60625', '60626', '60628', '60629', '60630', '60631', '60632', '60633', '60634', '60636', '60637', '60638', '60639', '60640', '60641', '60642', '60643', '60644', '60645', '60646', '60647', '60649', '60651', '60652', '60653', '60654', '60655', '60656', '60657', '60659', '60660', '60661']),
      coverageType: 'CITYWIDE',
      centerLatitude: 41.8781,
      centerLongitude: -87.6298,
      radiusMiles: 15,
      specializesInDogs: true,
      specializesInCats: true,
      specializesInBirds: true,
      specializesInOther: true,
      availableWeekdays: true,
      availableWeekends: true,
      availableDay: true,
      availableNight: true,
      hasTrackingDogs: true,
      hasDrones: true,
      isActive: true,
      isAcceptingCases: true,
    },
  });
  console.log(`  ✅ Squad: ${chicagoSquad.name} (${chicagoSquad.id})`);

  // ============================================================================
  // CREATE DIVISIONS
  // ============================================================================

  const divisionsData = [
    {
      name: 'Lakeview',
      centerLatitude: 41.9435,
      centerLongitude: -87.6530,
      radiusMiles: 3,
    },
    {
      name: 'Lincoln Park',
      centerLatitude: 41.9214,
      centerLongitude: -87.6513,
      radiusMiles: 3,
    },
    {
      name: 'Logan Square',
      centerLatitude: 41.9247,
      centerLongitude: -87.7082,
      radiusMiles: 3,
    },
    {
      name: 'Wicker Park',
      centerLatitude: 41.9088,
      centerLongitude: -87.6796,
      radiusMiles: 3,
    },
    {
      name: 'South Loop',
      centerLatitude: 41.8569,
      centerLongitude: -87.6247,
      radiusMiles: 3,
    },
  ];

  const divisions = [];
  for (const divData of divisionsData) {
    // Check if division exists
    let division = await prisma.division.findFirst({
      where: {
        rescueSquadId: chicagoSquad.id,
        name: divData.name,
      },
    });

    if (!division) {
      division = await prisma.division.create({
        data: {
          rescueSquadId: chicagoSquad.id,
          name: divData.name,
          description: `${divData.name} neighborhood division`,
          centerLatitude: divData.centerLatitude,
          centerLongitude: divData.centerLongitude,
          radiusMiles: divData.radiusMiles,
          isActive: true,
        },
      });
    }
    divisions.push(division);
    console.log(`  ✅ Division: ${division.name} (${division.id})`);
  }

  // ============================================================================
  // CREATE SQUAD MEMBERS
  // ============================================================================

  const memberAssignments = [
    { userIndex: 0, divisionIndex: 0, role: 'FOUNDER', isOnDuty: true },  // David - Lakeview, Founder
    { userIndex: 1, divisionIndex: 0, role: 'MEMBER', isOnDuty: true },   // Sarah - Lakeview
    { userIndex: 2, divisionIndex: 0, role: 'MEMBER', isOnDuty: true },   // Jennifer - Lakeview
    { userIndex: 3, divisionIndex: 1, role: 'LEADER', isOnDuty: true },   // Alex - Lincoln Park, Leader
    { userIndex: 4, divisionIndex: 1, role: 'MEMBER', isOnDuty: true },   // Chris - Lincoln Park
    { userIndex: 5, divisionIndex: 1, role: 'MEMBER', isOnDuty: false },  // Maria - Lincoln Park
    { userIndex: 6, divisionIndex: 2, role: 'MEMBER', isOnDuty: false },  // Tom - Logan Square
    { userIndex: 7, divisionIndex: 3, role: 'MEMBER', isOnDuty: false },  // Rachel - Wicker Park
    { userIndex: 8, divisionIndex: 4, role: 'MEMBER', isOnDuty: false },  // Mike - South Loop
  ];

  const members = [];
  for (const ma of memberAssignments) {
    const user = users[ma.userIndex];
    const division = divisions[ma.divisionIndex];

    // Check if member exists
    let member = await prisma.rescueForceMember.findFirst({
      where: {
        rescueSquadId: chicagoSquad.id,
        userId: user.id,
      },
    });

    if (!member) {
      member = await prisma.rescueForceMember.create({
        data: {
          rescueSquadId: chicagoSquad.id,
          userId: user.id,
          divisionId: division.id,
          role: ma.role,
          isActive: true,
          isOnDuty: ma.isOnDuty,
          lastActiveAt: new Date(Date.now() - Math.random() * 6 * 60 * 60 * 1000), // Random within last 6 hours
          joinedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random within last 30 days
        },
      });
    } else {
      // Update existing member
      member = await prisma.rescueForceMember.update({
        where: { id: member.id },
        data: {
          divisionId: division.id,
          role: ma.role,
          isOnDuty: ma.isOnDuty,
          lastActiveAt: new Date(Date.now() - Math.random() * 6 * 60 * 60 * 1000),
        },
      });
    }
    members.push(member);
    console.log(`  ✅ Member: ${user.firstName} ${user.lastName} (${ma.role})`);
  }

  // ============================================================================
  // CREATE TEST CASES
  // ============================================================================

  const casesData = [
    {
      petName: 'Max',
      petSpecies: 'DOG',
      petBreed: 'Golden Retriever',
      petColor: 'Golden',
      lastSeenAddress: '3200 N Clark St, Chicago, IL',
      lastSeenLatitude: 41.9350,
      lastSeenLongitude: -87.6520,
      hoursAgo: 2,
      status: 'ACTIVE',
      rewardAmount: 500,
    },
    {
      petName: 'Whiskers',
      petSpecies: 'CAT',
      petBreed: 'Tabby',
      petColor: 'Orange',
      lastSeenAddress: '2800 N Broadway, Chicago, IL',
      lastSeenLatitude: 41.9280,
      lastSeenLongitude: -87.6450,
      hoursAgo: 18,
      status: 'ACTIVE',
      rewardAmount: null,
    },
    {
      petName: 'Buddy',
      petSpecies: 'DOG',
      petBreed: 'Beagle',
      petColor: 'Tri-color',
      lastSeenAddress: '3500 N Ashland Ave, Chicago, IL',
      lastSeenLatitude: 41.9420,
      lastSeenLongitude: -87.6580,
      hoursAgo: 96,
      status: 'ACTIVE',
      rewardAmount: 200,
    },
    {
      petName: 'Luna',
      petSpecies: 'CAT',
      petBreed: 'Siamese',
      petColor: 'Cream',
      lastSeenAddress: '2000 N Lincoln Park West, Chicago, IL',
      lastSeenLatitude: 41.9180,
      lastSeenLongitude: -87.6350,
      hoursAgo: 5,
      status: 'ACTIVE',
      rewardAmount: 300,
    },
    {
      petName: 'Charlie',
      petSpecies: 'DOG',
      petBreed: 'French Bulldog',
      petColor: 'Brindle',
      lastSeenAddress: '1800 N Clark St, Chicago, IL',
      lastSeenLatitude: 41.9080,
      lastSeenLongitude: -87.6420,
      hoursAgo: 36,
      status: 'ACTIVE',
      rewardAmount: null,
    },
    {
      petName: 'Milo',
      petSpecies: 'CAT',
      petBreed: 'Maine Coon',
      petColor: 'Gray',
      lastSeenAddress: '2500 N Milwaukee Ave, Chicago, IL',
      lastSeenLatitude: 41.9250,
      lastSeenLongitude: -87.7050,
      hoursAgo: 24,
      status: 'ACTIVE',
      rewardAmount: 150,
    },
    {
      petName: 'Rocky',
      petSpecies: 'DOG',
      petBreed: 'Pit Bull Mix',
      petColor: 'White',
      lastSeenAddress: '1200 S Michigan Ave, Chicago, IL',
      lastSeenLatitude: 41.8650,
      lastSeenLongitude: -87.6280,
      hoursAgo: 120,
      status: 'ACTIVE',
      rewardAmount: null,
    },
    {
      petName: 'Bella',
      petSpecies: 'DOG',
      petBreed: 'Labrador',
      petColor: 'Black',
      lastSeenAddress: '3400 N Halsted St, Chicago, IL',
      lastSeenLatitude: 41.9380,
      lastSeenLongitude: -87.6550,
      hoursAgo: 168,
      status: 'RESOLVED',
      rewardAmount: 250,
    },
  ];

  const reporter = users[0]; // David is the reporter for test cases
  const cases = [];

  for (let i = 0; i < casesData.length; i++) {
    const missionData = casesData[i];
    const missionNumber = `CHI-2024-${String(i + 1).padStart(4, '0')}`;

    // Check if case exists
    let petCase = await prisma.case.findUnique({
      where: { missionNumber },
    });

    if (!petCase) {
      petCase = await prisma.case.create({
        data: {
          missionNumber,
          petName: missionData.petName,
          petSpecies: missionData.petSpecies,
          petBreed: missionData.petBreed,
          petColor: missionData.petColor,
          petSize: 'MEDIUM',
          petPhotoUrl: null,
          petDescription: `${missionData.petColor} ${missionData.petBreed}`,
          reporterId: reporter.id,
          ownerName: `${reporter.firstName} ${reporter.lastName}`,
          ownerPhone: '555-0100',
          ownerEmail: reporter.email,
          reportType: 'LOST',
          status: missionData.status,
          priority: missionData.hoursAgo < 24 ? 'URGENT' : 'NORMAL',
          lastSeenAt: new Date(Date.now() - missionData.hoursAgo * 60 * 60 * 1000),
          lastSeenLatitude: missionData.lastSeenLatitude,
          lastSeenLongitude: missionData.lastSeenLongitude,
          lastSeenAddress: missionData.lastSeenAddress,
          searchRadius: 5,
          escapeScenario: 'DOOR_DASH',
          hasReward: !!missionData.rewardAmount,
          rewardAmount: missionData.rewardAmount,
          resolvedAt: missionData.status === 'RESOLVED' ? new Date() : null,
          resolution: missionData.status === 'RESOLVED' ? 'REUNITED' : null,
        },
      });
    }
    cases.push(petCase);
    console.log(`  ✅ Case: ${petCase.petName} (${petCase.missionNumber})`);
  }

  // ============================================================================
  // CREATE CASE ASSIGNMENTS
  // ============================================================================

  for (const petCase of cases) {
    // Check if assignment exists
    let assignment = await prisma.caseAssignment.findFirst({
      where: {
        rescueSquadId: chicagoSquad.id,
        missionId: petCase.id,
      },
    });

    if (!assignment) {
      assignment = await prisma.caseAssignment.create({
        data: {
          rescueSquadId: chicagoSquad.id,
          missionId: petCase.id,
          status: petCase.status === 'RESOLVED' ? 'COMPLETED' : 'ACTIVE',
          acceptedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
          acceptedById: members[0].userId, // David accepted all cases
        },
      });

      // Add some participants
      const participantCount = Math.floor(Math.random() * 5) + 2; // 2-6 participants
      for (let i = 0; i < participantCount && i < members.length; i++) {
        await prisma.caseParticipant.create({
          data: {
            caseAssignmentId: assignment.id,
            userId: members[i].userId,
            role: i === 0 ? 'LEAD' : 'SEARCHER',
            isActive: true,
            joinedAt: new Date(Date.now() - Math.random() * 12 * 60 * 60 * 1000),
          },
        }).catch(() => {}); // Ignore duplicates
      }
    }
    console.log(`  ✅ Assignment: ${petCase.petName} -> ${chicagoSquad.name}`);
  }

  // ============================================================================
  // CREATE ACTIVITIES
  // ============================================================================

  const activityTypes = [
    { type: 'CASE_ACCEPTED', message: 'accepted case' },
    { type: 'MEMBER_JOINED', message: 'joined the rescue force' },
    { type: 'SIGHTING_REPORTED', message: 'reported a sighting' },
    { type: 'CASE_RESOLVED', message: 'case resolved - pet reunited!' },
  ];

  for (let i = 0; i < 10; i++) {
    const actType = activityTypes[Math.floor(Math.random() * activityTypes.length)];
    const actor = members[Math.floor(Math.random() * members.length)];
    const petCase = cases[Math.floor(Math.random() * cases.length)];

    await prisma.squadActivity.create({
      data: {
        rescueSquadId: chicagoSquad.id,
        type: actType.type,
        message: actType.message,
        actorId: actor.userId,
        missionId: actType.type.startsWith('CASE') || actType.type === 'SIGHTING_REPORTED' ? petCase.id : null,
        details: JSON.stringify({}),
        createdAt: new Date(Date.now() - Math.random() * 48 * 60 * 60 * 1000),
      },
    }).catch(() => {}); // Ignore duplicates
  }
  console.log('  ✅ Activities created');

  // ============================================================================
  // CREATE HELP REQUESTS (SquadTask with type REQUEST)
  // ============================================================================

  const requestsData = [
    {
      title: 'Need help putting up flyers in Lincoln Park',
      description: 'I have 200 flyers printed for Luna. Can meet at the Conservatory entrance.',
      creatorIndex: 5, // Maria
      caseIndex: 3, // Luna
    },
    {
      title: 'Looking for someone with a drone for aerial search',
      description: 'Max was spotted near Montrose Harbor yesterday. Would love drone footage.',
      creatorIndex: 1, // Sarah
      caseIndex: 0, // Max
    },
    {
      title: 'Can someone check under the Irving Park overpass?',
      description: 'Got a tip that a golden retriever matching Max description was seen there.',
      creatorIndex: 6, // Tom
      caseIndex: 0, // Max
    },
    {
      title: 'Need a Spanish speaker for canvassing',
      description: 'Looking to post flyers and talk to neighbors in a primarily Spanish-speaking area of Logan Square.',
      creatorIndex: 0, // David
      caseIndex: null, // General request
    },
  ];

  for (const req of requestsData) {
    const creator = users[req.creatorIndex];
    const petCase = req.caseIndex !== null ? cases[req.caseIndex] : null;

    await prisma.squadTask.create({
      data: {
        rescueSquadId: chicagoSquad.id,
        title: req.title,
        description: req.description,
        type: 'REQUEST',
        status: 'PENDING',
        priority: 'NORMAL',
        creatorId: creator.id,
        missionId: petCase?.id,
        createdAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
      },
    }).catch(() => {}); // Ignore duplicates
  }
  console.log('  ✅ Help requests created');

  console.log('\n🎉 Chicago Rescue Force seeded successfully!');
  console.log(`\n📋 Squad ID: ${chicagoSquad.id}`);
  console.log(`   Access the hub at: /rescue-forces/${chicagoSquad.id}`);
  console.log('\n📧 Test Users (password: testuser123):');
  for (const user of users) {
    console.log(`   - ${user.email}`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
