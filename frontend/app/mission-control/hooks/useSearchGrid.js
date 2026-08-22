'use client';

/**
 * useSearchGrid - the collaborative board's client half.
 *
 * Owns the grid cells, the three verbs (claim, release, mark searched),
 * and the live wire: an EventSource on the mission stream, applying
 * CELL_* patches as other people's claims and finishes land. The stream
 * endpoint existed before this hook; nothing had ever listened to it
 * from this screen.
 *
 * Realtime is an accelerant, not a dependency: everything also works on
 * refetch (tab focus, a reconnect, or after any action of your own), so
 * a dropped stream degrades to slightly stale rather than broken.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export default function useSearchGrid(caseId, userId, { onSighting } = {}) {
  const [grid, setGrid] = useState(null);
  const [cells, setCells] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [acting, setActing] = useState(false);
  const onSightingRef = useRef(onSighting);
  onSightingRef.current = onSighting;

  const fetchGrid = useCallback(async () => {
    if (!caseId) return;
    try {
      const res = await fetch(`/api/mission/${caseId}/grid`);
      if (res.status === 409) {
        setUnavailable(true);
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setGrid(data.grid);
      setCells(data.cells || []);
      setUnavailable(false);
    } catch (err) {
      // Leave whatever we had; the next focus or action refetches.
    }
  }, [caseId]);

  useEffect(() => {
    if (!caseId) return;
    setLoading(true);
    fetchGrid().finally(() => setLoading(false));
  }, [caseId, fetchGrid]);

  // Refetch when the tab comes back - someone searched blocks while the
  // phone was in a pocket.
  useEffect(() => {
    const onFocus = () => fetchGrid();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [fetchGrid]);

  // The live wire.
  useEffect(() => {
    if (!caseId) return undefined;
    let source;
    let retryTimer;
    let closed = false;

    const applyCell = (patch) => {
      if (!patch?.id) return;
      setCells((prev) =>
        prev.map((c) =>
          c.id === patch.id
            ? { ...c, ...patch, mine: patch.claimedById === userId }
            : c
        )
      );
    };

    const connect = () => {
      if (closed) return;
      try {
        source = new EventSource(`/api/mission/${caseId}/stream`);
        source.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'CELL_CLAIMED' || data.type === 'CELL_RELEASED' || data.type === 'CELL_SEARCHED') {
              applyCell(data.cell);
            } else if (data.type === 'SIGHTING_REPORTED') {
              onSightingRef.current?.(data.sighting);
            }
          } catch (err) {
            /* a malformed frame is dropped, not fatal */
          }
        };
        source.onerror = () => {
          source?.close();
          if (!closed) retryTimer = setTimeout(connect, 15000);
        };
      } catch (err) {
        /* EventSource unavailable: polling by focus still works */
      }
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retryTimer);
      source?.close();
    };
  }, [caseId, userId]);

  const cellAction = useCallback(
    async (cellId, action) => {
      if (!caseId || !cellId) return { success: false };
      setActing(true);
      setActionError(null);
      try {
        const res = await fetch(`/api/mission/${caseId}/grid/cell`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cellId, action }),
        });
        const data = await res.json();
        if (!res.ok) {
          setActionError(data.error || 'Could not update the block.');
          // Someone else moved first: refresh so the board tells the truth.
          if (data.code === 'CELL_TAKEN' || data.code === 'NOT_CLAIMED') fetchGrid();
          return { success: false, error: data.error, code: data.code };
        }
        // The response is the freshest truth for this cell; my other
        // claims may have auto-released, so refetch quietly too.
        setCells((prev) => {
          const patched = prev.map((c) => (c.id === data.cell.id ? { ...c, ...data.cell } : c));
          if (action === 'claim') {
            return patched.map((c) =>
              c.id !== data.cell.id && c.claimedById === userId
                ? { ...c, status: 'UNSEARCHED', claimedById: null, claimedByName: null, claimedAt: null, mine: false }
                : c
            );
          }
          return patched;
        });
        if (action === 'searched') fetchGrid();
        return { success: true, cell: data.cell };
      } catch (err) {
        setActionError('Could not reach the server.');
        return { success: false, error: 'network' };
      } finally {
        setActing(false);
      }
    },
    [caseId, userId, fetchGrid]
  );

  const myCell = cells.find((c) => c.mine && c.status === 'IN_PROGRESS') || null;
  const searchedCells = cells.filter((c) => c.status === 'SEARCHED' || c.status === 'PET_FOUND').length;
  const inProgressCells = cells.filter((c) => c.status === 'IN_PROGRESS').length;

  return {
    grid,
    cells,
    loading,
    unavailable,
    myCell,
    searchedCells,
    inProgressCells,
    totalCells: cells.length,
    claim: (cellId) => cellAction(cellId, 'claim'),
    release: (cellId) => cellAction(cellId, 'release'),
    markSearched: (cellId) => cellAction(cellId, 'searched'),
    acting,
    actionError,
    clearActionError: () => setActionError(null),
    refetch: fetchGrid,
  };
}
