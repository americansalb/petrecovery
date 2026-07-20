'use client';

/**
 * Shown on the shelter dashboard when the signed-in user has a PENDING
 * seat invite and no shelter yet. Accepting activates the seat and the
 * dashboard reloads into the full team view.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Loader2, CheckCircle2 } from 'lucide-react';

export default function InviteBanner({ shelterName }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const accept = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/shelter/members/accept', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to accept invite');
      router.refresh();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-flash-200 bg-flash-50/60 p-6 text-center">
      <Building2 className="w-10 h-10 text-flash-500 mx-auto mb-3" />
      <h2 className="text-xl font-bold text-midnight-900 mb-2">
        You&rsquo;re invited to help run {shelterName}
      </h2>
      <p className="text-midnight-700 mb-5">
        Accepting gives you access to the shelter&rsquo;s animals, health records,
        adoptions, and lost-pet matches.
      </p>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <button
        onClick={accept}
        disabled={busy}
        className="inline-flex items-center gap-2 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold px-6 py-3 rounded-xl disabled:opacity-60 transition"
      >
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
        Accept the invite
      </button>
    </div>
  );
}
