'use client';

/**
 * HeroSection - The identity of the lost pet
 *
 * Above-the-fold content that makes the pet unforgettable in 3 seconds.
 * Shows: photo, name, species/breed, urgency, reward, location, time missing
 */

import { motion } from 'framer-motion';
import { Clock, MapPin, AlertTriangle, DollarSign } from 'lucide-react';

// Calculate urgency level based on time elapsed
const getUrgencyLevel = (lastSeenAt) => {
  if (!lastSeenAt) return { level: 'ACTIVE', color: 'blue', bgColor: 'bg-blue-500', pulse: false };

  const now = new Date();
  const then = new Date(lastSeenAt);
  const hoursAgo = (now - then) / (1000 * 60 * 60);

  if (hoursAgo < 24) {
    return { level: 'CRITICAL', color: 'red', bgColor: 'bg-red-500', pulse: true, label: 'Just Lost' };
  }
  if (hoursAgo < 72) {
    return { level: 'HIGH', color: 'orange', bgColor: 'bg-orange-500', pulse: false, label: 'Missing 1-3 days' };
  }
  if (hoursAgo < 168) {
    return { level: 'MODERATE', color: 'yellow', bgColor: 'bg-amber-500', pulse: false, label: 'Missing 3-7 days' };
  }
  return { level: 'ACTIVE', color: 'blue', bgColor: 'bg-blue-500', pulse: false, label: 'Active Search' };
};

// Format time since missing with both relative and absolute
const formatTimeMissing = (lastSeenAt) => {
  if (!lastSeenAt) return { relative: 'Unknown', absolute: '' };

  const now = new Date();
  const then = new Date(lastSeenAt);
  const diffMs = now - then;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let relative;
  if (diffHours < 1) relative = 'Less than an hour';
  else if (diffHours < 24) relative = `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
  else if (diffDays === 1) relative = '1 day';
  else if (diffDays < 7) relative = `${diffDays} days`;
  else if (diffDays < 30) relative = `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? 's' : ''}`;
  else relative = `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) !== 1 ? 's' : ''}`;

  // Format absolute date
  const absolute = then.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  return { relative, absolute };
};

export default function HeroSection({ caseData, onContactOwner }) {
  if (!caseData) return null;

  const petName = caseData.petName || 'Unknown';
  const isLost = caseData.reportType === 'LOST';
  const urgency = getUrgencyLevel(caseData.lastSeenAt);
  const timeMissing = formatTimeMissing(caseData.lastSeenAt);

  // Extract city from address for cleaner display
  const getLocationShort = (address) => {
    if (!address) return 'Unknown location';
    const parts = address.split(',');
    if (parts.length >= 2) {
      return parts.slice(-2).join(',').trim();
    }
    return address;
  };

  return (
    <section className="relative bg-gradient-to-br from-rose-500 via-rose-600 to-rose-700 text-white overflow-hidden">
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '24px 24px'
          }}
        />
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 lg:py-12 relative z-10">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 items-center">

          {/* Pet Photo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-xs lg:max-w-sm flex-shrink-0"
          >
            <div className="relative aspect-square rounded-3xl overflow-hidden shadow-2xl border-4 border-white/20">
              {caseData.petPhotoUrl ? (
                <img
                  src={caseData.petPhotoUrl}
                  alt={`${petName} - Lost ${caseData.petSpecies || 'Pet'}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-rose-400 flex items-center justify-center">
                  <span className="text-8xl">
                    {caseData.petSpecies === 'DOG' ? '🐕' :
                     caseData.petSpecies === 'CAT' ? '🐈' :
                     caseData.petSpecies === 'BIRD' ? '🦜' :
                     caseData.petSpecies === 'RABBIT' ? '🐰' : '🐾'}
                  </span>
                </div>
              )}

              {/* Urgency Badge */}
              <div className={`absolute top-4 left-4 px-3 py-1.5 ${urgency.bgColor} text-white text-sm font-bold rounded-full shadow-lg flex items-center gap-1.5`}>
                {urgency.pulse && (
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                )}
                <AlertTriangle className="w-4 h-4" />
                {urgency.level}
              </div>

              {/* Reward Badge */}
              {caseData.hasReward && caseData.rewardAmount > 0 && (
                <div className="absolute bottom-4 right-4 px-4 py-2 bg-flash-400 text-midnight-900 font-bold rounded-full shadow-lg flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  {caseData.rewardAmount} REWARD
                </div>
              )}
            </div>
          </motion.div>

          {/* Pet Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="flex-1 text-center lg:text-left"
          >
            {/* Status Badge */}
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm px-4 py-2 rounded-full mb-4">
              <span className={`w-2 h-2 ${urgency.bgColor} rounded-full ${urgency.pulse ? 'animate-pulse' : ''}`} />
              <span className="font-semibold text-sm uppercase tracking-wide">
                {isLost ? 'Lost' : 'Found'} {caseData.petSpecies || 'Pet'}
              </span>
            </div>

            {/* Pet Name - The Hook */}
            <h1 className="text-4xl lg:text-6xl font-bold mb-4 leading-tight">
              Help Find {petName}
            </h1>

            {/* Identifying Tags */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-2 mb-5">
              {caseData.petBreed && (
                <span className="px-4 py-2 bg-white/20 rounded-full text-sm font-medium">
                  {caseData.petBreed}
                </span>
              )}
              {caseData.petColor && (
                <span className="px-4 py-2 bg-white/20 rounded-full text-sm font-medium capitalize">
                  {caseData.petColor}
                </span>
              )}
              {caseData.petSize && (
                <span className="px-4 py-2 bg-white/20 rounded-full text-sm font-medium capitalize">
                  {caseData.petSize.toLowerCase()}
                </span>
              )}
            </div>

            {/* Key Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 max-w-lg mx-auto lg:mx-0">
              {/* Location */}
              <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
                <MapPin className="w-5 h-5 text-rose-200 flex-shrink-0" />
                <div className="text-left overflow-hidden">
                  <p className="text-xs text-rose-200 uppercase tracking-wide">Last Seen</p>
                  <p className="font-semibold truncate">{getLocationShort(caseData.lastSeenAddress)}</p>
                </div>
              </div>

              {/* Time */}
              <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
                <Clock className="w-5 h-5 text-rose-200 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-xs text-rose-200 uppercase tracking-wide">Missing</p>
                  <p className="font-semibold">{timeMissing.relative}</p>
                </div>
              </div>
            </div>

            {/* Description if available */}
            {caseData.petDescription && (
              <p className="text-white/90 text-base lg:text-lg max-w-xl mb-4 leading-relaxed">
                {caseData.petDescription}
              </p>
            )}

            {/* Secondary info - exact date */}
            <p className="text-rose-200 text-sm">
              Last seen: {timeMissing.absolute}
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
