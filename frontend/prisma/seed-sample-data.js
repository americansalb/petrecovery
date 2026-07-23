/**
 * Local-dev sample data for screenshotting every page.
 * Creates: a local admin, regular users, pets (with meds/shares),
 * lost+found cases (with sightings, updates, mission control),
 * a rescue force (divisions, members, posts, tasks, activity),
 * forum categories/threads/posts, a conversation with messages,
 * shelters, alerts, and notifications.
 *
 * Idempotent-ish: safe to re-run (uses upsert/find-first guards).
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

const PASSWORD = 'LocalDevScreenshots1!';

async function upsertUser(email, firstName, lastName, role = 'USER') {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: { role },
    create: {
      email,
      passwordHash,
      firstName,
      lastName,
      role,
      emailVerified: new Date(),
      tosAcceptedAt: new Date(),
      tosVersionAccepted: '1.0.0',
    },
  });
}

async function main() {
  console.log('Seeding sample data for screenshots...');

  // ---- Users ----
  const admin = await upsertUser('admin@localdev.test', 'Avery', 'Admin', 'ADMIN');
  const sarah = await upsertUser('sarah@localdev.test', 'Sarah', 'Chen');
  const mike = await upsertUser('mike@localdev.test', 'Mike', 'Rodriguez');
  const david = await upsertUser('david@localdev.test', 'David', 'Lee');
  console.log('users ok');

  // ---- Pets (owned by admin so the logged-in session sees them) ----
  let max = await prisma.pet.findFirst({ where: { name: 'Max', ownerId: admin.id } });
  if (!max) {
    max = await prisma.pet.create({
      data: {
        ownerId: admin.id,
        name: 'Max',
        species: 'DOG',
        breed: 'Golden Retriever',
        age: 4,
        sex: 'MALE',
        isNeutered: true,
        color: 'Golden',
        size: 'LARGE',
        weight: 65,
        distinctiveMarks: 'White patch on chest, blue collar with bone tag',
        microchipId: '985112004567890',
        collarInfo: 'Blue collar, bone-shaped tag with phone number',
        personality: JSON.stringify(['friendly', 'energetic', 'food-motivated']),
        medicalConditions: 'Seasonal allergies',
        photos: JSON.stringify(['/seed/max.svg']),
        primaryPhotoUrl: '/seed/max.svg',
        publicViewToken: crypto.randomBytes(32).toString('base64url'),
      },
    });
  }
  let luna = await prisma.pet.findFirst({ where: { name: 'Luna', ownerId: admin.id } });
  if (!luna) {
    luna = await prisma.pet.create({
      data: {
        ownerId: admin.id,
        name: 'Luna',
        species: 'CAT',
        breed: 'Domestic Shorthair',
        age: 2,
        sex: 'FEMALE',
        color: 'Black',
        size: 'SMALL',
        weight: 9,
        distinctiveMarks: 'Green eyes, tiny white spot on tail tip',
        personality: JSON.stringify(['shy', 'indoor-only']),
        photos: JSON.stringify(['/seed/luna.svg']),
        primaryPhotoUrl: '/seed/luna.svg',
        publicViewToken: crypto.randomBytes(32).toString('base64url'),
      },
    });
  }
  console.log('pets ok:', max.id, luna.id);

  // Medication + dose for Max
  let med = await prisma.petMedication.findFirst({ where: { petId: max.id } });
  if (!med) {
    med = await prisma.petMedication.create({
      data: {
        petId: max.id,
        name: 'Apoquel',
        strength: '16 mg',
        form: 'PILL',
        purpose: 'Seasonal allergies',
        prescribedBy: 'Austin Vet Clinic',
        instructions: 'Give with food',
        scheduleType: 'DAILY',
        timesOfDay: JSON.stringify(['08:00', '20:00']),
        quantityRemaining: 42,
        refillAlertAt: 10,
      },
    });
  }

  // Share Luna with Sarah
  await prisma.petShare.upsert({
    where: { petId_email: { petId: luna.id, email: 'sarah@localdev.test' } },
    update: {},
    create: {
      petId: luna.id,
      email: 'sarah@localdev.test',
      userId: sarah.id,
      role: 'CAREGIVER',
      status: 'ACTIVE',
      invitedById: admin.id,
      respondedAt: new Date(),
    },
  });

  // ---- Cases ----
  const caseDefs = [
    {
      caseNumber: 'AUS-2026-0001',
      petId: max.id,
      petName: 'Max',
      petSpecies: 'DOG',
      petBreed: 'Golden Retriever',
      petColor: 'Golden',
      petSize: 'LARGE',
      petPhotoUrl: '/seed/max.svg',
      petDescription:
        'Friendly 4-year-old golden retriever. White patch on chest, wearing a blue collar. Responds to "Max". Microchipped.',
      reporterId: admin.id,
      ownerName: 'Avery Admin',
      ownerPhone: '512-555-0100',
      ownerEmail: 'admin@localdev.test',
      reportType: 'LOST',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      lastSeenAt: new Date(Date.now() - 18 * 3600e3),
      lastSeenLatitude: 30.2729,
      lastSeenLongitude: -97.7444,
      lastSeenAddress: 'Zilker Park, Austin, TX 78704',
      searchRadius: 5,
      escapeScenario: 'DOOR_DASH',
      escapeDetails: 'Slipped out the front door during a delivery.',
      hasReward: true,
      rewardAmount: 500,
      viewCount: 312,
      shareCount: 47,
      activeSearchers: 6,
    },
    {
      caseNumber: 'AUS-2026-0002',
      petName: 'Whiskers',
      petSpecies: 'CAT',
      petBreed: 'Tabby',
      petColor: 'Orange',
      petSize: 'SMALL',
      petPhotoUrl: '/seed/luna.svg',
      petDescription: 'Orange tabby, very shy. Slipped out a window screen at night.',
      reporterId: sarah.id,
      ownerName: 'Sarah Chen',
      ownerPhone: '512-555-0101',
      ownerEmail: 'sarah@localdev.test',
      reportType: 'LOST',
      status: 'ACTIVE',
      priority: 'NORMAL',
      lastSeenAt: new Date(Date.now() - 40 * 3600e3),
      lastSeenLatitude: 30.295,
      lastSeenLongitude: -97.7404,
      lastSeenAddress: 'Hyde Park, Austin, TX 78751',
      searchRadius: 2,
      escapeScenario: 'WINDOW_ESCAPE',
      hasReward: false,
      viewCount: 88,
      shareCount: 12,
    },
    {
      caseNumber: 'AUS-2026-0003',
      petName: 'Unknown (found)',
      petSpecies: 'DOG',
      petBreed: 'Golden Retriever',
      petColor: 'Golden',
      petSize: 'LARGE',
      petPhotoUrl: '/seed/buddy.svg',
      petDescription:
        'Found a friendly golden retriever near Barton Springs, no tags but wearing a blue collar.',
      reporterId: mike.id,
      ownerName: 'Mike Rodriguez',
      ownerPhone: '512-555-0102',
      ownerEmail: 'mike@localdev.test',
      reportType: 'FOUND',
      status: 'ACTIVE',
      priority: 'NORMAL',
      lastSeenAt: new Date(Date.now() - 6 * 3600e3),
      lastSeenLatitude: 30.2642,
      lastSeenLongitude: -97.7713,
      lastSeenAddress: 'Barton Springs Rd, Austin, TX 78746',
      searchRadius: 3,
      escapeScenario: 'FOUND_WANDERING',
    },
    {
      caseNumber: 'AUS-2025-0099',
      petName: 'Biscuit',
      petSpecies: 'DOG',
      petBreed: 'Beagle',
      petColor: 'Tricolor',
      petSize: 'MEDIUM',
      petPhotoUrl: '/seed/buddy.svg',
      petDescription: 'Beagle who chased a squirrel and got lost. Reunited after 3 days!',
      reporterId: david.id,
      ownerName: 'David Lee',
      ownerPhone: '512-555-0103',
      ownerEmail: 'david@localdev.test',
      reportType: 'LOST',
      status: 'REUNITED',
      priority: 'NORMAL',
      lastSeenAt: new Date(Date.now() - 21 * 86400e3),
      lastSeenLatitude: 30.25,
      lastSeenLongitude: -97.75,
      lastSeenAddress: 'Travis Heights, Austin, TX 78704',
      searchRadius: 4,
      escapeScenario: 'CHASED_ANIMAL',
      resolvedAt: new Date(Date.now() - 18 * 86400e3),
      resolution: 'REUNITED',
      resolutionNotes: 'Found by a rescue force volunteer two blocks away.',
      foundById: sarah.id,
    },
  ];

  const cases = {};
  for (const def of caseDefs) {
    cases[def.caseNumber] = await prisma.case.upsert({
      where: { caseNumber: def.caseNumber },
      update: {},
      create: def,
    });
  }
  const maxCase = cases['AUS-2026-0001'];
  console.log('cases ok');

  // Sightings + updates on Max's case
  if (!(await prisma.caseSighting.findFirst({ where: { missionId: maxCase.id } }))) {
    await prisma.caseSighting.create({
      data: {
        missionId: maxCase.id,
        reportedById: sarah.id,
        sightedAt: new Date(Date.now() - 10 * 3600e3),
        latitude: 30.2675,
        longitude: -97.7551,
        address: 'Barton Creek Greenbelt trailhead',
        description: 'Saw a golden retriever matching Max heading west along the creek.',
        certaintyLevel: 4,
        isVerified: true,
        verifiedBy: admin.id,
        verifiedAt: new Date(Date.now() - 9 * 3600e3),
      },
    });
    await prisma.caseSighting.create({
      data: {
        missionId: maxCase.id,
        reportedById: mike.id,
        sightedAt: new Date(Date.now() - 4 * 3600e3),
        latitude: 30.2648,
        longitude: -97.7689,
        address: 'Near Barton Springs Pool',
        description: 'Golden dog with blue collar drinking from the spillway.',
        certaintyLevel: 5,
      },
    });
  }
  if (!(await prisma.caseUpdate.findFirst({ where: { caseId: maxCase.id } }))) {
    await prisma.caseUpdate.create({
      data: {
        caseId: maxCase.id,
        authorId: admin.id,
        content: 'Max is microchipped and very food motivated — try hot dogs! Please do not chase him.',
        isUpdate: true,
        isPinned: true,
      },
    });
    await prisma.caseUpdate.create({
      data: {
        caseId: maxCase.id,
        authorId: sarah.id,
        content: 'Posted flyers along the greenbelt entrances this morning.',
      },
    });
  }

  // Mission control for Max's case
  await prisma.missionControl.upsert({
    where: { caseId: maxCase.id },
    update: {},
    create: {
      caseId: maxCase.id,
      mode: 'LIVE_SEARCH',
      activatedAt: new Date(Date.now() - 12 * 3600e3),
      activatedById: admin.id,
      activatorRole: 'OWNER',
      initialRadius: 3,
    },
  });

  // ---- Rescue Force ----
  let force = await prisma.rescueForce.findFirst({ where: { name: 'Austin Rescue Force' } });
  if (!force) {
    force = await prisma.rescueForce.create({
      data: {
        name: 'Austin Rescue Force',
        description:
          'Volunteers reuniting lost pets with their families across greater Austin. Trained search teams, drone pilots, and trap-savvy cat people.',
        slogan: 'Every pet comes home.',
        city: 'Austin',
        state: 'TX',
        country: 'US',
        zipCode: '78704',
        zipCodes: JSON.stringify(['78701', '78704', '78751']),
        coverageType: 'CITYWIDE',
        centerLatitude: 30.2672,
        centerLongitude: -97.7431,
        radiusMiles: 15,
        specializesInBirds: true,
        specializesInOther: true,
        availableNight: true,
        hasTrackingDogs: true,
        hasDrones: true,
        totalCasesAccepted: 23,
        totalCasesCompleted: 19,
        successfulReunions: 17,
        totalSearchHours: 412,
        rescueSquadLevel: 'VETERAN',
        squadPoints: 4350,
        badges: JSON.stringify(['first_reunion', 'night_owls']),
      },
    });
  }

  const divisions = {};
  for (const dname of ['North Austin', 'South Austin']) {
    divisions[dname] = await prisma.division.upsert({
      where: { rescueSquadId_name: { rescueSquadId: force.id, name: dname } },
      update: {},
      create: {
        rescueSquadId: force.id,
        name: dname,
        description: `${dname} neighborhoods coverage`,
        centerLatitude: dname === 'North Austin' ? 30.35 : 30.22,
        centerLongitude: -97.74,
        radiusMiles: 5,
        totalMembers: 2,
      },
    });
  }

  const memberDefs = [
    [admin.id, 'FOUNDER', null],
    [sarah.id, 'LEADER', divisions['North Austin'].id],
    [mike.id, 'MEMBER', divisions['South Austin'].id],
    [david.id, 'MEMBER', divisions['North Austin'].id],
  ];
  for (const [userId, role, divisionId] of memberDefs) {
    await prisma.rescueForceMember.upsert({
      where: { rescueSquadId_userId: { rescueSquadId: force.id, userId } },
      update: { role, divisionId },
      create: {
        rescueSquadId: force.id,
        userId,
        role,
        divisionId,
        casesParticipated: 5,
        successfulReunions: 2,
        searchHours: 24,
      },
    });
  }
  console.log('rescue force ok:', force.id);

  // Assignment of Max's case to the force
  const assignment = await prisma.caseAssignment.upsert({
    where: { missionId_rescueSquadId: { missionId: maxCase.id, rescueSquadId: force.id } },
    update: {},
    create: {
      missionId: maxCase.id,
      rescueSquadId: force.id,
      status: 'ACTIVE',
      acceptedById: admin.id,
      activeMembers: 4,
      searchHours: 18,
      areasSearched: 6,
    },
  });
  for (const userId of [admin.id, sarah.id, mike.id]) {
    await prisma.caseParticipant.upsert({
      where: { assignmentId_userId: { assignmentId: assignment.id, userId } },
      update: {},
      create: { assignmentId: assignment.id, userId, searchHours: 6, areasMarked: 2 },
    });
  }

  // Squad activity, tasks, posts
  if (!(await prisma.squadActivity.findFirst({ where: { rescueSquadId: force.id } }))) {
    const acts = [
      ['CASE_ACCEPTED', 'Austin Rescue Force accepted mission AUS-2026-0001 (Max)', admin.id],
      ['SIGHTING_REPORTED', 'Sarah reported a verified sighting near Barton Creek', sarah.id],
      ['MEMBER_JOINED', 'David joined the rescue force', david.id],
    ];
    for (const [type, message, actorId] of acts) {
      await prisma.squadActivity.create({
        data: { rescueSquadId: force.id, type, message, actorId, caseId: maxCase.id },
      });
    }
  }
  if (!(await prisma.squadTask.findFirst({ where: { rescueSquadId: force.id } }))) {
    await prisma.squadTask.create({
      data: {
        rescueSquadId: force.id,
        caseId: maxCase.id,
        title: 'Search Barton Creek Greenbelt east entrance',
        description: 'Walk the loop with treats; Max was last sighted heading west along the creek.',
        type: 'SEARCH_AREA',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        latitude: 30.2675,
        longitude: -97.7551,
        address: 'Barton Creek Greenbelt',
        createdById: admin.id,
        assignedToId: sarah.id,
        priorityScore: 80,
      },
    });
    await prisma.squadTask.create({
      data: {
        rescueSquadId: force.id,
        caseId: maxCase.id,
        title: 'Call Austin Animal Center',
        description: 'Check intakes for a golden retriever with a blue collar.',
        type: 'SHELTER_CHECK',
        priority: 'MEDIUM',
        status: 'AVAILABLE',
        createdById: admin.id,
        priorityScore: 55,
      },
    });
  }
  if (!(await prisma.squadPost.findFirst({ where: { rescueSquadId: force.id } }))) {
    const post = await prisma.squadPost.create({
      data: {
        rescueSquadId: force.id,
        authorId: sarah.id,
        title: 'Greenbelt search recap — promising trail!',
        content:
          'We covered the east loop today. Two independent sightings put Max near the spillway. Tomorrow we set up a feeding station with a camera.',
        upvotes: 12,
        commentCount: 1,
      },
    });
    await prisma.squadPostComment.create({
      data: {
        postId: post.id,
        authorId: mike.id,
        content: 'I can bring my trail cam at 7am. Count me in.',
        upvotes: 4,
      },
    });
  }

  // ---- Forum (hub) ----
  const catDefs = [
    ['Lost Pet Help', 'lost-pet-help', 'Tips and coordination for active lost pet searches', '🆘', '#ef4444'],
    ['Success Stories', 'success-stories', 'Reunions and happy endings', '🎉', '#10b981'],
    ['General Discussion', 'general', 'Everything else pets', '💬', '#6366f1'],
  ];
  const forumCats = {};
  for (let i = 0; i < catDefs.length; i++) {
    const [name, slug, description, icon, color] = catDefs[i];
    forumCats[slug] = await prisma.forumCategory.upsert({
      where: { slug },
      update: {},
      create: { name, slug, description, icon, color, displayOrder: i, threadCount: slug === 'lost-pet-help' ? 1 : 0 },
    });
  }
  let thread = await prisma.forumThread.findFirst({ where: { slug: 'tips-for-shy-cats-hiding-nearby' } });
  if (!thread) {
    thread = await prisma.forumThread.create({
      data: {
        title: 'Tips for shy cats hiding nearby — what worked for you?',
        slug: 'tips-for-shy-cats-hiding-nearby',
        categoryId: forumCats['lost-pet-help'].id,
        authorId: sarah.id,
        content:
          'My orange tabby Whiskers slipped out two nights ago. I know indoor cats usually hide within a few houses. What actually worked to lure yours out? Humane trap? Sock trail? Sitting outside at 2am with tuna?',
        locationTag: 'Austin, TX',
        latitude: 30.295,
        longitude: -97.7404,
        urgencyLevel: 'URGENT',
        viewCount: 64,
        replyCount: 2,
        lastActivityAt: new Date(),
      },
    });
    await prisma.forumPost.create({
      data: {
        threadId: thread.id,
        authorId: admin.id,
        content:
          'Humane trap + her used litter box outside worked for us in under 48 hours. Cats track their own scent home.',
        isAccepted: true,
      },
    }).catch(async () => {
      await prisma.forumPost.create({
        data: {
          threadId: thread.id,
          authorId: admin.id,
          content:
            'Humane trap + her used litter box outside worked for us in under 48 hours. Cats track their own scent home.',
        },
      });
    });
    await prisma.forumPost.create({
      data: {
        threadId: thread.id,
        authorId: mike.id,
        content: 'Trail camera pointed at a feeding station tells you if she is still in the area before you commit to trapping.',
      },
    });
  }
  for (const u of [admin, sarah, mike]) {
    await prisma.forumProfile.upsert({
      where: { userId: u.id },
      update: {},
      create: {
        userId: u.id,
        bio: `${u.firstName} — Austin Rescue Force volunteer`,
        location: 'Austin, TX',
        trustLevel: 2,
        reputation: 120,
        postsCount: 2,
        threadsCount: 1,
        lastActiveAt: new Date(),
      },
    });
  }
  console.log('forum ok:', thread.slug);

  // ---- Conversation between Max's owner (admin) and finder (mike) ----
  let convo = await prisma.conversation.findFirst({
    where: { lostCaseId: maxCase.id, foundCaseId: cases['AUS-2026-0003'].id },
  });
  if (!convo) {
    convo = await prisma.conversation.create({
      data: {
        lostCaseId: maxCase.id,
        foundCaseId: cases['AUS-2026-0003'].id,
        ownerId: admin.id,
        finderId: mike.id,
        matchScore: 92,
        matchDetails: JSON.stringify({ species: 30, breed: 25, color: 20, location: 17 }),
        status: 'ACTIVE',
        lastMessageAt: new Date(),
      },
    });
    const msgs = [
      [admin.id, 'OWNER', 'Hi! I think the dog you found might be my Max — golden retriever, blue collar, white chest patch?'],
      [mike.id, 'FINDER', 'Yes! Blue collar with a bone tag. He is safe at my place near Barton Springs. Very sweet boy.'],
      [admin.id, 'OWNER', 'That is him!! Can we meet this evening? I can bring his vet records and photos.'],
    ];
    for (const [senderId, senderRole, content] of msgs) {
      await prisma.directMessage.create({
        data: { conversationId: convo.id, senderId, senderRole, content },
      });
    }
  }
  console.log('conversation ok:', convo.id);

  // ---- Health Book: stamps and weights for Max ----
  if (!(await prisma.petVaccination.findFirst({ where: { petId: max.id } }))) {
    const yr = 365 * 86400e3;
    await prisma.petVaccination.createMany({
      data: [
        { petId: max.id, name: 'Rabies', administeredAt: new Date(Date.now() - 0.7 * yr), expiresAt: new Date(Date.now() + 2.3 * yr), vetName: 'Dr. Reyes, Austin Vet Clinic' },
        { petId: max.id, name: 'DHPP', administeredAt: new Date(Date.now() - 0.4 * yr), expiresAt: new Date(Date.now() + 0.6 * yr), vetName: 'Dr. Reyes, Austin Vet Clinic' },
        { petId: max.id, name: 'Bordetella', administeredAt: new Date(Date.now() - 0.95 * yr), expiresAt: new Date(Date.now() + 30 * 86400e3) },
      ],
    });
    const weights = [66.5, 66, 65.5, 65.8, 65.2, 65, 65];
    await prisma.petWeightEntry.createMany({
      data: weights.map((w, i) => ({
        petId: max.id,
        weightLbs: w,
        recordedAt: new Date(Date.now() - (weights.length - 1 - i) * 30 * 86400e3),
      })),
    });
    await prisma.pet.update({
      where: { id: max.id },
      data: { vetName: 'Dr. Reyes', vetClinic: 'Austin Vet Clinic', vetPhone: '512-555-0188' },
    });
  }

  // ---- Shelters ----
  const shelterDefs = [
    ['Austin Animal Center', '7201 Levander Loop', 'Austin', 'TX', '78702', 30.2521, -97.6889],
    ['Austin Pets Alive!', '1156 W Cesar Chavez St', 'Austin', 'TX', '78703', 30.2711, -97.7587],
  ];
  for (const [name, address, city, state, zipCode, latitude, longitude] of shelterDefs) {
    const existing = await prisma.shelter.findFirst({ where: { name } });
    if (!existing) {
      await prisma.shelter.create({
        data: {
          name,
          type: 'SHELTER',
          address,
          city,
          state,
          zipCode,
          latitude,
          longitude,
          phone: '512-555-0199',
          website: 'https://example.org',
          acceptsStrays: true,
          isNoKill: name.includes('Alive'),
          isVerified: true,
        },
      });
    }
  }

  // ---- Shelter account demo: admin claims a shelter with a full roster ----
  // Makes /shelter/dashboard and /shelters/[id] demo every feature:
  // intake/status chips, a pending stray match, a team seat, public page.
  const claimedShelter = await prisma.shelter.findFirst({ where: { name: 'Austin Animal Center' } });
  if (claimedShelter) {
    const existingProfile = await prisma.shelterProfile.findUnique({
      where: { shelterId: claimedShelter.id },
    });
    if (!existingProfile) {
      await prisma.shelterProfile.create({
        data: {
          shelterId: claimedShelter.id,
          claimedById: admin.id,
          claimedAt: new Date(),
          mission: 'Every animal deserves a warm bed and a second chance.',
          about:
            'Austin Animal Center takes in strays and surrenders from all of Travis County. ' +
            'Come meet our adoptable animals, or check here first if your pet has gone missing.',
          strayHoldDays: 5,
        },
      });
    } else if (existingProfile.strayHoldDays == null) {
      await prisma.shelterProfile.update({
        where: { shelterId: claimedShelter.id },
        data: { strayHoldDays: 5 },
      });
    }
    const rosterPet = await prisma.pet.findFirst({
      where: { managedByShelterId: claimedShelter.id },
    });
    if (!rosterPet) {
      const clover = await prisma.pet.create({
        data: {
          ownerId: admin.id,
          managedByShelterId: claimedShelter.id,
          name: 'Clover',
          species: 'CAT',
          breed: 'Domestic Shorthair',
          age: 2,
          sex: 'FEMALE',
          color: 'Gray tabby',
          size: 'SMALL',
          personality: JSON.stringify(['Gentle', 'Curious']),
          photos: '[]',
          primaryPhotoUrl: '',
          shelterStatus: 'AVAILABLE',
          intakeType: 'STRAY',
          intakeDate: new Date(Date.now() - 3 * 86400e3),
          intakeFoundAddress: 'Barton Springs Rd, Austin, TX',
          intakeFoundLatitude: 30.264,
          intakeFoundLongitude: -97.771,
        },
      });
      await prisma.pet.create({
        data: {
          ownerId: admin.id,
          managedByShelterId: claimedShelter.id,
          name: 'Rufus',
          species: 'DOG',
          breed: 'Boxer Mix',
          age: 4,
          sex: 'MALE',
          color: 'Brown and white',
          size: 'LARGE',
          personality: JSON.stringify(['Playful', 'Loyal']),
          photos: '[]',
          primaryPhotoUrl: '',
          shelterStatus: 'ADOPTION_PENDING',
          intakeType: 'SURRENDER',
          intakeDate: new Date(Date.now() - 12 * 86400e3),
        },
      });
      // A stray-vs-lost match waiting for shelter review (the confirm-first flow)
      const lostForMatch = cases['AUS-2026-0002'];
      if (lostForMatch) {
        await prisma.shelterStrayMatch.create({
          data: {
            petId: clover.id,
            shelterId: claimedShelter.id,
            caseId: lostForMatch.id,
            score: 68,
            pTrueMatch: 0.74,
            band: 'actionable',
            matchSource: 'attribute',
            direction: 'STRAY_INTAKE',
            visualVerdict: 'SAME',
            visualConfidence: 0.82,
          },
        }).catch(() => {});
      }
      // One ACTIVE staff seat so the team card demos populated
      await prisma.shelterMember.create({
        data: {
          shelterId: claimedShelter.id,
          email: 'sarah@localdev.test',
          userId: sarah.id,
          role: 'STAFF',
          status: 'ACTIVE',
          invitedById: admin.id,
          respondedAt: new Date(),
        },
      }).catch(() => {});
    }

    // Health Book stamps for the roster animals: one expired, one
    // expiring soon, so the portal's needs-attention queue demos both
    // tones. Guarded so reseeds don't duplicate.
    const rosterRufus = await prisma.pet.findFirst({
      where: { managedByShelterId: claimedShelter.id, name: 'Rufus' },
    });
    const rosterClover = await prisma.pet.findFirst({
      where: { managedByShelterId: claimedShelter.id, name: 'Clover' },
    });
    if (rosterRufus && !(await prisma.petVaccination.findFirst({ where: { petId: rosterRufus.id } }))) {
      const yr = 365 * 86400e3;
      await prisma.petVaccination.createMany({
        data: [
          { petId: rosterRufus.id, name: 'Rabies', administeredAt: new Date(Date.now() - 1.05 * yr), expiresAt: new Date(Date.now() - 20 * 86400e3), vetName: 'Travis County Mobile Vet' },
          { petId: rosterRufus.id, name: 'DHPP', administeredAt: new Date(Date.now() - 0.2 * yr), expiresAt: new Date(Date.now() + 0.8 * yr), vetName: 'Travis County Mobile Vet' },
        ],
      });
    }
    if (rosterClover && !(await prisma.petVaccination.findFirst({ where: { petId: rosterClover.id } }))) {
      await prisma.petVaccination.createMany({
        data: [
          { petId: rosterClover.id, name: 'FVRCP', administeredAt: new Date(Date.now() - 350 * 86400e3), expiresAt: new Date(Date.now() + 12 * 86400e3) },
        ],
      });
    }

    // Adoption inquiries so the portal inbox demos worked and unworked rows
    if (!(await prisma.shelterInquiry.findFirst({ where: { shelterId: claimedShelter.id } }))) {
      await prisma.shelterInquiry.createMany({
        data: [
          {
            shelterId: claimedShelter.id,
            petId: rosterRufus?.id || null,
            name: 'Jamie Rivera',
            email: 'jamie.rivera@example.com',
            phone: '512-555-0147',
            message:
              'We met Rufus at the adoption event on Saturday and have not stopped thinking about him. ' +
              'We have a fenced yard and an easygoing older lab. What are the next steps?',
            status: 'NEW',
            createdAt: new Date(Date.now() - 1 * 86400e3),
          },
          {
            shelterId: claimedShelter.id,
            petId: null,
            name: 'Priya Natarajan',
            email: 'priya.n@example.com',
            message:
              'Do you have any small dogs that do well in apartments? I work from home and can do daily walks.',
            status: 'REPLIED',
            createdAt: new Date(Date.now() - 4 * 86400e3),
          },
        ],
      });
    }
  }

  // ---- Alerts & notifications for admin ----
  if (!(await prisma.alert.findFirst({ where: { userId: admin.id } }))) {
    await prisma.alert.create({
      data: {
        caseId: cases['AUS-2026-0002'].id,
        userId: admin.id,
        method: 'EMAIL',
        deliveredAt: new Date(),
        openedAt: new Date(),
      },
    });
  }
  if (!(await prisma.notification.findFirst({ where: { userId: admin.id } }))) {
    await prisma.notification.create({
      data: {
        userId: admin.id,
        type: 'SIGHTING',
        title: 'New sighting reported for Max',
        message: 'Mike reported a level-5 certainty sighting near Barton Springs Pool.',
        actionUrl: '/missions/AUS-2026-0001',
      },
    });
    await prisma.notification.create({
      data: {
        userId: admin.id,
        type: 'SQUAD_MESSAGE',
        title: 'New post in Austin Rescue Force',
        message: 'Sarah posted: Greenbelt search recap — promising trail!',
        actionUrl: `/rescue-forces/${force.id}`,
        read: true,
        readAt: new Date(),
      },
    });
  }

  console.log('\nDone. Key IDs:');
  console.log(JSON.stringify({
    forceId: force.id,
    northDivisionId: divisions['North Austin'].id,
    maxCaseId: maxCase.id,
    maxCaseNumber: 'AUS-2026-0001',
    foundCaseId: cases['AUS-2026-0003'].id,
    petMaxId: max.id,
    petLunaId: luna.id,
    petMaxToken: max.publicViewToken,
    medicationId: med ? med.id : null,
    threadSlug: 'tips-for-shy-cats-hiding-nearby',
    conversationId: convo.id,
    adminId: admin.id,
    sarahId: sarah.id,
  }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
