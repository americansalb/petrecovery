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

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-red-950/40 to-slate-900/40 backdrop-blur-sm border-2 border-red-500/50 rounded-2xl p-8 mb-8 shadow-lg shadow-red-500/20">
      {/* Urgent Badge */}
      <div className="absolute top-4 right-4 px-4 py-2 rounded-full bg-red-500 text-white font-bold text-xs uppercase tracking-wider animate-pulse shadow-lg shadow-red-500/50">
        ⚡ Urgent
      </div>

      {/* Case Content */}
      <div className="flex gap-6 items-center">
        {/* Pet Photo */}
        <div className="flex-shrink-0">
          {currentCase.photoUrl ? (
            <img
              src={currentCase.photoUrl}
              alt={currentCase.petName}
              className="w-32 h-32 rounded-xl object-cover border-2 border-red-500/50 shadow-xl"
            />
          ) : (
            <div className="w-32 h-32 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-6xl border-2 border-red-500/50">
              {speciesEmoji}
            </div>
          )}
        </div>

        {/* Case Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-3xl font-bold text-white mb-2">
            {currentCase.petName}
            <span className="text-red-400 ml-3">·</span>
            <span className="text-slate-300 text-2xl ml-3 capitalize">{currentCase.species?.toLowerCase()}</span>
          </h3>

          {currentCase.lastSeenAddress && (
            <div className="flex items-center gap-2 text-slate-300 mb-3">
              <MapPin size={18} className="text-red-400 flex-shrink-0" />
              <span className="font-medium">{currentCase.lastSeenAddress}</span>
            </div>
          )}

          {currentCase.lastSeenAt && (
            <div className="flex items-center gap-2 text-slate-400 mb-4">
              <Clock size={16} className="flex-shrink-0" />
              <span className="text-sm">
                Last seen {formatDistanceToNow(new Date(currentCase.lastSeenAt), { addSuffix: true })}
              </span>
            </div>
          )}

          <button
            onClick={() => router.push(`/cases/${currentCase.caseNumber}`)}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white font-bold shadow-lg shadow-red-600/30 hover:shadow-xl hover:shadow-red-600/50 hover:scale-105 transition-all duration-200"
          >
            View Case & Help →
          </button>
        </div>

        {/* Navigation */}
        {featuredCases.length > 1 && (
          <div className="flex flex-col gap-3">
            <button
              onClick={goToPrevious}
              className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white hover:bg-slate-700 hover:border-cyan-500/50 transition-all"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={goToNext}
              className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white hover:bg-slate-700 hover:border-cyan-500/50 transition-all"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        )}
      </div>

      {/* Dots Indicator */}
      {featuredCases.length > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {featuredCases.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentIndex(index);
                setIsAutoPlaying(false);
              }}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? 'w-8 bg-red-500'
                  : 'bg-slate-600 hover:bg-slate-500'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
