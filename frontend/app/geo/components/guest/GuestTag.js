'use client';

/**
 * In a round, for a guest: which of today's guest games this is, and
 * that it is not saved. One small tag beside the score, so the trial is
 * never a surprise at the end and never in the way during a round.
 * Pressing it asks for an account without leaving the round.
 */

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useGuestPass } from '../../lib/guestPass';
import AccountDialog from '../AccountDialog';

export default function GuestTag({ className = 'inline-flex', compact = false }) {
  const pass = useGuestPass();
  const pathname = usePathname() || '/geo';
  const [open, setOpen] = useState(false);
  if (!pass?.guest || !pass.used) return null;
  return (
    <>
      <button
        type="button"
        className={`pe-guest-tag ${className}`}
        data-guest-tag
        aria-label={compact ? `Guest game ${Math.min(pass.used, pass.limit)} of ${pass.limit}, not saved. Make an account` : undefined}
        onClick={() => setOpen(true)}
      >
        {/* A phone's round header has room for the count and no more. */}
        <span>{compact ? 'Guest' : 'Guest game'} {Math.min(pass.used, pass.limit)} of {pass.limit}</span>
        {compact ? null : (
          <>
            <span aria-hidden="true">·</span>
            <span>Not saved</span>
          </>
        )}
      </button>
      {open ? (
        <AccountDialog
          title="Save your games"
          intro={`Make an account and your points and today’s daily score are kept, and you can play more than ${pass.limit} games a day. Your round stays where it is. It’s free: your email and a code.`}
          returnTo={pathname}
          submitLabel="Save my games"
          onClose={() => setOpen(false)}
          onAuthenticated={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
