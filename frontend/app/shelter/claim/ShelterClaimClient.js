'use client';

/**
 * Invite-claim screen for admin-invited shelters. Reads ?token= from
 * the window (house pattern, avoids a Suspense boundary), previews the
 * shelter, and claims on tap. Signed-out visitors route through
 * login/register and come back with the token intact.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ShelterClaimClient() {
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [state, setState] = useState({ loading: true, shelter: null, error: null, needsLogin: false });
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');

  useEffect(() => {
    let t = null;
    try {
      t = new URLSearchParams(window.location.search).get('token');
    } catch {}
    setToken(t);
    if (!t) {
      setState({ loading: false, shelter: null, error: 'This invite link is not valid', needsLogin: false });
      return;
    }
    let alive = true;
    fetch(`/api/shelter/claim?token=${encodeURIComponent(t)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!alive) return;
        if (res.status === 401) {
          setState({ loading: false, shelter: null, error: null, needsLogin: true });
        } else if (!res.ok) {
          setState({ loading: false, shelter: null, error: data.error || 'This invite link is not valid', needsLogin: false });
        } else {
          setState({ loading: false, shelter: data.shelter, error: null, needsLogin: false });
        }
      })
      .catch(() => {
        if (alive) setState({ loading: false, shelter: null, error: 'Something went wrong. Please try again.', needsLogin: false });
      });
    return () => { alive = false; };
  }, []);

  const claim = async () => {
    setClaiming(true);
    setClaimError('');
    try {
      const res = await fetch('/api/shelter/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to claim');
      router.push('/shelter/dashboard');
    } catch (e) {
      setClaimError(e.message);
      setClaiming(false);
    }
  };

  const backTo = token ? `/shelter/claim?token=${encodeURIComponent(token)}` : '/shelter/claim';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-midnight-100 bg-white shadow-sm p-8 text-center">
          {state.loading ? (
            <div className="py-10 flex flex-col items-center gap-3 text-midnight-500">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p>Loading your invitation…</p>
            </div>
          ) : state.needsLogin ? (
            <>
              <Building2 className="w-10 h-10 text-flash-500 mx-auto mb-4" />
              <h1 className="text-2xl font-black text-midnight-900 mb-2">Your shelter account is waiting</h1>
              <p className="text-midnight-600 mb-6">
                Sign in, or create a free account, to claim it. Takes about a minute.
              </p>
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(backTo)}`}
                className="inline-flex items-center justify-center w-full bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold px-6 py-3 rounded-xl transition"
              >
                Sign in to continue
              </Link>
              <p className="text-sm text-midnight-500 mt-4">
                New here?{' '}
                <Link href={`/register?callbackUrl=${encodeURIComponent(backTo)}`} className="font-semibold underline hover:text-midnight-900">
                  Create your free account
                </Link>
              </p>
            </>
          ) : state.error ? (
            <>
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-midnight-900 mb-2">Can&rsquo;t open this invitation</h1>
              <p className="text-midnight-600">{state.error}</p>
            </>
          ) : (
            <>
              <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-flash-50 border border-flash-200 mb-4">
                <Building2 className="w-8 h-8 text-flash-600" />
              </span>
              <h1 className="text-2xl font-black text-midnight-900 mb-2">
                Claim {state.shelter.name}
              </h1>
              <p className="text-midnight-600 mb-6">
                {state.shelter.city}, {state.shelter.state}. Your free account unlocks
                animal management, health records, lost-pet matching, staff seats, and
                your own public page. No cost, no card.
              </p>
              {claimError && <p className="text-sm text-red-600 mb-3">{claimError}</p>}
              <button
                onClick={claim}
                disabled={claiming}
                className="inline-flex items-center justify-center gap-2 w-full bg-flash-400 hover:bg-flash-300 disabled:opacity-60 text-midnight-900 font-bold px-6 py-3 rounded-xl transition"
              >
                {claiming ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                {claiming ? 'Claiming…' : 'Claim this shelter'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
