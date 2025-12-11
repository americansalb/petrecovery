'use client';

/**
 * Homepage - Live Data Redesign
 *
 * Features:
 * - Live metrics from /api/public/homepage
 * - Animated counting numbers
 * - Real reunion ticker with actual pet names
 * - Active cases preview with photos
 * - Engaging call-to-actions
 *
 * Uses: Midnight Blue + Flashlight Yellow color palette
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  Bell,
  Search,
  Shield,
  CheckCircle,
  ArrowRight,
  Users,
  MapPin,
  Clock,
  Heart,
  Zap,
  Eye,
  TrendingUp,
  Activity,
  ChevronRight,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui';

// --- Animated Counter Hook ---
function useAnimatedCounter(endValue, duration = 2000, startOnView = true) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  useEffect(() => {
    if (startOnView && !isInView) return;
    if (hasStarted) return;
    if (endValue === 0) return;

    setHasStarted(true);
    const startTime = Date.now();
    const startValue = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth deceleration
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = Math.round(startValue + (endValue - startValue) * easeOutQuart);

      setCount(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [endValue, duration, isInView, startOnView, hasStarted]);

  return { count, ref };
}

// --- Format Number Helper ---
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(num >= 10000 ? 0 : 1) + 'K';
  }
  return num.toLocaleString();
}

// --- Live Reunion Ticker ---
const LiveReunionTicker = ({ reunions = [], loading = false }) => {
  const [index, setIndex] = useState(0);

  // Default placeholder if no data
  const displayData = reunions.length > 0 ? reunions : [
    { petName: 'Loading...', petBreed: '', city: '', state: '' }
  ];

  useEffect(() => {
    if (displayData.length <= 1) return;

    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % displayData.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [displayData.length]);

  const current = displayData[index];

  return (
    <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white py-2.5 relative z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-green-100">Loading live reunions...</span>
          </div>
        ) : (
          <>
            <div className="hidden sm:flex items-center gap-2 text-green-200 text-sm">
              <Activity className="w-4 h-4 animate-pulse" />
              <span>LIVE</span>
            </div>
            <AnimatePresence mode='wait'>
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex items-center gap-2 text-sm"
              >
                <span className="inline-flex items-center justify-center w-5 h-5 bg-white rounded-full">
                  <Heart className="w-3 h-3 text-green-600 fill-green-600" />
                </span>
                <span className="text-green-100">Just reunited:</span>
                <span className="font-bold text-white">{current.petName}</span>
                {current.petBreed && (
                  <span className="text-green-200">({current.petBreed})</span>
                )}
                {current.city && (
                  <span className="text-green-300">in {current.city}{current.state ? `, ${current.state}` : ''}</span>
                )}
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
};

// --- Header ---
const HomeHeader = ({ session }) => {
  return (
    <div className="absolute top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 text-white font-bold text-xl">
          <img src="https://petrescue.b-cdn.net/Logos.svg" alt="PetRecovery" className="h-10 w-auto drop-shadow-lg" />
          <span className="drop-shadow-lg">PetRecovery</span>
        </Link>
        <div className="flex items-center gap-3">
          {session ? (
            <Link href="/dashboard">
              <Button>Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" className="text-white hover:bg-white/10">
                  Login
                </Button>
              </Link>
              <Link href="/register">
                <Button>Sign Up Free</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Animated Stat Card ---
const AnimatedStat = ({ value, label, icon: Icon, suffix = '', delay = 0 }) => {
  const { count, ref } = useAnimatedCounter(value, 2000 + delay * 200);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: delay * 0.1 }}
      className="text-center"
    >
      <Icon className="w-8 h-8 text-flash-400 mx-auto mb-3" />
      <div className="text-3xl md:text-4xl font-bold text-white mb-1">
        {formatNumber(count)}{suffix}
      </div>
      <div className="text-sm text-midnight-400">{label}</div>
    </motion.div>
  );
};

// --- Hero Section with Live Stats ---
const HeroSection = ({ session, metrics, loading }) => {
  return (
    <div className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
      <HomeHeader session={session} />

      {/* Background */}
      <div className="absolute inset-0 bg-midnight-950">
        <img
          src="https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=2069&auto=format&fit=crop"
          alt="Happy dog running"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-midnight-950/90 via-midnight-950/50 to-midnight-50" />
      </div>

      <div className="relative z-10 text-center max-w-5xl px-4 mt-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Mascot */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8, type: "spring" }}
            className="mb-6 flex justify-center"
          >
            <img
              src="https://petrescue.b-cdn.net/Logos%20(1).svg"
              alt="Surumaa"
              className="h-28 w-auto drop-shadow-2xl"
            />
          </motion.div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white mb-4 tracking-tight drop-shadow-lg">
            Bring Them <span className="text-flash-400">Home.</span>
          </h1>

          {/* Live Stats Highlight */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-8"
          >
            {loading ? (
              <p className="text-lg md:text-2xl text-midnight-200 font-medium">
                Loading live data...
              </p>
            ) : (
              <p className="text-lg md:text-2xl text-midnight-200 font-medium max-w-3xl mx-auto leading-relaxed">
                The community-powered network that has reunited{' '}
                <span className="text-flash-400 font-bold text-3xl md:text-4xl">
                  {metrics.petsReunited.toLocaleString()}
                </span>{' '}
                pets with their families.
                {metrics.weeklyReunions > 0 && (
                  <span className="block mt-2 text-base text-green-400">
                    <TrendingUp className="w-4 h-4 inline mr-1" />
                    {metrics.weeklyReunions} reunited this week alone!
                  </span>
                )}
              </p>
            )}
          </motion.div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/report/new">
              <Button
                size="xl"
                variant="danger"
                leftIcon={Bell}
                className="shadow-lg shadow-red-600/30 hover:shadow-red-600/50 group"
              >
                Report Lost Pet
                <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-full group-hover:bg-white/30 transition">
                  FREE
                </span>
              </Button>
            </Link>
            <Link href="/database">
              <Button
                size="xl"
                variant="outline"
                leftIcon={Search}
                className="border-white/30 text-white hover:bg-white/10"
              >
                Search Database
              </Button>
            </Link>
          </div>

          {/* Live Activity Indicator */}
          {!loading && metrics.openCases > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="mt-8 inline-flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-full text-red-300 text-sm"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              {metrics.openCases} pets need help right now
              <ChevronRight className="w-4 h-4" />
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

// --- Action Cards ---
const ActionCard = ({ href, icon: Icon, title, desc, variant, delay, badge }) => {
  const variants = {
    danger: {
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      hoverBorder: 'hover:border-red-200',
      badgeColor: 'bg-red-100 text-red-600',
    },
    success: {
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      hoverBorder: 'hover:border-green-200',
      badgeColor: 'bg-green-100 text-green-600',
    },
    primary: {
      iconBg: 'bg-midnight-100',
      iconColor: 'text-midnight-600',
      hoverBorder: 'hover:border-midnight-300',
      badgeColor: 'bg-midnight-100 text-midnight-600',
    },
  };

  const v = variants[variant] || variants.primary;

  return (
    <Link href={href} className="block group h-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay }}
        className={`bg-white rounded-2xl p-8 shadow-card border border-midnight-100 ${v.hoverBorder} transition-all hover:shadow-card-hover hover:-translate-y-1 h-full relative overflow-hidden`}
      >
        {badge && (
          <span className={`absolute top-4 right-4 text-xs font-bold px-2.5 py-1 rounded-full ${v.badgeColor}`}>
            {badge}
          </span>
        )}

        <div className={`w-14 h-14 rounded-2xl ${v.iconBg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`w-7 h-7 ${v.iconColor}`} />
        </div>

        <h3 className="text-2xl font-bold text-midnight-900 mb-3">{title}</h3>
        <p className="text-midnight-500 leading-relaxed mb-6">{desc}</p>

        <div className="flex items-center text-midnight-900 font-semibold group-hover:text-flash-600 transition-colors">
          Get Started <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </div>
      </motion.div>
    </Link>
  );
};

// --- Pets Needing Help Section ---
const PetsNeedingHelp = ({ cases = [], loading = false }) => {
  if (loading) {
    return (
      <div className="bg-gradient-to-br from-red-50 to-orange-50 py-16 border-y border-red-100">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="animate-pulse">
            <div className="h-8 bg-red-200 rounded w-64 mx-auto mb-4" />
            <div className="h-4 bg-red-100 rounded w-96 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (cases.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-red-50 to-orange-50 py-16 border-y border-red-100">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-bold uppercase text-sm tracking-wider">Urgent</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-midnight-900">
              Pets Needing Help Right Now
            </h2>
            <p className="text-midnight-500 mt-2">
              These pets are lost and their families are searching for them
            </p>
          </div>
          <Link href="/database" className="hidden md:block">
            <Button variant="outline" rightIcon={ArrowRight}>
              View All Cases
            </Button>
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {cases.slice(0, 6).map((pet, i) => (
            <motion.div
              key={pet.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Link
                href={`/cases/${pet.caseNumber}`}
                className="block bg-white rounded-2xl overflow-hidden shadow-card border border-midnight-100 hover:shadow-card-hover hover:-translate-y-1 transition-all group"
              >
                <div className="relative h-48 overflow-hidden bg-midnight-100">
                  {pet.petPhotoUrl ? (
                    <img
                      src={pet.petPhotoUrl}
                      alt={pet.petName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-midnight-100 to-midnight-200">
                      {pet.petSpecies === 'DOG' ? '🐕' : pet.petSpecies === 'CAT' ? '🐈' : '🐾'}
                    </div>
                  )}
                  {pet.isUrgent && (
                    <span className="absolute top-3 left-3 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                      URGENT
                    </span>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                    <h3 className="text-white font-bold text-xl">{pet.petName}</h3>
                    <p className="text-white/80 text-sm">{pet.petBreed || pet.petSpecies}</p>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-midnight-500 text-sm">
                      <MapPin className="w-4 h-4" />
                      {pet.city}, {pet.state}
                    </div>
                    <div className="flex items-center gap-1 text-red-600 font-semibold text-sm">
                      <Clock className="w-4 h-4" />
                      {pet.hoursLost < 24
                        ? `${pet.hoursLost}h ago`
                        : `${Math.floor(pet.hoursLost / 24)}d ago`}
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 text-center md:hidden">
          <Link href="/database">
            <Button variant="outline" rightIcon={ArrowRight}>
              View All Cases
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

// --- Stats Section with Live Animated Counters ---
const LiveStatsSection = ({ metrics, loading }) => {
  if (loading) {
    return (
      <div className="bg-midnight-900 py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="text-center animate-pulse">
                <div className="w-8 h-8 bg-flash-400/20 rounded mx-auto mb-3" />
                <div className="h-10 bg-white/10 rounded w-24 mx-auto mb-2" />
                <div className="h-4 bg-white/5 rounded w-32 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-midnight-900 py-16">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <span className="inline-flex items-center gap-2 text-flash-400 font-semibold text-sm uppercase tracking-wider mb-2">
            <Sparkles className="w-4 h-4" />
            Live Platform Stats
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            Our Community Impact
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <AnimatedStat
            value={metrics.petsReunited}
            label="Pets Reunited"
            icon={Heart}
            delay={0}
          />
          <AnimatedStat
            value={metrics.totalVolunteers || metrics.totalUsers}
            label="Community Members"
            icon={Users}
            delay={1}
          />
          <AnimatedStat
            value={metrics.activeSquads}
            label="Rescue Squads"
            icon={Shield}
            delay={2}
          />
          <AnimatedStat
            value={metrics.avgReunionTimeHours}
            label="Avg Hours to Reunion"
            icon={Clock}
            suffix="h"
            delay={3}
          />
        </div>

        {/* Secondary Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-10 pt-10 border-t border-midnight-700"
        >
          <div className="grid grid-cols-3 md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-xl md:text-2xl font-bold text-flash-400">
                {metrics.citiesCovered}+
              </div>
              <div className="text-xs md:text-sm text-midnight-400">Cities Covered</div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-bold text-green-400">
                {metrics.reunionRate}%
              </div>
              <div className="text-xs md:text-sm text-midnight-400">Reunion Rate</div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-bold text-blue-400">
                {metrics.openCases}
              </div>
              <div className="text-xs md:text-sm text-midnight-400">Active Searches</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

// --- How It Works Section ---
const HowItWorks = () => {
  const steps = [
    {
      num: '01',
      title: 'Report Instantly',
      desc: 'Submit your lost pet report in under 2 minutes. We immediately alert nearby volunteers and squads.',
      icon: Bell,
      color: 'red',
    },
    {
      num: '02',
      title: 'Community Mobilizes',
      desc: 'Local rescue squads receive your alert. Volunteers start searching your area within minutes.',
      icon: Users,
      color: 'blue',
    },
    {
      num: '03',
      title: 'Track Sightings',
      desc: 'Community members report sightings on a live map. Coordinate searches in real-time.',
      icon: MapPin,
      color: 'purple',
    },
    {
      num: '04',
      title: 'Reunion!',
      desc: 'Our data shows most pets are found within 48 hours when the community works together.',
      icon: Heart,
      color: 'green',
    },
  ];

  const colorClasses = {
    red: 'bg-red-100 text-red-600 border-red-200',
    blue: 'bg-blue-100 text-blue-600 border-blue-200',
    purple: 'bg-purple-100 text-purple-600 border-purple-200',
    green: 'bg-green-100 text-green-600 border-green-200',
  };

  return (
    <div className="bg-white py-20 border-t border-midnight-100">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-midnight-900 mb-4">
            How PetRecovery Works
          </h2>
          <p className="text-lg text-midnight-500 max-w-2xl mx-auto">
            Our community-powered approach gets results. Here's how we help bring your pet home.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-4 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative"
            >
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 left-[60%] w-full h-0.5 bg-midnight-100" />
              )}
              <div className="relative z-10">
                <div className={`w-20 h-20 rounded-2xl ${colorClasses[step.color]} border-2 flex items-center justify-center mb-6`}>
                  <step.icon className="w-8 h-8" />
                </div>
                <div className="text-xs font-bold text-midnight-400 mb-2">{step.num}</div>
                <h3 className="text-xl font-bold text-midnight-900 mb-2">{step.title}</h3>
                <p className="text-midnight-500 leading-relaxed">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <Link href="/register">
            <Button size="lg" rightIcon={ArrowRight}>
              Join the Community
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

// --- Success Stories Section ---
const SuccessStories = () => {
  const stories = [
    {
      name: 'Sarah & Buster',
      image: 'https://images.unsplash.com/photo-1558788353-f76d92427f16?q=80&w=1000&auto=format&fit=crop',
      story: 'I thought I\'d lost him forever. Within 20 minutes of posting, a patrol member spotted him three blocks away.',
      location: 'Austin, TX',
      time: '3 hours',
    },
    {
      name: 'James & Mochi',
      image: 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?q=80&w=1000&auto=format&fit=crop',
      story: 'The map feature is incredible. We coordinated a search grid and found Mochi hiding in a neighbor\'s shed.',
      location: 'Portland, OR',
      time: '8 hours',
    },
    {
      name: 'The Martinez Family',
      image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?q=80&w=1000&auto=format&fit=crop',
      story: 'We found a scared beagle and used the database to locate his owners. Seeing their reunion was amazing.',
      location: 'Denver, CO',
      time: '2 days',
    },
  ];

  return (
    <div className="bg-midnight-50 py-20 border-t border-midnight-100">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 text-green-600 font-semibold text-sm uppercase tracking-wider mb-2">
            <Heart className="w-4 h-4 fill-green-600" />
            Success Stories
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-midnight-900 mb-4">
            Happy Reunions
          </h2>
          <p className="text-lg text-midnight-500 max-w-2xl mx-auto">
            Real stories from families who found their beloved pets through our community.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {stories.map((story, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white rounded-2xl overflow-hidden shadow-card border border-midnight-100"
            >
              <div className="h-48 overflow-hidden relative">
                <img
                  src={story.image}
                  alt={story.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-3 right-3 bg-green-600 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Found in {story.time}
                </div>
              </div>
              <div className="p-6">
                <p className="text-midnight-600 italic mb-4 leading-relaxed">
                  "{story.story}"
                </p>
                <div className="flex items-center justify-between">
                  <div className="font-bold text-midnight-900">— {story.name}</div>
                  <div className="text-sm text-midnight-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {story.location}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- CTA Section ---
const CTASection = ({ session }) => {
  return (
    <div className="bg-gradient-to-br from-midnight-900 via-midnight-800 to-midnight-900 py-20">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <img
            src="https://petrescue.b-cdn.net/Logos%20(1).svg"
            alt="Surumaa"
            className="h-20 w-auto mx-auto mb-6"
          />
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Make a Difference?
          </h2>
          <p className="text-lg text-midnight-300 mb-8 max-w-2xl mx-auto">
            Join thousands of volunteers who help reunite lost pets with their families every day.
            It takes less than a minute to sign up.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {session ? (
              <Link href="/dashboard">
                <Button size="xl" rightIcon={ArrowRight}>
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/register">
                  <Button size="xl" rightIcon={ArrowRight}>
                    Create Free Account
                  </Button>
                </Link>
                <Link href="/rescue-squads/search">
                  <Button size="xl" variant="outline" className="border-white/30 text-white hover:bg-white/10">
                    Find Local Squads
                  </Button>
                </Link>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

// --- Footer ---
const Footer = () => {
  return (
    <div className="bg-midnight-950 py-12 border-t border-midnight-800">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <img
              src="https://petrescue.b-cdn.net/Logos.svg"
              alt="PetRecovery"
              className="h-14 w-auto"
            />
            <div>
              <p className="text-white font-semibold text-lg">Meet Surumaa</p>
              <p className="text-midnight-400 text-sm">Your guide on the journey home</p>
            </div>
          </div>
          <Link href="/about-surumaa">
            <Button variant="outline" className="border-flash-500/50 text-flash-400 hover:bg-flash-500/10">
              Learn About Surumaa <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

        <div className="border-t border-midnight-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-midnight-400">
            <p>&copy; {new Date().getFullYear()} PetRecovery.org. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-white transition">Terms of Service</Link>
              <Link href="/contact" className="hover:text-white transition">Contact</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main Homepage Component ---
export default function Home() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [homepageData, setHomepageData] = useState({
    metrics: {
      petsReunited: 0,
      totalUsers: 0,
      activeSquads: 0,
      totalVolunteers: 0,
      openCases: 0,
      citiesCovered: 0,
      avgReunionTimeHours: 0,
      reunionRate: 0,
      recentSightings24h: 0,
      weeklyReunions: 0,
    },
    ticker: [],
    casesNeedingHelp: [],
  });

  useEffect(() => {
    async function fetchHomepageData() {
      try {
        const res = await fetch('/api/public/homepage');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setHomepageData(data);
      } catch (error) {
        console.error('Error fetching homepage data:', error);
        // Keep default/zero values on error
      } finally {
        setLoading(false);
      }
    }

    fetchHomepageData();

    // Refresh data every 3 minutes
    const interval = setInterval(fetchHomepageData, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const { metrics, ticker, casesNeedingHelp } = homepageData;

  return (
    <div className="min-h-screen bg-midnight-50 font-sans selection:bg-flash-100 selection:text-midnight-900">
      {/* Live Reunion Ticker */}
      <LiveReunionTicker reunions={ticker} loading={loading} />

      {/* Hero Section */}
      <HeroSection session={session} metrics={metrics} loading={loading} />

      {/* Main Action Cards */}
      <div className="max-w-7xl mx-auto px-4 -mt-20 relative z-20 pb-20">
        <div className="grid md:grid-cols-3 gap-6">
          <ActionCard
            href="/report/new"
            icon={Bell}
            title="I Lost My Pet"
            desc="Activate the PetRecovery network immediately. Alert neighbors, squads, and shelters in seconds."
            variant="danger"
            delay={0.1}
            badge="Urgent Help"
          />
          <ActionCard
            href="/report/found"
            icon={CheckCircle}
            title="I Found a Pet"
            desc="Be a hero. Report a sighting or secured pet to help reunite them with their worried family."
            variant="success"
            delay={0.2}
          />
          <ActionCard
            href="/rescue-squads/search"
            icon={Shield}
            title="Join the Patrol"
            desc="Join local volunteer squads. Coordinate searches and bring lost pets home safely."
            variant="primary"
            delay={0.3}
          />
        </div>
      </div>

      {/* Pets Needing Help */}
      <PetsNeedingHelp cases={casesNeedingHelp} loading={loading} />

      {/* Live Stats Section */}
      <LiveStatsSection metrics={metrics} loading={loading} />

      {/* How It Works */}
      <HowItWorks />

      {/* Success Stories */}
      <SuccessStories />

      {/* CTA Section */}
      <CTASection session={session} />

      {/* Footer */}
      <Footer />
    </div>
  );
}
