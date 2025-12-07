/**
 * Scout Tip Service
 *
 * Generates contextual tips for the Scout mascot.
 * Per Actions_Guide.md Phase 5 specification.
 */

import { PrismaClient, TipType } from '@prisma/client';

// =============================================================================
// TYPES
// =============================================================================

export interface TipContext {
  caseId: string;
  petName: string;
  petType: 'DOG' | 'CAT' | 'OTHER';
  hoursLost: number;
  lastSeenLat?: number;
  lastSeenLng?: number;
  sheltersContacted: number;
  flyersPosted: number;
  searchesCompleted: number;
  recentSighting?: {
    lat: number;
    lng: number;
    reportedAt: Date;
  };
  coldSpotsCount: number;
}

export interface GeneratedTip {
  tipType: TipType;
  title?: string;
  message: string;
  priority: number;
  expiresAt?: Date;
  actionLabel?: string;
  actionType?: string;
  context?: Record<string, any>;
}

// =============================================================================
// TIP DEFINITIONS
// =============================================================================

// Static tip templates by type
const STATIC_TIPS = {
  STRATEGY: {
    CAT: [
      { message: "Cats usually hide very close to home - within 3-5 houses when scared.", priority: 60 },
      { message: "Check under porches, in bushes, and any small gaps where a scared cat could squeeze.", priority: 55 },
      { message: "Put the litter box outside - cats can smell it from far away!", priority: 65 },
      { message: "Leave a piece of your worn clothing outside - your scent is comforting.", priority: 50 },
      { message: "Shake a treat bag or open a can of food - familiar sounds attract cats.", priority: 55 },
      { message: "Search at dawn and dusk when cats are most active.", priority: 70 },
      { message: "Check high places - cats often climb trees, fences, and rooftops when scared.", priority: 50 },
      { message: "Look inside garages, sheds, and cars - cats sneak in and get trapped.", priority: 60 },
    ],
    DOG: [
      { message: "Dogs can travel far - expand your search radius as days pass.", priority: 60 },
      { message: "Alert delivery drivers, mail carriers, and joggers - they cover lots of ground.", priority: 55 },
      { message: "Dogs are often brought to shelters by good samaritans - keep calling!", priority: 65 },
      { message: "Post on local Facebook groups and Nextdoor - neighbors are your best allies.", priority: 60 },
      { message: "Leave water and food at the spot where they were last seen.", priority: 50 },
      { message: "Scared dogs may not come when called - approach slowly and calmly.", priority: 70 },
      { message: "Check with local vets - someone may have brought them in for a scan.", priority: 55 },
    ],
    OTHER: [
      { message: "Keep searching - every action brings your pet closer to home.", priority: 50 },
      { message: "Don't give up! Pets have been found weeks or even months later.", priority: 55 },
      { message: "The more people who know, the better your chances. Share widely!", priority: 60 },
    ],
  },
  ENCOURAGE: [
    { message: "You're doing amazing! Every flyer posted increases the chances of a reunion.", priority: 40 },
    { message: "Keep going! Your dedication is inspiring.", priority: 35 },
    { message: "Every action matters. You're one step closer!", priority: 40 },
    { message: "The search community is behind you. You've got this!", priority: 35 },
    { message: "Don't lose hope! Many pets are found after days or even weeks.", priority: 45 },
  ],
};

// Progress milestone tips
const PROGRESS_MILESTONES = {
  shelters: [
    { count: 5, message: "5 shelters contacted! You're making great progress.", priority: 50 },
    { count: 10, message: "10 shelters reached! That's excellent outreach.", priority: 55 },
    { count: 20, message: "20 shelters contacted! You're leaving no stone unturned.", priority: 60 },
  ],
  flyers: [
    { count: 5, message: "5 flyers posted! Great start on coverage.", priority: 50 },
    { count: 10, message: "10 flyers up! The neighborhood knows to look out.", priority: 55 },
    { count: 25, message: "25 flyers! That's amazing coverage.", priority: 60 },
  ],
  searches: [
    { count: 3, message: "3 searches completed! Keep exploring new areas.", priority: 50 },
    { count: 5, message: "5 searches done! You're covering good ground.", priority: 55 },
    { count: 10, message: "10 searches! Your dedication is incredible.", priority: 60 },
  ],
};

// =============================================================================
// TIP GENERATION FUNCTIONS
// =============================================================================

/**
 * Generate time-based tips (dawn/dusk alerts)
 */
function generateTimeTips(context: TipContext): GeneratedTip[] {
  const tips: GeneratedTip[] = [];
  const now = new Date();
  const hour = now.getHours();

  // Dawn tips (5-7 AM)
  if (hour >= 5 && hour <= 7) {
    const isCat = context.petType === 'CAT';
    tips.push({
      tipType: 'TIME',
      title: 'Dawn Alert!',
      message: isCat
        ? "Early bird! Dawn is prime search time for cats. They're most active now."
        : "Good morning! Early searches often catch dogs before the day gets busy.",
      priority: 80,
      expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2 hours
      actionLabel: 'Start Search',
      actionType: 'navigate:search',
      context: { hour, trigger: 'dawn' },
    });
  }

  // Dusk tips (5-8 PM / 17-20)
  if (hour >= 17 && hour <= 20) {
    const isCat = context.petType === 'CAT';
    tips.push({
      tipType: 'TIME',
      title: 'Dusk Alert!',
      message: isCat
        ? "It's the golden hour! Cats often come out to hunt at dusk."
        : "Evening search time! Dogs may be more visible as activity calms down.",
      priority: 80,
      expiresAt: new Date(now.getTime() + 3 * 60 * 60 * 1000), // 3 hours
      actionLabel: 'Start Search',
      actionType: 'navigate:search',
      context: { hour, trigger: 'dusk' },
    });
  }

  // Business hours tip (for shelter calls)
  if (hour >= 9 && hour <= 17 && context.sheltersContacted < 10) {
    tips.push({
      tipType: 'TIME',
      title: 'Shelter Hours',
      message: "Shelters are open now - great time to make calls!",
      priority: 60,
      expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      actionLabel: 'Contact Shelters',
      actionType: 'navigate:shelters',
      context: { hour, trigger: 'business_hours' },
    });
  }

  return tips;
}

/**
 * Generate progress-based tips (milestones)
 */
function generateProgressTips(context: TipContext): GeneratedTip[] {
  const tips: GeneratedTip[] = [];

  // Check shelter milestones
  for (const milestone of PROGRESS_MILESTONES.shelters) {
    if (context.sheltersContacted === milestone.count) {
      tips.push({
        tipType: 'PROGRESS',
        title: 'Milestone Reached!',
        message: milestone.message,
        priority: milestone.priority,
        context: { sheltersContacted: context.sheltersContacted },
      });
      break;
    }
  }

  // Check flyer milestones
  for (const milestone of PROGRESS_MILESTONES.flyers) {
    if (context.flyersPosted === milestone.count) {
      tips.push({
        tipType: 'PROGRESS',
        title: 'Flyer Milestone!',
        message: milestone.message,
        priority: milestone.priority,
        context: { flyersPosted: context.flyersPosted },
      });
      break;
    }
  }

  // Check search milestones
  for (const milestone of PROGRESS_MILESTONES.searches) {
    if (context.searchesCompleted === milestone.count) {
      tips.push({
        tipType: 'PROGRESS',
        title: 'Search Milestone!',
        message: milestone.message,
        priority: milestone.priority,
        context: { searchesCompleted: context.searchesCompleted },
      });
      break;
    }
  }

  return tips;
}

/**
 * Generate cold spot tips
 */
function generateColdSpotTips(context: TipContext): GeneratedTip[] {
  const tips: GeneratedTip[] = [];

  if (context.coldSpotsCount > 0 && context.flyersPosted > 0) {
    tips.push({
      tipType: 'COLD_SPOT',
      message: `There are ${context.coldSpotsCount} areas nearby that still need flyers.`,
      priority: 60,
      actionLabel: 'Post Flyers',
      actionType: 'navigate:flyers',
      context: { coldSpotsCount: context.coldSpotsCount },
    });
  } else if (context.coldSpotsCount > 0 && context.flyersPosted === 0) {
    tips.push({
      tipType: 'COLD_SPOT',
      title: 'Flyers Help!',
      message: "Posting flyers in high-traffic areas greatly increases sighting reports.",
      priority: 70,
      actionLabel: 'Start Posting',
      actionType: 'navigate:flyers',
      context: { coldSpotsCount: context.coldSpotsCount },
    });
  }

  return tips;
}

/**
 * Generate sighting-related tips
 */
function generateSightingTips(context: TipContext): GeneratedTip[] {
  const tips: GeneratedTip[] = [];

  if (context.recentSighting) {
    const hoursSinceSighting = (Date.now() - context.recentSighting.reportedAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceSighting < 24) {
      tips.push({
        tipType: 'SIGHTING',
        title: 'Recent Sighting!',
        message: `${context.petName} was spotted ${hoursSinceSighting < 1 ? 'less than an hour' : `${Math.round(hoursSinceSighting)} hours`} ago! Focus your search in that area.`,
        priority: 95, // Highest priority
        actionLabel: 'View on Map',
        actionType: 'navigate:map',
        context: {
          sightingLat: context.recentSighting.lat,
          sightingLng: context.recentSighting.lng,
          hoursSinceSighting,
        },
      });
    }
  }

  return tips;
}

/**
 * Generate strategy tips based on pet type and time lost
 */
function generateStrategyTips(context: TipContext): GeneratedTip[] {
  const tips: GeneratedTip[] = [];
  const petType = context.petType === 'CAT' || context.petType === 'DOG' ? context.petType : 'OTHER';
  const strategyTips = STATIC_TIPS.STRATEGY[petType];

  // Pick 1-2 relevant strategy tips
  const shuffled = [...strategyTips].sort(() => Math.random() - 0.5);
  const selectedTips = shuffled.slice(0, 2);

  for (const tip of selectedTips) {
    tips.push({
      tipType: 'STRATEGY',
      message: tip.message.replace('[Pet]', context.petName),
      priority: tip.priority,
      context: { petType, hoursLost: context.hoursLost },
    });
  }

  // Add time-specific strategy tips
  if (context.hoursLost < 24) {
    tips.push({
      tipType: 'STRATEGY',
      title: 'First 24 Hours',
      message: `The first 24 hours are critical! ${context.petName} is likely still very close to home.`,
      priority: 85,
      context: { hoursLost: context.hoursLost, trigger: 'first_24h' },
    });
  } else if (context.hoursLost > 72 && context.petType === 'DOG') {
    tips.push({
      tipType: 'STRATEGY',
      message: "After 3 days, dogs may have traveled further. Consider expanding your search radius.",
      priority: 65,
      context: { hoursLost: context.hoursLost, trigger: 'expanded_search' },
    });
  }

  return tips;
}

/**
 * Generate encouragement tips
 */
function generateEncourageTips(context: TipContext): GeneratedTip[] {
  const tips: GeneratedTip[] = [];

  // Add encouragement if low activity
  const totalActions = context.sheltersContacted + context.flyersPosted + context.searchesCompleted;

  if (totalActions > 5 || Math.random() < 0.3) {
    const encourageTip = STATIC_TIPS.ENCOURAGE[Math.floor(Math.random() * STATIC_TIPS.ENCOURAGE.length)];
    tips.push({
      tipType: 'ENCOURAGE',
      message: encourageTip.message.replace('[Pet]', context.petName),
      priority: encourageTip.priority,
    });
  }

  return tips;
}

// =============================================================================
// MAIN SERVICE CLASS
// =============================================================================

export class TipService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Generate all applicable tips for a case
   */
  async generateTips(context: TipContext): Promise<GeneratedTip[]> {
    const allTips: GeneratedTip[] = [];

    // Generate tips from each source
    allTips.push(...generateTimeTips(context));
    allTips.push(...generateProgressTips(context));
    allTips.push(...generateColdSpotTips(context));
    allTips.push(...generateSightingTips(context));
    allTips.push(...generateStrategyTips(context));
    allTips.push(...generateEncourageTips(context));

    // Sort by priority and return top tips
    return allTips
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5);
  }

  /**
   * Get context data for tip generation
   */
  async getTipContext(caseId: string): Promise<TipContext | null> {
    const caseData = await this.prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        petName: true,
        petSpecies: true,
        lostAt: true,
        lastSeenLatitude: true,
        lastSeenLongitude: true,
      },
    });

    if (!caseData) return null;

    // Get stats
    const [shelterCount, flyerCount, searchCount, latestSighting] = await Promise.all([
      this.prisma.shelterContact.count({ where: { caseId } }),
      this.prisma.flyerPosting.count({ where: { caseId } }),
      this.prisma.searchSession.count({ where: { caseId } }),
      this.prisma.caseSighting.findFirst({
        where: { caseId },
        orderBy: { createdAt: 'desc' },
        select: { latitude: true, longitude: true, createdAt: true },
      }),
    ]);

    // Calculate hours lost
    const lostAt = caseData.lostAt || new Date();
    const hoursLost = (Date.now() - lostAt.getTime()) / (1000 * 60 * 60);

    // Determine pet type
    let petType: 'DOG' | 'CAT' | 'OTHER' = 'OTHER';
    if (caseData.petSpecies === 'DOG') petType = 'DOG';
    else if (caseData.petSpecies === 'CAT') petType = 'CAT';

    return {
      caseId,
      petName: caseData.petName,
      petType,
      hoursLost,
      lastSeenLat: caseData.lastSeenLatitude || undefined,
      lastSeenLng: caseData.lastSeenLongitude || undefined,
      sheltersContacted: shelterCount,
      flyersPosted: flyerCount,
      searchesCompleted: searchCount,
      recentSighting: latestSighting ? {
        lat: latestSighting.latitude,
        lng: latestSighting.longitude,
        reportedAt: latestSighting.createdAt,
      } : undefined,
      coldSpotsCount: 0, // Will be calculated by flyer service
    };
  }

  /**
   * Save generated tips to database
   */
  async saveTips(caseId: string, tips: GeneratedTip[]): Promise<void> {
    // Delete expired tips first
    await this.prisma.mascotTip.deleteMany({
      where: {
        caseId,
        expiresAt: { lt: new Date() },
      },
    });

    // Create new tips
    for (const tip of tips) {
      // Check if similar tip already exists
      const existingTip = await this.prisma.mascotTip.findFirst({
        where: {
          caseId,
          tipType: tip.tipType,
          message: tip.message,
          expiresAt: tip.expiresAt ? { gte: new Date() } : undefined,
        },
      });

      if (!existingTip) {
        await this.prisma.mascotTip.create({
          data: {
            caseId,
            tipType: tip.tipType,
            title: tip.title,
            message: tip.message,
            priority: tip.priority,
            expiresAt: tip.expiresAt,
            actionLabel: tip.actionLabel,
            actionType: tip.actionType,
            context: tip.context,
          },
        });
      }
    }
  }

  /**
   * Get active tips for a case
   */
  async getActiveTips(caseId: string, userId?: string): Promise<any[]> {
    const tips = await this.prisma.mascotTip.findMany({
      where: {
        caseId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
        ...(userId ? { NOT: { dismissedBy: { has: userId } } } : {}),
      },
      orderBy: { priority: 'desc' },
      take: 5,
    });

    return tips;
  }

  /**
   * Dismiss a tip for a user
   */
  async dismissTip(tipId: string, userId: string): Promise<void> {
    const tip = await this.prisma.mascotTip.findUnique({
      where: { id: tipId },
      select: { dismissedBy: true },
    });

    if (tip && !tip.dismissedBy.includes(userId)) {
      await this.prisma.mascotTip.update({
        where: { id: tipId },
        data: {
          dismissedBy: { push: userId },
        },
      });
    }
  }

  /**
   * Mark a tip as posted to chat
   */
  async markPostedToChat(tipId: string): Promise<void> {
    await this.prisma.mascotTip.update({
      where: { id: tipId },
      data: {
        postedToChat: true,
        postedToChatAt: new Date(),
      },
    });
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

let tipServiceInstance: TipService | null = null;

export function getTipService(prisma: PrismaClient): TipService {
  if (!tipServiceInstance) {
    tipServiceInstance = new TipService(prisma);
  }
  return tipServiceInstance;
}
