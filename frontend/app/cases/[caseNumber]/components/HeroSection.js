'use client';

/**
 * HeroSection - Premium Lost Pet Hero
 *
 * Design: Clean, light background with pet photo as the star.
 * Color palette: Midnight blue + Flash yellow (NO red/rose)
 *
 * Key elements:
 * - Large pet photo with subtle shadow
 * - Urgency badge in flash yellow
 * - Clear pet identity
 * - Time missing with actual date
 * - Reward if available
 */

import { motion } from 'framer-motion';
import { Clock, MapPin, AlertTriangle, Gift } from 'lucide-react';

// Calculate urgency level based on time elapsed
const getUrgencyConfig = (lastSeenAt) => {
  if (!lastSeenAt) return { level: 'MISSING', urgencyClass: 'bg-midnight-800', textClass: 'text-white', pulse: false };

  const now = new Date();
  const then = new Date(lastSeenAt);
  const hoursAgo = (now - then) / (1000 * 60 * 60);

  if (hoursAgo < 6) {
    return { level: 'JUST LOST', urgencyClass: 'bg-flash-400', textClass: 'text-midnight-900', pulse: true };
  }
  if (hoursAgo < 24) {
    return { level: 'URGENT', urgencyClass: 'bg-flash-400', textClass: 'text-midnight-900', pulse: true };
  }
  if (hoursAgo < 72) {
    return { level: 'HIGH PRIORITY', urgencyClass: 'bg-flash-500', textClass: 'text-midnight-900', pulse: false };
  }
  if (hoursAgo < 168) {
    return { level: 'ACTIVE SEARCH', urgencyClass: 'bg-midnight-700', textClass: 'text-white', pulse: false };
  }
  return { level: 'MISSING', urgencyClass: 'bg-midnight-800', textClass: 'text-white', pulse: false };
};

// Format time since missing with both relative and absolute
const formatTimeMissing = (lastSeenAt) => {
  if (!lastSeenAt) return { relative: 'Unknown', absolute: '', days: 0 };

  const now = new Date();
  const then = new Date(lastSeenAt);
  const diffMs = now - then;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let relative;
  if (diffHours < 1) relative = 'Less than 1 hour';
  else if (diffHours < 24) relative = `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
  else if (diffDays === 1) relative = '1 day';
  else if (diffDays < 7) relative = `${diffDays} days`;
  else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    relative = `${weeks} week${weeks !== 1 ? 's' : ''}`;
  } else {
    const months = Math.floor(diffDays / 30);
    relative = `${months} month${months !== 1 ? 's' : ''}`;
  }

  const absolute = then.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  return { relative, absolute, days: diffDays };
};

// Get pet emoji based on species
const getPetEmoji = (species) => {
  switch (species?.toUpperCase()) {
    case 'DOG': return '🐕';
    case 'CAT': return '🐈';
    case 'BIRD': return '🦜';
    case 'RABBIT': return '🐰';
    default: return '🐾';
  }
};

export default function HeroSection({ caseData }) {
  if (!caseData) return null;

  const petName = caseData.petName || 'Unknown';
  const isLost = caseData.reportType === 'LOST';
  const urgency = getUrgencyConfig(caseData.lastSeenAt);
  const timeMissing = formatTimeMissing(caseData.lastSeenAt);
  const petEmoji = getPetEmoji(caseData.petSpecies);

  // Extract city from address
  const getCity = (address) => {
    if (!address) return '';
    const parts = address.split(',');
    if (parts.length >= 2) {
      return parts[parts.length - 2]?.trim() || '';
    }
    return address;
  };

  const city = getCity(caseData.lastSeenAddress);

  return (
    <section className="bg-gradient-to-b from-midnight-50 to-white">
      <div className="max-w-5xl mx-auto px-4 pt-8 pb-6">

        {/* Top Bar: Species + Urgency */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          {/* Species Badge */}
          <div className="flex items-center gap-2 px-4 py-2 bg-midnight-100 rounded-full">
            <span className="text-lg">{petEmoji}</span>
            <span className="text-sm font-semibold text-midnight-700 uppercase tracking-wide">
              {isLost ? 'Lost' : 'Found'} {caseData.petSpecies || 'Pet'}
            </span>
          </div>

          {/* Urgency Badge */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm ${urgency.urgencyClass} ${urgency.textClass}`}>
            {urgency.pulse && (
              <span className="w-2 h-2 bg-current rounded-full animate-pulse opacity-80" />
            )}
            <AlertTriangle className="w-4 h-4" />
            {urgency.level}
          </div>
        </motion.div>

        {/* Main Hero Grid */}
        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* Pet Photo - The Star */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="w-full lg:w-[380px] flex-shrink-0"
          >
            <div className="relative">
              {/* Photo Container */}
              <div className="aspect-square rounded-3xl overflow-hidden shadow-2xl shadow-midnight-200/50 border-4 border-white">
                {caseData.petPhotoUrl ? (
                  <img
                    src={caseData.petPhotoUrl}
                    alt={`${petName} - Lost ${caseData.petSpecies || 'Pet'}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-midnight-100 to-midnight-200 flex items-center justify-center">
                    <span className="text-9xl opacity-50">{petEmoji}</span>
                  </div>
                )}
              </div>

              {/* Reward Badge - Positioned on photo */}
              {caseData.hasReward && caseData.rewardAmount > 0 && (
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-6 py-2 bg-flash-400 text-midnight-900 font-bold rounded-full shadow-lg shadow-flash-400/30 flex items-center gap-2">
                  <Gift className="w-5 h-5" />
                  ${caseData.rewardAmount} REWARD
                </div>
              )}
            </div>
          </motion.div>

          {/* Pet Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex-1 lg:pt-4"
          >
            {/* Pet Name - The Hook */}
            <h1 className="text-4xl lg:text-5xl font-bold text-midnight-900 mb-4 leading-tight">
              Help Find <span className="text-midnight-700">{petName}</span>
            </h1>

            {/* Identifying Tags */}
            <div className="flex flex-wrap gap-2 mb-6">
              {caseData.petBreed && (
                <span className="px-4 py-2 bg-midnight-100 text-midnight-700 rounded-full text-sm font-medium">
                  {caseData.petBreed}
                </span>
              )}
              {caseData.petColor && (
                <span className="px-4 py-2 bg-midnight-100 text-midnight-700 rounded-full text-sm font-medium capitalize">
                  {caseData.petColor}
                </span>
              )}
              {caseData.petSize && (
                <span className="px-4 py-2 bg-midnight-100 text-midnight-700 rounded-full text-sm font-medium capitalize">
                  {caseData.petSize.toLowerCase()}
                </span>
              )}
            </div>

            {/* Key Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {/* Location */}
              <div className="flex items-center gap-3 bg-white border border-midnight-200 rounded-2xl px-4 py-3 shadow-sm">
                <div className="w-10 h-10 bg-midnight-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-midnight-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-midnight-500 uppercase tracking-wide font-medium">Last Seen</p>
                  <p className="font-semibold text-midnight-900 truncate">{city || caseData.lastSeenAddress || 'Unknown'}</p>
                </div>
              </div>

              {/* Time Missing */}
              <div className="flex items-center gap-3 bg-white border border-midnight-200 rounded-2xl px-4 py-3 shadow-sm">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  timeMissing.days < 3 ? 'bg-flash-100' : 'bg-midnight-100'
                }`}>
                  <Clock className={`w-5 h-5 ${timeMissing.days < 3 ? 'text-flash-600' : 'text-midnight-600'}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-midnight-500 uppercase tracking-wide font-medium">Missing</p>
                  <p className="font-semibold text-midnight-900">{timeMissing.relative}</p>
                </div>
              </div>
            </div>

            {/* Description */}
            {caseData.petDescription && (
              <p className="text-midnight-600 text-base leading-relaxed mb-4">
                {caseData.petDescription}
              </p>
            )}

            {/* Exact Date/Time */}
            <p className="text-sm text-midnight-400">
              Last seen: {timeMissing.absolute}
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
