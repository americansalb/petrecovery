'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';

export default function FeaturedCasesCarousel({ cases }) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const autoPlayRef = useRef(null);

  // Filter to show only active urgent cases
  const featuredCases = cases.filter(c =>
    (c.status === 'ACTIVE' || c.status === 'IN_PROGRESS' || c.status === 'PENDING') &&
    c.urgency === 'HIGH'
  ).slice(0, 5); // Max 5 featured

  // Auto-advance carousel
  useEffect(() => {
    if (!isAutoPlaying || featuredCases.length <= 1) return;

    autoPlayRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredCases.length);
    }, 5000); // 5 seconds

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [isAutoPlaying, featuredCases.length]);

  const goToPrevious = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev - 1 + featuredCases.length) % featuredCases.length);
  };

  const goToNext = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev + 1) % featuredCases.length);
  };

  if (featuredCases.length === 0) return null;

  const currentCase = featuredCases[currentIndex];
  const speciesEmoji = {
    DOG: '🐕',
    CAT: '🐈',
    BIRD: '🐦',
    RABBIT: '🐰',
    OTHER: '🐾',
  }[currentCase.species] || '🐾';

  // Extract first photo from photoUrls JSON array
  let petPhotoUrl = null;
  if (currentCase.photoUrls) {
    try {
      const photos = typeof currentCase.photoUrls === 'string'
        ? JSON.parse(currentCase.photoUrls)
        : currentCase.photoUrls;
      petPhotoUrl = Array.isArray(photos) && photos.length > 0 ? photos[0] : null;
    } catch (e) {
      console.error('Failed to parse photoUrls:', e);
    }
  }

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-slate-800/20 to-slate-900/20 backdrop-blur-sm border border-red-500/30 rounded-xl p-4 mb-6">
      {/* Urgent Badge */}
      <div className="absolute top-2 right-2 px-2 py-1 rounded-md bg-red-500/80 text-white font-bold text-xs uppercase tracking-wider">
        ⚡ Urgent
      </div>

      {/* Case Content */}
      <div className="flex gap-4 items-center">
        {/* Pet Photo */}
        <div className="flex-shrink-0">
          {petPhotoUrl ? (
            <img
              src={petPhotoUrl}
              alt={currentCase.petName}
              className="w-16 h-16 rounded-lg object-cover border border-red-500/30"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-3xl border border-red-500/30">
              {speciesEmoji}
            </div>
          )}
        </div>

        {/* Case Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-white mb-1">
            {currentCase.petName} · {currentCase.species?.toLowerCase()}
          </h3>

          <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
            {currentCase.lastSeenAddress && (
              <div className="flex items-center gap-1">
                <MapPin size={12} className="text-red-400" />
                <span className="truncate max-w-[200px]">{currentCase.lastSeenAddress}</span>
              </div>
            )}
            {currentCase.lastSeenAt && (
              <span>
                {formatDistanceToNow(new Date(currentCase.lastSeenAt), { addSuffix: true })}
              </span>
            )}
          </div>

          <button
            onClick={() => router.push(`/cases/${currentCase.caseNumber}`)}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-500 transition-colors"
          >
            Help Now →
          </button>
        </div>

        {/* Navigation */}
        {featuredCases.length > 1 && (
          <div className="flex gap-1">
            <button
              onClick={goToPrevious}
              className="p-1.5 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={goToNext}
              className="p-1.5 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
