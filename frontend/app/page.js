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
  CheckCircle,
  Eye,
} from 'lucide-react';
import { SARAMA_AVATAR, LOGO_PRIMARY, LOGO_ICON } from '@/lib/brandAssets';
import { useToast } from '@/app/components/ui/Toast';

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
  const toast = useToast();
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
          name: city.squad?.name || `${city.city} Rescue Force`,
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
      toast.error('Geolocation is not supported by your browser');
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
                  name: c.squad?.name || `${c.city} Rescue Force`,
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
              toast.error('Could not determine your location. Please enter a city or zip code.');
            }
          }
        } catch (e) {
          console.error(e);
          toast.error('Unable to get your location. Please enter a city or zip code.');
        } finally {
          setSearching(false);
          setLocating(false);
        }
      },
      (error) => {
        setLocating(false);
        toast.error('Unable to get your location. Please enter a city or zip code.');
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
          toast.error(data.error || 'Failed to create rescue force');
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to create rescue force');
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
        toast.error(data.error || 'Failed to join rescue force');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to join rescue force');
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
    <div className="min-h-screen bg-white">
      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => { setShowAuthModal(false); setSquadToJoin(null); }}
        squadToJoin={squadToJoin}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Reunion Ticker */}
      <ReunionTicker reunions={ticker} loading={loading} />


      {/* Hero */}
      <section className="py-16 md:py-24 relative overflow-hidden bg-gradient-to-b from-flash-50 via-white to-amber-50/30">
        {/* Warm decorative shapes */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-flash-300 to-amber-200 rounded-full blur-3xl opacity-40 -translate-y-1/3 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-flash-200 to-orange-100 rounded-full blur-3xl opacity-40 translate-y-1/3 -translate-x-1/4" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-amber-100 rounded-full blur-3xl opacity-30 -translate-x-1/2 -translate-y-1/2" />

        {/* Subtle paw prints decoration */}
        <svg className="absolute top-20 left-[10%] w-16 h-16 text-flash-300/20 transform -rotate-12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 6c-2.2 0-4 1.8-4 4h8c0-2.2-1.8-4-4-4z" />
        </svg>
        <svg className="absolute bottom-32 right-[15%] w-14 h-14 text-flash-300/20 transform rotate-12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 6c-2.2 0-4 1.8-4 4h8c0-2.2-1.8-4-4-4z" />
        </svg>
        <svg className="absolute top-1/3 right-[8%] w-12 h-12 text-amber-200/30 transform rotate-45" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 6c-2.2 0-4 1.8-4 4h8c0-2.2-1.8-4-4-4z" />
        </svg>

        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <div className="text-center mb-12">
            {/* Mascot - larger and more prominent */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", bounce: 0.4 }}
              className="mb-8"
            >
              <img
                src={LOGO_PRIMARY}
                alt="ReunitePets"
                className="h-56 md:h-72 w-auto mx-auto"
                style={{
                  filter: 'drop-shadow(0 20px 25px rgba(0, 0, 0, 0.25)) drop-shadow(0 8px 10px rgba(0, 0, 0, 0.15))'
                }}
              />
            </motion.div>

            {/* Live Alert - warmer styling */}
            {!loading && metrics.openCases > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 px-5 py-2.5 rounded-full text-sm mb-6 border border-amber-200/50 shadow-sm"
              >
                <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
                <span className="font-medium">{metrics.openCases} pets waiting to come home</span>
                <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />
              </motion.div>
            )}

            {/* Headline - warmer, more emotional */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl lg:text-6xl font-black text-midnight-900 mb-5 leading-tight"
            >
              Every Lost Pet Deserves{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-flash-500 via-amber-500 to-orange-400">
                A Search Party
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl md:text-2xl text-midnight-600 mb-8 max-w-2xl mx-auto leading-relaxed"
            >
              When your furry family member goes missing, your neighbors rally together to bring them home. <span className="text-amber-600 font-medium">That's the power of community.</span>
            </motion.p>

            {/* Stats - warmer presentation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap justify-center gap-8 mb-12"
            >
              {loading ? (
                <div className="h-8 w-48 bg-flash-100 rounded-full animate-pulse" />
              ) : (
                <>
                  <div className="flex items-center gap-2 bg-rose-50 px-4 py-2 rounded-full">
                    <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
                    <span className="font-bold text-midnight-900">{metrics.petsReunited.toLocaleString()}</span>
                    <span className="text-midnight-600">happy reunions</span>
                  </div>
                  <div className="flex items-center gap-2 bg-flash-100 px-4 py-2 rounded-full">
                    <Shield className="w-5 h-5 text-flash-600" />
                    <span className="font-bold text-midnight-900">{metrics.activeSquads}</span>
                    <span className="text-midnight-600">neighborhood rescue forces</span>
                  </div>
                  <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-full">
                    <Users className="w-5 h-5 text-amber-600" />
                    <span className="font-bold text-midnight-900">{metrics.totalVolunteers?.toLocaleString() || 0}</span>
                    <span className="text-midnight-600">caring neighbors</span>
                  </div>
                </>
              )}
            </motion.div>

            {/* Primary Actions - warmer, more inviting */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-8"
            >
              <Link
                href="/report/new"
                className="group inline-flex items-center justify-center gap-3 bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-400 hover:to-red-400 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg shadow-rose-200 hover:shadow-rose-300 hover:scale-[1.02]"
              >
                <Bell className="w-5 h-5" />
                My Pet is Lost
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/report/found"
                className="group inline-flex items-center justify-center gap-3 bg-gradient-to-r from-flash-400 to-amber-400 hover:from-flash-300 hover:to-amber-300 text-midnight-900 px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg shadow-flash-200 hover:shadow-flash-300 hover:scale-[1.02]"
              >
                <Heart className="w-5 h-5" />
                I Found a Pet
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
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
                <Shield className="w-4 h-4" /> Find your rescue force
              </Link>
              <Link href="/shelters" className="inline-flex items-center gap-2 hover:text-gray-900 transition">
                <Building2 className="w-4 h-4" /> Check shelters
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Live Search Preview */}
      <section className="py-16 bg-gradient-to-b from-amber-50/50 to-white relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <span className="inline-block bg-rose-100 text-rose-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              Coordinated Search & Rescue
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-midnight-900 mb-3">
              See Your Community in Action
            </h2>
            <p className="text-midnight-600 max-w-2xl mx-auto">
              When a pet goes missing, the entire neighborhood mobilizes. Here's what coordinated search looks like.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-flash-100 relative overflow-hidden"
          >
            <div className="grid md:grid-cols-2 gap-6">
              {/* Mini Map Preview */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-5 relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                      <Map className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-bold text-midnight-900">Live Search Map</span>
                  </div>
                  <span className="text-xs bg-emerald-500 text-white px-2 py-1 rounded-full animate-pulse">LIVE</span>
                </div>

                {/* Simulated map with search areas */}
                <div className="relative h-48 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl overflow-hidden">
                  {/* Grid lines */}
                  <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                  {/* Search areas - colored zones */}
                  <div className="absolute top-4 left-4 w-16 h-14 bg-emerald-400/40 rounded-lg border-2 border-emerald-500 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="absolute top-4 left-24 w-14 h-16 bg-emerald-400/40 rounded-lg border-2 border-emerald-500 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="absolute top-6 right-8 w-20 h-12 bg-amber-400/40 rounded-lg border-2 border-amber-500 border-dashed flex items-center justify-center">
                    <Users className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="absolute bottom-8 left-8 w-18 h-14 bg-blue-400/30 rounded-lg border-2 border-blue-400 border-dashed" />
                  <div className="absolute bottom-4 right-4 w-16 h-16 bg-rose-400/30 rounded-lg border-2 border-rose-400" />

                  {/* Pet last seen marker */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="relative">
                      <div className="w-10 h-10 bg-rose-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-midnight-900 text-white text-xs px-2 py-0.5 rounded">
                        Last seen
                      </div>
                    </div>
                  </div>

                  {/* Volunteer markers */}
                  <div className="absolute top-8 left-10 w-6 h-6 bg-flash-400 rounded-full border-2 border-white shadow flex items-center justify-center text-xs font-bold text-midnight-900">M</div>
                  <div className="absolute top-10 right-16 w-6 h-6 bg-flash-400 rounded-full border-2 border-white shadow flex items-center justify-center text-xs font-bold text-midnight-900">J</div>
                  <div className="absolute bottom-12 left-20 w-6 h-6 bg-flash-400 rounded-full border-2 border-white shadow flex items-center justify-center text-xs font-bold text-midnight-900">S</div>
                </div>

                {/* Map legend */}
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-midnight-600">
                  <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-400 rounded" /> Searched</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-400 rounded" /> In Progress</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-400 rounded" /> Assigned</div>
                </div>
              </div>

              {/* Live Activity Feed */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-midnight-900 rounded-lg flex items-center justify-center">
                    <Bell className="w-4 h-4 text-flash-400" />
                  </div>
                  <span className="font-bold text-midnight-900">Live Activity</span>
                </div>

                <div className="space-y-3">
                  {/* Activity items */}
                  <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-midnight-900 text-sm">Maria completed Oak Street sector</p>
                      <p className="text-xs text-midnight-500">2 min ago - 0.3 acres searched</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Eye className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-midnight-900 text-sm">Possible sighting reported!</p>
                      <p className="text-xs text-midnight-500">5 min ago - Near Elm Park</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <UserPlus className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-midnight-900 text-sm">James joined the search</p>
                      <p className="text-xs text-midnight-500">8 min ago - 12 searchers now active</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-flash-50 rounded-xl border border-flash-100">
                    <div className="w-8 h-8 bg-flash-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Map className="w-4 h-4 text-midnight-900" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-midnight-900 text-sm">Search radius expanded</p>
                      <p className="text-xs text-midnight-500">12 min ago - Now covering 2 miles</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom stats bar */}
            <div className="mt-6 pt-6 border-t border-flash-100 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-midnight-900">12</p>
                <p className="text-sm text-midnight-500">Active Searchers</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">4.2 mi</p>
                <p className="text-sm text-midnight-500">Area Covered</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">47 min</p>
                <p className="text-sm text-midnight-500">Search Duration</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* What You Get - Warmer Design */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <span className="inline-block bg-flash-100 text-flash-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
                How We Help
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-midnight-900 mb-4">
                Everything to Bring Them Home
              </h2>
              <p className="text-midnight-600 max-w-2xl mx-auto text-lg">
                Report once. Your community does the rest.
              </p>
            </motion.div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Rescue Squads - Krishna Blue */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-midnight-800 to-midnight-900 rounded-3xl p-6 text-white relative overflow-hidden group hover:scale-[1.02] transition-transform"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-flash-400/10 rounded-full blur-2xl" />
              <div className="w-14 h-14 bg-flash-400 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                <Shield className="w-7 h-7 text-midnight-900" />
              </div>
              <h3 className="text-xl font-bold mb-2">Rescue Forces</h3>
              <p className="text-midnight-200 text-sm leading-relaxed">
                Your neighbors are ready to help. Join your local rescue force or rally a new one.
              </p>
            </motion.div>

            {/* Auto Flyers - Vibrant Yellow */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-flash-300 to-flash-400 rounded-3xl p-6 relative overflow-hidden group hover:scale-[1.02] transition-transform"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-2xl" />
              <div className="w-14 h-14 bg-midnight-900 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                <FileText className="w-7 h-7 text-flash-400" />
              </div>
              <h3 className="text-xl font-bold text-midnight-900 mb-2">Instant Flyers</h3>
              <p className="text-midnight-700 text-sm leading-relaxed">
                Beautiful lost pet flyers created in seconds. Print, share, post everywhere.
              </p>
            </motion.div>

            {/* Shelter Finder */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl p-6 text-white relative overflow-hidden group hover:scale-[1.02] transition-transform"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                <Building2 className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">Shelter Alerts</h3>
              <p className="text-emerald-100 text-sm leading-relaxed">
                We check nearby shelters for you. Get notified if your pet is found.
              </p>
            </motion.div>

            {/* Coordinated Search */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-br from-rose-400 to-rose-500 rounded-3xl p-6 text-white relative overflow-hidden group hover:scale-[1.02] transition-transform"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                <Map className="w-7 h-7 text-rose-500" />
              </div>
              <h3 className="text-xl font-bold mb-2">Live Search Map</h3>
              <p className="text-rose-100 text-sm leading-relaxed">
                See searches in real-time. Every street covered. No area missed.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Find Your Squad - Midnight Starry Sky Section */}
      <section className="py-20 bg-gradient-to-b from-[#0a1628] via-[#0f1d32] to-[#162544] overflow-hidden relative">
        {/* Starry sky background */}
        <div className="absolute inset-0">
          {/* Distant nebula glow */}
          <div className="absolute top-0 left-1/3 w-[500px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-purple-600/8 rounded-full blur-[80px]" />
          <div className="absolute top-1/2 left-10 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[60px]" />

          {/* Bright stars */}
          <div className="absolute top-[10%] left-[15%] w-1 h-1 bg-white rounded-full shadow-[0_0_6px_2px_rgba(255,255,255,0.6)]" />
          <div className="absolute top-[20%] right-[25%] w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_3px_rgba(255,255,255,0.7)]" />
          <div className="absolute top-[15%] right-[10%] w-1 h-1 bg-blue-200 rounded-full shadow-[0_0_6px_2px_rgba(191,219,254,0.6)]" />
          <div className="absolute bottom-[30%] left-[8%] w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_3px_rgba(255,255,255,0.5)]" />
          <div className="absolute bottom-[20%] right-[15%] w-1 h-1 bg-amber-100 rounded-full shadow-[0_0_6px_2px_rgba(254,243,199,0.5)]" />
          <div className="absolute top-[40%] left-[25%] w-0.5 h-0.5 bg-white rounded-full shadow-[0_0_4px_1px_rgba(255,255,255,0.4)]" />
          <div className="absolute top-[60%] right-[35%] w-1 h-1 bg-white rounded-full shadow-[0_0_6px_2px_rgba(255,255,255,0.5)]" />
          <div className="absolute top-[25%] left-[45%] w-0.5 h-0.5 bg-blue-100 rounded-full shadow-[0_0_4px_1px_rgba(219,234,254,0.4)]" />
          <div className="absolute bottom-[40%] left-[35%] w-1 h-1 bg-white rounded-full shadow-[0_0_6px_2px_rgba(255,255,255,0.5)]" />
          <div className="absolute top-[50%] right-[8%] w-1.5 h-1.5 bg-amber-200 rounded-full shadow-[0_0_8px_3px_rgba(253,230,138,0.4)]" />
          <div className="absolute bottom-[15%] left-[50%] w-0.5 h-0.5 bg-white rounded-full shadow-[0_0_4px_1px_rgba(255,255,255,0.3)]" />
          <div className="absolute top-[8%] left-[60%] w-1 h-1 bg-white rounded-full shadow-[0_0_6px_2px_rgba(255,255,255,0.6)]" />
          <div className="absolute bottom-[25%] right-[45%] w-0.5 h-0.5 bg-blue-200 rounded-full shadow-[0_0_4px_1px_rgba(191,219,254,0.4)]" />
          <div className="absolute top-[35%] right-[18%] w-1 h-1 bg-white rounded-full shadow-[0_0_6px_2px_rgba(255,255,255,0.5)]" />
          <div className="absolute bottom-[45%] left-[18%] w-0.5 h-0.5 bg-white rounded-full shadow-[0_0_4px_1px_rgba(255,255,255,0.3)]" />

          {/* Featured bright star with cross-glow */}
          <div className="absolute top-[12%] right-[40%]">
            <div className="w-2 h-2 bg-white rounded-full shadow-[0_0_10px_4px_rgba(255,255,255,0.8)]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-0.5 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-6 bg-gradient-to-b from-transparent via-white/60 to-transparent" />
          </div>
        </div>

        {/* Subtle star dust overlay */}
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(1px 1px at 20px 30px, white, transparent), radial-gradient(1px 1px at 40px 70px, rgba(255,255,255,0.5), transparent), radial-gradient(1px 1px at 50px 160px, white, transparent), radial-gradient(1px 1px at 90px 40px, rgba(255,255,255,0.7), transparent), radial-gradient(1px 1px at 130px 80px, white, transparent), radial-gradient(1px 1px at 160px 120px, rgba(255,255,255,0.5), transparent)', backgroundSize: '200px 200px' }} />

        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 bg-flash-400/20 backdrop-blur-sm px-5 py-2.5 rounded-full text-flash-300 text-sm mb-6 border border-flash-400/30">
                <Users className="w-4 h-4" />
                <span className="font-medium">{metrics.totalVolunteers?.toLocaleString() || 0} neighbors ready to help</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-5">
                Your Community is{' '}
                <span className="text-flash-400">Ready</span>
              </h2>
              <p className="text-midnight-200 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                Real neighbors. Real care. When a pet goes missing, your local Rescue Force mobilizes to help.
              </p>
            </motion.div>
          </div>

          {/* Squads Grid - Shows search results or featured squads */}
          {(searching || displaySquads.length > 0) && (
            <div className="mb-10">
              {/* Results header */}
              {searchResults && (
                <div className="flex items-center justify-between mb-4">
                  <p className="text-midnight-200">
                    {searchResults.length === 0 ? (
                      'No rescue forces found in this area'
                    ) : (
                      <>Found <span className="font-bold text-flash-400">{searchResults.length}</span> rescue forces near you</>
                    )}
                  </p>
                  <button
                    onClick={() => { setSearchResults(null); setLocationQuery(''); }}
                    className="text-midnight-300 hover:text-white text-sm transition"
                  >
                    Clear search
                  </button>
                </div>
              )}

              {searching ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-flash-400 animate-spin" />
                  <span className="ml-3 text-white">Finding your neighbors...</span>
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
                      whileHover={{ scale: 1.02, y: -2 }}
                      className={`backdrop-blur-sm border rounded-2xl p-5 transition-all ${squad.exists
                        ? 'bg-midnight-700/50 border-midnight-600 hover:border-flash-400/50 hover:bg-midnight-700/70'
                        : 'bg-flash-400/10 border-flash-400/30 hover:bg-flash-400/20'
                        }`}
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${squad.exists
                          ? 'bg-gradient-to-br from-flash-400 to-amber-500'
                          : 'bg-gradient-to-br from-emerald-400 to-green-500'
                          }`}>
                          {squad.logoUrl ? (
                            <img src={squad.logoUrl} alt={squad.name} className="w-14 h-14 rounded-2xl object-cover" />
                          ) : squad.exists ? (
                            <Shield className="w-7 h-7 text-midnight-900" />
                          ) : (
                            <UserPlus className="w-7 h-7 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-bold truncate text-lg">
                            {squad.exists ? squad.name : `${squad.city} Rescue Force`}
                          </h3>
                          <p className="text-midnight-300 text-sm flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {squad.city}, {squad.state}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        {squad.exists ? (
                          <>
                            <div className="text-midnight-300 text-sm">
                              <span className="text-flash-400 font-bold">{squad.memberCount || 0}</span> neighbors
                            </div>
                            <button
                              onClick={() => handleJoinSquad(squad)}
                              disabled={joiningSquad === squad.id}
                              className="bg-flash-400 hover:bg-flash-300 text-midnight-900 px-5 py-2.5 rounded-xl font-bold text-sm transition flex items-center gap-2 shadow-lg shadow-flash-400/20"
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
                            <div className="text-flash-300 text-sm font-medium">
                              Be the founder!
                            </div>
                            <button
                              onClick={() => handleCreateSquad(squad)}
                              disabled={creatingSquad === `${squad.city}-${squad.state}`}
                              className="bg-emerald-500 hover:bg-emerald-400 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition flex items-center gap-2 shadow-lg"
                            >
                              {creatingSquad === `${squad.city}-${squad.state}` ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Shield className="w-4 h-4" />
                                  Start Rescue Force
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
                  <p className="text-midnight-300 mb-4">No rescue forces in this area yet - be the first!</p>
                  <Link
                    href="/rescue-squads/create"
                    className="inline-flex items-center gap-2 bg-flash-400 hover:bg-flash-300 text-midnight-900 px-6 py-3 rounded-xl font-bold transition shadow-lg"
                  >
                    <Shield className="w-5 h-5" />
                    Start the First Rescue Force
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
            className="bg-midnight-700/50 backdrop-blur-sm border border-midnight-600 rounded-3xl p-6 md:p-8 max-w-2xl mx-auto"
          >
            <h3 className="text-white font-bold text-xl mb-2 text-center">Find Your Local Rescue Force</h3>
            <p className="text-midnight-300 text-center mb-6">Enter your location to find neighbors ready to help</p>
            <form id="squad-search-form" onSubmit={handleFindSquad} className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1 relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400 pointer-events-none z-10" />
                <input
                  type="text"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  onFocus={() => citySuggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="City or zip code..."
                  className="w-full pr-4 py-4 rounded-xl bg-white text-midnight-900 placeholder-midnight-400 focus:ring-2 focus:ring-flash-400 focus:outline-none shadow-lg"
                  style={{ paddingLeft: '3rem' }}
                  autoComplete="off"
                />
                {/* Autocomplete dropdown */}
                {showSuggestions && citySuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-flash-200 overflow-hidden z-50">
                    {citySuggestions.map((suggestion, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelectSuggestion(suggestion)}
                        className="w-full px-4 py-3 text-left hover:bg-flash-50 flex items-center gap-3 border-b border-midnight-100 last:border-0"
                      >
                        <MapPin className="w-4 h-4 text-flash-500" />
                        <span className="text-midnight-900">{suggestion.city}, {suggestion.state}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={searching}
                className="bg-flash-400 hover:bg-flash-300 text-midnight-900 px-6 py-4 rounded-xl font-bold transition flex items-center justify-center gap-2 disabled:opacity-70 shadow-lg shadow-flash-400/20"
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
                className="inline-flex items-center gap-2 text-midnight-200 hover:text-white transition bg-midnight-600/50 px-4 py-2 rounded-full hover:bg-midnight-600"
              >
                <LocateFixed className={`w-4 h-4 ${locating ? 'animate-spin' : ''}`} />
                {locating ? 'Locating...' : 'Use my location'}
              </button>
              <span className="text-midnight-500 hidden sm:block">or</span>
              <Link
                href="/rescue-squads/create"
                className="inline-flex items-center gap-2 text-flash-400 hover:text-flash-300 transition font-medium"
              >
                <Shield className="w-4 h-4" />
                Start a new rescue force
              </Link>
            </div>
          </motion.div>

          {/* Stats row - warmer */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap justify-center gap-10 mt-12 text-center"
          >
            <div className="bg-midnight-700/30 px-6 py-4 rounded-2xl">
              <div className="text-3xl font-bold text-flash-400">{metrics.activeSquads}</div>
              <div className="text-midnight-300 text-sm">Active Rescue Forces</div>
            </div>
            <div className="bg-midnight-700/30 px-6 py-4 rounded-2xl">
              <div className="text-3xl font-bold text-flash-400">{metrics.citiesCovered || 0}</div>
              <div className="text-midnight-300 text-sm">Cities Covered</div>
            </div>
            <div className="bg-midnight-700/30 px-6 py-4 rounded-2xl">
              <div className="text-3xl font-bold text-flash-400">{metrics.weeklyReunions || 0}</div>
              <div className="text-midnight-300 text-sm">Reunions This Week</div>
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
                        <div className="w-full h-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                          <Search className="w-12 h-12 text-amber-400" />
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
              { icon: Radio, title: 'Alert', desc: 'Rescue Force gets notified instantly', color: 'bg-amber-500' },
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
                <img src={SARAMA_AVATAR} alt="ReunitePets" className="h-14 w-auto" />
                <span className="font-bold">Reunite<span className="text-amber-400">Pets</span></span>
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
                <li><Link href="/rescue-squads/search" className="hover:text-white transition">Find Rescue Forces</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">More</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><Link href="/shelters" className="hover:text-white transition">Shelters</Link></li>
                <li><Link href="/patrol/signup" className="hover:text-white transition">Volunteer</Link></li>
                <li><Link href="/about-sarama" className="hover:text-white transition">About Sarama</Link></li>
                <li><Link href="/contact" className="hover:text-white transition">Contact</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <p>© {new Date().getFullYear()} ReunitePets.org</p>
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
