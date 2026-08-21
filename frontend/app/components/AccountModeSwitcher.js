'use client';

/**
 * The door between worlds. One account can own animals, help run a
 * shelter, and ride with a rescue force; each is a different layout with
 * a different idea of what "pets" means. This picks which one you are
 * looking at.
 *
 * It changes PRESENTATION, never permission. Authority is re-derived from
 * the database inside every guarded route (docs/PERMISSIONS.md), so
 * choosing a mode you do not hold simply bounces you back out. That is
 * what keeps the hats from tangling: the switcher can be wrong without
 * being dangerous.
 *
 * Someone who only owns pets holds one mode and never sees this at all.
 *
 * (Not to be confused with the older components/ModeSwitcher.js, a
 * lost/found display toggle that nothing currently renders.)
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { PawPrint, Building2, Shield, Check, ChevronDown } from 'lucide-react';

const ICONS = { owner: PawPrint, shelter: Building2, searcher: Shield };

/** Remembered so the next sign-in lands where you left off. */
export function rememberMode(id) {
  try {
    document.cookie = `rp_mode=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax`;
  } catch { /* cookies disabled: switching still works, it just forgets */ }
}

/**
 * Guests hold no server modes, but the doors must still be visible -
 * discoverability is the whole point of the switcher. The fallback pair
 * gives each hat a sensible public landing.
 */
const GUEST_MODES = [
  // Labelled Health Book, not "Pet Care": the drawer already carries a
  // Pet Care link in its BROWSE list pointing at this same /care route, so
  // the two read as a duplicated entry. This one names what is behind the
  // door instead.
  { id: 'owner', label: 'Health Book', detail: 'Vaccinations, meds and vet info in one place', href: '/care' },
  { id: 'searcher', label: 'Help find lost pets', detail: 'Join searchers near you', href: '/rescue-forces/search' },
];

/**
 * Shared by every chrome consumer (top bar, tab bar, both switcher
 * surfaces): one fetch per sign-in, cached at module level and keyed by
 * the session's user so sign-in/out invalidates it. Guests skip the
 * network entirely - their doors are static.
 */
let modesCache = { key: null, promise: null, at: 0 };

export function useAccountModes() {
  const { data: session, status } = useSession();
  const [modes, setModes] = useState(null);
  const userId = session?.user?.id || null;

  useEffect(() => {
    if (status === 'loading') return undefined;
    const key = userId || 'guest';
    let alive = true;

    const load = (force) => {
      // The 5s window collapses the burst when several chrome consumers
      // react to the same focus event: one fetch, shared by all.
      const stale = force && Date.now() - modesCache.at > 5000;
      if (modesCache.key !== key || stale) {
        modesCache = {
          key,
          at: Date.now(),
          promise: userId
            ? fetch('/api/account/modes')
                .then((r) => (r.ok ? r.json() : null))
                .then((d) => (d?.modes?.length ? d.modes : GUEST_MODES))
                .catch(() => GUEST_MODES)
            : Promise.resolve(GUEST_MODES),
        };
      }
      modesCache.promise.then((m) => { if (alive) setModes(m); });
    };

    load(false);

    // Hats change mid-session (claiming a shelter, joining a force).
    // Coming back to the tab re-checks, so the bar never shows a world
    // the account no longer holds - or hides one it just gained.
    const onFocus = () => { if (userId) load(true); };
    window.addEventListener('focus', onFocus);
    return () => { alive = false; window.removeEventListener('focus', onFocus); };
  }, [status, userId]);

  return modes;
}

/**
 * `variant` picks the surface: "menu" sits inside the consumer account
 * dropdown, "sidebar" sits in the portal's dark footer.
 */
export default function AccountModeSwitcher({ current, variant = 'menu', onNavigate }) {
  const router = useRouter();
  const modes = useAccountModes();
  const [open, setOpen] = useState(false);

  if (!modes) return null; // still loading

  /**
   * One hat means there is nothing to switch between, but the door to the
   * other worlds must stay visible: this entry is how someone who runs a
   * shelter finds out they can have an account. /shelter/dashboard sorts
   * out what they see (application pitch, pending status, or seat invite).
   * Inside the portal there is nothing to advertise, so it stays quiet.
   */
  if (modes.length < 2) {
    if (variant === 'sidebar') return null;
    return (
      <Link
        href="/shelter/dashboard"
        onClick={() => { if (onNavigate) onNavigate(); }}
        className="flex items-center gap-3 px-4 py-3 text-midnight-700 hover:bg-midnight-50 transition"
      >
        <Building2 className="w-4 h-4 shrink-0" />
        <span className="font-medium">Shelter Portal</span>
      </Link>
    );
  }

  const active = modes.find((m) => m.id === current) || modes[0];

  if (variant === 'sidebar') {
    const go = (mode) => {
      rememberMode(mode.id);
      setOpen(false);
      if (onNavigate) onNavigate();
      router.push(mode.href);
    };
    return (
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          className="w-full flex items-center gap-2 text-sm font-semibold text-midnight-200 hover:text-white transition-colors"
        >
          <span className="flex-1 text-left truncate">Switch view</span>
          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div role="menu" className="absolute bottom-full left-0 right-0 mb-2 rounded-xl bg-white shadow-xl border border-midnight-100 overflow-hidden">
            {modes.map((m) => {
              const Icon = ICONS[m.id] || PawPrint;
              return (
                <button
                  key={m.id}
                  role="menuitem"
                  onClick={() => go(m)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 transition"
                >
                  <Icon className="w-4 h-4 text-midnight-500 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-midnight-900 truncate">{m.label}</span>
                    <span className="block text-[12px] text-midnight-400">{m.detail}</span>
                  </span>
                  {m.id === active.id && <Check className="w-4 h-4 text-flash-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // The shelter door must stay discoverable even for people who don't
  // hold that hat yet - it's how a shelter director learns the free
  // portal exists. (/shelter/dashboard sorts out pitch vs pending vs
  // invite.) Holders get their shelter as a mode row instead.
  const hasShelterMode = modes.some((m) => m.id === 'shelter');

  // Only the OTHER worlds: you are already where you are, and a switcher
  // that lists your current location as a link is noise. No concept
  // header either - the rows are plain destinations.
  const others = modes.filter((m) => m.id !== current);

  return (
    <div className="border-b border-midnight-100 py-1">
      {others.map((m) => {
        const Icon = ICONS[m.id] || PawPrint;
        return (
          <Link
            key={m.id}
            href={m.href}
            onClick={() => {
              rememberMode(m.id);
              if (onNavigate) onNavigate();
            }}
            className="flex items-center gap-3 px-4 py-2.5 text-midnight-700 hover:bg-midnight-50 transition"
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block font-medium truncate">{m.label}</span>
              <span className="block text-[12px] text-midnight-400">{m.detail}</span>
            </span>
          </Link>
        );
      })}
      {!hasShelterMode && (
        <Link
          href="/shelter/dashboard"
          onClick={() => { if (onNavigate) onNavigate(); }}
          className="flex items-center gap-3 px-4 py-2.5 text-midnight-700 hover:bg-midnight-50 transition"
        >
          <Building2 className="w-4 h-4 shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block font-medium truncate">Shelter Portal</span>
            <span className="block text-[12px] text-midnight-400">Run a shelter? Free tools</span>
          </span>
        </Link>
      )}
    </div>
  );
}
