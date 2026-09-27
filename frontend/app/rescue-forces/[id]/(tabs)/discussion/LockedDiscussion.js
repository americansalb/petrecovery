'use client';

/** The Discussion tab for anyone who is not a member: what it is, and the way in. */

import { Loader2, Lock, UserPlus } from 'lucide-react';
import { useForce } from '../ForceShell';

export default function LockedDiscussion() {
  const { force, join, joining } = useForce();
  return (
    <div className="mx-auto max-w-xl px-4 pb-24 pt-10 text-center lg:pb-12">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-midnight-100 text-midnight-600">
        <Lock className="h-6 w-6" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-xl font-extrabold tracking-tight text-midnight-900">The discussion is for members</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-midnight-600">
        Members of {force.name} post sightings and updates and ask questions here. Posts can include addresses, so only
        members see them.
      </p>
      <button
        type="button"
        onClick={join}
        disabled={joining}
        className="mx-auto mt-5 flex h-[52px] items-center justify-center gap-2 rounded-[14px] bg-flash-400 px-7 text-base font-extrabold text-midnight-900 shadow-[0_2px_6px_rgba(202,138,4,0.28)] disabled:opacity-60"
      >
        {joining ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <UserPlus className="h-5 w-5" aria-hidden="true" />}
        Join to help
      </button>
    </div>
  );
}
