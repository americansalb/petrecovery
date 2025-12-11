'use client';

/**
 * Homepage - Emotionally Engaging Design
 *
 * This is not just a landing page - it's the first moment of hope
 * for someone whose pet is missing. Every element should convey:
 * - Immediate empathy and understanding
 * - Hope that reunion is possible
 * - Urgency to act now
 * - Trust in the community
 *
 * Design Philosophy: Warm, hopeful, urgent, human
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
  Phone,
  MessageCircle,
  Star,
  ArrowDown,
  Play,
  Quote,
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

// --- Heartbeat Animation for Urgency ---
const Heartbeat = ({ className = '' }) => (
  <span className={`relative inline-flex ${className}`}>
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
  </span>
);

// --- Live Reunion Ticker - Celebrating Success ---
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
      {/* Subtle shine effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 animate-shimmer" />

      <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-4 relative">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
          >
            <Heart className="w-5 h-5 text-white fill-white" />
          </motion.div>
          <span className="font-semibold text-emerald-100">REUNION</span>
        </div>

        <AnimatePresence mode='wait'>
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2"
          >
            <span className="font-bold text-white text-lg">{current.petName}</span>
            {current.petBreed && (
              <span className="text-emerald-200">the {current.petBreed}</span>
            )}
            <span className="text-emerald-100">is back home</span>
            {current.city && (
              <span className="text-emerald-200 hidden sm:inline">in {current.city}</span>
            )}
            {current.timeToReunionHours && (
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm ml-2">
                Found in {current.timeToReunionHours < 24
                  ? `${Math.round(current.timeToReunionHours)}h`
                  : `${Math.round(current.timeToReunionHours / 24)}d`}
              </span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// --- Header ---
const HomeHeader = ({ session, scrolled }) => {
  return (
    <motion.div
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-midnight-950/95 backdrop-blur-md shadow-lg' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 text-white font-bold text-xl group">
          <motion.img
            whileHover={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.5 }}
            src="https://petrescue.b-cdn.net/Logos.svg"
            alt="PetRecovery"
            className="h-10 w-auto drop-shadow-lg"
          />
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
                <Button className="shadow-lg shadow-flash-500/25">Sign Up Free</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// --- Hero Section - The Emotional Hook ---
const HeroSection = ({ session, metrics, loading, scrolled }) => {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });

  const backgroundY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <div ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <HomeHeader session={session} scrolled={scrolled} />

      {/* Parallax Background */}
      <motion.div
        className="absolute inset-0 bg-midnight-950"
        style={{ y: backgroundY }}
      >
        <img
          src="https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=2070&auto=format&fit=crop"
          alt="Dog looking hopeful"
          className="w-full h-[120%] object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-midnight-950/70 via-midnight-950/50 to-midnight-950" />

        {/* Warm overlay for emotional warmth */}
        <div className="absolute inset-0 bg-gradient-to-tr from-amber-900/20 via-transparent to-rose-900/10" />
      </motion.div>

      <motion.div
        style={{ opacity }}
        className="relative z-10 text-center max-w-5xl px-4 pt-20"
      >
        {/* Mascot with gentle float */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="mb-8 flex justify-center"
        >
          <motion.img
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            src="https://petrescue.b-cdn.net/Logos%20(1).svg"
            alt="Surumaa"
            className="h-32 md:h-40 w-auto drop-shadow-2xl"
          />
        </motion.div>

        {/* Main Headline - Emotional & Clear */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white mb-6 tracking-tight">
            <span className="block">We Help Bring</span>
            <span className="block mt-2">
              <span className="relative inline-block">
                <span className="relative z-10 text-flash-400">Lost Pets</span>
                <motion.span
                  className="absolute -inset-2 bg-flash-500/20 rounded-lg -z-0"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </span>
              {' '}Home
            </span>
          </h1>
        </motion.div>

        {/* Emotional Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-xl md:text-2xl text-midnight-200 mb-4 max-w-3xl mx-auto leading-relaxed"
        >
          Every minute matters when your pet is missing.
        </motion.p>

        {/* Live Stats - Social Proof */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mb-10"
        >
          {!loading && metrics.petsReunited > 0 && (
            <p className="text-lg text-midnight-300">
              Our community has reunited{' '}
              <span className="text-flash-400 font-bold text-2xl md:text-3xl">
                {metrics.petsReunited.toLocaleString()}
              </span>{' '}
              families with their pets
              {metrics.weeklyReunions > 0 && (
                <span className="block mt-2 text-green-400 font-medium">
                  <Heart className="w-4 h-4 inline mr-1 fill-green-400" />
                  {metrics.weeklyReunions} happy reunions this week
                </span>
              )}
            </p>
          )}
        </motion.div>

        {/* Primary CTAs - Clear & Urgent */}
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
              className="shadow-xl shadow-red-600/40 hover:shadow-red-600/60 hover:scale-105 transition-all text-lg px-8 py-6 group"
            >
              <Bell className="w-5 h-5 mr-2 group-hover:animate-bounce" />
              My Pet Is Lost
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <Link href="/report/found">
            <Button
              size="xl"
              className="bg-emerald-600 hover:bg-emerald-500 shadow-xl shadow-emerald-600/30 hover:shadow-emerald-600/50 hover:scale-105 transition-all text-lg px-8 py-6"
            >
              <Heart className="w-5 h-5 mr-2" />
              I Found a Pet
            </Button>
          </Link>
        </motion.div>

        {/* Secondary Action */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <Link
            href="/database"
            className="inline-flex items-center gap-2 text-midnight-300 hover:text-white transition-colors group"
          >
            <Search className="w-4 h-4" />
            Search for a lost pet in our database
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>

        {/* Urgent Cases Indicator */}
        {!loading && metrics.openCases > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="mt-12"
          >
            <Link href="#pets-need-help">
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="inline-flex items-center gap-3 px-6 py-3 bg-red-500/20 border border-red-500/40 rounded-full text-white cursor-pointer group"
              >
                <Heartbeat />
                <span>
                  <strong className="text-red-300">{metrics.openCases} pets</strong> need your help right now
                </span>
                <ArrowDown className="w-4 h-4 animate-bounce" />
              </motion.div>
            </Link>
          </motion.div>
        )}
      </motion.div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-white/50"
        >
          <ArrowDown className="w-6 h-6" />
        </motion.div>
      </motion.div>
    </div>
  );
};

// --- The Promise Section - Why We Exist ---
const PromiseSection = () => {
  return (
    <div className="bg-white py-20 relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="max-w-6xl mx-auto px-4 relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-black text-midnight-900 mb-6">
            When Your Pet Goes Missing,
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-flash-500 to-amber-500">
              Every Second Counts
            </span>
          </h2>
          <p className="text-xl text-midnight-600 max-w-3xl mx-auto leading-relaxed">
            We understand the panic, the fear, the desperate hope. That's why we built
            a community that springs into action the moment you need help.
          </p>
        </motion.div>

        {/* Three Pillars */}
        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          {[
            {
              icon: Zap,
              title: "Instant Alerts",
              description: "Your report reaches volunteers, neighbors, and local shelters within seconds - not hours.",
              color: "red",
              stat: "< 30 sec",
              statLabel: "Alert time"
            },
            {
              icon: Users,
              title: "Community Power",
              description: "Hundreds of caring neighbors ready to search, share, and watch for your pet.",
              color: "blue",
              stat: "24/7",
              statLabel: "Active community"
            },
            {
              icon: Heart,
              title: "Real Results",
              description: "Our coordinated approach helps reunite pets with their families faster than searching alone.",
              color: "green",
              stat: "48h",
              statLabel: "Avg. reunion time"
            }
          ].map((pillar, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="relative group"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${
                pillar.color === 'red' ? 'from-red-100 to-orange-50' :
                pillar.color === 'blue' ? 'from-blue-100 to-indigo-50' :
                'from-green-100 to-emerald-50'
              } rounded-3xl transform group-hover:scale-105 transition-transform duration-300`} />

              <div className="relative p-8">
                <div className={`w-16 h-16 rounded-2xl ${
                  pillar.color === 'red' ? 'bg-red-500' :
                  pillar.color === 'blue' ? 'bg-blue-500' :
                  'bg-green-500'
                } flex items-center justify-center mb-6 shadow-lg`}>
                  <pillar.icon className="w-8 h-8 text-white" />
                </div>

                <h3 className="text-2xl font-bold text-midnight-900 mb-3">
                  {pillar.title}
                </h3>
                <p className="text-midnight-600 leading-relaxed mb-6">
                  {pillar.description}
                </p>

                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                  pillar.color === 'red' ? 'bg-red-100 text-red-700' :
                  pillar.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  <span className="text-2xl font-black">{pillar.stat}</span>
                  <span className="text-sm font-medium">{pillar.statLabel}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Pets Needing Help - The Emotional Core ---
const PetsNeedingHelp = ({ cases = [], loading = false }) => {
  if (loading || cases.length === 0) return null;

  return (
    <div id="pets-need-help" className="bg-gradient-to-b from-midnight-950 to-midnight-900 py-20 relative overflow-hidden">
      {/* Subtle animated background */}
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
            <span className="font-bold uppercase tracking-wider text-sm">Urgent - They Need You</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            These Pets Are Lost Right Now
          </h2>
          <p className="text-xl text-midnight-300 max-w-2xl mx-auto">
            Somewhere nearby, a family is searching. Can you help?
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
              whileHover={{ y: -8 }}
              className="group"
            >
              <Link href={`/cases/${pet.caseNumber}`}>
                <div className="bg-white rounded-3xl overflow-hidden shadow-2xl">
                  {/* Pet Photo */}
                  <div className="relative h-56 overflow-hidden">
                    {pet.petPhotoUrl ? (
                      <img
                        src={pet.petPhotoUrl}
                        alt={pet.petName}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-7xl bg-gradient-to-br from-midnight-100 to-midnight-200">
                        {pet.petSpecies === 'DOG' ? '🐕' : pet.petSpecies === 'CAT' ? '🐈' : '🐾'}
                      </div>
                    )}

                    {/* Urgency Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Time Badge */}
                    <div className="absolute top-4 right-4">
                      <div className={`px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 ${
                        pet.hoursLost < 24
                          ? 'bg-red-500 text-white'
                          : pet.hoursLost < 72
                            ? 'bg-orange-500 text-white'
                            : 'bg-midnight-700 text-white'
                      }`}>
                        <Clock className="w-3.5 h-3.5" />
                        {pet.hoursLost < 24
                          ? `${pet.hoursLost}h ago`
                          : `${Math.floor(pet.hoursLost / 24)} days`}
                      </div>
                    </div>

                    {pet.isUrgent && (
                      <div className="absolute top-4 left-4">
                        <div className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          URGENT
                        </div>
                      </div>
                    )}

                    {/* Pet Info Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <h3 className="text-2xl font-black text-white mb-1">
                        {pet.petName}
                      </h3>
                      <p className="text-white/80">
                        {pet.petBreed || pet.petSpecies} • {pet.city}, {pet.state}
                      </p>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="p-4 bg-gradient-to-r from-midnight-50 to-white flex items-center justify-between">
                    <span className="text-midnight-600 font-medium flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-red-500" />
                      Help find {pet.petName}
                    </span>
                    <div className="w-10 h-10 rounded-full bg-midnight-900 flex items-center justify-center group-hover:bg-flash-500 transition-colors">
                      <ArrowRight className="w-5 h-5 text-white" />
                    </div>
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
          className="mt-12 text-center"
        >
          <Link href="/database">
            <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
              View All Lost Pets
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

// --- Community Impact Stats ---
const ImpactStats = ({ metrics, loading }) => {
  if (loading) return null;

  const stats = [
    { value: metrics.petsReunited, label: "Pets Reunited", icon: Heart, color: "text-rose-400" },
    { value: metrics.totalVolunteers || metrics.totalUsers, label: "Community Heroes", icon: Users, color: "text-blue-400" },
    { value: metrics.activeSquads, label: "Rescue Squads", icon: Shield, color: "text-purple-400" },
    { value: metrics.citiesCovered, label: "Cities Covered", icon: MapPin, color: "text-amber-400" },
  ];

  return (
    <div className="bg-midnight-900 py-20 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-flash-500/10 to-purple-500/10 rounded-full filter blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto px-4 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 text-flash-400 font-semibold mb-4">
            <Sparkles className="w-5 h-5" />
            <span className="uppercase tracking-wider text-sm">Our Impact Together</span>
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-white">
            A Community Built on Love
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => {
            const { count, ref } = useAnimatedCounter(stat.value, 2000 + i * 300);

            return (
              <motion.div
                key={i}
                ref={ref}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <stat.icon className={`w-10 h-10 ${stat.color} mx-auto mb-4`} />
                <div className="text-4xl md:text-5xl font-black text-white mb-2">
                  {count.toLocaleString()}
                </div>
                <div className="text-midnight-400 font-medium">{stat.label}</div>
              </motion.div>
            );
          })}
        </div>

        {/* Success Rate */}
        {metrics.reunionRate > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16 text-center"
          >
            <div className="inline-flex items-center gap-4 px-8 py-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-2xl">
              <CheckCircle className="w-8 h-8 text-green-400" />
              <div className="text-left">
                <div className="text-3xl font-black text-white">{metrics.reunionRate}%</div>
                <div className="text-green-300">Reunion Success Rate</div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

// --- Featured Success Story ---
const FeaturedStory = () => {
  return (
    <div className="bg-gradient-to-br from-amber-50 via-white to-rose-50 py-24 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid md:grid-cols-2 gap-12 items-center"
        >
          {/* Image Side */}
          <div className="relative">
            <motion.div
              whileInView={{ scale: [0.95, 1] }}
              viewport={{ once: true }}
              className="relative z-10"
            >
              <img
                src="https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=1000&auto=format&fit=crop"
                alt="Happy reunion"
                className="w-full h-[500px] object-cover rounded-3xl shadow-2xl"
              />
              {/* Reunion badge */}
              <div className="absolute -bottom-6 -right-6 bg-green-500 text-white px-6 py-4 rounded-2xl shadow-xl">
                <div className="flex items-center gap-2">
                  <Heart className="w-6 h-6 fill-white" />
                  <div>
                    <div className="text-2xl font-black">Reunited!</div>
                    <div className="text-green-100 text-sm">After 47 hours</div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Decorative elements */}
            <div className="absolute -top-8 -left-8 w-32 h-32 bg-flash-200 rounded-full filter blur-2xl opacity-60" />
            <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-rose-200 rounded-full filter blur-2xl opacity-60" />
          </div>

          {/* Story Side */}
          <div>
            <div className="flex items-center gap-2 text-green-600 mb-6">
              <Heart className="w-5 h-5 fill-green-600" />
              <span className="font-bold uppercase tracking-wider text-sm">Success Story</span>
            </div>

            <Quote className="w-12 h-12 text-midnight-200 mb-4" />

            <blockquote className="text-2xl md:text-3xl font-medium text-midnight-800 leading-relaxed mb-8">
              "I was losing hope after two days. Then a PetRecovery volunteer spotted Max
              in their yard. Within an hour, I was holding him again. I can't stop crying happy tears."
            </blockquote>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-midnight-200 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100&auto=format&fit=crop"
                  alt="Sarah"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="font-bold text-midnight-900 text-lg">Sarah Mitchell</div>
                <div className="text-midnight-500">Austin, TX • Reunited with Max</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

// --- How It Works - Visual Journey ---
const HowItWorks = () => {
  const steps = [
    {
      num: "01",
      title: "Report in 2 Minutes",
      description: "Tell us about your pet. Add a photo. We handle the rest.",
      icon: Bell,
      color: "from-red-500 to-orange-500"
    },
    {
      num: "02",
      title: "Alerts Go Out Instantly",
      description: "Nearby volunteers, squads, and shelters are notified immediately.",
      icon: Zap,
      color: "from-amber-500 to-yellow-500"
    },
    {
      num: "03",
      title: "Community Searches",
      description: "Track sightings on a live map. Coordinate with volunteers.",
      icon: MapPin,
      color: "from-blue-500 to-indigo-500"
    },
    {
      num: "04",
      title: "Joyful Reunion",
      description: "Together, we bring your family back together.",
      icon: Heart,
      color: "from-green-500 to-emerald-500"
    }
  ];

  return (
    <div className="bg-white py-24">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl md:text-5xl font-black text-midnight-900 mb-6">
            How We Help Find Your Pet
          </h2>
          <p className="text-xl text-midnight-600 max-w-2xl mx-auto">
            A simple process designed for when every minute counts
          </p>
        </motion.div>

        <div className="relative">
          {/* Connection Line */}
          <div className="hidden md:block absolute top-24 left-0 right-0 h-1 bg-gradient-to-r from-red-200 via-amber-200 via-blue-200 to-green-200" />

          <div className="grid md:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative text-center"
              >
                {/* Icon Circle */}
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className={`w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg relative z-10`}
                >
                  <step.icon className="w-10 h-10 text-white" />
                </motion.div>

                <div className="text-sm font-black text-midnight-300 mb-2">{step.num}</div>
                <h3 className="text-xl font-bold text-midnight-900 mb-3">{step.title}</h3>
                <p className="text-midnight-600">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <Link href="/report/new">
            <Button size="xl" className="shadow-xl shadow-midnight-900/20">
              Start a Free Report
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

// --- Join the Community CTA ---
const JoinCommunity = ({ session }) => {
  return (
    <div className="relative py-24 overflow-hidden">
      {/* Beautiful gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-midnight-900 via-indigo-900 to-midnight-900" />

      {/* Animated orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ x: [0, 100, 0], y: [0, -50, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
          className="absolute top-20 left-20 w-64 h-64 bg-flash-500/30 rounded-full filter blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -100, 0], y: [0, 50, 0] }}
          transition={{ duration: 25, repeat: Infinity }}
          className="absolute bottom-20 right-20 w-80 h-80 bg-purple-500/20 rounded-full filter blur-3xl"
        />
      </div>

      <div className="max-w-4xl mx-auto px-4 text-center relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <motion.img
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
            src="https://petrescue.b-cdn.net/Logos%20(1).svg"
            alt="Surumaa"
            className="h-24 w-auto mx-auto mb-8"
          />

          <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
            Be Someone's Hero Today
          </h2>
          <p className="text-xl text-midnight-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            Join thousands of compassionate people who help reunite lost pets
            with their families. Every volunteer makes a difference.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {session ? (
              <Link href="/dashboard">
                <Button size="xl" className="shadow-xl">
                  Go to Your Dashboard
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/register">
                  <Button size="xl" className="shadow-xl shadow-flash-500/30">
                    Join Free - Make a Difference
                    <Heart className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link href="/rescue-squads/search">
                  <Button size="xl" variant="outline" className="border-white/30 text-white hover:bg-white/10">
                    <Shield className="w-5 h-5 mr-2" />
                    Find Local Squads
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Trust Indicators */}
          <div className="mt-12 flex flex-wrap justify-center gap-8 text-midnight-400">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span>100% Free to Use</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span>No Credit Card Needed</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span>Takes 30 Seconds</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

// --- Footer ---
const Footer = () => {
  return (
    <div className="bg-midnight-950 py-16 border-t border-midnight-800">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img
                src="https://petrescue.b-cdn.net/Logos.svg"
                alt="PetRecovery"
                className="h-12 w-auto"
              />
              <span className="text-white font-bold text-xl">PetRecovery</span>
            </div>
            <p className="text-midnight-400 leading-relaxed max-w-md">
              A community-powered platform dedicated to reuniting lost pets with their families.
              Because every pet deserves to come home.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-bold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-midnight-400">
              <li><Link href="/report/new" className="hover:text-white transition">Report Lost Pet</Link></li>
              <li><Link href="/report/found" className="hover:text-white transition">Report Found Pet</Link></li>
              <li><Link href="/database" className="hover:text-white transition">Search Database</Link></li>
              <li><Link href="/rescue-squads/search" className="hover:text-white transition">Find Squads</Link></li>
            </ul>
          </div>

          {/* About */}
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
};

// --- Shimmer Animation CSS ---
const ShimmerStyle = () => (
  <style jsx global>{`
    @keyframes shimmer {
      0% { transform: translateX(-100%) skewX(-12deg); }
      100% { transform: translateX(200%) skewX(-12deg); }
    }
    .animate-shimmer {
      animation: shimmer 3s infinite;
    }
  `}</style>
);

// --- Main Homepage Component ---
export default function Home() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
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
      weeklyReunions: 0,
    },
    ticker: [],
    casesNeedingHelp: [],
  });

  // Scroll detection for header
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch homepage data
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

      {/* Live Reunion Ticker */}
      <LiveReunionTicker reunions={ticker} loading={loading} />

      {/* Hero - The Emotional Hook */}
      <HeroSection
        session={session}
        metrics={metrics}
        loading={loading}
        scrolled={scrolled}
      />

      {/* The Promise - Why We Exist */}
      <PromiseSection />

      {/* Pets Needing Help - The Emotional Core */}
      <PetsNeedingHelp cases={casesNeedingHelp} loading={loading} />

      {/* Community Impact */}
      <ImpactStats metrics={metrics} loading={loading} />

      {/* Featured Success Story */}
      <FeaturedStory />

      {/* How It Works */}
      <HowItWorks />

      {/* Join the Community */}
      <JoinCommunity session={session} />

      {/* Footer */}
      <Footer />
    </div>
  );
}
