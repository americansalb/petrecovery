'use client';

/**
 * The hat system (docs/PRODUCT_IA_PLAN.md §"Three doors, one record").
 *
 * One account, three ways to wear it: `hat` is UI EMPHASIS ONLY -
 * 'owner' | 'searcher' - never an identity, a role, or a permission.
 * Shelter is the third door but lives as a *place*: the /my-shelter
 * portal owns its own chrome, so the top bar only ever renders the
 * owner or searcher set and "switching to Shelter" is navigation.
 *
 * Rules encoded here:
 * - persisted per device (localStorage), defaults to owner
 * - deep links auto-switch: a searcher-world URL puts the searcher hat
 *   on, an owner-world URL the owner hat; shared surfaces (hub,
 *   lost-and-found, the shelters directory, report flows) never switch
 * - switching hides nothing and loses nothing - cross-hat pages stay
 *   reachable, and the Report CTA is global in every hat
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';

const STORAGE_KEY = 'rp.hat';
const HATS = ['owner', 'searcher'];

const SEARCHER_PREFIXES = ['/rescue-forces', '/mission-control', '/divisions', '/join'];
const OWNER_PREFIXES = ['/pets', '/care', '/my-alerts'];

function matchesPrefix(pathname, prefixes) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function hatForPath(pathname) {
  if (matchesPrefix(pathname, SEARCHER_PREFIXES)) return 'searcher';
  if (matchesPrefix(pathname, OWNER_PREFIXES)) return 'owner';
  return null;
}

const HatContext = createContext({ hat: 'owner', setHat: () => {} });

export function HatProvider({ children }) {
  const pathname = usePathname();
  const [hat, setHatState] = useState('owner');

  // Device preference loads after mount (SSR always paints owner).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (HATS.includes(stored)) setHatState(stored);
    } catch {
      /* private mode etc. - the default hat is fine */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setHat = useCallback((next) => {
    if (!HATS.includes(next)) return;
    setHatState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* non-fatal */
    }
  }, []);

  // Deep links put the right hat on so nobody lands in a chrome that
  // doesn't match the page they're reading.
  useEffect(() => {
    const implied = hatForPath(pathname || '');
    if (implied) setHat(implied);
  }, [pathname, setHat]);

  return <HatContext.Provider value={{ hat, setHat }}>{children}</HatContext.Provider>;
}

export function useHat() {
  return useContext(HatContext);
}
