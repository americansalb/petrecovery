'use client';

/**
 * The one flash-filled CTA on the force page. Signed-out visitors go to
 * login with a callback; signed-in visitors join in place and the server
 * page re-renders them as crew. (The full JoinSheet is Phase 4.)
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Zap } from 'lucide-react';

export default function JoinForceButton({ forceId }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const join = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/rescue-forces/${forceId}/join`, { method: 'POST' });
      if (res.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent(`/rescue-forces/${forceId}`)}`);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not join right now.');
      }
      router.refresh();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        onClick={join}
        disabled={busy}
        className="w-full inline-flex items-center justify-center gap-2 bg-flash-400 hover:bg-flash-300 disabled:opacity-70 text-midnight-900 font-bold px-5 py-3 rounded-xl transition shadow-lg shadow-flash-400/25"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
        Join this force
      </button>
      <p className="text-[12px] text-midnight-300 mt-2 text-center">
        Be reachable when a pet near you needs more eyes.
      </p>
      {error && <p className="text-[12px] text-red-300 mt-1 text-center">{error}</p>}
    </div>
  );
}
