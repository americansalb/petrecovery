'use client';

/**
 * Join a Rescue Force. A signed-in visitor joins in place and the server
 * page re-renders them as a member. A signed-out visitor goes to sign in
 * (or create an account) first and comes back to this page.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';

const BUTTON =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-flash-400 px-5 py-3 font-semibold text-midnight-900 shadow-sm transition hover:bg-flash-500 disabled:opacity-70';

export default function JoinForceButton({ forceId, signedIn }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const back = `/rescue-forces/${forceId}`;

  if (!signedIn) {
    return (
      <div>
        <Link href={`/login?callbackUrl=${encodeURIComponent(back)}`} className={BUTTON}>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Join this Rescue Force
        </Link>
        <p className="mt-2 text-center text-sm text-midnight-500">You&apos;ll sign in or create an account first.</p>
      </div>
    );
  }

  const join = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/rescue-forces/${forceId}/join`, { method: 'POST' });
      if (res.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent(back)}`);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not join right now. Try again in a moment.');
      }
      router.refresh();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div>
      <button type="button" onClick={join} disabled={busy} className={BUTTON}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
        Join this Rescue Force
      </button>
      {error && (
        <p role="alert" className="mt-2 text-center text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
