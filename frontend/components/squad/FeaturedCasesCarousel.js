'use client';

/**
 * FeaturedCases - Shows 2-3 random active cases from the most recent 30
 *
 * Simple, non-carousel design:
 * - Picks 3 random cases on each page load
 * - Responsive grid layout
 * - Clean, compact cards
 */

import { useMemo } from 'react';
import { Clock, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';

export default function FeaturedCases({ cases }) {
  const router = useRouter();

  // Get 3 random cases from the most recent 30 active cases
  const featuredCases = useMemo(() => {
    const activeCases = cases
      .filter(c => c.status === 'ACTIVE' || c.status === 'IN_PROGRESS' || c.status === 'PENDING')
      .slice(0, 30);

    if (activeCases.length === 0) return [];

    // Shuffle and pick up to 3
    const shuffled = [...activeCases].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(3, shuffled.length));
  }, [cases]);

  if (featuredCases.length === 0) return null;

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-800/60">
      <div className="max-w-7xl mx-auto px-6 py-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Featured Cases</h3>
          <div className="h-px flex-1 bg-gradient-to-r from-slate-700/50 to-transparent" />
        </div>

        {/* Cases Grid - responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {featuredCases.map((caseData) => (
            <FeaturedCaseCard key={caseData.id} caseData={caseData} router={router} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FeaturedCaseCard({ caseData, router }) {
  const {
    caseNumber,
    petName,
    species,
    photoUrl,
    urgency,
    lastSeenAt,
    helperCount,
  } = caseData;

  const speciesEmoji = {
    DOG: '🐕',
    CAT: '🐈',
    BIRD: '🐦',
    RABBIT: '🐰',
    OTHER: '🐾',
  }[species] || '🐾';

  const timeAgo = lastSeenAt
    ? formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true })
    : 'Recently';

  return (
    <button
      onClick={() => router.push(`/mission-control?mission=${caseNumber}`)}
      className="group relative bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3 hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/20 transition-all text-left"
    >
      <div className="flex items-center gap-3">
        {/* Pet Photo */}
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={petName}
            loading="lazy"
            className="w-12 h-12 rounded-lg object-cover border border-slate-600/50 group-hover:border-orange-500/30 transition-colors"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-slate-700/50 border border-slate-600/50 group-hover:border-orange-500/30 flex items-center justify-center text-2xl transition-colors">
            {speciesEmoji}
          </div>
        )}

        {/* Case Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-bold text-white text-sm truncate group-hover:text-orange-400 transition-colors">
              {petName}
            </h4>
            {urgency === 'HIGH' && (
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Users size={10} />
              {helperCount || 0}
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {timeAgo.replace(' ago', '')}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
