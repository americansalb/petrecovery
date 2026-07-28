'use client';

/**
 * Accept-a-pet-transfer screen. Loads the invite (auth + email checked
 * server-side), shows who's handing over which pet, and flips ownership
 * on accept. Signed-out visitors are sent through login and come back.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Heart, PawPrint, AlertCircle, Loader2 } from 'lucide-react';

export default function TransferAcceptClient({ token }) {
  const router = useRouter();
  const [state, setState] = useState({ loading: true, invite: null, error: null, needsLogin: false });
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/pets/transfer/${token}`);
        const data = await res.json();
        if (!alive) return;
        if (res.status === 401) {
          setState({ loading: false, invite: null, error: null, needsLogin: true });
        } else if (!res.ok) {
          setState({ loading: false, invite: null, error: data.error || 'This invite is no longer valid', needsLogin: false });
        } else {
          setState({ loading: false, invite: data, error: null, needsLogin: false });
        }
      } catch {
        if (alive) setState({ loading: false, invite: null, error: 'Something went wrong. Please try again.', needsLogin: false });
      }
    })();
    return () => { alive = false; };
  }, [token]);

  const accept = async () => {
    setAccepting(true);
    setAcceptError('');
    try {
      const res = await fetch(`/api/pets/transfer/${token}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to accept');
      router.push(`/pets/${data.petId}/today`);
    } catch (e) {
      setAcceptError(e.message);
      setAccepting(false);
    }
  };

  const loginUrl = `/login?callbackUrl=${encodeURIComponent(`/pets/transfer/${token}`)}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-midnight-100 bg-white shadow-sm p-8 text-center">
          {state.loading ? (
            <div className="py-10 flex flex-col items-center gap-3 text-midnight-500">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p>Loading your invite…</p>
            </div>
          ) : state.needsLogin ? (
            <>
              <PawPrint className="w-10 h-10 text-flash-500 mx-auto mb-4" />
              <h1 className="text-2xl font-black text-midnight-900 mb-2">A pet's health record is waiting for you</h1>
              <p className="text-midnight-600 mb-6">
                Sign in with the email this invite was sent to, or create a free account with it.
              </p>
              <Link href={loginUrl} className="inline-flex items-center justify-center w-full bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold px-6 py-3 rounded-xl transition">
                Sign in to continue
              </Link>
              <p className="text-sm text-midnight-500 mt-4">
                New here?{' '}
                <Link href={`/register?callbackUrl=${encodeURIComponent(`/pets/transfer/${token}`)}`} className="font-semibold underline hover:text-midnight-900">
                  Create your free account
                </Link>
              </p>
            </>
          ) : state.error ? (
            <>
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-midnight-900 mb-2">Can't open this invite</h1>
              <p className="text-midnight-600">{state.error}</p>
            </>
          ) : (
            <>
              {state.invite.pet.primaryPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={state.invite.pet.primaryPhotoUrl}
                  alt={state.invite.pet.name}
                  className="w-24 h-24 rounded-full object-cover mx-auto mb-4 border-4 border-flash-200"
                />
              ) : (
                <PawPrint className="w-10 h-10 text-flash-500 mx-auto mb-4" />
              )}
              <h1 className="text-2xl font-black text-midnight-900 mb-2">
                {state.invite.pet.name} is coming home with you
              </h1>
              <p className="text-midnight-600 mb-6">
                <strong>{state.invite.fromName}</strong> is handing you{' '}
                {state.invite.pet.name}'s complete health record: medications, vaccinations,
                weight history, and photos. It becomes yours and the previous caretaker
                loses access.
              </p>
              {acceptError && (
                <p className="text-sm text-red-600 mb-3">{acceptError}</p>
              )}
              <button
                onClick={accept}
                disabled={accepting}
                className="inline-flex items-center justify-center gap-2 w-full bg-flash-400 hover:bg-flash-300 disabled:opacity-60 text-midnight-900 font-bold px-6 py-3 rounded-xl transition"
              >
                {accepting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Heart className="w-5 h-5" />}
                {accepting ? 'Accepting…' : `Accept ${state.invite.pet.name}'s record`}
              </button>
              <p className="text-xs text-midnight-500 mt-4">
                No cost, no card, no catch.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
