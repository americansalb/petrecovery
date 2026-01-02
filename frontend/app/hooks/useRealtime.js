'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Hook for real-time notifications via Server-Sent Events
 *
 * @param {Object} options
 * @param {Function} options.onNotification - Callback when notification received
 * @param {Function} options.onCaseUpdate - Callback when case update received
 * @param {Function} options.onSquadMessage - Callback when squad message received
 * @param {Function} options.onSighting - Callback when sighting reported
 * @param {boolean} options.enabled - Whether to enable the connection
 * @returns {Object} { connected, reconnect }
 */
export function useRealtime({
  onNotification,
  onCaseUpdate,
  onSquadMessage,
  onSighting,
  enabled = true,
} = {}) {
  const { data: session } = useSession();
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  // Store handlers in refs to prevent reconnection when callbacks change
  // This is critical - inline callbacks would cause constant reconnects
  const handlersRef = useRef({ onNotification, onCaseUpdate, onSquadMessage, onSighting });
  useEffect(() => {
    handlersRef.current = { onNotification, onCaseUpdate, onSquadMessage, onSighting };
  }, [onNotification, onCaseUpdate, onSquadMessage, onSighting]);

  const connect = useCallback(() => {
    if (!session?.user?.id || !enabled) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource('/api/realtime/notifications');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Use refs to get current handlers - they may have changed since connect()
          const handlers = handlersRef.current;

          switch (data.type) {
            case 'connected':
              console.log('Realtime connected:', data.userId);
              break;

            case 'heartbeat':
              // Connection still alive
              break;

            case 'notification':
              handlers.onNotification?.(data.payload);
              break;

            case 'case_update':
              handlers.onCaseUpdate?.(data.payload);
              break;

            case 'squad_message':
              handlers.onSquadMessage?.(data.payload);
              break;

            case 'sighting':
              handlers.onSighting?.(data.payload);
              break;

            default:
              console.log('Unknown realtime message type:', data.type);
          }
        } catch (e) {
          console.error('Error parsing realtime message:', e);
        }
      };

      eventSource.onerror = () => {
        setConnected(false);
        eventSource.close();

        // Exponential backoff reconnect with jitter to prevent thundering herd
        const baseDelay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        const jitter = Math.random() * 1000; // 0-1s random jitter
        const delay = baseDelay + jitter;
        reconnectAttemptsRef.current++;

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    } catch (e) {
      console.error('Error creating EventSource:', e);
    }
  }, [session?.user?.id, enabled]); // Only reconnect when session or enabled changes, NOT handlers

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connect]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  return { connected, reconnect };
}

/**
 * Hook for real-time case coordination updates
 *
 * @param {string} missionId - Case ID to subscribe to
 * @param {Object} handlers - Event handlers
 */
export function useCaseRealtime(missionId, {
  onMessage,
  onParticipantJoined,
  onParticipantLeft,
  onSearchAreaAdded,
  onSpottingReported,
} = {}) {
  const { connected } = useRealtime({
    onCaseUpdate: (payload) => {
      if (payload.missionId !== missionId) return;

      switch (payload.event) {
        case 'message':
          onMessage?.(payload.data);
          break;
        case 'participant_joined':
          onParticipantJoined?.(payload.data);
          break;
        case 'participant_left':
          onParticipantLeft?.(payload.data);
          break;
        case 'search_area_added':
          onSearchAreaAdded?.(payload.data);
          break;
        case 'spotting_reported':
          onSpottingReported?.(payload.data);
          break;
      }
    },
    enabled: !!missionId,
  });

  return { connected };
}

export default useRealtime;
