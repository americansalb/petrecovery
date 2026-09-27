'use client';

/**
 * A member's menu, opened from the "Member" button in the force's header.
 * The force's other pages live here now that the page has three tabs:
 * the chat for everyone, and members, divisions and settings for the
 * people who run the force. Leaving takes a second tap.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Loader2, Map as MapIcon, MessageCircle, MessagesSquare, Settings, Users } from 'lucide-react';
import { Modal } from '@/components/ui';

export default function MemberMenu({ open, onClose, force, viewer }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const base = `/rescue-forces/${force.id}`;

  const links = [
    { href: `${base}/discussion`, label: 'Go to the discussion', icon: MessagesSquare },
    { href: `${base}/chat`, label: 'Force chat', icon: MessageCircle },
    ...(viewer.isLeader || viewer.isAdmin
      ? [
          { href: `${base}/members`, label: 'Members and roles', icon: Users },
          { href: `${base}/divisions`, label: 'Divisions', icon: MapIcon },
          { href: `${base}/settings`, label: 'Settings', icon: Settings },
        ]
      : []),
  ];

  const close = () => {
    setConfirming(false);
    setError('');
    onClose();
  };

  async function leave() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/rescue-forces/${force.id}/leave`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'That did not go through. Try again in a moment.');
      }
      close();
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title="You are a member" subtitle={`of ${force.name}`}>
      <ul className="-mx-2">
        {links.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              onClick={close}
              className="flex items-center gap-3 rounded-xl px-2 py-3 font-semibold text-midnight-900 transition hover:bg-midnight-50"
            >
              <Icon className="h-5 w-5 shrink-0 text-midnight-500" aria-hidden="true" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="h-4 w-4 text-midnight-400" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-4 border-t border-midnight-100 pt-4">
        {confirming ? (
          <div>
            <p className="text-midnight-800">Leave {force.name}? You can join again any time.</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={leave}
                disabled={busy}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Leave
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="h-11 flex-1 rounded-xl border-2 border-midnight-200 px-4 font-semibold text-midnight-800 transition hover:bg-midnight-50"
              >
                Stay
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-sm font-semibold text-red-700 underline-offset-4 hover:underline"
          >
            Leave {force.name}
          </button>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
