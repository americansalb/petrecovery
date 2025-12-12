'use client';

/**
 * Offline Support System
 *
 * Provides offline detection and action queue with IndexedDB.
 * Per Actions_Guide.md Phase 7 specification.
 */

// =============================================================================
// CONSTANTS
// =============================================================================

const DB_NAME = 'petrecovery_offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending_actions';
const SYNC_INTERVAL = 30000; // 30 seconds

// =============================================================================
// INDEXEDDB SETUP
// =============================================================================

let db = null;

/**
 * Initialize IndexedDB for offline storage
 */
async function initDB() {
  if (db) return db;
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    console.warn('IndexedDB not available');
    return null;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('missionId', 'missionId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
  });
}

// =============================================================================
// ACTION QUEUE
// =============================================================================

/**
 * Queue an action for later sync
 */
export async function queueAction(action) {
  const database = await initDB();
  if (!database) {
    console.warn('Cannot queue action: IndexedDB not available');
    return null;
  }

  const queuedAction = {
    ...action,
    createdAt: new Date().toISOString(),
    status: 'pending',
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(queuedAction);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error('Failed to queue action:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Get all pending actions
 */
export async function getPendingActions() {
  const database = await initDB();
  if (!database) return [];

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('status');
    const request = index.getAll('pending');

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = () => {
      console.error('Failed to get pending actions:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Get pending action count
 */
export async function getPendingCount() {
  const database = await initDB();
  if (!database) return 0;

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('status');
    const request = index.count('pending');

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Mark action as completed (remove from queue)
 */
export async function completeAction(id) {
  const database = await initDB();
  if (!database) return;

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Mark action as failed (increment retry count)
 */
export async function failAction(id, error) {
  const database = await initDB();
  if (!database) return;

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const action = getRequest.result;
      if (!action) {
        resolve();
        return;
      }

      action.retryCount++;
      action.lastError = error;
      action.status = action.retryCount >= 3 ? 'failed' : 'pending';

      const updateRequest = store.put(action);
      updateRequest.onsuccess = () => resolve();
      updateRequest.onerror = () => reject(updateRequest.error);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

// =============================================================================
// SYNC ENGINE
// =============================================================================

let syncInProgress = false;
let syncInterval = null;

/**
 * Sync pending actions with server
 */
export async function syncPendingActions(onProgress) {
  if (syncInProgress || !navigator.onLine) return;

  syncInProgress = true;
  const pending = await getPendingActions();

  let synced = 0;
  let failed = 0;

  for (const action of pending) {
    try {
      const response = await fetch(action.endpoint, {
        method: action.method || 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.data),
      });

      if (response.ok) {
        await completeAction(action.id);
        synced++;
      } else {
        await failAction(action.id, `HTTP ${response.status}`);
        failed++;
      }
    } catch (error) {
      await failAction(action.id, error.message);
      failed++;
    }

    if (onProgress) {
      onProgress({ synced, failed, total: pending.length });
    }
  }

  syncInProgress = false;
  return { synced, failed, total: pending.length };
}

/**
 * Start automatic background sync
 */
export function startAutoSync(onSync) {
  if (syncInterval) return;

  // Initial sync
  if (navigator.onLine) {
    syncPendingActions(onSync);
  }

  // Periodic sync
  syncInterval = setInterval(() => {
    if (navigator.onLine) {
      syncPendingActions(onSync);
    }
  }, SYNC_INTERVAL);

  // Sync on reconnect
  window.addEventListener('online', () => {
    syncPendingActions(onSync);
  });
}

/**
 * Stop automatic sync
 */
export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

// =============================================================================
// OFFLINE ACTIONS
// =============================================================================

/**
 * Queue a flyer posting for later sync
 */
export async function queueFlyerPosting(missionId, latitude, longitude, photoUrl, notes) {
  return queueAction({
    type: 'flyer_posting',
    missionId,
    endpoint: `/api/mission/${missionId}/flyers`,
    method: 'POST',
    data: { latitude, longitude, photoUrl, notes },
  });
}

/**
 * Queue a search session for later sync
 */
export async function queueSearchSession(missionId, gpsPath, durationMinutes) {
  return queueAction({
    type: 'search_session',
    missionId,
    endpoint: `/api/mission/${missionId}/searches`,
    method: 'POST',
    data: { gpsPath, durationMinutes },
  });
}

/**
 * Queue an activity log for later sync
 */
export async function queueActivityLog(missionId, activityType, notes) {
  return queueAction({
    type: 'activity_log',
    missionId,
    endpoint: `/api/mission/${missionId}/activities`,
    method: 'POST',
    data: { activityType, notes },
  });
}

// =============================================================================
// REACT HOOK
// =============================================================================

import { useState, useEffect, useCallback } from 'react';

/**
 * useOffline - Hook for offline state and action queue
 */
export function useOffline() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update pending count
  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 5000);
    return () => clearInterval(interval);
  }, [refreshPendingCount]);

  // Manual sync
  const sync = useCallback(async () => {
    if (!isOnline) return null;

    setSyncing(true);
    const result = await syncPendingActions();
    setLastSyncResult(result);
    await refreshPendingCount();
    setSyncing(false);

    return result;
  }, [isOnline, refreshPendingCount]);

  // Queue action with pending count update
  const queue = useCallback(async (action) => {
    const id = await queueAction(action);
    await refreshPendingCount();
    return id;
  }, [refreshPendingCount]);

  return {
    isOnline,
    isOffline: !isOnline,
    pendingCount,
    syncing,
    lastSyncResult,
    sync,
    queue,
    queueFlyerPosting,
    queueSearchSession,
    queueActivityLog,
  };
}

export default useOffline;
