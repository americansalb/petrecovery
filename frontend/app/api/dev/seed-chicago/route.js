import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import bcrypt from 'bcryptjs';

/**
 * POST /api/admin/seed-chicago
 *
 * Seeds the Chicago Rescue Squad with test data.
 * This endpoint should only be used in development.
 */
export async function POST() {
  try {
    console.log('Seeding Chicago Rescue Squad...');

    // Check if Chicago squad already exists
    const existing = await prisma.rescueSquad.findFirst({
      where: { city: { equals: 'Chicago', mode: 'insensitive' } },
    });

    if (existing) {
      return NextResponse.json({
        message: 'Chicago Rescue Squad already exists',
        squadId: existing.id,
        url: `/rescue-squads/${existing.id}`,
      });
    }

    // Create test users
    const passwordHash = await bcrypt.hash('testuser123', 10);

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
    }

    // Create Chicago Rescue Squad
    const chicagoSquad = await prisma.rescueSquad.create({
      data: {
        name: 'Chicago Rescue Squad',
        description: 'Helping reunite lost pets with their families across the Chicagoland area.',
        city: 'Chicago',
        state: 'IL',
        zipCodes: JSON.stringify(['60601', '60602', '60614', '60657']),
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

    // Create divisions
    const divisionsData = [
      { name: 'Lakeview', centerLatitude: 41.9435, centerLongitude: -87.6530, radiusMiles: 3 },
      { name: 'Lincoln Park', centerLatitude: 41.9214, centerLongitude: -87.6513, radiusMiles: 3 },
      { name: 'Logan Square', centerLatitude: 41.9247, centerLongitude: -87.7082, radiusMiles: 3 },
      { name: 'Wicker Park', centerLatitude: 41.9088, centerLongitude: -87.6796, radiusMiles: 3 },
      { name: 'South Loop', centerLatitude: 41.8569, centerLongitude: -87.6247, radiusMiles: 3 },
    ];

    const divisions = [];
    for (const divData of divisionsData) {
      const division = await prisma.division.create({
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
      divisions.push(division);
    }

    // Create squad members
    const memberAssignments = [
      { userIndex: 0, divisionIndex: 0, role: 'FOUNDER', isOnDuty: true },
      { userIndex: 1, divisionIndex: 0, role: 'MEMBER', isOnDuty: true },
      { userIndex: 2, divisionIndex: 0, role: 'MEMBER', isOnDuty: true },
      { userIndex: 3, divisionIndex: 1, role: 'LEADER', isOnDuty: true },
      { userIndex: 4, divisionIndex: 1, role: 'MEMBER', isOnDuty: true },
      { userIndex: 5, divisionIndex: 1, role: 'MEMBER', isOnDuty: false },
      { userIndex: 6, divisionIndex: 2, role: 'MEMBER', isOnDuty: false },
      { userIndex: 7, divisionIndex: 3, role: 'MEMBER', isOnDuty: false },
      { userIndex: 8, divisionIndex: 4, role: 'MEMBER', isOnDuty: false },
    ];

    const members = [];
    for (const ma of memberAssignments) {
      const user = users[ma.userIndex];
      const division = divisions[ma.divisionIndex];

      const member = await prisma.rescueSquadMember.create({
        data: {
          rescueSquadId: chicagoSquad.id,
          userId: user.id,
          divisionId: division.id,
          role: ma.role,
          isActive: true,
          isOnDuty: ma.isOnDuty,
          lastActiveAt: new Date(Date.now() - Math.random() * 6 * 60 * 60 * 1000),
          joinedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        },
      });
      members.push(member);
    }

    // Create test cases
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

    const reporter = users[0];
    const cases = [];

    for (let i = 0; i < casesData.length; i++) {
      const caseData = casesData[i];
      const caseNumber = `CHI-2024-${String(i + 1).padStart(4, '0')}`;

      const petCase = await prisma.case.create({
        data: {
          caseNumber,
          petName: caseData.petName,
          petSpecies: caseData.petSpecies,
          petBreed: caseData.petBreed,
          petColor: caseData.petColor,
          petSize: 'MEDIUM',
          petPhotoUrl: null,
          petDescription: `${caseData.petColor} ${caseData.petBreed}`,
          reporterId: reporter.id,
          ownerName: `${reporter.firstName} ${reporter.lastName}`,
          ownerPhone: '555-0100',
          ownerEmail: reporter.email,
          reportType: 'LOST',
          status: caseData.status,
          priority: caseData.hoursAgo < 24 ? 'URGENT' : 'NORMAL',
          lastSeenAt: new Date(Date.now() - caseData.hoursAgo * 60 * 60 * 1000),
          lastSeenLatitude: caseData.lastSeenLatitude,
          lastSeenLongitude: caseData.lastSeenLongitude,
          lastSeenAddress: caseData.lastSeenAddress,
          searchRadius: 5,
          escapeScenario: 'DOOR_DASH',
          hasReward: !!caseData.rewardAmount,
          rewardAmount: caseData.rewardAmount,
          resolvedAt: caseData.status === 'RESOLVED' ? new Date() : null,
          resolution: caseData.status === 'RESOLVED' ? 'REUNITED' : null,
        },
      });
      cases.push(petCase);
    }

    // Create case assignments
    for (const petCase of cases) {
      const assignment = await prisma.caseAssignment.create({
        data: {
          rescueSquadId: chicagoSquad.id,
          caseId: petCase.id,
          status: petCase.status === 'RESOLVED' ? 'COMPLETED' : 'ACTIVE',
          acceptedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
          acceptedById: members[0].userId,
        },
      });

      // Add participants
      const participantCount = Math.floor(Math.random() * 5) + 2;
      for (let i = 0; i < participantCount && i < members.length; i++) {
        try {
          await prisma.caseParticipant.create({
            data: {
              caseAssignmentId: assignment.id,
              userId: members[i].userId,
              role: i === 0 ? 'LEAD' : 'SEARCHER',
              isActive: true,
              joinedAt: new Date(Date.now() - Math.random() * 12 * 60 * 60 * 1000),
            },
          });
        } catch (e) {
          // Ignore duplicate errors
        }
      }
    }

    // Create activities
    const activityTypes = [
      { type: 'CASE_ACCEPTED', message: 'accepted case' },
      { type: 'MEMBER_JOINED', message: 'joined the squad' },
      { type: 'SIGHTING_REPORTED', message: 'reported a sighting' },
    ];

    for (let i = 0; i < 10; i++) {
      const actType = activityTypes[Math.floor(Math.random() * activityTypes.length)];
      const actor = members[Math.floor(Math.random() * members.length)];
      const petCase = cases[Math.floor(Math.random() * cases.length)];

      try {
        await prisma.squadActivity.create({
          data: {
            rescueSquadId: chicagoSquad.id,
            type: actType.type,
            message: actType.message,
            actorId: actor.userId,
            caseId: actType.type.startsWith('CASE') || actType.type === 'SIGHTING_REPORTED' ? petCase.id : null,
            details: JSON.stringify({}),
            createdAt: new Date(Date.now() - Math.random() * 48 * 60 * 60 * 1000),
          },
        });
      } catch (e) {
        // Ignore errors
      }
    }

    // Create help requests
    const requestsData = [
      {
        title: 'Need help putting up flyers in Lincoln Park',
        description: 'I have 200 flyers printed for Luna. Can meet at the Conservatory entrance.',
        creatorIndex: 5,
        caseIndex: 3,
      },
      {
        title: 'Looking for someone with a drone for aerial search',
        description: 'Max was spotted near Montrose Harbor yesterday. Would love drone footage.',
        creatorIndex: 1,
        caseIndex: 0,
      },
      {
        title: 'Can someone check under the Irving Park overpass?',
        description: 'Got a tip that a golden retriever matching Max description was seen there.',
        creatorIndex: 6,
        caseIndex: 0,
      },
      {
        title: 'Need a Spanish speaker for canvassing',
        description: 'Looking to post flyers and talk to neighbors in a primarily Spanish-speaking area of Logan Square.',
        creatorIndex: 0,
        caseIndex: null,
      },
    ];

    for (const req of requestsData) {
      const creator = users[req.creatorIndex];
      const petCase = req.caseIndex !== null ? cases[req.caseIndex] : null;

      try {
        await prisma.squadTask.create({
          data: {
            rescueSquadId: chicagoSquad.id,
            title: req.title,
            description: req.description,
            type: 'REQUEST',
            status: 'PENDING',
            priority: 'NORMAL',
            creatorId: creator.id,
            caseId: petCase?.id,
            createdAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
          },
        });
      } catch (e) {
        // Ignore errors
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Chicago Rescue Squad seeded successfully!',
      squadId: chicagoSquad.id,
      url: `/rescue-squads/${chicagoSquad.id}`,
      slugUrl: '/rescue-squads/chicago',
      testUsers: testUsers.map(u => u.email),
      password: 'testuser123',
      stats: {
        users: users.length,
        divisions: divisions.length,
        members: members.length,
        cases: cases.length,
      },
    });
  } catch (error) {
    console.error('Error seeding Chicago squad:', error);
    return NextResponse.json(
      { error: 'Failed to seed Chicago squad', details: error.message },
      { status: 500 }
    );
  }
}
