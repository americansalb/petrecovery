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
    <div className="relative">
      {/* Title */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-flash-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wide">Featured Cases</h3>
        </div>
        <div className="text-xs text-slate-500">
          {currentIndex + 1}-{Math.min(currentIndex + 4, featuredCases.length)} of {featuredCases.length}
        </div>
      </div>

      {/* Carousel Container */}
      <div className="relative overflow-hidden -mx-2 px-2">
        <div
          className="flex gap-4 transition-transform duration-700 ease-in-out"
          style={{
            transform: `translateX(-${currentIndex * (100 / 4 + 4)}%)`
          }}
        >
          {featuredCases.map((caseData) => (
            <FeaturedCaseCard key={caseData.id} caseData={caseData} router={router} />
          ))}
        </div>
      </div>

      {/* Dots indicator */}
      {featuredCases.length > 4 && (
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {Array.from({ length: Math.ceil(featuredCases.length / 4) }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx * 4)}
              className={`h-1.5 rounded-full transition-all ${
                Math.floor(currentIndex / 4) === idx
                  ? 'w-6 bg-flash-400'
                  : 'w-1.5 bg-slate-700 hover:bg-slate-600'
              }`}
            />
          ))}
        </div>
      )}
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
      className="flex-shrink-0 w-full sm:w-[calc(33.333%-1rem)] lg:w-[calc(25%-1rem)] group"
    >
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-xl hover:border-flash-500/50 hover:shadow-lg hover:shadow-flash-500/20 transition-all">
        {/* Urgency Badge */}
        {urgency === 'HIGH' && (
          <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-md bg-red-500 text-white text-xs font-bold uppercase">
            Urgent
          </div>
        )}

        {/* Pet Photo */}
        <div className="relative aspect-square overflow-hidden bg-slate-800">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={petName}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-slate-800 to-slate-900">
              {speciesEmoji}
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />

          {/* Name overlay on image */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <h4 className="font-bold text-white text-lg truncate group-hover:text-flash-400 transition-colors">
              {petName}
            </h4>
          </div>
        </div>

        {/* Info */}
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1">
              <Clock size={12} />
              <span>{timeAgo}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users size={12} />
              <span>{helperCount || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
