'use client';

/**
 * My Squads Page
 *
 * Shows all rescue squads the user is a member of
 * Quick access to squad hubs from the main navigation
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import UnifiedNav from '@/app/components/UnifiedNav';

export default function MySquadsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [squads, setSquads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/rescue-squads/my');
    }
  }, [status, router]);

  useEffect(() => {
    async function fetchSquads() {
      if (!session?.user) return;

      try {
        const res = await fetch('/api/user/squads');
        if (!res.ok) throw new Error('Failed to load squads');
        const data = await res.json();
        setSquads(data.squads || []);
      } catch (err) {
        console.error('Error fetching squads:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (status === 'authenticated') {
      fetchSquads();
    }
  }, [session, status]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <UnifiedNav
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard', icon: '🏠' },
            { label: 'My Squads' }
          ]}
        />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
            <p className="mt-4 text-slate-400">Loading your squads...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <UnifiedNav
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard', icon: '🏠' },
          { label: 'My Squads', icon: '👥' }
        ]}
      />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">My Rescue Squads</h1>
            <p className="text-slate-400 mt-1">
              Teams you're part of
            </p>
          </div>
          <Link
            href="/rescue-squads/search"
            className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold rounded-lg transition flex items-center gap-2"
          >
            <span>+</span> Join a Squad
          </Link>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-6 text-center mb-6">
            <p className="text-red-300 font-semibold">Error loading squads</p>
            <p className="text-red-400 mt-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!error && squads.length === 0 && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">👥</div>
            <h2 className="text-xl font-bold text-white mb-2">No Squads Yet</h2>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
              Join a local rescue squad to coordinate searches with your community and help reunite lost pets with their families.
            </p>
            <Link
              href="/rescue-squads/search"
              className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-white font-bold rounded-xl transition"
            >
              Find Squads Near You
            </Link>
          </div>
        )}

        {/* Squads List */}
        {!error && squads.length > 0 && (
          <div className="grid gap-4">
            {squads.map((squad) => (
              <Link
                key={squad.id}
                href={`/rescue-squads/${squad.id}`}
                className="bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-slate-600 transition group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-2xl">
                      🚨
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition">
                        {squad.displayName || squad.name}
                      </h3>
                      <p className="text-slate-400 text-sm">
                        {squad.city}, {squad.state}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span>{squad.memberCount || squad._count?.members || 0} members</span>
                        <span>•</span>
                        <span>{squad.activeCases || squad._count?.caseAssignments || 0} active cases</span>
                        {squad.role && (
                          <>
                            <span>•</span>
                            <span className={`px-2 py-0.5 rounded-full ${
                              squad.role === 'FOUNDER' ? 'bg-red-500/20 text-red-400' :
                              squad.role === 'LEADER' ? 'bg-amber-500/20 text-amber-400' :
                              squad.role === 'COORDINATOR' ? 'bg-purple-500/20 text-purple-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {squad.role}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <svg className="w-6 h-6 text-slate-500 group-hover:text-cyan-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
