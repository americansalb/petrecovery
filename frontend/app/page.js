'use client';

/**
 * Homepage - Hopeful, Shows Capabilities, Action-Oriented
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
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
  Map,
  Radio,
  FileText,
  LocateFixed,
  X,
  Mail,
  Lock,
  UserPlus,
  Loader2,
} from 'lucide-react';

// Auth Modal Component
const AuthModal = ({ isOpen, onClose, squadToJoin, onAuthSuccess }) => {
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        // Register first
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            firstName: formData.firstName,
            acceptedTerms: true,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Registration failed');
          setLoading(false);
          return;
        }
      }

      // Sign in
      const result = await signIn('credentials', {
        redirect: false,
        email: formData.email,
        password: formData.password,
      });

      if (result?.error) {
        setError(mode === 'login' ? 'Invalid email or password' : 'Account created but login failed');
        setLoading(false);
        return;
      }

      // Success - trigger callback
      onAuthSuccess();
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 z-10"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {mode === 'login' ? 'Sign In to Join' : 'Create Account to Join'}
          </h2>
          {squadToJoin && (
            <p className="text-gray-600">
              Join <span className="font-semibold text-blue-600">{squadToJoin.name}</span>
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="Jane"
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition"
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="you@example.com"
                required
                className="w-full pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition"
                style={{ paddingLeft: '3rem' }}
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10" />
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                required
                minLength={mode === 'register' ? 8 : undefined}
                className="w-full pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition"
                style={{ paddingLeft: '3rem' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-4 rounded-xl font-bold transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : mode === 'login' ? (
              <>Sign In & Join</>
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                Create Account & Join
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6 pt-6 border-t border-gray-100">
          {mode === 'login' ? (
            <p className="text-gray-600">
              Don't have an account?{' '}
              <button
                onClick={() => setMode('register')}
                className="text-blue-600 font-semibold hover:underline"
              >
                Create one
              </button>
            </p>
          ) : (
            <p className="text-gray-600">
              Already have an account?{' '}
              <button
                onClick={() => setMode('login')}
                className="text-blue-600 font-semibold hover:underline"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};

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
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [locationQuery, setLocationQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [squadToJoin, setSquadToJoin] = useState(null);
  const [joiningSquad, setJoiningSquad] = useState(null);
  const [creatingSquad, setCreatingSquad] = useState(null);
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [data, setData] = useState({
    metrics: { petsReunited: 0, openCases: 0, activeSquads: 0, totalVolunteers: 0, weeklyReunions: 0 },
    ticker: [],
    casesNeedingHelp: [],
    featuredSquads: [],
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

  // Debounced city autocomplete
  useEffect(() => {
    if (locationQuery.length < 2) {
      setCitySuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cities/suggest?q=${encodeURIComponent(locationQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setCitySuggestions((data.suggestions || []).slice(0, 5));
          setShowSuggestions(true);
        }
      } catch (e) {
        console.error(e);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [locationQuery]);

  // Search for squads inline - include ALL cities
  const handleFindSquad = async (e) => {
    e.preventDefault();
    if (!locationQuery.trim()) return;
    setShowSuggestions(false);

    setSearching(true);
    try {
      const res = await fetch(`/api/rescue-squads?search=${encodeURIComponent(locationQuery.trim())}`);
      if (res.ok) {
        const data = await res.json();
        // Include ALL cities - both with and without squads
        const results = (data.cities || []).map(city => ({
          id: city.squad?.id || `new-${city.city}-${city.state}`,
          name: city.squad?.name || `${city.city} Rescue Squad`,
          city: city.city,
          state: city.state,
          memberCount: city.squad?.memberCount || 0,
          distance: city.distance,
          exists: city.exists,
          logoUrl: city.squad?.logoUrl || null,
        }));
        setSearchResults(results);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSuggestion = (suggestion) => {
    setLocationQuery(suggestion.city);
    setShowSuggestions(false);
    // Trigger search
    setTimeout(() => {
      const form = document.getElementById('squad-search-form');
      if (form) form.dispatchEvent(new Event('submit', { bubbles: true }));
    }, 100);
  };

  const handleUseLocation = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setSearching(true);
        try {
          // Reverse geocode to get ZIP code using Nominatim
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'User-Agent': 'PetRecovery/1.0' } }
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            const zipCode = geoData.address?.postcode;
            const city = geoData.address?.city || geoData.address?.town || geoData.address?.village;

            if (zipCode || city) {
              const searchTerm = zipCode || city;
              setLocationQuery(searchTerm);
              const res = await fetch(`/api/rescue-squads?search=${encodeURIComponent(searchTerm)}`);
              if (res.ok) {
                const data = await res.json();
                const results = (data.cities || []).map(c => ({
                  id: c.squad?.id || `new-${c.city}-${c.state}`,
                  name: c.squad?.name || `${c.city} Rescue Squad`,
                  city: c.city,
                  state: c.state,
                  memberCount: c.squad?.memberCount || 0,
                  distance: c.distance,
                  exists: c.exists,
                  logoUrl: c.squad?.logoUrl || null,
                }));
                setSearchResults(results);
              }
            } else {
              alert('Could not determine your location. Please enter a city or zip code.');
            }
          }
        } catch (e) {
          console.error(e);
          alert('Unable to get your location. Please enter a city or zip code.');
        } finally {
          setSearching(false);
          setLocating(false);
        }
      },
      (error) => {
        setLocating(false);
        alert('Unable to get your location. Please enter a city or zip code.');
      }
    );
  };

  // Handle joining a squad
  const handleJoinSquad = async (squad) => {
    if (!session) {
      // Not logged in - show auth modal
      setSquadToJoin(squad);
      setShowAuthModal(true);
      return;
    }

    // Already logged in - join directly
    await joinSquadDirectly(squad);
  };

  // Handle creating a new squad
  const handleCreateSquad = async (cityData) => {
    if (!session) {
      // Not logged in - show auth modal with city to create
      setSquadToJoin({ ...cityData, isNew: true });
      setShowAuthModal(true);
      return;
    }

    await createSquadDirectly(cityData);
  };

  const createSquadDirectly = async (cityData) => {
    setCreatingSquad(`${cityData.city}-${cityData.state}`);
    try {
      const res = await fetch('/api/rescue-squads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: cityData.city,
          state: cityData.state,
          zipCode: cityData.zipCode || locationQuery,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/rescue-squads/${data.squad.id}?created=true`);
      } else {
        const data = await res.json();
        if (data.code === 'WAIVER_NOT_ACCEPTED') {
          router.push(data.redirectTo);
        } else {
          alert(data.error || 'Failed to create squad');
        }
      }
    } catch (e) {
      console.error(e);
      alert('Failed to create squad');
    } finally {
      setCreatingSquad(null);
    }
  };

  const joinSquadDirectly = async (squad) => {
    setJoiningSquad(squad.id);
    try {
      const res = await fetch(`/api/rescue-squads/${squad.id}/join`, {
        method: 'POST',
      });

      if (res.ok) {
        // Redirect to the squad page
        router.push(`/rescue-squads/${squad.id}?joined=true`);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to join squad');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to join squad');
    } finally {
      setJoiningSquad(null);
    }
  };

  const handleAuthSuccess = async () => {
    setShowAuthModal(false);
    await updateSession();
    if (squadToJoin) {
      if (squadToJoin.isNew) {
        await createSquadDirectly(squadToJoin);
      } else {
        await joinSquadDirectly(squadToJoin);
      }
    }
  };

  const { metrics, ticker, casesNeedingHelp, featuredSquads } = data;

  // Display squads - either search results or featured
  const displaySquads = searchResults || featuredSquads;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-blue-50">
      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => { setShowAuthModal(false); setSquadToJoin(null); }}
        squadToJoin={squadToJoin}
        onAuthSuccess={handleAuthSuccess}
      />

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

      {/* Find Your Squad - Dynamic Community Section */}
      <section className="py-16 bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 overflow-hidden relative">
        {/* Animated background elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-10 left-10 w-32 h-32 bg-yellow-300 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-10 right-10 w-40 h-40 bg-amber-300 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-yellow-200 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <div className="text-center mb-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-yellow-200 text-sm mb-6 border border-white/30">
                <Users className="w-4 h-4" />
                <span>{metrics.totalVolunteers?.toLocaleString() || 0} volunteers ready to help</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Your Neighborhood Has a Rescue Squad
              </h2>
              <p className="text-blue-100 text-lg max-w-2xl mx-auto">
                Real volunteers. Real communities. Ready to mobilize the moment a pet goes missing.
              </p>
            </motion.div>
          </div>

          {/* Squads Grid - Shows search results or featured squads */}
          {(searching || displaySquads.length > 0) && (
            <div className="mb-10">
              {/* Results header */}
              {searchResults && (
                <div className="flex items-center justify-between mb-4">
                  <p className="text-white/90">
                    {searchResults.length === 0 ? (
                      'No squads found in this area'
                    ) : (
                      <>Found <span className="font-bold text-yellow-300">{searchResults.length}</span> squads</>
                    )}
                  </p>
                  <button
                    onClick={() => { setSearchResults(null); setLocationQuery(''); }}
                    className="text-blue-200 hover:text-white text-sm transition"
                  >
                    Clear search
                  </button>
                </div>
              )}

              {searching ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                  <span className="ml-3 text-white">Searching nearby squads...</span>
                </div>
              ) : displaySquads.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  {displaySquads.slice(0, 6).map((squad, i) => (
                    <motion.div
                      key={squad.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      whileHover={{ scale: 1.02 }}
                      className={`backdrop-blur-sm border rounded-2xl p-4 transition ${
                        squad.exists
                          ? 'bg-white/10 border-white/20 hover:bg-white/20'
                          : 'bg-yellow-400/20 border-yellow-300/30 hover:bg-yellow-400/30'
                      }`}
                    >
                      <div className="flex items-center gap-4 mb-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${
                          squad.exists
                            ? 'bg-gradient-to-br from-yellow-400 to-amber-500'
                            : 'bg-gradient-to-br from-green-400 to-emerald-500'
                        }`}>
                          {squad.logoUrl ? (
                            <img src={squad.logoUrl} alt={squad.name} className="w-12 h-12 rounded-xl object-cover" />
                          ) : squad.exists ? (
                            <Shield className="w-6 h-6 text-gray-900" />
                          ) : (
                            <UserPlus className="w-6 h-6 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-bold truncate">
                            {squad.exists ? squad.name : `${squad.city} Rescue Squad`}
                          </h3>
                          <p className="text-blue-200 text-sm flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {squad.city}, {squad.state}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        {squad.exists ? (
                          <>
                            <div className="text-blue-200 text-sm">
                              <span className="text-yellow-300 font-bold">{squad.memberCount || 0}</span> members
                            </div>
                            <button
                              onClick={() => handleJoinSquad(squad)}
                              disabled={joiningSquad === squad.id}
                              className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 px-4 py-2 rounded-lg font-bold text-sm transition flex items-center gap-1"
                            >
                              {joiningSquad === squad.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <UserPlus className="w-4 h-4" />
                                  Join
                                </>
                              )}
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="text-yellow-200 text-sm">
                              Be the first!
                            </div>
                            <button
                              onClick={() => handleCreateSquad(squad)}
                              disabled={creatingSquad === `${squad.city}-${squad.state}`}
                              className="bg-green-500 hover:bg-green-400 text-white px-4 py-2 rounded-lg font-bold text-sm transition flex items-center gap-1"
                            >
                              {creatingSquad === `${squad.city}-${squad.state}` ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Shield className="w-4 h-4" />
                                  Create
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : searchResults && searchResults.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-blue-200 mb-4">No squads found in this area yet.</p>
                  <Link
                    href="/rescue-squads/create"
                    className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-gray-900 px-6 py-3 rounded-xl font-bold transition"
                  >
                    <Shield className="w-5 h-5" />
                    Start the First Squad Here
                  </Link>
                </div>
              ) : null}
            </div>
          )}

          {/* Search Your Area */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-6 md:p-8 max-w-2xl mx-auto"
          >
            <h3 className="text-white font-bold text-xl mb-4 text-center">Find Squads Near You</h3>
            <form id="squad-search-form" onSubmit={handleFindSquad} className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1 relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10" />
                <input
                  type="text"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  onFocus={() => citySuggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="City or zip code..."
                  className="w-full pr-4 py-4 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  style={{ paddingLeft: '3rem' }}
                  autoComplete="off"
                />
                {/* Autocomplete dropdown */}
                {showSuggestions && citySuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
                    {citySuggestions.map((suggestion, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelectSuggestion(suggestion)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100 last:border-0"
                      >
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900">{suggestion.city}, {suggestion.state}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={searching}
                className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 px-6 py-4 rounded-xl font-bold transition flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {searching ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Search className="w-5 h-5" />
                )}
                {searching ? 'Searching...' : 'Search'}
              </button>
            </form>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm">
              <button
                onClick={handleUseLocation}
                disabled={locating}
                className="inline-flex items-center gap-2 text-white/90 hover:text-white transition bg-white/10 px-4 py-2 rounded-full hover:bg-white/20"
              >
                <LocateFixed className={`w-4 h-4 ${locating ? 'animate-spin' : ''}`} />
                {locating ? 'Locating...' : 'Use my location'}
              </button>
              <span className="text-blue-200 hidden sm:block">or</span>
              <Link
                href="/rescue-squads/create"
                className="inline-flex items-center gap-2 text-yellow-300 hover:text-yellow-200 transition"
              >
                <Shield className="w-4 h-4" />
                Start a squad in your area
              </Link>
            </div>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap justify-center gap-8 mt-10 text-center"
          >
            <div>
              <div className="text-3xl font-bold text-white">{metrics.activeSquads}</div>
              <div className="text-blue-200 text-sm">Active Squads</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">{metrics.citiesCovered || 0}</div>
              <div className="text-blue-200 text-sm">Cities Covered</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">{metrics.weeklyReunions || 0}</div>
              <div className="text-blue-200 text-sm">Reunions This Week</div>
            </div>
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
