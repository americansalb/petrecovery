const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🏠 Seeding Rescue Hub data...');

  // ============================================================================
  // FORUM CATEGORIES
  // ============================================================================

  const categories = [
    {
      name: 'Welcome',
      slug: 'welcome',
      description: 'Introduce yourself to the community and learn the ropes',
      icon: '👋',
      color: '#10b981', // Green
      displayOrder: 1,
      requiredTrustLevel: 0, // Anyone can post
    },
    {
      name: 'Lost Pet Support',
      slug: 'lost-pet-support',
      description: 'Emotional support and search strategies for those missing a pet',
      icon: '💙',
      color: '#3b82f6', // Blue
      displayOrder: 2,
      requiredTrustLevel: 0,
    },
    {
      name: 'Found Pet Help',
      slug: 'found-pet-help',
      description: 'Advice and resources for when you find a stray animal',
      icon: '🔍',
      color: '#8b5cf6', // Purple
      displayOrder: 3,
      requiredTrustLevel: 0,
    },
    {
      name: 'Transport Network',
      slug: 'transport',
      description: 'Coordinate animal transport across cities and states',
      icon: '🚗',
      color: '#f59e0b', // Amber
      displayOrder: 4,
      requiredTrustLevel: 1,
    },
    {
      name: 'Foster Hub',
      slug: 'foster',
      description: 'Connect with foster families and share fostering experiences',
      icon: '🏡',
      color: '#ec4899', // Pink
      displayOrder: 5,
      requiredTrustLevel: 1,
    },
    {
      name: 'Shelter Talk',
      slug: 'shelter-talk',
      description: 'Discussion for shelter staff, volunteers, and rescue organizations',
      icon: '🏥',
      color: '#06b6d4', // Cyan
      displayOrder: 6,
      requiredTrustLevel: 1,
    },
    {
      name: 'Training & Resources',
      slug: 'training',
      description: 'Guides, tutorials, and educational content for rescuers',
      icon: '📚',
      color: '#6366f1', // Indigo
      displayOrder: 7,
      requiredTrustLevel: 0,
      isModOnly: true, // Only mods can create threads, but anyone can read
    },
    {
      name: 'Success Stories',
      slug: 'success-stories',
      description: 'Celebrate reunions and happy endings',
      icon: '🎉',
      color: '#22c55e', // Green
      displayOrder: 8,
      requiredTrustLevel: 0,
    },
    {
      name: 'Urgent Alerts',
      slug: 'urgent',
      description: 'Time-sensitive situations needing immediate attention',
      icon: '🚨',
      color: '#ef4444', // Red
      displayOrder: 9,
      requiredTrustLevel: 1,
    },
    {
      name: 'General Discussion',
      slug: 'general',
      description: 'Off-topic conversations and community bonding',
      icon: '💬',
      color: '#64748b', // Slate
      displayOrder: 10,
      requiredTrustLevel: 1,
    },
  ];

  for (const category of categories) {
    const existing = await prisma.forumCategory.findUnique({
      where: { slug: category.slug }
    });

    if (!existing) {
      await prisma.forumCategory.create({ data: category });
      console.log(`  ✅ Created category: ${category.name}`);
    } else {
      await prisma.forumCategory.update({
        where: { slug: category.slug },
        data: category
      });
      console.log(`  ℹ️  Updated category: ${category.name}`);
    }
  }

  // ============================================================================
  // BADGES
  // ============================================================================

  const badges = [
    // Automatic badges
    {
      name: 'First Post',
      slug: 'first-post',
      description: 'Made your first post in the community',
      icon: '✨',
      color: '#10b981',
      criteriaType: 'POSTS',
      criteriaValue: 1,
      displayOrder: 1,
    },
    {
      name: 'Contributor',
      slug: 'contributor',
      description: 'Made 10 helpful posts',
      icon: '📝',
      color: '#3b82f6',
      criteriaType: 'POSTS',
      criteriaValue: 10,
      displayOrder: 2,
    },
    {
      name: 'Prolific',
      slug: 'prolific',
      description: 'Made 100 helpful posts',
      icon: '🌟',
      color: '#8b5cf6',
      criteriaType: 'POSTS',
      criteriaValue: 100,
      displayOrder: 3,
      isRare: true,
    },
    {
      name: 'Helpful Hand',
      slug: 'helpful-hand',
      description: 'Received 10 helpful reactions',
      icon: '🤝',
      color: '#f59e0b',
      criteriaType: 'HELPFUL',
      criteriaValue: 10,
      displayOrder: 4,
    },
    {
      name: 'Community Pillar',
      slug: 'community-pillar',
      description: 'Received 100 helpful reactions',
      icon: '🏛️',
      color: '#ec4899',
      criteriaType: 'HELPFUL',
      criteriaValue: 100,
      displayOrder: 5,
      isRare: true,
    },
    {
      name: 'Reunion Hero',
      slug: 'reunion-hero',
      description: 'Helped reunite a lost pet with their family',
      icon: '🦸',
      color: '#22c55e',
      criteriaType: 'REUNIONS',
      criteriaValue: 1,
      displayOrder: 6,
    },
    {
      name: 'Reunion Champion',
      slug: 'reunion-champion',
      description: 'Helped reunite 10 lost pets',
      icon: '🏆',
      color: '#eab308',
      criteriaType: 'REUNIONS',
      criteriaValue: 10,
      displayOrder: 7,
      isRare: true,
    },
    {
      name: 'Road Warrior',
      slug: 'road-warrior',
      description: 'Completed your first transport leg',
      icon: '🚗',
      color: '#06b6d4',
      criteriaType: 'TRANSPORT',
      criteriaValue: 1,
      displayOrder: 8,
    },
    {
      name: 'Transport Legend',
      slug: 'transport-legend',
      description: 'Completed 25 transport legs',
      icon: '🛣️',
      color: '#6366f1',
      criteriaType: 'TRANSPORT',
      criteriaValue: 25,
      displayOrder: 9,
      isRare: true,
    },
    {
      name: 'Veteran',
      slug: 'veteran',
      description: 'Been a member for 1 year',
      icon: '🎖️',
      color: '#64748b',
      criteriaType: 'TENURE',
      criteriaValue: 365,
      displayOrder: 10,
    },

    // Manual/special badges
    {
      name: 'Verified Shelter',
      slug: 'verified-shelter',
      description: 'Official shelter representative',
      icon: '🏥',
      color: '#0ea5e9',
      displayOrder: 20,
    },
    {
      name: 'Verified Rescue',
      slug: 'verified-rescue',
      description: 'Official rescue organization representative',
      icon: '🐾',
      color: '#14b8a6',
      displayOrder: 21,
    },
    {
      name: 'Moderator',
      slug: 'moderator',
      description: 'Community moderator',
      icon: '🛡️',
      color: '#a855f7',
      displayOrder: 22,
    },
    {
      name: 'Founding Member',
      slug: 'founding-member',
      description: 'One of the original Rescue Hub members',
      icon: '🌱',
      color: '#84cc16',
      displayOrder: 23,
      isRare: true,
    },
  ];

  for (const badge of badges) {
    const existing = await prisma.badge.findUnique({
      where: { slug: badge.slug }
    });

    if (!existing) {
      await prisma.badge.create({ data: badge });
      console.log(`  ✅ Created badge: ${badge.name}`);
    } else {
      await prisma.badge.update({
        where: { slug: badge.slug },
        data: badge
      });
      console.log(`  ℹ️  Updated badge: ${badge.name}`);
    }
  }

  // ============================================================================
  // WELCOME ANNOUNCEMENT
  // ============================================================================

  const welcomeAnnouncement = {
    title: 'Welcome to Rescue Hub!',
    body: 'This is your community space to connect, learn, and coordinate. Start by introducing yourself in the Welcome category!',
    style: 'INFO',
    displayLocations: JSON.stringify(['hub']),
    minTrustLevel: 0,
    isActive: true,
    createdBy: 'system',
  };

  const existingAnnouncement = await prisma.forumAnnouncement.findFirst({
    where: { title: welcomeAnnouncement.title }
  });

  if (!existingAnnouncement) {
    await prisma.forumAnnouncement.create({ data: welcomeAnnouncement });
    console.log('  ✅ Created welcome announcement');
  } else {
    console.log('  ℹ️  Welcome announcement already exists');
  }

  console.log('\n✅ Rescue Hub seeding complete!');
}

main()
  .catch((e) => {
    console.error('Error seeding Rescue Hub:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
