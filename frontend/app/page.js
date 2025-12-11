'use client';

/**
 * Homepage - Final Design
 *
 * Emotionally engaging + Feature-rich + Beautiful
 * Focus on what we ARE, not what we're NOT
 */

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence, useScroll, useTransform, useInView } from 'framer-motion';
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
  ChevronRight,
  AlertTriangle,
  Sparkles,
  Navigation,
  Radio,
  Target,
  Map,
  Smartphone,
  Eye,
  Trophy,
  Compass,
  ArrowDown,
  Quote,
  Play,
  PawPrint,
  Building2,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui';

// --- Animated Counter Hook ---
function useAnimatedCounter(endValue, duration = 2500, startOnView = true) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  useEffect(() => {
    if (startOnView && !isInView) return;
    if (hasStarted) return;
    if (endValue === 0) return;

    setHasStarted(true);
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = Math.round(endValue * easeOutQuart);
      setCount(currentValue);
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [endValue, duration, isInView, startOnView, hasStarted]);

  return { count, ref };
}

// --- Heartbeat Animation ---
const Heartbeat = ({ className = '' }) => (
  <span className={`relative inline-flex ${className}`}>
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
  </span>
);

// --- Live Reunion Ticker ---
const LiveReunionTicker = ({ reunions = [], loading = false }) => {
  const [index, setIndex] = useState(0);
  const displayData = reunions.length > 0 ? reunions : [];

  useEffect(() => {
    if (displayData.length <= 1) return;
    const timer = setInterval(() => setIndex((prev) => (prev + 1) % displayData.length), 5000);
    return () => clearInterval(timer);
  }, [displayData.length]);

  if (loading || displayData.length === 0) return null;

  const current = displayData[index];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-600 text-white py-3 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 animate-shimmer" />
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-3 relative">
        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}>
          <Heart className="w-5 h-5 text-white fill-white" />
        </motion.div>
        <AnimatePresence mode='wait'>
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex items-center gap-2 text-sm sm:text-base"
          >
            <span className="font-bold">{current.petName}</span>
            <span className="text-emerald-100">is back home</span>
            {current.city && <span className="text-emerald-200 hidden sm:inline">in {current.city}</span>}
            {current.timeToReunionHours && (
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs ml-1">
                {current.timeToReunionHours < 24 ? `${Math.round(current.timeToReunionHours)}h` : `${Math.round(current.timeToReunionHours / 24)}d`}
              </span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// --- Header ---
const HomeHeader = ({ session, scrolled }) => (
  <motion.div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-midnight-950/95 backdrop-blur-md shadow-lg py-3' : 'py-4'}`}>
    <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-3 text-white font-bold text-xl">
        <img src="https://petrescue.b-cdn.net/Logos.svg" alt="PetRecovery" className="h-10 w-auto drop-shadow-lg" />
        <span className="drop-shadow-lg hidden sm:inline">PetRecovery</span>
      </Link>

      {/* Navigation Links */}
      <div className="hidden md:flex items-center gap-6 text-sm">
        <Link href="/database" className="text-white/80 hover:text-white transition">Search Pets</Link>
        <Link href="/rescue-squads/search" className="text-white/80 hover:text-white transition">Find Squads</Link>
        <Link href="/shelters" className="text-white/80 hover:text-white transition">Shelters</Link>
      </div>

      <div className="flex items-center gap-3">
        {session ? (
          <Link href="/dashboard">
            <Button>Dashboard</Button>
          </Link>
        ) : (
          <>
            <Link href="/login">
              <Button variant="ghost" className="text-white hover:bg-white/10">Login</Button>
            </Link>
            <Link href="/register">
              <Button>Sign Up Free</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  </motion.div>
);

// --- Hero Section ---
const HeroSection = ({ session, metrics, loading, scrolled }) => {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const backgroundY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <div ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <HomeHeader session={session} scrolled={scrolled} />

      {/* Beautiful Background */}
      <motion.div className="absolute inset-0 bg-midnight-950" style={{ y: backgroundY }}>
        <img
          src="https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=2069&auto=format&fit=crop"
          alt="Dogs running happily"
          className="w-full h-[120%] object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-midnight-950/60 via-midnight-950/40 to-midnight-950" />
        <div className="absolute inset-0 bg-gradient-to-tr from-rose-900/20 via-transparent to-amber-900/10" />
      </motion.div>

      <motion.div style={{ opacity }} className="relative z-10 text-center max-w-5xl px-4 pt-20">
        {/* Mascot */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          className="mb-6 flex justify-center"
        >
          <motion.img
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
            src="https://petrescue.b-cdn.net/Logos%20(1).svg"
            alt="Surumaa"
            className="h-28 md:h-36 w-auto drop-shadow-2xl"
          />
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white mb-6 tracking-tight leading-tight">
            Bring Them{' '}
            <span className="text-flash-400">Home</span>
          </h1>
        </motion.div>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-xl md:text-2xl text-white/90 mb-6 max-w-3xl mx-auto leading-relaxed"
        >
          When your pet goes missing, we mobilize{' '}
          <span className="text-flash-400 font-semibold">GPS-tracked volunteer teams</span>{' '}
          to search your neighborhood in real-time.
        </motion.p>

        {/* Live Stats */}
        {!loading && metrics.petsReunited > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mb-10"
          >
            <p className="text-lg text-white/70">
              <span className="text-flash-400 font-bold text-3xl">{metrics.petsReunited.toLocaleString()}</span>{' '}
              happy reunions and counting
              {metrics.weeklyReunions > 0 && (
                <span className="text-green-400 ml-2 text-base">
                  (+{metrics.weeklyReunions} this week)
                </span>
              )}
            </p>
          </motion.div>
        )}

        {/* Primary Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-8"
        >
          <Link href="/report/new">
            <Button
              size="xl"
              variant="danger"
              className="w-full sm:w-auto shadow-xl shadow-red-600/30 hover:shadow-red-600/50 transition-all text-lg"
            >
              <Bell className="w-5 h-5 mr-2" />
              Report Lost Pet
            </Button>
          </Link>
          <Link href="/report/found">
            <Button
              size="xl"
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 shadow-xl shadow-emerald-600/20 transition-all text-lg"
            >
              <Heart className="w-5 h-5 mr-2" />
              I Found a Pet
            </Button>
          </Link>
        </motion.div>

        {/* Secondary Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex flex-wrap justify-center gap-4 mb-12"
        >
          <Link href="/database">
            <Button variant="outline" className="border-white/30 text-white hover:bg-white/10">
              <Search className="w-4 h-4 mr-2" />
              Search Database
            </Button>
          </Link>
          <Link href="/rescue-squads/search">
            <Button variant="outline" className="border-white/30 text-white hover:bg-white/10">
              <Shield className="w-4 h-4 mr-2" />
              Join a Squad
            </Button>
          </Link>
          <Link href="/shelters">
            <Button variant="outline" className="border-white/30 text-white hover:bg-white/10">
              <Building2 className="w-4 h-4 mr-2" />
              Check Shelters
            </Button>
          </Link>
        </motion.div>

        {/* Active Cases Alert */}
        {!loading && metrics.openCases > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
          >
            <Link href="#pets-need-help">
              <div className="inline-flex items-center gap-3 px-5 py-3 bg-red-500/20 border border-red-500/30 rounded-full text-white cursor-pointer hover:bg-red-500/30 transition">
                <Heartbeat />
                <span className="font-medium">
                  <span className="text-red-300 font-bold">{metrics.openCases}</span> pets need help right now
                </span>
                <ArrowDown className="w-4 h-4 animate-bounce" />
              </div>
            </Link>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

// --- How It Works - Positive Focus ---
const HowItWorks = () => {
  const steps = [
    {
      icon: Bell,
      title: "Report in 2 Minutes",
      description: "Add your pet's photo, last location, and details. We calculate probability zones based on species behavior.",
      color: "bg-red-500",
      highlight: "Instant alerts sent"
    },
    {
      icon: Users,
      title: "Squad Mobilizes",
      description: "Local rescue squads receive SMS, email, and push notifications. Volunteers in your area start searching.",
      color: "bg-amber-500",
      highlight: "24/7 coverage"
    },
    {
      icon: Navigation,
      title: "GPS-Tracked Search",
      description: "Volunteers run real-time searches with GPS tracking. Every path is mapped. No area gets missed.",
      color: "bg-blue-500",
      highlight: "Verified effort"
    },
    {
      icon: Eye,
      title: "Live Sighting Network",
      description: "Community reports sightings that appear instantly on everyone's map. Squads converge on hot spots.",
      color: "bg-purple-500",
      highlight: "Real-time updates"
    },
    {
      icon: Target,
      title: "Coordinate & Contain",
      description: "When sightings cluster, teams coordinate containment. Mission control broadcasts to all volunteers.",
      color: "bg-green-500",
      highlight: "Tactical response"
    },
    {
      icon: Heart,
      title: "Happy Reunion",
      description: "Pet found! Family reunited. Average reunion time: 48 hours when the community works together.",
      color: "bg-rose-500",
      highlight: "You're home"
    }
  ];

  return (
    <div id="how-it-works" className="bg-white py-24">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 text-midnight-500 font-semibold mb-4 text-sm uppercase tracking-wider">
            <Compass className="w-5 h-5" />
            How It Works
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-midnight-900 mb-4">
            Coordinated Search & Rescue
          </h2>
          <p className="text-xl text-midnight-600 max-w-2xl mx-auto">
            Professional-grade pet recovery powered by community volunteers
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-midnight-50 rounded-2xl p-6 border border-midnight-100 hover:shadow-lg hover:border-midnight-200 transition-all group"
            >
              <div className={`w-12 h-12 ${step.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
                <step.icon className="w-6 h-6 text-white" />
              </div>
              <div className="text-xs font-bold text-midnight-400 uppercase tracking-wider mb-1">Step {i + 1}</div>
              <h3 className="text-lg font-bold text-midnight-900 mb-2">{step.title}</h3>
              <p className="text-midnight-600 text-sm leading-relaxed mb-3">{step.description}</p>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-midnight-500 bg-midnight-100 px-2 py-1 rounded-full">
                <Sparkles className="w-3 h-3" />
                {step.highlight}
              </span>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <Link href="/report/new">
            <Button size="lg">
              Start a Free Report
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

// --- Technology Features ---
const TechnologySection = () => {
  return (
    <div className="bg-midnight-900 py-24 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500 rounded-full filter blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500 rounded-full filter blur-[150px]" />
      </div>

      <div className="max-w-6xl mx-auto px-4 relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 text-blue-400 font-semibold mb-4 text-sm uppercase tracking-wider">
            <Smartphone className="w-5 h-5" />
            The Technology
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            Mission Control in Your Pocket
          </h2>
          <p className="text-xl text-midnight-300 max-w-2xl mx-auto">
            Every volunteer gets professional SAR tools
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Map,
              title: "Live Search Map",
              features: ["Pet's probability zone", "Real-time sightings", "Search coverage grid", "Your GPS trail", "All volunteers visible"],
              gradient: "from-blue-500 to-cyan-500"
            },
            {
              icon: Navigation,
              title: "GPS Search Mode",
              features: ["Tracks your path", "Validates speed", "Marks areas covered", "Distance tracking", "Auto-pauses if driving"],
              gradient: "from-green-500 to-emerald-500"
            },
            {
              icon: Trophy,
              title: "Points & Rewards",
              features: ["100 pts per mile", "Grid coverage bonus", "Dawn/dusk multipliers", "First 24h bonus", "Leaderboard rankings"],
              gradient: "from-amber-500 to-orange-500"
            }
          ].map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-midnight-800/50 border border-midnight-700 rounded-2xl p-6 hover:border-midnight-600 transition-colors"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">{card.title}</h3>
              <ul className="space-y-2">
                {card.features.map((feature, j) => (
                  <li key={j} className="flex items-center gap-2 text-midnight-300 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Surumaa AI */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 bg-gradient-to-r from-flash-500/20 to-amber-500/20 border border-flash-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6 text-center md:text-left"
        >
          <img src="https://petrescue.b-cdn.net/Logos%20(1).svg" alt="Surumaa" className="h-20 w-auto" />
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Meet Surumaa, Your AI Guide</h3>
            <p className="text-midnight-300">
              Contextual tips during searches: "Dawn is prime time for cats", "Check under porches",
              "You're outside the search zone". Smart guidance when you need it.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

// --- Rescue Squads Section ---
const RescueSquadsSection = ({ metrics }) => {
  return (
    <div className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-24">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-flex items-center gap-2 text-blue-600 font-semibold mb-4 text-sm uppercase tracking-wider">
              <Shield className="w-5 h-5" />
              Rescue Squads
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-midnight-900 mb-6">
              Your Neighborhood
              <br />
              <span className="text-blue-600">Has Your Back</span>
            </h2>
            <p className="text-xl text-midnight-600 mb-8 leading-relaxed">
              Local volunteer teams organized by city. When a pet goes missing, the squad mobilizes within minutes.
              Real people. Real coordination. Real results.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              {[
                { value: metrics?.activeSquads || 0, label: "Active Squads" },
                { value: metrics?.citiesCovered || 0, label: "Cities" },
                { value: metrics?.totalVolunteers || 0, label: "Volunteers" },
                { value: "24/7", label: "Coverage" }
              ].map((stat, i) => (
                <div key={i} className="bg-white rounded-xl p-4 text-center shadow-sm border border-midnight-100">
                  <div className="text-2xl font-black text-midnight-900">
                    {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                  </div>
                  <div className="text-sm text-midnight-500">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/rescue-squads/search">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-500">
                  <Shield className="w-5 h-5 mr-2" />
                  Find Your Local Squad
                </Button>
              </Link>
              <Link href="/patrol/signup">
                <Button size="lg" variant="outline">
                  Become a Volunteer
                </Button>
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-midnight-100">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-midnight-100">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="font-bold text-midnight-900">Austin Rescue Squad</div>
                  <div className="text-sm text-midnight-500">47 members • 12 online now</div>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { status: "active", pet: "Max", type: "Golden Retriever", time: "2h", helpers: 8 },
                  { status: "active", pet: "Luna", type: "Tabby Cat", time: "5h", helpers: 5 },
                  { status: "reunited", pet: "Cooper", type: "Beagle", time: "12h", helpers: 12 }
                ].map((mission, i) => (
                  <div key={i} className={`p-3 rounded-xl ${mission.status === 'active' ? 'bg-red-50 border border-red-100' : 'bg-green-50 border border-green-100'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{mission.status === 'active' ? '🔴' : '✅'}</span>
                        <div>
                          <div className="font-semibold text-midnight-900 text-sm">{mission.pet}</div>
                          <div className="text-xs text-midnight-500">{mission.type}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-midnight-500">{mission.time} ago</div>
                        <div className="text-xs font-medium text-midnight-700">{mission.helpers} helping</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

// --- Pets Needing Help ---
const PetsNeedingHelp = ({ cases = [], loading = false }) => {
  if (loading || cases.length === 0) return null;

  return (
    <div id="pets-need-help" className="bg-gradient-to-b from-midnight-950 to-midnight-900 py-20 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500 rounded-full filter blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500 rounded-full filter blur-[128px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 text-red-400 mb-4">
            <Heartbeat />
            <span className="font-bold uppercase tracking-wider text-sm">Active Missions</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            They Need You Right Now
          </h2>
          <p className="text-xl text-midnight-300">
            Join an active search. Your effort makes a real difference.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {cases.slice(0, 6).map((pet, i) => (
            <motion.div
              key={pet.id}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4 }}
            >
              <Link href={`/cases/${pet.caseNumber}`}>
                <div className="bg-white rounded-2xl overflow-hidden shadow-xl group">
                  <div className="relative h-44 overflow-hidden">
                    {pet.petPhotoUrl ? (
                      <img src={pet.petPhotoUrl} alt={pet.petName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-midnight-100 to-midnight-200">
                        {pet.petSpecies === 'DOG' ? '🐕' : '🐈'}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute top-3 right-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${pet.hoursLost < 24 ? 'bg-red-500' : 'bg-orange-500'} text-white`}>
                        {pet.hoursLost < 24 ? `${pet.hoursLost}h` : `${Math.floor(pet.hoursLost / 24)}d`}
                      </span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-xl font-bold text-white">{pet.petName}</h3>
                      <p className="text-white/80 text-sm">{pet.petBreed || pet.petSpecies}</p>
                    </div>
                  </div>
                  <div className="p-4 flex items-center justify-between">
                    <span className="text-midnight-600 text-sm flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {pet.city}, {pet.state}
                    </span>
                    <span className="text-blue-600 font-semibold text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                      Help search <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-10 text-center"
        >
          <Link href="/database">
            <Button variant="outline" className="border-white/30 text-white hover:bg-white/10">
              View All Lost Pets
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

// --- Success Story ---
const SuccessStory = () => (
  <div className="bg-gradient-to-br from-amber-50 via-white to-rose-50 py-24">
    <div className="max-w-5xl mx-auto px-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="grid md:grid-cols-2 gap-12 items-center"
      >
        <div className="relative">
          <img
            src="https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=1000&auto=format&fit=crop"
            alt="Happy dog"
            className="w-full h-[400px] object-cover rounded-2xl shadow-xl"
          />
          <div className="absolute -bottom-4 -right-4 bg-green-500 text-white px-5 py-3 rounded-xl shadow-lg">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 fill-white" />
              <span className="font-bold">Reunited in 4 hours</span>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-green-600 mb-4">
            <Heart className="w-5 h-5 fill-green-600" />
            <span className="font-bold uppercase tracking-wider text-sm">Success Story</span>
          </div>
          <Quote className="w-10 h-10 text-midnight-200 mb-4" />
          <blockquote className="text-2xl font-medium text-midnight-800 leading-relaxed mb-6">
            "I watched 12 volunteers fan out across my neighborhood on the live map. Someone spotted Max, and within minutes, three people converged. They found him hiding under a porch. This level of coordination saved my dog."
          </blockquote>
          <div className="flex items-center gap-4">
            <img
              src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100&auto=format&fit=crop"
              alt="Sarah"
              className="w-14 h-14 rounded-full object-cover"
            />
            <div>
              <div className="font-bold text-midnight-900">Sarah Mitchell</div>
              <div className="text-midnight-500 text-sm">Austin, TX</div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  </div>
);

// --- Stats Section ---
const StatsSection = ({ metrics, loading }) => {
  if (loading) return null;

  const stats = [
    { value: metrics.petsReunited, label: "Pets Reunited", icon: Heart, color: "text-rose-400" },
    { value: metrics.totalVolunteers || metrics.totalUsers, label: "Volunteers", icon: Users, color: "text-blue-400" },
    { value: metrics.activeSquads, label: "Rescue Squads", icon: Shield, color: "text-purple-400" },
    { value: metrics.avgReunionTimeHours || 48, label: "Avg Hours", icon: Clock, color: "text-amber-400", suffix: "h" },
  ];

  return (
    <div className="bg-midnight-900 py-16">
      <div className="max-w-5xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => {
            const { count, ref } = useAnimatedCounter(stat.value, 2000 + i * 300);
            return (
              <motion.div
                key={i}
                ref={ref}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <stat.icon className={`w-8 h-8 ${stat.color} mx-auto mb-3`} />
                <div className="text-3xl md:text-4xl font-black text-white mb-1">
                  {count.toLocaleString()}{stat.suffix || ''}
                </div>
                <div className="text-midnight-400 text-sm">{stat.label}</div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- Final CTA ---
const FinalCTA = ({ session }) => (
  <div className="relative py-24 overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-midnight-900 via-indigo-900 to-midnight-900" />
    <div className="absolute inset-0 overflow-hidden">
      <motion.div animate={{ x: [0, 50, 0], y: [0, -30, 0] }} transition={{ duration: 15, repeat: Infinity }} className="absolute top-20 left-20 w-64 h-64 bg-flash-500/20 rounded-full filter blur-3xl" />
      <motion.div animate={{ x: [0, -50, 0], y: [0, 30, 0] }} transition={{ duration: 20, repeat: Infinity }} className="absolute bottom-20 right-20 w-80 h-80 bg-purple-500/20 rounded-full filter blur-3xl" />
    </div>

    <div className="max-w-4xl mx-auto px-4 text-center relative">
      <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
        <motion.img
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
          src="https://petrescue.b-cdn.net/Logos%20(1).svg"
          alt="Surumaa"
          className="h-20 w-auto mx-auto mb-6"
        />
        <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
          Be Part of the Village
        </h2>
        <p className="text-xl text-midnight-300 mb-8 max-w-2xl mx-auto">
          Finding a lost pet takes a community. Join thousands of volunteers who make reunions happen every day.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          {session ? (
            <Link href="/dashboard">
              <Button size="xl">
                Go to Dashboard
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/register">
                <Button size="xl">
                  Join Free
                  <Heart className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/report/new">
                <Button size="xl" variant="outline" className="border-white/30 text-white hover:bg-white/10">
                  Report Lost Pet
                </Button>
              </Link>
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-6 text-midnight-400 text-sm">
          <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" />100% Free</span>
          <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" />GPS Verified</span>
          <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" />Real Coordination</span>
        </div>
      </motion.div>
    </div>
  </div>
);

// --- Footer ---
const Footer = () => (
  <div className="bg-midnight-950 py-12 border-t border-midnight-800">
    <div className="max-w-6xl mx-auto px-4">
      <div className="grid md:grid-cols-4 gap-8 mb-8">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <img src="https://petrescue.b-cdn.net/Logos.svg" alt="PetRecovery" className="h-10 w-auto" />
            <span className="text-white font-bold text-lg">PetRecovery</span>
          </div>
          <p className="text-midnight-400 text-sm leading-relaxed max-w-sm">
            Coordinated search and rescue for lost pets. GPS-tracked volunteers.
            Real-time sightings. Because finding a lost pet takes a village.
          </p>
        </div>
        <div>
          <h4 className="text-white font-bold mb-3 text-sm">Quick Links</h4>
          <ul className="space-y-2 text-midnight-400 text-sm">
            <li><Link href="/report/new" className="hover:text-white transition">Report Lost Pet</Link></li>
            <li><Link href="/report/found" className="hover:text-white transition">Report Found Pet</Link></li>
            <li><Link href="/database" className="hover:text-white transition">Search Database</Link></li>
            <li><Link href="/rescue-squads/search" className="hover:text-white transition">Find Squads</Link></li>
            <li><Link href="/shelters" className="hover:text-white transition">Check Shelters</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-bold mb-3 text-sm">About</h4>
          <ul className="space-y-2 text-midnight-400 text-sm">
            <li><Link href="/about-surumaa" className="hover:text-white transition">About Surumaa</Link></li>
            <li><Link href="/patrol/signup" className="hover:text-white transition">Become a Volunteer</Link></li>
            <li><Link href="/contact" className="hover:text-white transition">Contact Us</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-midnight-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-midnight-500">
        <p>&copy; {new Date().getFullYear()} PetRecovery.org</p>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
          <Link href="/terms" className="hover:text-white transition">Terms</Link>
        </div>
      </div>
    </div>
  </div>
);

// --- Shimmer CSS ---
const ShimmerStyle = () => (<style jsx global>{`@keyframes shimmer { 0% { transform: translateX(-100%) skewX(-12deg); } 100% { transform: translateX(200%) skewX(-12deg); } } .animate-shimmer { animation: shimmer 3s infinite; }`}</style>);

// --- Main Component ---
export default function Home() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [homepageData, setHomepageData] = useState({
    metrics: { petsReunited: 0, totalUsers: 0, activeSquads: 0, totalVolunteers: 0, openCases: 0, citiesCovered: 0, avgReunionTimeHours: 0, reunionRate: 0, weeklyReunions: 0 },
    ticker: [],
    casesNeedingHelp: [],
  });

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    async function fetchHomepageData() {
      try {
        const res = await fetch('/api/public/homepage');
        if (!res.ok) throw new Error('Failed to fetch');
        setHomepageData(await res.json());
      } catch (error) {
        console.error('Error fetching homepage data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchHomepageData();
    const interval = setInterval(fetchHomepageData, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const { metrics, ticker, casesNeedingHelp } = homepageData;

  return (
    <div className="min-h-screen bg-midnight-50 font-sans selection:bg-flash-100 selection:text-midnight-900">
      <ShimmerStyle />
      <LiveReunionTicker reunions={ticker} loading={loading} />
      <HeroSection session={session} metrics={metrics} loading={loading} scrolled={scrolled} />
      <HowItWorks />
      <TechnologySection />
      <RescueSquadsSection metrics={metrics} />
      <PetsNeedingHelp cases={casesNeedingHelp} loading={loading} />
      <SuccessStory />
      <StatsSection metrics={metrics} loading={loading} />
      <FinalCTA session={session} />
      <Footer />
    </div>
  );
}
