'use client';

/**
 * FeaturedCasesCarousel - Auto-cycling carousel showing 3-4 recent cases
 *
 * Performance optimizations:
 * - CSS transforms for smooth animations
 * - Lazy image loading
 * - Limits to 30 most recent cases
 * - Responsive: 1 card mobile, 3 cards tablet, 4 cards desktop
 */

import { useState, useEffect } from 'react';
import { Clock, Users, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';

export default function FeaturedCasesCarousel({ cases }) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Get 30 most recent active cases (sorted by creation/update time)
  const featuredCases = cases
    .filter(c => c.status === 'ACTIVE' || c.status === 'IN_PROGRESS' || c.status === 'PENDING')
    .slice(0, 30);

  // Auto-cycle every 6 seconds
  useEffect(() => {
    if (featuredCases.length <= 4) return; // Don't cycle if all cases fit

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredCases.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [featuredCases.length]);

  if (featuredCases.length === 0) return null;

  return (
    <div className="relative border-b border-slate-800/60 bg-slate-900/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-3">
        {/* Compact Title */}
        <div className="flex items-center gap-3 mb-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Featured Cases</h3>
          <div className="h-px flex-1 bg-gradient-to-r from-slate-700/50 to-transparent" />
          <div className="text-xs text-slate-500">
            {currentIndex + 1}-{Math.min(currentIndex + 4, featuredCases.length)} of {featuredCases.length}
          </div>
        </div>

        {/* Compact Carousel Container */}
        <div className="relative overflow-hidden -mx-2 px-2">
          <div
            className="flex gap-3 transition-transform duration-700 ease-in-out pb-2"
            style={{
              transform: `translateX(-${currentIndex * (100 / 4 + 3)}%)`
            }}
          >
            {featuredCases.map((caseData) => (
              <FeaturedCaseCard key={caseData.id} caseData={caseData} router={router} />
            ))}
          </div>
        </div>

        {/* Compact Dots indicator */}
        {featuredCases.length > 4 && (
          <div className="flex items-center justify-center gap-0.5 mt-1">
            {Array.from({ length: Math.ceil(featuredCases.length / 4) }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx * 4)}
                style={{
                  width: Math.floor(currentIndex / 4) === idx ? '4px' : '2px',
                  height: '2px',
                }}
                className={`rounded-full transition-all ${
                  Math.floor(currentIndex / 4) === idx
                    ? 'bg-orange-500'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              />
            ))}
          </div>
        )}
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
      className="flex-shrink-0 w-64 group relative bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3 hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/20 transition-all"
    >
      <div className="flex items-center gap-3">
        {/* Compact Pet Photo */}
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

        {/* Compact Case Info */}
        <div className="flex-1 text-left min-w-0">
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
