'use client';

/**
 * Homepage - Hopeful, Shows Capabilities, Action-Oriented
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  Map,
  Radio,
  FileText,
  LocateFixed,
} from 'lucide-react';

// Live Reunion Ticker
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
    <div className="bg-gradient-to-r from-emerald-500 to-green-500 text-white py-2.5">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-center gap-3">
        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
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
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [locationQuery, setLocationQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [data, setData] = useState({
    metrics: { petsReunited: 0, openCases: 0, activeSquads: 0, totalVolunteers: 0, weeklyReunions: 0 },
    ticker: [],
    casesNeedingHelp: [],
  });

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

  const handleFindSquad = (e) => {
    e.preventDefault();
    if (locationQuery.trim()) {
      router.push(`/rescue-squads/search?q=${encodeURIComponent(locationQuery.trim())}`);
    }
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        router.push(`/rescue-squads/search?lat=${latitude}&lng=${longitude}`);
      },
      (error) => {
        setLocating(false);
        alert('Unable to get your location. Please enter a city or zip code.');
      }
    );
  };

  const { metrics, ticker, casesNeedingHelp } = data;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-blue-50">
      {/* Reunion Ticker */}
      <ReunionTicker reunions={ticker} loading={loading} />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="https://petrescue.b-cdn.net/Logos.svg" alt="PetRecovery" className="h-9 w-auto" />
            <span className="font-bold text-lg text-gray-900 hidden sm:inline">PetRecovery</span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-4 text-sm">
            <Link href="/database" className="text-gray-600 hover:text-gray-900 transition px-2 py-1">
              Search
            </Link>
            <Link href="/rescue-squads/search" className="text-gray-600 hover:text-gray-900 transition px-2 py-1">
              Squads
            </Link>
            <Link href="/shelters" className="text-gray-600 hover:text-gray-900 transition px-2 py-1 hidden sm:block">
              Shelters
            </Link>
            {session ? (
              <Link
                href="/dashboard"
                className="bg-flash-400 text-gray-900 px-4 py-2 rounded-xl font-semibold hover:bg-flash-500 transition"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="bg-gray-900 text-white px-4 py-2 rounded-xl font-medium hover:bg-gray-800 transition"
              >
                Login
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            {/* Mascot */}
            <motion.img
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              src="https://petrescue.b-cdn.net/Logos%20(1).svg"
              alt="Surumaa"
              className="h-16 w-auto mx-auto mb-4"
            />

            {/* Live Alert */}
            {!loading && metrics.openCases > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-full text-sm mb-6"
              >
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                {metrics.openCases} pets need help right now
              </motion.div>
            )}

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 mb-4"
            >
              Your Neighborhood Searches{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">
                Together
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto"
            >
              When your pet goes missing, we mobilize GPS-tracked volunteers who coordinate in real-time to bring them home.
            </motion.p>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap justify-center gap-6 mb-10 text-gray-600"
            >
              {loading ? (
                <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Heart className="w-5 h-5 text-rose-500" />
                    <span className="font-bold text-gray-900">{metrics.petsReunited.toLocaleString()}</span> reunited
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-500" />
                    <span className="font-bold text-gray-900">{metrics.activeSquads}</span> rescue squads
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-500" />
                    <span className="font-bold text-gray-900">{metrics.totalVolunteers?.toLocaleString() || 0}</span> volunteers
                  </div>
                </>
              )}
            </motion.div>

            {/* Primary Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-6"
            >
              <Link
                href="/report/new"
                className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg shadow-red-200 hover:shadow-red-300 hover:scale-[1.02]"
              >
                <Bell className="w-5 h-5" />
                Report Lost Pet
              </Link>
              <Link
                href="/report/found"
                className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg shadow-emerald-200 hover:shadow-emerald-300 hover:scale-[1.02]"
              >
                <Heart className="w-5 h-5" />
                I Found a Pet
              </Link>
            </motion.div>

            {/* Secondary Links */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-wrap justify-center gap-6 text-gray-500"
            >
              <Link href="/database" className="inline-flex items-center gap-2 hover:text-gray-900 transition">
                <Search className="w-4 h-4" /> Search lost pets
              </Link>
              <Link href="/rescue-squads/search" className="inline-flex items-center gap-2 hover:text-gray-900 transition">
                <Shield className="w-4 h-4" /> Find your squad
              </Link>
              <Link href="/shelters" className="inline-flex items-center gap-2 hover:text-gray-900 transition">
                <Building2 className="w-4 h-4" /> Check shelters
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* What You Get - Show the Product */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Find Them
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Report once. We handle the rest.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Rescue Squads */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl p-6 border border-blue-200"
            >
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Rescue Squads</h3>
              <p className="text-gray-600 text-sm">
                Join your neighborhood squad or start one. Real volunteers ready to search when you need them.
              </p>
            </motion.div>

            {/* Auto Flyers */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-amber-50 to-orange-100 rounded-2xl p-6 border border-amber-200"
            >
              <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Auto-Generated Flyers</h3>
              <p className="text-gray-600 text-sm">
                Professional flyers created instantly from your report. Print, share, and post around town.
              </p>
            </motion.div>

            {/* Shelter Finder */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl p-6 border border-green-200"
            >
              <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center mb-4">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Nearby Shelters</h3>
              <p className="text-gray-600 text-sm">
                We find shelters near you automatically. Check if your pet was brought in. Get contact info instantly.
              </p>
            </motion.div>

            {/* Coordinated Search */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-br from-purple-50 to-violet-100 rounded-2xl p-6 border border-purple-200"
            >
              <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center mb-4">
                <Map className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Tracked Searches</h3>
              <p className="text-gray-600 text-sm">
                See who's searching where. GPS tracks coverage so no area gets missed. Everyone works together.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Find Your Squad */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Shield className="w-12 h-12 text-white/80 mx-auto mb-4" />
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Find Your Rescue Squad
            </h2>
            <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
              Join volunteers in your neighborhood. When a pet goes missing nearby, you'll be ready to help.
            </p>

            <form onSubmit={handleFindSquad} className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto mb-4">
              <div className="flex-1 relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  placeholder="Enter city or zip code"
                  className="w-full pl-12 pr-4 py-4 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="bg-amber-400 hover:bg-amber-300 text-gray-900 px-8 py-4 rounded-xl font-bold transition"
              >
                Find Squads
              </button>
            </form>

            <button
              onClick={handleUseLocation}
              disabled={locating}
              className="inline-flex items-center gap-2 text-white/80 hover:text-white transition text-sm"
            >
              <LocateFixed className={`w-4 h-4 ${locating ? 'animate-pulse' : ''}`} />
              {locating ? 'Finding your location...' : 'Use my current location'}
            </button>

            <p className="text-blue-200 text-sm mt-6">
              No squad nearby? <Link href="/rescue-squads/create" className="text-white underline hover:no-underline">Start one in your area</Link>
            </p>
          </motion.div>
        </div>
      </section>

      {/* Pets Needing Help */}
      {!loading && casesNeedingHelp.length > 0 && (
        <section className="py-16 bg-gradient-to-b from-white to-amber-50">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                  Help Them Get Home
                </h2>
                <p className="text-gray-600">Active searches happening now. Join one.</p>
              </div>
              <Link
                href="/database"
                className="hidden sm:inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 font-medium"
              >
                View all <ArrowRight className="w-4 h-4" />
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
                    className="block bg-white hover:bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden transition group shadow-sm hover:shadow-md"
                  >
                    <div className="relative h-40">
                      {pet.petPhotoUrl ? (
                        <img
                          src={pet.petPhotoUrl}
                          alt={pet.petName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-5xl">
                          {pet.petSpecies === 'DOG' ? '🐕' : '🐈'}
                        </div>
                      )}
                      <div className="absolute top-3 right-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${pet.hoursLost < 24 ? 'bg-red-500' : 'bg-orange-500'} text-white`}>
                          {pet.hoursLost < 24 ? `${pet.hoursLost}h` : `${Math.floor(pet.hoursLost / 24)}d`}
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="text-gray-900 font-bold text-lg mb-1">{pet.petName}</h3>
                      <p className="text-gray-500 text-sm flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {pet.city}, {pet.state}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How It Works */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              From Report to Reunion
            </h2>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { icon: Bell, title: 'Report', desc: '2 minutes to create your case', color: 'bg-red-500' },
              { icon: Radio, title: 'Alert', desc: 'Squad gets notified instantly', color: 'bg-amber-500' },
              { icon: Navigation, title: 'Search', desc: 'GPS-tracked volunteers mobilize', color: 'bg-blue-500' },
              { icon: Heart, title: 'Reunite', desc: 'Community brings them home', color: 'bg-green-500' },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className={`w-14 h-14 ${step.color} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                  <step.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{step.title}</h3>
                <p className="text-gray-600 text-sm">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Join CTA */}
      <section className="py-20 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Be Part of the Search
            </h2>
            <p className="text-white/90 text-lg mb-8 max-w-2xl mx-auto">
              Every reunion happens because someone chose to help. Join thousands who make a difference.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-gray-900 px-8 py-4 rounded-2xl font-bold text-lg transition shadow-lg"
              >
                Get Started <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/patrol/signup"
                className="inline-flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 text-white px-8 py-4 rounded-2xl font-bold text-lg transition backdrop-blur-sm"
              >
                <Shield className="w-5 h-5" /> Become a Volunteer
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <img src="https://petrescue.b-cdn.net/Logos.svg" alt="PetRecovery" className="h-8 w-auto" />
                <span className="font-bold">PetRecovery</span>
              </div>
              <p className="text-gray-400 text-sm max-w-sm">
                Coordinated pet search and rescue. GPS-tracked volunteers. Live sighting network.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Quick Links</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><Link href="/report/new" className="hover:text-white transition">Report Lost Pet</Link></li>
                <li><Link href="/report/found" className="hover:text-white transition">Report Found Pet</Link></li>
                <li><Link href="/database" className="hover:text-white transition">Search Database</Link></li>
                <li><Link href="/rescue-squads/search" className="hover:text-white transition">Find Squads</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">More</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><Link href="/shelters" className="hover:text-white transition">Shelters</Link></li>
                <li><Link href="/patrol/signup" className="hover:text-white transition">Volunteer</Link></li>
                <li><Link href="/about-surumaa" className="hover:text-white transition">About</Link></li>
                <li><Link href="/contact" className="hover:text-white transition">Contact</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
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
