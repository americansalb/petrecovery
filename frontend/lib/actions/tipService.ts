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
  // For LOCATION tips - unsearched areas
  unsearchedDirections?: string[]; // e.g., ['north', 'east']
  lastSearchHoursAgo?: number;
  // For WEATHER tips
  weather?: {
    temperature: number; // Fahrenheit
    weatherCode: number; // WMO weather code
    isRaining: boolean;
    windSpeed: number; // mph
  };
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
 * Generate location tips (unsearched areas)
 */
function generateLocationTips(context: TipContext): GeneratedTip[] {
  const tips: GeneratedTip[] = [];

  // Suggest unsearched directions
  if (context.unsearchedDirections && context.unsearchedDirections.length > 0) {
    const directions = context.unsearchedDirections.slice(0, 2).join(' and ');
    tips.push({
      tipType: 'LOCATION',
      title: 'Unsearched Area',
      message: `The ${directions} area${context.unsearchedDirections.length > 1 ? 's have' : ' has'}n't been searched yet. ${context.petName} could be hiding there.`,
      priority: 65,
      actionLabel: 'View Map',
      actionType: 'navigate:map',
      context: { unsearchedDirections: context.unsearchedDirections },
    });
  }

  // Suggest re-searching if it's been a while
  if (context.lastSearchHoursAgo && context.lastSearchHoursAgo > 24) {
    tips.push({
      tipType: 'LOCATION',
      message: `It's been ${Math.round(context.lastSearchHoursAgo)} hours since the last search. Pets can move - consider re-checking previous areas.`,
      priority: 55,
      actionLabel: 'Start Search',
      actionType: 'navigate:search',
      context: { lastSearchHoursAgo: context.lastSearchHoursAgo },
    });
  }

  // If no searches at all yet
  if (context.searchesCompleted === 0 && context.hoursLost < 48) {
    const radiusTip = context.petType === 'CAT'
      ? 'Start searching within 3-5 houses of where they were last seen.'
      : 'Start by searching the immediate area, then expand outward.';
    tips.push({
      tipType: 'LOCATION',
      title: 'Start Searching',
      message: radiusTip,
      priority: 75,
      actionLabel: 'Start Search',
      actionType: 'navigate:search',
    });
  }

  return tips;
}

/**
 * Generate weather-based tips
 * Uses Open-Meteo weather codes: https://open-meteo.com/en/docs
 */
function generateWeatherTips(context: TipContext): GeneratedTip[] {
  const tips: GeneratedTip[] = [];

  if (!context.weather) return tips;

  const { temperature, weatherCode, isRaining, windSpeed } = context.weather;

  // Rain tips (WMO codes 51-67, 80-82 are rain/drizzle)
  if (isRaining) {
    tips.push({
      tipType: 'WEATHER',
      title: 'Rainy Conditions',
      message: context.petType === 'CAT'
        ? `It's raining - ${context.petName} is likely hiding somewhere dry. Check garages, sheds, and covered porches.`
        : `Rain may keep ${context.petName} sheltered. They might seek cover under structures or dense bushes.`,
      priority: 75,
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
      context: { weatherCode, isRaining: true },
    });
  }

  // Cold weather tips (below 40°F)
  if (temperature < 40) {
    tips.push({
      tipType: 'WEATHER',
      title: 'Cold Weather Alert',
      message: `It's ${Math.round(temperature)}°F outside. ${context.petName} may be seeking warmth - check near buildings, vents, and car engines.`,
      priority: 70,
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      context: { temperature },
    });
  }

  // Hot weather tips (above 85°F)
  if (temperature > 85) {
    tips.push({
      tipType: 'WEATHER',
      title: 'Hot Weather',
      message: `It's ${Math.round(temperature)}°F - ${context.petName} will seek shade and water. Check near ponds, streams, or shaded areas.`,
      priority: 70,
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      context: { temperature },
    });
  }

  // High wind tips (above 20 mph)
  if (windSpeed > 20) {
    tips.push({
      tipType: 'WEATHER',
      message: `Windy conditions (${Math.round(windSpeed)} mph) may make it harder for ${context.petName} to hear you calling. Get closer before calling their name.`,
      priority: 50,
      expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
      context: { windSpeed },
    });
  }

  // Good search weather (clear, mild)
  if (!isRaining && temperature >= 50 && temperature <= 75 && windSpeed < 15) {
    tips.push({
      tipType: 'WEATHER',
      title: 'Great Search Weather!',
      message: 'Conditions are ideal for searching. Pets are more likely to be active and visible.',
      priority: 45,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      context: { temperature, windSpeed, ideal: true },
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
    allTips.push(...generateWeatherTips(context));
    allTips.push(...generateProgressTips(context));
    allTips.push(...generateLocationTips(context));
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
        lastSeenAt: true,
        lastSeenLatitude: true,
        lastSeenLongitude: true,
      },
    });

    if (!caseData) return null;

    // Get stats and search sessions
    const [shelterCount, flyerCount, searchSessions, latestSighting] = await Promise.all([
      this.prisma.shelterContact.count({ where: { caseId } }),
      this.prisma.flyerPosting.count({ where: { caseId } }),
      this.prisma.searchSession.findMany({
        where: { caseId },
        select: {
          id: true,
          endedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.caseSighting.findFirst({
        where: { caseId },
        orderBy: { createdAt: 'desc' },
        select: { latitude: true, longitude: true, createdAt: true },
      }),
    ]);

    // Calculate hours lost
    const lastSeenAt = caseData.lastSeenAt || new Date();
    const hoursLost = (Date.now() - lastSeenAt.getTime()) / (1000 * 60 * 60);

    // Determine pet type
    let petType: 'DOG' | 'CAT' | 'OTHER' = 'OTHER';
    if (caseData.petSpecies === 'DOG') petType = 'DOG';
    else if (caseData.petSpecies === 'CAT') petType = 'CAT';

    // Calculate unsearched directions (simplified - SearchSession doesn't have location data)
    const unsearchedDirections: string[] = [];

    // Calculate hours since last search
    let lastSearchHoursAgo: number | undefined;
    if (searchSessions.length > 0) {
      const lastSearch = searchSessions[0];
      const lastSearchTime = lastSearch.endedAt || lastSearch.createdAt;
      lastSearchHoursAgo = (Date.now() - lastSearchTime.getTime()) / (1000 * 60 * 60);
    }

    // Fetch weather data if we have coordinates
    let weather: TipContext['weather'] | undefined;
    if (caseData.lastSeenLatitude && caseData.lastSeenLongitude) {
      weather = await this.fetchWeather(caseData.lastSeenLatitude, caseData.lastSeenLongitude);
    }

    return {
      caseId,
      petName: caseData.petName,
      petType,
      hoursLost,
      lastSeenLat: caseData.lastSeenLatitude || undefined,
      lastSeenLng: caseData.lastSeenLongitude || undefined,
      sheltersContacted: shelterCount,
      flyersPosted: flyerCount,
      searchesCompleted: searchSessions.length,
      recentSighting: latestSighting ? {
        lat: latestSighting.latitude,
        lng: latestSighting.longitude,
        reportedAt: latestSighting.createdAt,
      } : undefined,
      coldSpotsCount: 0, // Will be calculated by flyer service
      unsearchedDirections,
      lastSearchHoursAgo,
      weather,
    };
  }

  /**
   * Calculate which cardinal directions haven't been searched
   */
  // Note: SearchSession doesn't have location fields, so direction calculation is disabled
  // Returns all directions as "unsearched" since we can't determine which were searched
  private calculateUnsearchedDirections(): string[] {
    return ['north', 'south', 'east', 'west'];
  }

  /**
   * Fetch current weather from Open-Meteo API (free, no API key required)
   */
  private async fetchWeather(lat: number, lng: number): Promise<TipContext['weather'] | undefined> {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;

      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) return undefined;

      const data = await response.json();
      const current = data.current;

      if (!current) return undefined;

      // WMO weather codes: 51-67, 80-82 indicate rain/drizzle
      const weatherCode = current.weather_code;
      const isRaining = (weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82);

      return {
        temperature: current.temperature_2m,
        weatherCode,
        isRaining,
        windSpeed: current.wind_speed_10m,
      };
    } catch (error) {
      // Silently fail - weather tips are optional
      console.warn('Failed to fetch weather:', error);
      return undefined;
    }
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
