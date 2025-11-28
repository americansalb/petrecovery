/**
 * Predictive Analytics for Pet Recovery
 *
 * Analyzes historical data to predict:
 * - Probability of finding a lost pet
 * - Optimal search times and locations
 * - Estimated time to reunion
 */

/**
 * Calculate success probability for a case
 */
export async function calculateSuccessProbability(caseData, historicalData) {
  const factors = [];
  let baseScore = 0.5; // 50% base probability

  // Factor 1: Species (dogs have higher recovery rates)
  const speciesRates = {
    DOG: 0.93,  // 93% of lost dogs are found
    CAT: 0.75,  // 75% of lost cats are found
    BIRD: 0.40,
    RABBIT: 0.50,
    OTHER: 0.45,
  };
  const speciesFactor = speciesRates[caseData.petSpecies] || 0.5;
  factors.push({ name: 'Species', value: speciesFactor, weight: 0.15 });

  // Factor 2: Time elapsed (probability decreases over time)
  const hoursElapsed = (Date.now() - new Date(caseData.lastSeenAt).getTime()) / (1000 * 60 * 60);
  let timeFactor;
  if (hoursElapsed <= 24) {
    timeFactor = 0.9;
  } else if (hoursElapsed <= 72) {
    timeFactor = 0.75;
  } else if (hoursElapsed <= 168) { // 1 week
    timeFactor = 0.6;
  } else if (hoursElapsed <= 720) { // 1 month
    timeFactor = 0.4;
  } else {
    timeFactor = 0.2;
  }
  factors.push({ name: 'Time Elapsed', value: timeFactor, weight: 0.2 });

  // Factor 3: Has microchip
  const microchipFactor = caseData.hasMicrochip ? 0.85 : 0.5;
  factors.push({ name: 'Microchip', value: microchipFactor, weight: 0.1 });

  // Factor 4: Collar/ID tags
  const idFactor = caseData.hasCollar ? 0.8 : 0.5;
  factors.push({ name: 'ID Tags', value: idFactor, weight: 0.08 });

  // Factor 5: Number of sightings
  const sightingCount = caseData.sightingsCount || 0;
  let sightingFactor;
  if (sightingCount >= 3) {
    sightingFactor = 0.85;
  } else if (sightingCount >= 1) {
    sightingFactor = 0.7;
  } else {
    sightingFactor = 0.4;
  }
  factors.push({ name: 'Sightings', value: sightingFactor, weight: 0.15 });

  // Factor 6: Active searchers
  const searcherCount = caseData.activeSearchers || 0;
  let searcherFactor;
  if (searcherCount >= 10) {
    searcherFactor = 0.9;
  } else if (searcherCount >= 5) {
    searcherFactor = 0.75;
  } else if (searcherCount >= 1) {
    searcherFactor = 0.6;
  } else {
    searcherFactor = 0.4;
  }
  factors.push({ name: 'Active Searchers', value: searcherFactor, weight: 0.12 });

  // Factor 7: Has reward
  const rewardFactor = caseData.hasReward ? 0.75 : 0.5;
  factors.push({ name: 'Reward Offered', value: rewardFactor, weight: 0.05 });

  // Factor 8: Urban vs rural (urban has more eyes)
  const urbanFactor = caseData.isUrban ? 0.7 : 0.55;
  factors.push({ name: 'Urban Area', value: urbanFactor, weight: 0.08 });

  // Factor 9: Season (more people outside in good weather)
  const month = new Date().getMonth();
  const seasonFactor = (month >= 4 && month <= 9) ? 0.7 : 0.55;
  factors.push({ name: 'Season', value: seasonFactor, weight: 0.07 });

  // Calculate weighted average
  let totalWeight = 0;
  let weightedSum = 0;

  for (const factor of factors) {
    weightedSum += factor.value * factor.weight;
    totalWeight += factor.weight;
  }

  const probability = Math.round((weightedSum / totalWeight) * 100);

  return {
    probability,
    factors: factors.map(f => ({
      ...f,
      contribution: Math.round(f.value * f.weight * 100),
    })),
    recommendations: generateRecommendations(factors, caseData),
    estimatedDaysToReunion: estimateDaysToReunion(probability, hoursElapsed),
  };
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(factors, caseData) {
  const recommendations = [];

  // Check each factor and suggest improvements
  for (const factor of factors) {
    if (factor.name === 'Sightings' && factor.value < 0.6) {
      recommendations.push({
        priority: 'high',
        action: 'Increase visibility',
        description: 'Share case on social media and post flyers in the last seen area',
      });
    }

    if (factor.name === 'Active Searchers' && factor.value < 0.6) {
      recommendations.push({
        priority: 'high',
        action: 'Recruit searchers',
        description: 'Join a rescue squad or ask friends and neighbors to help search',
      });
    }

    if (factor.name === 'Reward Offered' && factor.value < 0.6) {
      recommendations.push({
        priority: 'medium',
        action: 'Consider offering a reward',
        description: 'A reward can motivate people to look more actively',
      });
    }
  }

  // Time-based recommendations
  const hoursElapsed = (Date.now() - new Date(caseData.lastSeenAt).getTime()) / (1000 * 60 * 60);

  if (hoursElapsed < 24) {
    recommendations.push({
      priority: 'high',
      action: 'Search immediately',
      description: 'Most pets are found within the first 24 hours. Focus on nearby areas now.',
    });
  }

  if (hoursElapsed > 72 && !caseData.checkedShelters) {
    recommendations.push({
      priority: 'high',
      action: 'Check local shelters',
      description: 'Visit shelters in person. Pets may be brought in and descriptions can be inaccurate.',
    });
  }

  // Species-specific recommendations
  if (caseData.petSpecies === 'CAT') {
    recommendations.push({
      priority: 'medium',
      action: 'Search at dawn and dusk',
      description: 'Cats are most active during twilight hours. Search quiet areas and under porches.',
    });
  }

  return recommendations.slice(0, 5); // Top 5 recommendations
}

/**
 * Estimate days to reunion based on probability
 */
function estimateDaysToReunion(probability, hoursElapsed) {
  // Base estimates from historical data
  const baseEstimates = {
    90: 2,   // 90%+ probability: ~2 days
    75: 5,   // 75-89%: ~5 days
    60: 10,  // 60-74%: ~10 days
    45: 21,  // 45-59%: ~3 weeks
    30: 45,  // 30-44%: ~6 weeks
    0: null, // <30%: Unknown
  };

  for (const [threshold, days] of Object.entries(baseEstimates)) {
    if (probability >= parseInt(threshold)) {
      return days;
    }
  }

  return null;
}

/**
 * Analyze optimal search times based on sighting patterns
 */
export function analyzeOptimalSearchTimes(sightings) {
  if (!sightings || sightings.length === 0) {
    // Default recommendations
    return {
      bestTimes: [
        { hour: 6, label: '6 AM - Early morning', score: 0.8 },
        { hour: 18, label: '6 PM - Evening', score: 0.85 },
        { hour: 21, label: '9 PM - Night', score: 0.7 },
      ],
      analysis: 'No sighting data available. Using typical patterns for lost pets.',
    };
  }

  // Analyze sighting times
  const hourCounts = new Array(24).fill(0);

  for (const sighting of sightings) {
    const hour = new Date(sighting.sightedAt).getHours();
    hourCounts[hour]++;
  }

  // Find peak hours
  const maxCount = Math.max(...hourCounts);
  const bestTimes = hourCounts
    .map((count, hour) => ({
      hour,
      label: formatHour(hour),
      score: maxCount > 0 ? count / maxCount : 0,
      count,
    }))
    .filter(h => h.count > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    bestTimes,
    analysis: `Based on ${sightings.length} sighting(s), peak activity detected at these times.`,
    hourlyDistribution: hourCounts,
  };
}

function formatHour(hour) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour} ${period}`;
}

/**
 * Predict likely location zones
 */
export function predictLocationZones(lastSeenLocation, sightings, petSpecies, hoursElapsed) {
  // Base travel distances by species (miles per day)
  const travelRates = {
    DOG: { min: 0.5, typical: 2, max: 10 },
    CAT: { min: 0.1, typical: 0.3, max: 1 },
    BIRD: { min: 1, typical: 5, max: 50 },
    RABBIT: { min: 0.05, typical: 0.1, max: 0.5 },
    OTHER: { min: 0.1, typical: 0.5, max: 2 },
  };

  const rates = travelRates[petSpecies] || travelRates.OTHER;
  const days = hoursElapsed / 24;

  // Calculate likely radius
  const zones = [
    {
      type: 'high_priority',
      radius: Math.min(rates.typical * days, rates.max * 0.5),
      probability: 0.6,
      color: '#ef4444',
    },
    {
      type: 'medium_priority',
      radius: Math.min(rates.typical * days * 1.5, rates.max * 0.75),
      probability: 0.25,
      color: '#f97316',
    },
    {
      type: 'extended',
      radius: Math.min(rates.max * days * 0.5, rates.max),
      probability: 0.15,
      color: '#eab308',
    },
  ];

  // Adjust based on sightings
  if (sightings && sightings.length > 0) {
    const latestSighting = sightings.sort((a, b) =>
      new Date(b.sightedAt) - new Date(a.sightedAt)
    )[0];

    // Shift zones toward latest sighting
    return {
      zones,
      center: {
        lat: latestSighting.latitude,
        lng: latestSighting.longitude,
      },
      adjustedFromSighting: true,
      sightingAge: hoursElapsed - ((Date.now() - new Date(latestSighting.sightedAt).getTime()) / (1000 * 60 * 60)),
    };
  }

  return {
    zones,
    center: lastSeenLocation,
    adjustedFromSighting: false,
  };
}

/**
 * Calculate case similarity for pattern matching
 */
export function findSimilarCases(currentCase, historicalCases) {
  const similarities = historicalCases.map(histCase => {
    let score = 0;
    let factors = 0;

    // Species match
    if (histCase.petSpecies === currentCase.petSpecies) {
      score += 3;
    }
    factors += 3;

    // Size match
    if (histCase.petSize === currentCase.petSize) {
      score += 1;
    }
    factors += 1;

    // Location proximity (same city/area)
    if (histCase.city === currentCase.city) {
      score += 2;
    }
    factors += 2;

    // Time of year similarity
    const currentMonth = new Date().getMonth();
    const histMonth = new Date(histCase.createdAt).getMonth();
    if (Math.abs(currentMonth - histMonth) <= 2) {
      score += 1;
    }
    factors += 1;

    // Similar escape scenario
    if (histCase.escapeScenario === currentCase.escapeScenario) {
      score += 2;
    }
    factors += 2;

    return {
      caseId: histCase.id,
      similarity: score / factors,
      wasFound: histCase.status === 'REUNITED',
      daysToReunion: histCase.daysToReunion,
    };
  });

  // Filter to similar cases and sort
  return similarities
    .filter(s => s.similarity >= 0.6)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10);
}
