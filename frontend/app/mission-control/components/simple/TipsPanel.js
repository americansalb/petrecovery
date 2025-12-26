'use client';

/**
 * TipsPanel - Search strategies and recovery tips
 *
 * Features:
 * - Species-specific search advice
 * - Time-based strategies
 * - Attracting station guide
 * - What to do when found
 */

import { useState } from 'react';
import {
  Lightbulb,
  Clock,
  MapPin,
  Home,
  Eye,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Utensils,
  Moon,
  Sun,
  Heart,
} from 'lucide-react';

// Tips organized by category
const TIP_SECTIONS = {
  DOG: [
    {
      id: 'search-pattern',
      title: 'Search Pattern',
      icon: MapPin,
      tips: [
        'Dogs often travel in a direction, not circles. Search outward from last known location.',
        'Check yards, under decks, and in garages - dogs may seek shelter.',
        'Visit dog parks, trails, and areas your dog knows.',
        'Dogs may travel 2-5 miles in a day when scared.',
      ]
    },
    {
      id: 'time-of-day',
      title: 'Best Search Times',
      icon: Clock,
      tips: [
        'Early morning (5-7 AM) and dusk (6-8 PM) are ideal when it\'s quieter.',
        'Avoid midday heat - dogs rest during this time.',
        'At night, use a flashlight to catch eye reflections.',
      ]
    },
    {
      id: 'attracting',
      title: 'Attracting Your Dog',
      icon: Home,
      tips: [
        'Leave your unwashed clothing or their bed outside.',
        'Set up a feeding station with their food at regular feeding times.',
        'Play sounds they know: your voice, their favorite squeaky toy.',
        'Leave your garage or gate slightly open if safe.',
      ]
    },
    {
      id: 'when-spotted',
      title: 'When You See Them',
      icon: Eye,
      tips: [
        'DON\'T chase! Scared dogs will run.',
        'Get low, turn sideways, and avoid eye contact.',
        'Speak calmly and offer treats.',
        'Let them come to you. Sit and wait if possible.',
      ]
    },
  ],
  CAT: [
    {
      id: 'search-pattern',
      title: 'Search Pattern',
      icon: MapPin,
      tips: [
        'Most cats hide within 3-5 houses of home. Search VERY close first.',
        'Check under porches, in bushes, up trees, in garages and sheds.',
        'Indoor-only cats often freeze in fear and hide silently.',
        'Search low and high - cats can be at ground level or elevated.',
      ]
    },
    {
      id: 'time-of-day',
      title: 'Best Search Times',
      icon: Clock,
      tips: [
        'Search at night between 2-5 AM when it\'s quiet.',
        'Use a flashlight - cat eyes reflect brightly.',
        'Listen for meows - cats are more vocal at night.',
        'Early dawn before traffic picks up is also effective.',
      ]
    },
    {
      id: 'attracting',
      title: 'Attracting Your Cat',
      icon: Home,
      tips: [
        'Put their litter box outside - they can smell it from far away.',
        'Leave your worn clothes near the door.',
        'Set up a trail of their food leading to your door.',
        'Leave a window or door cracked if safe (use a screen).',
      ]
    },
    {
      id: 'when-spotted',
      title: 'When You See Them',
      icon: Eye,
      tips: [
        'DO NOT approach or chase - frightened cats bolt.',
        'Get low and make yourself small.',
        'Talk softly and offer treats or shake a food bag.',
        'Consider a humane trap if they won\'t come to you.',
      ]
    },
  ],
};

const TIME_BASED_ADVICE = [
  {
    range: '0-24 hours',
    urgency: 'critical',
    color: 'red',
    title: 'First 24 Hours',
    advice: [
      'Search your home thoroughly - check closets, under beds, in appliances.',
      'Walk the immediate neighborhood calling their name.',
      'Alert neighbors and ask them to check yards and garages.',
      'Post on social media and Nextdoor immediately.',
    ]
  },
  {
    range: '24-72 hours',
    urgency: 'high',
    color: 'amber',
    title: '24-72 Hours',
    advice: [
      'Expand search radius - 1 mile for cats, 3 miles for dogs.',
      'Contact all local shelters and animal control.',
      'Post flyers at intersections, vet offices, and pet stores.',
      'Set up feeding/attracting stations at last known location.',
    ]
  },
  {
    range: '3-7 days',
    urgency: 'moderate',
    color: 'yellow',
    title: '3-7 Days',
    advice: [
      'Search at dawn and dusk when pets are more active.',
      'Use a humane trap with their favorite food.',
      'Re-visit shelters - new animals arrive daily.',
      'Check with neighbors who have been away.',
    ]
  },
  {
    range: '1+ week',
    urgency: 'ongoing',
    color: 'blue',
    title: 'After 1 Week',
    advice: [
      'Don\'t give up! Pets are found weeks and months later.',
      'Refresh flyers and social media posts.',
      'Expand to vet clinics in a wider radius.',
      'Consider posting a reward if you haven\'t already.',
    ]
  },
];

export default function TipsPanel({
  petSpecies = 'DOG',
  hoursMissing = 0,
}) {
  const [expandedSection, setExpandedSection] = useState('search-pattern');
  const [expandedTimeAdvice, setExpandedTimeAdvice] = useState(null);

  // Get species-specific tips
  const speciesTips = TIP_SECTIONS[petSpecies] || TIP_SECTIONS.DOG;

  // Determine current time phase
  const getCurrentPhase = () => {
    if (hoursMissing < 24) return '0-24 hours';
    if (hoursMissing < 72) return '24-72 hours';
    if (hoursMissing < 168) return '3-7 days';
    return '1+ week';
  };
  const currentPhase = getCurrentPhase();

  const urgencyColors = {
    red: 'bg-red-500/10 border-red-500/30 text-red-400',
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-y-auto">
      {/* Header */}
      <div className="shrink-0 p-4 bg-slate-900/50 border-b border-slate-800">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Lightbulb size={20} className="text-amber-400" />
          Search Tips
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Strategies for finding {petSpecies === 'CAT' ? 'cats' : 'dogs'} based on animal behavior
        </p>
      </div>

      {/* Current Time Phase Banner */}
      {TIME_BASED_ADVICE.filter(t => t.range === currentPhase).map(phase => (
        <div
          key={phase.range}
          className={`mx-4 mt-4 p-4 rounded-xl border ${urgencyColors[phase.color]}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold">{phase.title}</span>
            <Clock size={16} />
          </div>
          <ul className="space-y-1">
            {phase.advice.slice(0, 2).map((tip, i) => (
              <li key={i} className="text-xs opacity-80 flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* Species-Specific Tips */}
      <div className="p-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          {petSpecies === 'CAT' ? '🐱 Cat' : '🐕 Dog'} Search Strategies
        </h3>

        <div className="space-y-2">
          {speciesTips.map(section => {
            const isExpanded = expandedSection === section.id;
            const IconComponent = section.icon;

            return (
              <div key={section.id} className="rounded-xl border border-slate-800 overflow-hidden">
                <button
                  onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                  className="w-full p-4 flex items-center gap-3 hover:bg-slate-900/50 transition"
                >
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                    <IconComponent size={18} />
                  </div>
                  <span className="flex-1 text-left font-medium text-white">{section.title}</span>
                  {isExpanded ? (
                    <ChevronDown size={18} className="text-slate-500" />
                  ) : (
                    <ChevronRight size={18} className="text-slate-500" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-2">
                    {section.tips.map((tip, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/50">
                        <span className="text-amber-400 mt-0.5">•</span>
                        <p className="text-sm text-slate-300">{tip}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Time-Based Strategies */}
      <div className="p-4 border-t border-slate-800">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Time-Based Strategies
        </h3>

        <div className="space-y-2">
          {TIME_BASED_ADVICE.map(phase => {
            const isExpanded = expandedTimeAdvice === phase.range;
            const isCurrent = phase.range === currentPhase;

            return (
              <div
                key={phase.range}
                className={`rounded-xl border overflow-hidden ${
                  isCurrent ? urgencyColors[phase.color] : 'border-slate-800'
                }`}
              >
                <button
                  onClick={() => setExpandedTimeAdvice(isExpanded ? null : phase.range)}
                  className="w-full p-3 flex items-center gap-3 hover:bg-slate-900/30 transition"
                >
                  <Clock size={16} className={isCurrent ? '' : 'text-slate-500'} />
                  <span className={`flex-1 text-left text-sm font-medium ${isCurrent ? '' : 'text-slate-400'}`}>
                    {phase.title}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/20">NOW</span>
                  )}
                  {isExpanded ? (
                    <ChevronDown size={16} className="text-slate-500" />
                  ) : (
                    <ChevronRight size={16} className="text-slate-500" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 space-y-1">
                    {phase.advice.map((tip, i) => (
                      <p key={i} className="text-xs text-slate-400 flex items-start gap-2 pl-6">
                        <span>•</span>
                        <span>{tip}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Safety Reminder */}
      <div className="p-4">
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <div className="flex items-center gap-2 text-red-400 font-semibold mb-2">
            <AlertTriangle size={18} />
            Safety First
          </div>
          <ul className="text-xs text-slate-400 space-y-1">
            <li>• Don't search alone at night in unfamiliar areas</li>
            <li>• Carry a phone and let someone know where you're going</li>
            <li>• Be cautious around stray/unknown animals</li>
          </ul>
        </div>
      </div>

      {/* Bottom padding */}
      <div className="h-4" />
    </div>
  );
}
