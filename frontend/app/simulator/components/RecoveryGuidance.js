'use client';

/**
 * RecoveryGuidance - Contextual recovery tips based on simulation results
 *
 * Displays species-specific, personality-aware guidance for finding lost pets.
 * This is content-based, derived from lost pet recovery research.
 */

import {
  Clock, MapPin, Volume2, Sparkles, AlertTriangle,
  Home, Building2, TreePine, Search, Heart, Flashlight
} from 'lucide-react';

// Recovery tips by species
const SPECIES_TIPS = {
  DOG: {
    title: 'Lost Dog Recovery',
    searchTiming: 'Dogs are most active during dawn (5-7 AM) and dusk (5-8 PM). Focus your search efforts during these windows.',
    behavior: 'Lost dogs often travel along roads, trails, and paths. They may cover significant ground but tend to stay in familiar-feeling environments.',
    attraction: [
      'Use familiar scents: Leave worn clothing at the last seen location',
      'Bring their favorite treats or food with strong smell',
      'Have a family member call their name calmly (avoid frantic yelling)',
      'Carry their favorite squeaky toy',
    ],
    warnings: [
      'Don\'t chase a scared dog - they will run further',
      'Approach slowly and sideways, avoiding direct eye contact',
      'Get low to the ground and wait for them to approach you',
    ],
  },
  CAT: {
    title: 'Lost Cat Recovery',
    searchTiming: 'Cats are crepuscular - most active at dawn and dusk. Indoor cats especially may only emerge at night when it\'s quiet.',
    behavior: 'Most indoor cats hide within 3-5 houses of home. They often hide silently even when they hear their owner calling.',
    attraction: [
      'Set out their litter box outside (cats can smell it from far away)',
      'Place worn clothing near entry points',
      'Set up a humane trap with their favorite food',
      'Play recordings of can opening or treat bag sounds at night',
    ],
    warnings: [
      'Indoor cats may be too scared to meow or respond',
      'Search at night with a flashlight - their eyes will reflect',
      'Check ALL hiding spots: under porches, in garages, up trees, in sheds',
    ],
  },
  BIRD: {
    title: 'Lost Bird Recovery',
    searchTiming: 'Birds are most vocal at dawn. They may call for their flock (you) in the early morning.',
    behavior: 'Birds typically fly in the direction of the wind when startled. They often land in tall trees and may not fly far if bonded.',
    attraction: [
      'Bring their cage outside - they recognize it as home',
      'Play recordings of their own voice or companion birds',
      'Use bright-colored fruits they love',
      'Call their name consistently - they respond to familiar voices',
    ],
    warnings: [
      'Don\'t use nets or startle them - they will fly further',
      'Contact local bird clubs and exotic pet stores immediately',
      'Post on parrot-specific lost bird databases',
    ],
  },
  OTHER: {
    title: 'Lost Pet Recovery',
    searchTiming: 'Research your specific pet\'s active hours. Many small animals are crepuscular (dawn/dusk) or nocturnal.',
    behavior: 'Small animals often hide close to home. They may not travel far but can squeeze into surprisingly small spaces.',
    attraction: [
      'Use their favorite food with strong scent',
      'Set humane traps sized appropriately',
      'Leave familiar bedding at key locations',
    ],
    warnings: [
      'Small pets are vulnerable to predators - act quickly',
      'Check all enclosed spaces: drains, vents, crawl spaces',
    ],
  },
};

// Personality-specific guidance
const PERSONALITY_TIPS = {
  FRIENDLY: {
    approach: 'Good news: Friendly pets are often found quickly because they approach people.',
    strategy: 'Focus on contacting neighbors, delivery drivers, and mail carriers. Your pet may be with a good samaritan.',
    shelter: 'Check shelters within 24 hours - friendly pets are often brought in by finders.',
  },
  NEUTRAL: {
    approach: 'Your pet may be cautious but approachable if they feel safe.',
    strategy: 'Combine active searching with posting flyers. Sit quietly in likely areas and wait.',
    shelter: 'Check shelters every 2-3 days. It may take time for someone to catch them.',
  },
  SHY: {
    approach: 'Shy pets require patience. They will hide and may not respond to calls.',
    strategy: 'Use humane traps and trail cameras. Set up a feeding station and monitor it.',
    shelter: 'It may take weeks for a shy pet to be caught. Be persistent with shelter visits.',
  },
};

// Time-based guidance
function getTimeGuidance(hoursLost) {
  if (hoursLost < 6) {
    return {
      phase: 'Immediate Response',
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      tips: [
        'Search the immediate area thoroughly - most pets are closer than you think',
        'Alert all neighbors immediately',
        'Post on local social media groups right away',
        'Put out food and water near your home',
      ],
    };
  } else if (hoursLost < 24) {
    return {
      phase: 'First 24 Hours',
      icon: Clock,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      tips: [
        'Expand your search radius systematically',
        'Post physical flyers within 1 mile radius',
        'Register with local shelters and animal control',
        'Contact local vets and pet stores',
      ],
    };
  } else if (hoursLost < 72) {
    return {
      phase: 'Days 2-3',
      icon: Search,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      tips: [
        'Set up feeding stations and trail cameras',
        'Consider humane traps in likely hiding spots',
        'Check shelters in person (don\'t just call)',
        'Expand flyer radius to 3+ miles',
      ],
    };
  } else {
    return {
      phase: 'Extended Search',
      icon: Heart,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      tips: [
        'Don\'t give up - pets are found weeks or months later',
        'Refresh flyers and social media posts weekly',
        'Check shelters regularly in a 30+ mile radius',
        'Consider hiring a pet detective or using scent dogs',
      ],
    };
  }
}

// Terrain-specific guidance
const TERRAIN_TIPS = {
  URBAN: {
    icon: Building2,
    focus: 'Urban environments have many hiding spots: under porches, in garages, behind dumpsters.',
    tips: [
      'Check parking garages and commercial loading docks',
      'Ask businesses to check storage areas',
      'Contact sanitation workers who cover your area',
    ],
  },
  SUBURBAN: {
    icon: Home,
    focus: 'Suburban areas offer yards, sheds, and wooded edges as hiding spots.',
    tips: [
      'Knock on every door within 5 houses',
      'Check all backyard structures: sheds, playhouses, under decks',
      'Search drainage ditches and culverts',
    ],
  },
  RURAL: {
    icon: TreePine,
    focus: 'Rural areas are challenging - pets may travel further but also have more predator threats.',
    tips: [
      'Focus on barns, outbuildings, and abandoned structures',
      'Contact farmers and landowners in the area',
      'Set up trail cameras at field edges and water sources',
    ],
  },
  WOODED: {
    icon: TreePine,
    focus: 'Wooded areas provide excellent cover for hiding pets.',
    tips: [
      'Search at dawn and dusk when animals are most active',
      'Look for trails and clearings where pets may travel',
      'Leave scent items at trail intersections',
    ],
  },
};

export default function RecoveryGuidance({ config, batch }) {
  const speciesTips = SPECIES_TIPS[config.petSpecies] || SPECIES_TIPS.OTHER;
  const personalityTips = PERSONALITY_TIPS[config.petPersonality] || PERSONALITY_TIPS.NEUTRAL;
  const terrainTips = TERRAIN_TIPS[config.terrainType] || TERRAIN_TIPS.SUBURBAN;
  const timeGuidance = getTimeGuidance(config.maxSimulationHours || 24);
  const TerrainIcon = terrainTips.icon;
  const TimeIcon = timeGuidance.icon;

  // Calculate insights from batch if available
  const batchInsights = batch ? {
    successRate: batch.successRate || 0,
    avgTimeMins: batch.avgTimeToFindMins,
    mostCommonOutcome: batch.foundBySearcherCount > batch.returnedHomeCount
      ? 'active_search'
      : 'return_home',
  } : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6" />
          <div>
            <h2 className="font-bold text-lg">{speciesTips.title}</h2>
            <p className="text-indigo-100 text-sm">Recovery guidance based on your simulation</p>
          </div>
        </div>
      </div>

      {/* Simulation Insights */}
      {batchInsights && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Search className="w-4 h-4 text-indigo-600" />
            Based on {batch.totalRuns} Simulations
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-green-700 font-medium">
                {batchInsights.successRate.toFixed(0)}% Recovery Rate
              </div>
              <div className="text-green-600 text-xs">
                Predicted within simulation window
              </div>
            </div>
            {batchInsights.avgTimeMins && (
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-blue-700 font-medium">
                  ~{Math.round(batchInsights.avgTimeMins / 60)} Hours Average
                </div>
                <div className="text-blue-600 text-xs">
                  Time to recovery when found
                </div>
              </div>
            )}
          </div>
          {batchInsights.mostCommonOutcome === 'active_search' ? (
            <p className="mt-3 text-sm text-gray-600">
              <strong>Active searching works!</strong> In simulations, most finds came from search parties.
              Focus your efforts on systematic ground searches.
            </p>
          ) : (
            <p className="mt-3 text-sm text-gray-600">
              <strong>Many pets return home.</strong> Keep food and familiar items outside.
              Don't leave the house unattended for long periods.
            </p>
          )}
        </div>
      )}

      {/* Time-Based Phase */}
      <div className={`rounded-lg p-4 ${timeGuidance.bg}`}>
        <h3 className={`font-semibold mb-2 flex items-center gap-2 ${timeGuidance.color}`}>
          <TimeIcon className="w-4 h-4" />
          {timeGuidance.phase}
        </h3>
        <ul className="space-y-1.5 text-sm text-gray-700">
          {timeGuidance.tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">•</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Search Timing */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600" />
          Optimal Search Times
        </h3>
        <p className="text-sm text-gray-600">{speciesTips.searchTiming}</p>
        <div className="mt-3 flex gap-2">
          <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
            Dawn: 5-7 AM
          </span>
          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
            Dusk: 5-8 PM
          </span>
          {config.petSpecies === 'CAT' && (
            <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
              Night: 10 PM-2 AM
            </span>
          )}
        </div>
      </div>

      {/* Terrain Focus */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <TerrainIcon className="w-4 h-4 text-indigo-600" />
          {config.terrainType} Area Focus
        </h3>
        <p className="text-sm text-gray-600 mb-3">{terrainTips.focus}</p>
        <ul className="space-y-1.5 text-sm text-gray-600">
          {terrainTips.tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2">
              <MapPin className="w-3 h-3 text-gray-400 mt-1 flex-shrink-0" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Attraction Methods */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-indigo-600" />
          Attraction Strategies
        </h3>
        <ul className="space-y-2 text-sm text-gray-600">
          {speciesTips.attraction.map((tip, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Personality Approach */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-2">
          {config.petPersonality === 'FRIENDLY' ? '🤗' : config.petPersonality === 'SHY' ? '😰' : '😐'}{' '}
          {config.petPersonality} Pet Approach
        </h3>
        <p className="text-sm text-gray-600 mb-2">{personalityTips.approach}</p>
        <p className="text-sm text-gray-600 mb-2"><strong>Strategy:</strong> {personalityTips.strategy}</p>
        <p className="text-sm text-gray-600"><strong>Shelters:</strong> {personalityTips.shelter}</p>
      </div>

      {/* Warnings */}
      <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
        <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Important Warnings
        </h3>
        <ul className="space-y-1.5 text-sm text-amber-700">
          {speciesTips.warnings.map((warning, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">⚠</span>
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Night Search Tips */}
      {(config.petSpecies === 'CAT' || config.petPersonality === 'SHY') && (
        <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-4">
          <h3 className="font-semibold text-indigo-800 mb-2 flex items-center gap-2">
            <Flashlight className="w-4 h-4" />
            Night Search Tips
          </h3>
          <ul className="space-y-1.5 text-sm text-indigo-700">
            <li className="flex items-start gap-2">
              <span className="text-indigo-400 mt-0.5">•</span>
              <span>Use a flashlight to spot eye shine in the dark</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-400 mt-0.5">•</span>
              <span>Search slowly and quietly - scared pets freeze when frightened</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-400 mt-0.5">•</span>
              <span>Sit quietly for 10-15 minutes in likely hiding spots</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-400 mt-0.5">•</span>
              <span>Bring treats and make calm, familiar sounds</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
