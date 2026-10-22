'use client';

/**
 * The Guest chip in the header: who you are playing as and how many of
 * today's guest games are left, on every page a guest sees. Pressing it
 * asks for an account and says why, in a sentence.
 *
 * It sits in the header's one session-dependent slot, beside Sign in,
 * and only for a guest (GeoHeader.js).
 */

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useGuestPass } from '../../lib/guestPass';
import AccountDialog from '../AccountDialog';
import GuestDots from './GuestDots';

export function leftText(pass) {
  if (!pass?.guest) return '';
  if (pass.left <= 0) return 'No games left today';
  return `${pass.left} ${pass.left === 1 ? 'game' : 'games'} left today`;
}

export default function GuestChip() {
  const pass = useGuestPass();
  const pathname = usePathname() || '/geo';
  const [open, setOpen] = useState(false);
  if (!pass?.guest) return null;
  return (
    <>
      <button
        type="button"
        className="pe-guest-chip pe-fade-in"
        data-guest-chip
        data-empty={pass.left <= 0 ? '' : undefined}
        aria-label={`Playing as a guest. ${leftText(pass)}. Make an account`}
        onClick={() => setOpen(true)}
      >
        <span className="pe-guest-chip-name">Guest</span>
        <GuestDots left={pass.left} limit={pass.limit} />
        <span className="pe-guest-chip-left">{leftText(pass)}</span>
      </button>
      {open ? (
        <AccountDialog
          title="Make an account"
          intro={`Guests get ${pass.limit} games a day. Make an account to play more, keep your points and board scores on any device, and play Ranked, the weekly cup and multiplayer. It’s free: your email and a code.`}
          returnTo={pathname}
          onClose={() => setOpen(false)}
          onAuthenticated={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
