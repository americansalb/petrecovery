'use client';

/**
 * useRealtimeUpdates Hook
 *
 * Connects to the Mission Control SSE stream and provides
 * real-time updates to components.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { triggerHaptic, announce } from './accessibility';

export default function useRealtimeUpdates(caseId, options = {}) {
  const {
    onVolunteerUpdate,
    onZoneUpdate,
    onSighting,
    onModeChange,
    onBroadcast,
    onContainment,
    autoReconnect = true,
    enabled = true,
  } = options;

  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [error, setError] = useState(null);
  const [volunteers, setVolunteers] = useState([]);
  const [zones, setZones] = useState([]);
  const [mode, setMode] = useState(null);

  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!caseId || !enabled) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource(`/api/mission/${caseId}/stream`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastEvent(data);
          handleEvent(data);
        } catch (err) {
          console.error('Failed to parse SSE event:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE error:', err);
        setConnected(false);
        eventSource.close();

        if (autoReconnect && reconnectAttempts.current < maxReconnectAttempts) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else {
          setError('Connection lost. Please refresh the page.');
        }
      };
    } catch (err) {
      console.error('Failed to create EventSource:', err);
      setError('Failed to connect to real-time updates.');
    }
  }, [caseId, enabled, autoReconnect]);

  const handleEvent = useCallback((data) => {
    switch (data.type) {
      case 'CONNECTED':
        setMode(data.mode);
        break;

      case 'PING':
        // Heartbeat, no action needed
        break;

      case 'VOLUNTEER_JOINED':
        setVolunteers(prev => {
          const exists = prev.find(v => v.id === data.volunteer.id);
          if (exists) return prev;
          return [...prev, data.volunteer];
        });
        onVolunteerUpdate?.('joined', data.volunteer);
        break;

      case 'VOLUNTEER_LEFT':
        setVolunteers(prev => prev.filter(v => v.id !== data.volunteerId));
        onVolunteerUpdate?.('left', { id: data.volunteerId });
        break;

      case 'VOLUNTEER_MOVED':
        setVolunteers(prev =>
          prev.map(v =>
            v.id === data.volunteerId
              ? { ...v, location: data.location }
              : v
          )
        );
        onVolunteerUpdate?.('moved', data);
        break;

      case 'ZONE_UPDATED':
        setZones(prev =>
          prev.map(z =>
            z.id === data.zoneId
              ? { ...z, status: data.status, assignedTo: data.assignedTo }
              : z
          )
        );
        onZoneUpdate?.(data);
        break;

      case 'SIGHTING_REPORTED':
        triggerHaptic('warning');
        announce('New sighting reported!', 'assertive');
        onSighting?.(data);
        break;

      case 'SIGHTING_VERIFIED':
        triggerHaptic('urgent');
        announce('Sighting verified! Containment starting.', 'assertive');
        onSighting?.(data);
        break;

      case 'MODE_CHANGED':
        setMode(data.mode);
        if (data.mode === 'CONTAINMENT') {
          triggerHaptic('urgent');
          announce('Containment mode activated!', 'assertive');
        }
        onModeChange?.(data);
        break;

      case 'BROADCAST':
        triggerHaptic('tap');
        announce(`Message from ${data.from || 'Command'}: ${data.message}`, 'polite');
        onBroadcast?.(data);
        break;

      case 'CONTAINMENT_ACTIVATED':
        triggerHaptic('urgent');
        onContainment?.(data);
        break;

      case 'CALL_MODE_TRIGGERED':
        triggerHaptic('warning');
        announce("Owner's voice is now playing.", 'assertive');
        break;

      default:
        console.log('Unknown event type:', data.type);
    }
  }, [onVolunteerUpdate, onZoneUpdate, onSighting, onModeChange, onBroadcast, onContainment]);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    reconnectAttempts.current = 0;
    connect();
  }, [connect]);

  return {
    connected,
    error,
    lastEvent,
    volunteers,
    zones,
    mode,
    reconnect,
  };
}
