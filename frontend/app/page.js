'use client';

/**
 * Homepage - Action First
 *
 * Direct. Clear. Get people to act, not scroll.
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import {
  Bell,
  Search,
  Heart,
  MapPin,
  Users,
  Shield,
  ArrowRight,
  Building2,
  Clock,
  CheckCircle,
} from 'lucide-react';

export default function Home() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    metrics: { petsReunited: 0, openCases: 0, activeSquads: 0, totalVolunteers: 0 },
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

  const { metrics, casesNeedingHelp } = data;

  return (
    <div className="min-h-screen bg-midnight-950">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-midnight-950/90 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="https://petrescue.b-cdn.net/Logos.svg" alt="PetRecovery" className="h-8 w-auto" />
            <span className="text-white font-bold hidden sm:inline">PetRecovery</span>
          </Link>

          <nav className="flex items-center gap-4 text-sm">
            <Link href="/database" className="text-white/70 hover:text-white transition">
              Search
            </Link>
            <Link href="/rescue-squads/search" className="text-white/70 hover:text-white transition">
              Squads
            </Link>
            <Link href="/shelters" className="text-white/70 hover:text-white transition">
              Shelters
            </Link>
            {session ? (
              <Link
                href="/dashboard"
                className="bg-flash-400 text-midnight-900 px-4 py-2 rounded-lg font-semibold hover:bg-flash-500 transition"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="text-white/70 hover:text-white transition"
              >
                Login
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero - Action First */}
      <main className="pt-20">
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left: Message + Actions */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Live stat */}
                {!loading && metrics.openCases > 0 && (
                  <div className="inline-flex items-center gap-2 bg-red-500/20 text-red-300 px-3 py-1 rounded-full text-sm mb-6">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    {metrics.openCases} pets need help right now
                  </div>
                )}

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-4 leading-tight">
                  Lost Pet?
                  <br />
                  <span className="text-flash-400">We mobilize searchers.</span>
                </h1>

                <p className="text-lg text-white/70 mb-8 max-w-md">
                  GPS-tracked volunteers. Real-time sightings. Coordinated search teams in your neighborhood.
                </p>

                {/* Primary Actions - Using Link styled as buttons */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  <Link
                    href="/report/new"
                    className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-4 rounded-xl font-bold text-lg transition shadow-lg shadow-red-600/30"
                  >
                    <Bell className="w-5 h-5" />
                    Report Lost Pet
                  </Link>
                  <Link
                    href="/report/found"
                    className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-4 rounded-xl font-bold text-lg transition"
                  >
                    <Heart className="w-5 h-5" />
                    I Found a Pet
                  </Link>
                </div>

                {/* Secondary Actions */}
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/database"
                    className="inline-flex items-center gap-2 text-white/70 hover:text-white transition text-sm"
                  >
                    <Search className="w-4 h-4" />
                    Search lost pets
                  </Link>
                  <span className="text-white/30">•</span>
                  <Link
                    href="/rescue-squads/search"
                    className="inline-flex items-center gap-2 text-white/70 hover:text-white transition text-sm"
                  >
                    <Shield className="w-4 h-4" />
                    Join a rescue squad
                  </Link>
                  <span className="text-white/30">•</span>
                  <Link
                    href="/shelters"
                    className="inline-flex items-center gap-2 text-white/70 hover:text-white transition text-sm"
                  >
                    <Building2 className="w-4 h-4" />
                    Check shelters
                  </Link>
                </div>
              </motion.div>
            </div>

            {/* Right: Active Cases */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-bold flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  Active Searches
                </h2>
                <Link href="/database" className="text-flash-400 text-sm hover:underline">
                  View all →
                </Link>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : casesNeedingHelp.length > 0 ? (
                <div className="space-y-3">
                  {casesNeedingHelp.slice(0, 4).map((pet) => (
                    <Link
                      key={pet.id}
                      href={`/cases/${pet.caseNumber}`}
                      className="flex items-center gap-3 bg-white/5 hover:bg-white/10 rounded-xl p-3 transition group"
                    >
                      <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-midnight-800">
                        {pet.petPhotoUrl ? (
                          <img src={pet.petPhotoUrl} alt={pet.petName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">
                            {pet.petSpecies === 'DOG' ? '🐕' : '🐈'}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold truncate">{pet.petName}</span>
                          <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">
                            {pet.hoursLost < 24 ? `${pet.hoursLost}h` : `${Math.floor(pet.hoursLost / 24)}d`}
                          </span>
                        </div>
                        <div className="text-white/50 text-sm flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {pet.city}, {pet.state}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-flash-400 transition" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-white/50">
                  No active cases right now
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* Quick Stats Bar */}
        {!loading && (
          <div className="border-t border-white/10 bg-white/5">
            <div className="max-w-6xl mx-auto px-4 py-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <div>
                  <div className="text-2xl md:text-3xl font-black text-white">{metrics.petsReunited.toLocaleString()}</div>
                  <div className="text-white/50 text-sm">Pets Reunited</div>
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-black text-white">{metrics.activeSquads}</div>
                  <div className="text-white/50 text-sm">Rescue Squads</div>
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-black text-white">{metrics.totalVolunteers?.toLocaleString() || '0'}</div>
                  <div className="text-white/50 text-sm">Volunteers</div>
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-black text-white">24/7</div>
                  <div className="text-white/50 text-sm">Coverage</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* How It Works - Compact */}
        <div className="bg-midnight-900 py-16">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-white text-center mb-10">How It Works</h2>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { icon: Bell, title: "Report", desc: "Add your pet's details in 2 minutes" },
                { icon: Users, title: "Mobilize", desc: "Local volunteers get notified" },
                { icon: MapPin, title: "Search", desc: "GPS-tracked coordinated search" },
                { icon: Heart, title: "Reunite", desc: "Community brings them home" },
              ].map((step, i) => (
                <div key={i} className="text-center">
                  <div className="w-12 h-12 bg-flash-400/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <step.icon className="w-6 h-6 text-flash-400" />
                  </div>
                  <div className="text-white font-semibold mb-1">{step.title}</div>
                  <div className="text-white/50 text-sm">{step.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-flash-500 to-amber-500 py-12">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-midnight-900 mb-4">
              Ready to help or need help?
            </h2>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 bg-midnight-900 hover:bg-midnight-800 text-white px-6 py-3 rounded-xl font-semibold transition"
              >
                Sign Up Free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/patrol/signup"
                className="inline-flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 text-midnight-900 px-6 py-3 rounded-xl font-semibold transition"
              >
                <Shield className="w-4 h-4" />
                Become a Volunteer
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer - Minimal */}
      <footer className="bg-midnight-950 border-t border-white/10 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="https://petrescue.b-cdn.net/Logos.svg" alt="PetRecovery" className="h-6 w-auto" />
              <span className="text-white/50 text-sm">© {new Date().getFullYear()} PetRecovery</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-white/50">
              <Link href="/about-surumaa" className="hover:text-white transition">About</Link>
              <Link href="/contact" className="hover:text-white transition">Contact</Link>
              <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
