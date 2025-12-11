'use client';

/**
 * Homepage - Warm, Engaging, Action-Oriented
 *
 * Balance: Emotional connection + Clear actions
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Search,
  Heart,
  MapPin,
  Users,
  Shield,
  ArrowRight,
  Building2,
  Navigation,
  Eye,
  ChevronDown,
} from 'lucide-react';

// Live Reunion Ticker - celebrates recent reunions
const ReunionTicker = ({ reunions = [], loading }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reunions.length <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % reunions.length), 5000);
    return () => clearInterval(timer);
  }, [reunions.length]);

  if (loading || reunions.length === 0) return null;

  const current = reunions[index];

  return (
    <div className="bg-gradient-to-r from-emerald-600 to-green-600 text-white py-2.5 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-center gap-3">
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <Heart className="w-4 h-4 fill-white" />
        </motion.div>
        <AnimatePresence mode="wait">
          <motion.span
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-sm"
          >
            <strong>{current.petName}</strong> is back home
            {current.city && <span className="text-emerald-100"> in {current.city}</span>}
            {current.timeToReunionHours && (
              <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                {current.timeToReunionHours < 24
                  ? `${Math.round(current.timeToReunionHours)}h`
                  : `${Math.round(current.timeToReunionHours / 24)}d`}
              </span>
            )}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default function Home() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [data, setData] = useState({
    metrics: { petsReunited: 0, openCases: 0, activeSquads: 0, totalVolunteers: 0, weeklyReunions: 0 },
    ticker: [],
    casesNeedingHelp: [],
  });

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/public/homepage');
        if (res.ok) setData(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const { metrics, ticker, casesNeedingHelp } = data;

  return (
    <div className="min-h-screen bg-midnight-950">
      {/* Reunion Ticker */}
      <ReunionTicker reunions={ticker} loading={loading} />

      {/* Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-midnight-950/95 backdrop-blur-md shadow-lg' : ''
        }`}
        style={{ top: !loading && ticker.length > 0 ? '36px' : '0' }}
      >
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="https://petrescue.b-cdn.net/Logos.svg"
              alt="PetRecovery"
              className="h-9 w-auto drop-shadow-lg"
            />
            <span className="text-white font-bold text-lg hidden sm:inline">PetRecovery</span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-4 text-sm">
            <Link href="/database" className="text-white/70 hover:text-white transition px-2 py-1">
              Search
            </Link>
            <Link href="/rescue-squads/search" className="text-white/70 hover:text-white transition px-2 py-1">
              Squads
            </Link>
            <Link href="/shelters" className="text-white/70 hover:text-white transition px-2 py-1 hidden sm:block">
              Shelters
            </Link>
            {session ? (
              <Link
                href="/dashboard"
                className="bg-flash-400 text-midnight-900 px-4 py-2 rounded-xl font-semibold hover:bg-flash-500 transition"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="bg-white/10 text-white px-4 py-2 rounded-xl font-medium hover:bg-white/20 transition"
              >
                Login
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=2069&auto=format&fit=crop"
            alt="Dogs running happily"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-midnight-950 via-midnight-950/90 to-midnight-950/70" />
          <div className="absolute inset-0 bg-gradient-to-t from-midnight-950 via-transparent to-midnight-950/50" />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 pt-32 pb-20">
          <div className="max-w-2xl">
            {/* Mascot */}
            <motion.img
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              src="https://petrescue.b-cdn.net/Logos%20(1).svg"
              alt="Surumaa"
              className="h-20 w-auto mb-6 drop-shadow-2xl"
            />

            {/* Live alert */}
            {!loading && metrics.openCases > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="inline-flex items-center gap-2 bg-red-500/20 backdrop-blur-sm border border-red-500/30 text-red-200 px-4 py-2 rounded-full text-sm mb-6"
              >
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                {metrics.openCases} pets need help right now
              </motion.div>
            )}

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl md:text-6xl lg:text-7xl font-black text-white mb-6 leading-[1.1]"
            >
              When They're Lost,
              <br />
              <span className="text-flash-400">We Search Together</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xl text-white/80 mb-8 leading-relaxed"
            >
              Real volunteers. GPS-tracked searches. Live sighting reports.
              <br className="hidden sm:block" />
              Your community comes together to bring your pet home.
            </motion.p>

            {/* Stats */}
            {!loading && metrics.petsReunited > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-6 mb-10 text-white/60"
              >
                <div>
                  <span className="text-2xl font-bold text-white">{metrics.petsReunited.toLocaleString()}</span>
                  <span className="ml-1">reunited</span>
                </div>
                <div className="w-px h-6 bg-white/20" />
                <div>
                  <span className="text-2xl font-bold text-white">{metrics.activeSquads}</span>
                  <span className="ml-1">rescue squads</span>
                </div>
                {metrics.weeklyReunions > 0 && (
                  <>
                    <div className="w-px h-6 bg-white/20" />
                    <div className="text-green-400">
                      +{metrics.weeklyReunions} this week
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* Primary Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 mb-8"
            >
              <Link
                href="/report/new"
                className="inline-flex items-center justify-center gap-3 bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-xl shadow-red-900/30 hover:shadow-red-900/50 hover:scale-[1.02]"
              >
                <Bell className="w-5 h-5" />
                Report Lost Pet
              </Link>
              <Link
                href="/report/found"
                className="inline-flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all hover:scale-[1.02]"
              >
                <Heart className="w-5 h-5" />
                I Found a Pet
              </Link>
            </motion.div>

            {/* Secondary Actions */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap items-center gap-x-6 gap-y-2 text-white/60"
            >
              <Link href="/database" className="inline-flex items-center gap-2 hover:text-white transition">
                <Search className="w-4 h-4" />
                Search lost pets
              </Link>
              <Link href="/rescue-squads/search" className="inline-flex items-center gap-2 hover:text-white transition">
                <Shield className="w-4 h-4" />
                Find your squad
              </Link>
              <Link href="/shelters" className="inline-flex items-center gap-2 hover:text-white transition">
                <Building2 className="w-4 h-4" />
                Check shelters
              </Link>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40"
        >
          <ChevronDown className="w-6 h-6 animate-bounce" />
        </motion.div>
      </section>

      {/* Pets Needing Help */}
      {!loading && casesNeedingHelp.length > 0 && (
        <section className="bg-midnight-900 py-16">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  Pets Who Need You
                </h2>
                <p className="text-white/60">Join an active search. Every helper makes a difference.</p>
              </div>
              <Link
                href="/database"
                className="hidden sm:inline-flex items-center gap-2 text-flash-400 hover:text-flash-300 font-medium"
              >
                View all
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {casesNeedingHelp.slice(0, 4).map((pet, i) => (
                <motion.div
                  key={pet.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Link
                    href={`/cases/${pet.caseNumber}`}
                    className="block bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl overflow-hidden transition group"
                  >
                    <div className="relative h-40">
                      {pet.petPhotoUrl ? (
                        <img
                          src={pet.petPhotoUrl}
                          alt={pet.petName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-midnight-800 flex items-center justify-center text-5xl">
                          {pet.petSpecies === 'DOG' ? '🐕' : '🐈'}
                        </div>
                      )}
                      <div className="absolute top-3 right-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-bold ${
                            pet.hoursLost < 24 ? 'bg-red-500' : 'bg-orange-500'
                          } text-white`}
                        >
                          {pet.hoursLost < 24 ? `${pet.hoursLost}h` : `${Math.floor(pet.hoursLost / 24)}d`}
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="text-white font-bold text-lg mb-1">{pet.petName}</h3>
                      <p className="text-white/50 text-sm flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {pet.city}, {pet.state}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            <div className="mt-6 text-center sm:hidden">
              <Link
                href="/database"
                className="inline-flex items-center gap-2 text-flash-400 font-medium"
              >
                View all lost pets
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* How It Works */}
      <section className="bg-gradient-to-b from-midnight-900 to-midnight-950 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              How We Bring Them Home
            </h2>
            <p className="text-white/60 max-w-2xl mx-auto">
              Not just a lost pet post. A coordinated search effort with real volunteers.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Bell,
                title: 'Report',
                desc: 'Add your pet\'s photo and last location. Takes 2 minutes.',
                color: 'bg-red-500',
              },
              {
                icon: Users,
                title: 'Alert',
                desc: 'Local rescue squads receive instant notifications.',
                color: 'bg-amber-500',
              },
              {
                icon: Navigation,
                title: 'Search',
                desc: 'GPS-tracked volunteers cover your neighborhood systematically.',
                color: 'bg-blue-500',
              },
              {
                icon: Eye,
                title: 'Spot',
                desc: 'Community reports sightings. Teams converge on hot spots.',
                color: 'bg-purple-500',
              },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center"
              >
                <div
                  className={`w-14 h-14 ${step.color} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg`}
                >
                  <step.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{step.title}</h3>
                <p className="text-white/60 text-sm">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Join CTA */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-flash-500 to-amber-500" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=2000')] bg-cover bg-center opacity-20" />

        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-midnight-900 mb-4">
              It Takes a Village
            </h2>
            <p className="text-midnight-800/80 text-lg mb-8 max-w-2xl mx-auto">
              Every reunion happens because someone chose to help.
              Join {metrics.totalVolunteers?.toLocaleString() || 'our'} volunteers making a difference.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 bg-midnight-900 hover:bg-midnight-800 text-white px-8 py-4 rounded-2xl font-bold text-lg transition"
              >
                Join Free
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/patrol/signup"
                className="inline-flex items-center justify-center gap-2 bg-white/30 hover:bg-white/40 text-midnight-900 px-8 py-4 rounded-2xl font-bold text-lg transition backdrop-blur-sm"
              >
                <Shield className="w-5 h-5" />
                Become a Volunteer
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-midnight-950 border-t border-white/10 py-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <img src="https://petrescue.b-cdn.net/Logos.svg" alt="PetRecovery" className="h-8 w-auto" />
                <span className="text-white font-bold">PetRecovery</span>
              </div>
              <p className="text-white/50 text-sm max-w-sm">
                Coordinated pet search and rescue. GPS-tracked volunteers. Live sighting network.
                Because finding a lost pet takes a village.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Quick Links</h4>
              <ul className="space-y-2 text-white/50 text-sm">
                <li><Link href="/report/new" className="hover:text-white transition">Report Lost Pet</Link></li>
                <li><Link href="/report/found" className="hover:text-white transition">Report Found Pet</Link></li>
                <li><Link href="/database" className="hover:text-white transition">Search Database</Link></li>
                <li><Link href="/rescue-squads/search" className="hover:text-white transition">Find Squads</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">More</h4>
              <ul className="space-y-2 text-white/50 text-sm">
                <li><Link href="/shelters" className="hover:text-white transition">Shelters</Link></li>
                <li><Link href="/patrol/signup" className="hover:text-white transition">Volunteer</Link></li>
                <li><Link href="/about-surumaa" className="hover:text-white transition">About</Link></li>
                <li><Link href="/contact" className="hover:text-white transition">Contact</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/40">
            <p>© {new Date().getFullYear()} PetRecovery.org</p>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
