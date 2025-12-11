'use client';

/**
 * Homepage - Emotionally Engaging + Feature-Rich Design
 *
 * This page must communicate:
 * 1. Emotional understanding - we know the panic of losing a pet
 * 2. Active coordination - this isn't passive posting, it's organized SAR
 * 3. Technology - GPS tracking, probability maps, real-time sightings
 * 4. Community power - organized squads, not just random strangers
 * 5. Results - real reunions with real data
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
  MessageSquare,
  Trophy,
  Compass,
  ArrowDown,
  Quote,
  Play,
  Circle,
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
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % displayData.length);
    }, 5000);
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
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-4 relative">
        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}>
          <Heart className="w-5 h-5 text-white fill-white" />
        </motion.div>
        <AnimatePresence mode='wait'>
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex items-center gap-2"
          >
            <span className="font-bold text-white text-lg">{current.petName}</span>
            <span className="text-emerald-100">is back home</span>
            {current.city && <span className="text-emerald-200 hidden sm:inline">in {current.city}</span>}
            {current.timeToReunionHours && (
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm ml-2">
                Found in {current.timeToReunionHours < 24 ? `${Math.round(current.timeToReunionHours)}h` : `${Math.round(current.timeToReunionHours / 24)}d`}
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
  <motion.div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-midnight-950/95 backdrop-blur-md shadow-lg' : ''}`}>
    <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-3 text-white font-bold text-xl">
        <motion.img whileHover={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 0.5 }} src="https://petrescue.b-cdn.net/Logos.svg" alt="PetRecovery" className="h-10 w-auto drop-shadow-lg" />
        <span className="drop-shadow-lg">PetRecovery</span>
      </Link>
      <div className="flex items-center gap-3">
        {session ? (
          <Link href="/dashboard"><Button>Dashboard</Button></Link>
        ) : (
          <>
            <Link href="/login"><Button variant="ghost" className="text-white hover:bg-white/10">Login</Button></Link>
            <Link href="/register"><Button className="shadow-lg shadow-flash-500/25">Sign Up Free</Button></Link>
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

      <motion.div className="absolute inset-0 bg-midnight-950" style={{ y: backgroundY }}>
        <img src="https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=2070&auto=format&fit=crop" alt="Dog looking hopeful" className="w-full h-[120%] object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-midnight-950/70 via-midnight-950/50 to-midnight-950" />
        <div className="absolute inset-0 bg-gradient-to-tr from-amber-900/20 via-transparent to-rose-900/10" />
      </motion.div>

      <motion.div style={{ opacity }} className="relative z-10 text-center max-w-5xl px-4 pt-20">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }} className="mb-8 flex justify-center">
          <motion.img animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity }} src="https://petrescue.b-cdn.net/Logos%20(1).svg" alt="Surumaa" className="h-32 md:h-40 w-auto drop-shadow-2xl" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white mb-6 tracking-tight">
            <span className="block">Coordinated</span>
            <span className="block mt-2">
              <span className="text-flash-400">Search & Rescue</span>
            </span>
            <span className="block text-3xl md:text-4xl font-bold mt-4 text-midnight-200">for Lost Pets</span>
          </h1>
        </motion.div>

        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }} className="text-xl md:text-2xl text-midnight-300 mb-4 max-w-3xl mx-auto">
          Not just a post. A <span className="text-white font-semibold">GPS-tracked, real-time coordinated</span> search with organized volunteer teams.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.5 }} className="mb-10">
          {!loading && metrics.petsReunited > 0 && (
            <p className="text-lg text-midnight-400">
              <span className="text-flash-400 font-bold text-2xl">{metrics.petsReunited.toLocaleString()}</span> pets reunited
              {metrics.weeklyReunions > 0 && (
                <span className="text-green-400 ml-2">({metrics.weeklyReunions} this week)</span>
              )}
            </p>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.6 }} className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <Link href="/report/new">
            <Button size="xl" variant="danger" className="shadow-xl shadow-red-600/40 hover:shadow-red-600/60 hover:scale-105 transition-all text-lg px-8 py-6 group">
              <Bell className="w-5 h-5 mr-2" />
              My Pet Is Lost
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <Link href="/register">
            <Button size="xl" className="bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-600/30 hover:scale-105 transition-all text-lg px-8 py-6">
              <Shield className="w-5 h-5 mr-2" />
              Join a Rescue Squad
            </Button>
          </Link>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="flex flex-wrap justify-center gap-6 text-midnight-400 text-sm">
          <span className="flex items-center gap-2"><Navigation className="w-4 h-4 text-blue-400" /> GPS-Tracked Searches</span>
          <span className="flex items-center gap-2"><Radio className="w-4 h-4 text-green-400" /> Real-Time Sightings</span>
          <span className="flex items-center gap-2"><Users className="w-4 h-4 text-purple-400" /> Organized Squads</span>
        </motion.div>

        {!loading && metrics.openCases > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }} className="mt-12">
            <Link href="#how-it-works">
              <motion.div whileHover={{ scale: 1.02 }} className="inline-flex items-center gap-3 px-6 py-3 bg-white/10 border border-white/20 rounded-full text-white cursor-pointer">
                <Play className="w-4 h-4" />
                <span>See how it works</span>
                <ArrowDown className="w-4 h-4 animate-bounce" />
              </motion.div>
            </Link>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

// --- The Difference Section ---
const TheDifference = () => {
  return (
    <div className="bg-midnight-950 py-24 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500 rounded-full filter blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500 rounded-full filter blur-[150px]" />
      </div>

      <div className="max-w-6xl mx-auto px-4 relative">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
            This Isn't a Facebook Post
          </h2>
          <p className="text-xl text-midnight-300 max-w-3xl mx-auto">
            When your pet goes missing, you need more than thoughts and prayers.
            You need <span className="text-white font-semibold">organized action</span>.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Old Way */}
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="bg-midnight-900/50 border border-midnight-700 rounded-3xl p-8">
            <div className="text-red-400 font-bold uppercase tracking-wider text-sm mb-4">The Old Way</div>
            <h3 className="text-2xl font-bold text-white mb-6">Posting on Social Media</h3>
            <ul className="space-y-4 text-midnight-300">
              <li className="flex items-start gap-3">
                <Circle className="w-5 h-5 text-midnight-600 mt-0.5 flex-shrink-0" />
                <span>Post gets buried in feeds within hours</span>
              </li>
              <li className="flex items-start gap-3">
                <Circle className="w-5 h-5 text-midnight-600 mt-0.5 flex-shrink-0" />
                <span>No way to coordinate who's searching where</span>
              </li>
              <li className="flex items-start gap-3">
                <Circle className="w-5 h-5 text-midnight-600 mt-0.5 flex-shrink-0" />
                <span>Sightings scattered across comments and DMs</span>
              </li>
              <li className="flex items-start gap-3">
                <Circle className="w-5 h-5 text-midnight-600 mt-0.5 flex-shrink-0" />
                <span>Same areas searched repeatedly, others missed</span>
              </li>
              <li className="flex items-start gap-3">
                <Circle className="w-5 h-5 text-midnight-600 mt-0.5 flex-shrink-0" />
                <span>No verification of who actually helped</span>
              </li>
            </ul>
          </motion.div>

          {/* PetRecovery Way */}
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="bg-gradient-to-br from-flash-500/10 to-green-500/10 border border-flash-500/30 rounded-3xl p-8">
            <div className="text-flash-400 font-bold uppercase tracking-wider text-sm mb-4">The PetRecovery Way</div>
            <h3 className="text-2xl font-bold text-white mb-6">Coordinated Search & Rescue</h3>
            <ul className="space-y-4 text-midnight-200">
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong className="text-white">GPS-tracked searches</strong> verify real effort</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong className="text-white">Live map</strong> shows who's searching where</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong className="text-white">Instant sighting alerts</strong> to all volunteers</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong className="text-white">Search grid tracking</strong> ensures full coverage</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong className="text-white">Organized squads</strong> with real accountability</span>
              </li>
            </ul>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

// --- How It Works - The Technology ---
const HowItWorks = () => {
  const features = [
    {
      icon: Bell,
      title: "Report in 2 Minutes",
      description: "Add your pet's photo and details. We instantly calculate probability zones based on species behavior.",
      color: "from-red-500 to-orange-500",
      detail: "AI-powered probability circles"
    },
    {
      icon: Radio,
      title: "Squads Get Alerted",
      description: "Nearby rescue squads receive instant notifications via SMS, email, and push. They mobilize within minutes.",
      color: "from-amber-500 to-yellow-500",
      detail: "Real-time notifications"
    },
    {
      icon: Navigation,
      title: "GPS-Tracked Searches",
      description: "Volunteers run live searches with GPS tracking. Every step is verified. Search coverage is mapped in real-time.",
      color: "from-blue-500 to-cyan-500",
      detail: "Verified search effort"
    },
    {
      icon: Eye,
      title: "Live Sighting Network",
      description: "Community members report sightings that instantly appear on every volunteer's map with location and confidence level.",
      color: "from-purple-500 to-pink-500",
      detail: "Real-time coordination"
    },
    {
      icon: Target,
      title: "Coordinate & Converge",
      description: "When sightings cluster, squads coordinate containment. Mission control broadcasts commands to all volunteers.",
      color: "from-green-500 to-emerald-500",
      detail: "Tactical coordination"
    },
    {
      icon: Heart,
      title: "Joyful Reunion",
      description: "Pet found. Family reunited. The community celebrates. Data helps improve future searches.",
      color: "from-rose-500 to-red-500",
      detail: "Happy ending"
    }
  ];

  return (
    <div id="how-it-works" className="bg-white py-24">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-20">
          <span className="inline-flex items-center gap-2 text-midnight-500 font-semibold mb-4">
            <Compass className="w-5 h-5" />
            <span className="uppercase tracking-wider text-sm">How It Works</span>
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-midnight-900 mb-6">
            Professional Search & Rescue
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Powered by Community</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group"
            >
              <div className="bg-midnight-50 rounded-3xl p-8 h-full border border-midnight-100 hover:border-midnight-200 hover:shadow-xl transition-all">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <div className="text-xs font-bold text-midnight-400 uppercase tracking-wider mb-2">Step {i + 1}</div>
                <h3 className="text-xl font-bold text-midnight-900 mb-3">{feature.title}</h3>
                <p className="text-midnight-600 leading-relaxed mb-4">{feature.description}</p>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-midnight-500 bg-midnight-100 px-3 py-1 rounded-full">
                  <Sparkles className="w-3 h-3" />
                  {feature.detail}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Live Technology Demo Section ---
const TechnologyShowcase = () => {
  return (
    <div className="bg-gradient-to-b from-midnight-900 to-midnight-950 py-24 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <span className="inline-flex items-center gap-2 text-blue-400 font-semibold mb-4">
            <Smartphone className="w-5 h-5" />
            <span className="uppercase tracking-wider text-sm">The Technology</span>
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
            Mission Control in Your Pocket
          </h2>
          <p className="text-xl text-midnight-300 max-w-2xl mx-auto">
            Every volunteer becomes a coordinated search unit with real-time tools.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Map,
              title: "Live Search Map",
              features: ["Pet's last location", "All sightings in real-time", "Search coverage grid", "Probability circles", "Your GPS trail"],
              color: "blue"
            },
            {
              icon: Navigation,
              title: "GPS Search Mode",
              features: ["Tracks your search path", "Validates walking speed", "Calculates distance", "Marks areas covered", "Awards points"],
              color: "green"
            },
            {
              icon: Trophy,
              title: "Points & Leaderboard",
              features: ["100 pts per mile searched", "Bonus for grid coverage", "Dawn/dusk multipliers", "First 24h bonus", "Real-time rankings"],
              color: "amber"
            }
          ].map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="bg-midnight-800/50 border border-midnight-700 rounded-3xl p-8 hover:border-midnight-600 transition-colors"
            >
              <div className={`w-12 h-12 rounded-xl bg-${card.color}-500/20 flex items-center justify-center mb-6`}>
                <card.icon className={`w-6 h-6 text-${card.color}-400`} />
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

        {/* Surumaa AI Tips */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 bg-gradient-to-r from-flash-500/20 to-amber-500/20 border border-flash-500/30 rounded-3xl p-8 text-center"
        >
          <img src="https://petrescue.b-cdn.net/Logos%20(1).svg" alt="Surumaa" className="h-16 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">AI Search Assistant</h3>
          <p className="text-midnight-300 max-w-2xl mx-auto">
            Surumaa provides contextual tips during your search: "Dawn is prime search time",
            "Cats typically hide within 500 feet", "You're outside the search zone". Smart guidance when you need it.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

// --- Rescue Squads Section ---
const RescueSquads = ({ metrics }) => {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 py-24">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <span className="inline-flex items-center gap-2 text-blue-600 font-semibold mb-4">
              <Shield className="w-5 h-5" />
              <span className="uppercase tracking-wider text-sm">Rescue Squads</span>
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-midnight-900 mb-6">
              Organized Teams.
              <br />
              Real Coordination.
            </h2>
            <p className="text-xl text-midnight-600 mb-8 leading-relaxed">
              Local volunteer teams organized by city. When a pet goes missing, the squad mobilizes.
              Missions are assigned. Areas are covered. Nothing is left to chance.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              {[
                { value: metrics?.activeSquads || 0, label: "Active Squads" },
                { value: metrics?.citiesCovered || 0, label: "Cities Covered" },
                { value: metrics?.totalVolunteers || 0, label: "Volunteers" },
                { value: "24/7", label: "Alert Coverage" }
              ].map((stat, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 text-center shadow-sm">
                  <div className="text-2xl font-black text-midnight-900">{typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}</div>
                  <div className="text-sm text-midnight-500">{stat.label}</div>
                </div>
              ))}
            </div>

            <Link href="/rescue-squads/search">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-500">
                <Shield className="w-5 h-5 mr-2" />
                Find Your Local Squad
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative">
            <div className="bg-white rounded-3xl shadow-2xl p-6 border border-midnight-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="font-bold text-midnight-900">Austin Rescue Squad</div>
                  <div className="text-sm text-midnight-500">47 active members</div>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { status: "active", pet: "Max", breed: "Golden Retriever", time: "2h ago", helpers: 12 },
                  { status: "active", pet: "Luna", breed: "Tabby Cat", time: "5h ago", helpers: 8 },
                  { status: "reunited", pet: "Cooper", breed: "Beagle", time: "Yesterday", helpers: 15 }
                ].map((mission, i) => (
                  <div key={i} className={`p-4 rounded-xl ${mission.status === 'active' ? 'bg-red-50 border border-red-100' : 'bg-green-50 border border-green-100'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{mission.status === 'active' ? '🔴' : '✅'}</div>
                        <div>
                          <div className="font-semibold text-midnight-900">{mission.pet}</div>
                          <div className="text-sm text-midnight-500">{mission.breed}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-midnight-500">{mission.time}</div>
                        <div className="text-sm font-medium text-midnight-700">{mission.helpers} helpers</div>
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
    <div className="bg-gradient-to-b from-midnight-950 to-midnight-900 py-20 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500 rounded-full filter blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500 rounded-full filter blur-[128px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 relative">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-red-400 mb-4">
            <Heartbeat />
            <span className="font-bold uppercase tracking-wider text-sm">Active Missions</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            They Need You Right Now
          </h2>
          <p className="text-xl text-midnight-300">
            Join an active search. Your GPS-tracked effort makes a real difference.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {cases.slice(0, 6).map((pet, i) => (
            <motion.div key={pet.id} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} whileHover={{ y: -8 }}>
              <Link href={`/cases/${pet.caseNumber}`}>
                <div className="bg-white rounded-3xl overflow-hidden shadow-2xl">
                  <div className="relative h-48 overflow-hidden">
                    {pet.petPhotoUrl ? (
                      <img src={pet.petPhotoUrl} alt={pet.petName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-midnight-100 to-midnight-200">
                        {pet.petSpecies === 'DOG' ? '🐕' : '🐈'}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute top-4 right-4">
                      <div className={`px-3 py-1.5 rounded-full text-sm font-bold ${pet.hoursLost < 24 ? 'bg-red-500' : 'bg-orange-500'} text-white flex items-center gap-1.5`}>
                        <Clock className="w-3.5 h-3.5" />
                        {pet.hoursLost < 24 ? `${pet.hoursLost}h` : `${Math.floor(pet.hoursLost / 24)}d`}
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-xl font-black text-white">{pet.petName}</h3>
                      <p className="text-white/80 text-sm">{pet.petBreed || pet.petSpecies} • {pet.city}</p>
                    </div>
                  </div>
                  <div className="p-4 flex items-center justify-between bg-gradient-to-r from-midnight-50 to-white">
                    <span className="text-midnight-600 font-medium text-sm flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-blue-500" />
                      Join the search
                    </span>
                    <div className="w-8 h-8 rounded-full bg-midnight-900 flex items-center justify-center">
                      <ArrowRight className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Success Story ---
const SuccessStory = () => (
  <div className="bg-gradient-to-br from-amber-50 via-white to-rose-50 py-24">
    <div className="max-w-6xl mx-auto px-4">
      <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="grid md:grid-cols-2 gap-12 items-center">
        <div className="relative">
          <img src="https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=1000&auto=format&fit=crop" alt="Happy reunion" className="w-full h-[500px] object-cover rounded-3xl shadow-2xl" />
          <div className="absolute -bottom-6 -right-6 bg-green-500 text-white px-6 py-4 rounded-2xl shadow-xl">
            <div className="flex items-center gap-2">
              <Heart className="w-6 h-6 fill-white" />
              <div>
                <div className="text-2xl font-black">Reunited!</div>
                <div className="text-green-100 text-sm">12 volunteers helped</div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-green-600 mb-6">
            <Heart className="w-5 h-5 fill-green-600" />
            <span className="font-bold uppercase tracking-wider text-sm">Success Story</span>
          </div>
          <Quote className="w-12 h-12 text-midnight-200 mb-4" />
          <blockquote className="text-2xl md:text-3xl font-medium text-midnight-800 leading-relaxed mb-8">
            "I watched on the map as 12 volunteers fanned out across my neighborhood. Someone reported a sighting, and within 20 minutes, three people converged on that location. They found Max hiding under a porch. This wouldn't have happened with a Facebook post."
          </blockquote>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-midnight-200 overflow-hidden">
              <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100&auto=format&fit=crop" alt="Sarah" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="font-bold text-midnight-900 text-lg">Sarah Mitchell</div>
              <div className="text-midnight-500">Austin, TX • Reunited in 4 hours</div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  </div>
);

// --- Impact Stats ---
const ImpactStats = ({ metrics, loading }) => {
  if (loading) return null;

  const stats = [
    { value: metrics.petsReunited, label: "Pets Reunited", icon: Heart, color: "text-rose-400" },
    { value: metrics.totalVolunteers || metrics.totalUsers, label: "Community Heroes", icon: Users, color: "text-blue-400" },
    { value: metrics.activeSquads, label: "Rescue Squads", icon: Shield, color: "text-purple-400" },
    { value: metrics.avgReunionTimeHours || 48, label: "Avg Hours to Reunion", icon: Clock, color: "text-amber-400", suffix: "h" },
  ];

  return (
    <div className="bg-midnight-900 py-20">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-black text-white">Our Community Impact</h2>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => {
            const { count, ref } = useAnimatedCounter(stat.value, 2000 + i * 300);
            return (
              <motion.div key={i} ref={ref} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center">
                <stat.icon className={`w-10 h-10 ${stat.color} mx-auto mb-4`} />
                <div className="text-4xl md:text-5xl font-black text-white mb-2">{count.toLocaleString()}{stat.suffix || ''}</div>
                <div className="text-midnight-400">{stat.label}</div>
              </motion.div>
            );
          })}
        </div>

        {metrics.reunionRate > 0 && (
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-12 text-center">
            <div className="inline-flex items-center gap-4 px-8 py-4 bg-green-500/20 border border-green-500/30 rounded-2xl">
              <CheckCircle className="w-8 h-8 text-green-400" />
              <div className="text-left">
                <div className="text-3xl font-black text-white">{metrics.reunionRate}%</div>
                <div className="text-green-300">Reunion Rate</div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

// --- Final CTA ---
const FinalCTA = ({ session }) => (
  <div className="relative py-24 overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-midnight-900 via-indigo-900 to-midnight-900" />
    <div className="absolute inset-0 overflow-hidden">
      <motion.div animate={{ x: [0, 100, 0], y: [0, -50, 0] }} transition={{ duration: 20, repeat: Infinity }} className="absolute top-20 left-20 w-64 h-64 bg-flash-500/30 rounded-full filter blur-3xl" />
      <motion.div animate={{ x: [0, -100, 0], y: [0, 50, 0] }} transition={{ duration: 25, repeat: Infinity }} className="absolute bottom-20 right-20 w-80 h-80 bg-purple-500/20 rounded-full filter blur-3xl" />
    </div>

    <div className="max-w-4xl mx-auto px-4 text-center relative">
      <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
        <motion.img animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity }} src="https://petrescue.b-cdn.net/Logos%20(1).svg" alt="Surumaa" className="h-24 w-auto mx-auto mb-8" />
        <h2 className="text-4xl md:text-5xl font-black text-white mb-6">Ready to Make a Difference?</h2>
        <p className="text-xl text-midnight-300 mb-10 max-w-2xl mx-auto">
          Join the coordinated search network. When a pet goes missing in your area, you'll be part of the response team.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {session ? (
            <Link href="/dashboard"><Button size="xl">Go to Dashboard<ArrowRight className="w-5 h-5 ml-2" /></Button></Link>
          ) : (
            <>
              <Link href="/register"><Button size="xl" className="shadow-xl shadow-flash-500/30">Join a Rescue Squad<Shield className="w-5 h-5 ml-2" /></Button></Link>
              <Link href="/report/new"><Button size="xl" variant="outline" className="border-white/30 text-white hover:bg-white/10">Report a Lost Pet</Button></Link>
            </>
          )}
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-8 text-midnight-400">
          <span className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-400" />100% Free</span>
          <span className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-400" />GPS-Verified</span>
          <span className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-400" />Real Coordination</span>
        </div>
      </motion.div>
    </div>
  </div>
);

// --- Footer ---
const Footer = () => (
  <div className="bg-midnight-950 py-16 border-t border-midnight-800">
    <div className="max-w-7xl mx-auto px-4">
      <div className="grid md:grid-cols-4 gap-12 mb-12">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <img src="https://petrescue.b-cdn.net/Logos.svg" alt="PetRecovery" className="h-12 w-auto" />
            <span className="text-white font-bold text-xl">PetRecovery</span>
          </div>
          <p className="text-midnight-400 leading-relaxed max-w-md">
            Coordinated search and rescue for lost pets. GPS-tracked volunteers. Real-time sightings. Organized rescue squads. Because finding a lost pet takes a village.
          </p>
        </div>
        <div>
          <h4 className="text-white font-bold mb-4">Quick Links</h4>
          <ul className="space-y-2 text-midnight-400">
            <li><Link href="/report/new" className="hover:text-white transition">Report Lost Pet</Link></li>
            <li><Link href="/report/found" className="hover:text-white transition">Report Found Pet</Link></li>
            <li><Link href="/database" className="hover:text-white transition">Search Database</Link></li>
            <li><Link href="/rescue-squads/search" className="hover:text-white transition">Find Squads</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-bold mb-4">About</h4>
          <ul className="space-y-2 text-midnight-400">
            <li><Link href="/about-surumaa" className="hover:text-white transition">About Surumaa</Link></li>
            <li><Link href="/how-it-works" className="hover:text-white transition">How It Works</Link></li>
            <li><Link href="/contact" className="hover:text-white transition">Contact Us</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-midnight-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-midnight-500">
        <p>&copy; {new Date().getFullYear()} PetRecovery.org. All rights reserved.</p>
        <div className="flex items-center gap-6">
          <Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-white transition">Terms of Service</Link>
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
        const data = await res.json();
        setHomepageData(data);
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
      <TheDifference />
      <HowItWorks />
      <TechnologyShowcase />
      <RescueSquads metrics={metrics} />
      <PetsNeedingHelp cases={casesNeedingHelp} loading={loading} />
      <SuccessStory />
      <ImpactStats metrics={metrics} loading={loading} />
      <FinalCTA session={session} />
      <Footer />
    </div>
  );
}
