'use client';

/**
 * One pet, fetched once. The shell mounts this provider and every room
 * under /pets/[id] reads identity + access from context instead of
 * re-fetching /api/pets/[id] per tab. `allPets` powers the family
 * switcher and includes pets shared with you, so caregivers can move
 * between books the same way owners do.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const PetContext = createContext(null);

export function PetProvider({ petId, children }) {
  const [pet, setPet] = useState(null);
  const [access, setAccess] = useState(null); // OWNER | CAREGIVER | VIEWER
  const [allPets, setAllPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshPet = useCallback(async () => {
    if (!petId) return;
    try {
      const res = await fetch(`/api/pets/${petId}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not load this pet');
      setPet(data.pet || null);
      setAccess(data.access || 'OWNER');
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [petId]);

  useEffect(() => {
    if (!petId) return;
    let alive = true;
    setLoading(true);
    Promise.allSettled([
      fetch(`/api/pets/${petId}`).then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
      fetch('/api/pets').then((r) => (r.ok ? r.json() : null)),
    ]).then(([detail, list]) => {
      if (!alive) return;
      if (detail.status === 'fulfilled' && detail.value.ok) {
        setPet(detail.value.d.pet || null);
        setAccess(detail.value.d.access || 'OWNER');
      } else {
        setError(detail.status === 'fulfilled' ? (detail.value.d?.error || 'Could not load this pet') : 'Could not load this pet');
      }
      if (list.status === 'fulfilled' && list.value) {
        const mine = list.value.pets || [];
        const shared = list.value.sharedPets || [];
        const seen = new Set();
        setAllPets([...mine, ...shared].filter((p) => !seen.has(p.id) && seen.add(p.id)));
      }
      setLoading(false);
    });
    return () => { alive = false; };
  }, [petId]);

  const value = useMemo(
    () => ({ pet, access, allPets, loading, error, refreshPet, setPet }),
    [pet, access, allPets, loading, error, refreshPet]
  );

  return <PetContext.Provider value={value}>{children}</PetContext.Provider>;
}

export function usePet() {
  const ctx = useContext(PetContext);
  if (!ctx) throw new Error('usePet must be used inside <PetProvider>');
  return ctx;
}
