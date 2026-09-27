'use client';

/**
 * The top of every tab of a Rescue Force's page: the map, the force's
 * name, the one action (Join to help, or Member for a member's menu),
 * Share, and the three tabs: Pets, Needs, Discussion.
 *
 * On a phone the map comes first and stays above the tabs. On a computer
 * it moves into the Pets tab, beside the list (ForceMapSlot decides which
 * one draws, so there is only ever one map). The Lost / Found / Reunited
 * filters live here too, because the map and the Pets list both follow
 * them; reunited pets are hidden until asked for.
 *
 * The tabs sit under the universal navbar (sticky top-16), never in its
 * place (CLAUDE.md).
 */

import { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { Check, ChevronLeft, Loader2, Lock, Share2, Shield, UserPlus } from 'lucide-react';
import { getBaseUrl } from '@/app/lib/config';
import ShareSheet from '@/app/cases/[caseNumber]/components/ShareSheet';
import JoinForceSheet from '@/app/components/help/JoinForceSheet';
import MembersSheet, { Avatar } from './MembersSheet';
import MemberMenu from './MemberMenu';

const ForceMap = nextDynamic(() => import('./ForceMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-midnight-100" aria-hidden="true" />,
});

const ForceContext = createContext(null);

export function useForce() {
  return useContext(ForceContext);
}

const LEADER_ROLES = ['FOUNDER', 'LEADER', 'ADMINISTRATOR'];

/** Whether the computer layout is showing: null until the browser says. */
function useWide() {
  const [wide, setWide] = useState(null);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return wide;
}

/** The map, drawn in the phone's band (`band`) or beside the Pets list (`side`), never both. */
export function ForceMapSlot({ where }) {
  const { force, pets, shown, wide } = useForce();
  const router = useRouter();
  const active = wide !== null && (where === 'side' ? wide : !wide);
  if (!active) return <div className="h-full w-full bg-midnight-100" aria-hidden="true" />;
  return (
    <ForceMap
      force={force}
      pets={pets}
      shown={shown}
      wide={where === 'side'}
      onOpen={(caseNumber) => router.push(`/cases/${encodeURIComponent(caseNumber)}`)}
    />
  );
}

function ForceBadge({ force, className }) {
  if (force.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={force.photo} alt="" className={`${className} shrink-0 rounded-[14px] object-cover`} />;
  }
  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-midnight-800 to-midnight-900 text-flash-400`}
      aria-hidden="true"
    >
      <Shield className="h-1/2 w-1/2" />
    </span>
  );
}

export default function ForceShell({ data, children }) {
  const { force, members, pets, needsCount, viewer } = data;
  const router = useRouter();
  const pathname = usePathname() || '';
  const wide = useWide();
  const [shown, setShown] = useState(() => new Set(['lost', 'found']));
  const [sheet, setSheet] = useState(null); // members | join | member | share
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  const base = `/rescue-forces/${force.id}`;
  const canReadDiscussion = viewer.isMember || viewer.isAdmin;
  const leader = members.find((m) => LEADER_ROLES.includes(m.role) && m.name);
  const count = `${members.length} ${members.length === 1 ? 'member' : 'members'}`;
  const shareUrl = `${getBaseUrl()}${base}`;
  const shareText = `${force.name}: neighbors who help find lost pets${force.city ? ` in ${force.city}` : ''}.`;

  const toggle = (status) =>
    setShown((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });

  async function join() {
    if (!viewer.signedIn) {
      setSheet('join');
      return;
    }
    setJoining(true);
    setJoinError('');
    try {
      const res = await fetch(`/api/rescue-forces/${force.id}/join`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not join right now. Try again in a moment.');
      }
      router.refresh();
    } catch (e) {
      setJoinError(e.message);
    } finally {
      setJoining(false);
    }
  }

  function joinFromSheet() {
    if (viewer.signedIn) {
      setSheet(null);
      join();
    } else {
      setSheet('join');
    }
  }

  async function share() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: force.name, text: shareText, url: shareUrl });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;
      }
    }
    setSheet('share');
  }

  const tabs = [
    { href: base, label: 'Pets', active: pathname === base },
    { href: `${base}/needs`, label: 'Needs', count: needsCount, active: pathname.startsWith(`${base}/needs`) },
    {
      href: `${base}/discussion`,
      label: 'Discussion',
      locked: !canReadDiscussion,
      active: pathname.startsWith(`${base}/discussion`),
    },
  ];

  const context = { force, members, pets, needsCount, viewer, shown, toggle, wide, join, joining, openSheet: setSheet };

  return (
    <ForceContext.Provider value={context}>
      <div className="min-h-screen bg-white">
        {/* Phone: the map leads, with the way back on it. */}
        <div className="relative isolate h-[230px] bg-midnight-100 lg:hidden">
          <ForceMapSlot where="band" />
          <Link
            href="/rescue-forces"
            className="absolute left-2.5 top-2.5 z-[1000] flex h-10 items-center gap-0.5 rounded-full bg-white pl-2 pr-3.5 text-sm font-bold text-midnight-900 shadow-[0_2px_8px_rgba(15,23,42,0.25)]"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            All Rescue Forces
          </Link>
        </div>

        <header className="border-b border-midnight-100 lg:border-midnight-200">
          <div className="px-4 py-3.5 lg:flex lg:items-center lg:justify-between lg:gap-8 lg:px-8 lg:py-5">
            <div className="min-w-0">
              <Link
                href="/rescue-forces"
                className="-ml-1 mb-2 hidden items-center gap-1 px-1 text-sm font-medium text-midnight-500 hover:text-midnight-900 lg:inline-flex"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                All Rescue Forces
              </Link>
              <div className="flex items-center gap-3 lg:gap-4">
                <ForceBadge force={force} className="h-12 w-12 lg:h-14 lg:w-14" />
                <div className="min-w-0">
                  <h1 className="break-words text-[22px] font-extrabold leading-tight tracking-tight text-midnight-900 lg:text-[28px]">
                    {force.name}
                  </h1>
                  <button type="button" onClick={() => setSheet('members')} className="flex items-center gap-2 text-left">
                    <span className="flex">
                      {members.slice(0, 3).map((m, i) => (
                        <span key={m.id} className={`rounded-full ring-2 ring-white ${i ? '-ml-2' : ''}`}>
                          <Avatar person={m} i={i} size="h-6 w-6 text-[11px]" />
                        </span>
                      ))}
                    </span>
                    <span className="text-sm font-bold text-midnight-700 underline underline-offset-2">
                      {count}
                      <span className="hidden lg:inline">{leader ? ` · Led by ${leader.name}` : ''}</span>
                    </span>
                  </button>
                </div>
              </div>
              {!force.isActive && (
                <p className="mt-2 inline-flex rounded-full bg-midnight-100 px-3 py-1 text-sm font-medium text-midnight-700">
                  Waiting to be activated
                </p>
              )}
            </div>

            <div className="mt-3.5 lg:mt-0 lg:shrink-0">
              <div className="flex gap-2.5">
                {viewer.isMember ? (
                  <button
                    type="button"
                    onClick={() => setSheet('member')}
                    className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[14px] border-2 border-midnight-900 bg-white text-base font-extrabold text-midnight-900 lg:flex-none lg:px-7"
                  >
                    <Check className="h-5 w-5" strokeWidth={2.6} aria-hidden="true" />
                    Member
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={join}
                    disabled={joining}
                    className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-flash-400 text-base font-extrabold text-midnight-900 shadow-[0_2px_6px_rgba(202,138,4,0.28)] disabled:opacity-60 lg:flex-none lg:px-7"
                  >
                    {joining ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    ) : (
                      <UserPlus className="h-5 w-5" aria-hidden="true" />
                    )}
                    Join to help
                  </button>
                )}
                <button
                  type="button"
                  onClick={share}
                  aria-label={`Share ${force.name}`}
                  className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] border-2 border-midnight-200 bg-white text-midnight-900 transition hover:bg-midnight-50"
                >
                  <Share2 className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              {joinError && (
                <p role="alert" className="mt-2 text-sm text-red-700">
                  {joinError}
                </p>
              )}
            </div>
          </div>
        </header>

        <nav aria-label={force.name} className="sticky top-16 z-30 border-b border-midnight-200 bg-white">
          <div className="flex lg:px-3">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                aria-current={t.active ? 'page' : undefined}
                className={`relative inline-flex h-[50px] flex-1 items-center justify-center gap-1.5 border-b-[3px] text-[15px] transition lg:flex-none lg:px-6 ${
                  t.active
                    ? 'border-midnight-900 font-extrabold text-midnight-900'
                    : 'border-transparent font-semibold text-midnight-500 hover:text-midnight-800'
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-flash-400 bg-gradient-to-b from-flash-300 to-flash-400 px-1.5 text-xs font-extrabold text-midnight-900">
                    {t.count}
                  </span>
                )}
                {t.locked && (
                  <>
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="sr-only">(members only)</span>
                  </>
                )}
              </Link>
            ))}
          </div>
        </nav>

        {children}
      </div>

      <MembersSheet
        open={sheet === 'members'}
        onClose={() => setSheet(null)}
        force={force}
        members={members}
        onJoin={viewer.isMember ? null : joinFromSheet}
      />
      {viewer.isMember && (
        <MemberMenu open={sheet === 'member'} onClose={() => setSheet(null)} force={force} viewer={viewer} />
      )}
      <JoinForceSheet open={sheet === 'join'} onClose={() => setSheet(null)} force={force} signedIn={viewer.signedIn} />
      <ShareSheet
        open={sheet === 'share'}
        onClose={() => setSheet(null)}
        url={shareUrl}
        title={force.name}
        text={shareText}
      />
    </ForceContext.Provider>
  );
}
