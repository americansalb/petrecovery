'use client';

/**
 * useMissionChat - Chat functionality for Mission Control
 *
 * Uses mission-level chat API (any authenticated user can participate).
 * Includes realtime updates via SSE + polling fallback.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRealtime } from '@/app/hooks/useRealtime';

export default function useMissionChat(missionId) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const pollIntervalRef = useRef(null);

  // Fetch messages from mission chat API
  const fetchMessages = useCallback(async () => {
    if (!missionId) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/missions/${missionId}/chat?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages?.map(msg => ({
          id: msg.id,
          userId: msg.userId,
          userName: msg.userName,
          text: msg.text,
          timestamp: new Date(msg.timestamp).getTime(),
        })) || []);
        setError(null);
      } else if (res.status === 401) {
        setError('Please sign in to view chat');
      } else if (res.status !== 503) {
        setError('Failed to load messages');
      }
    } catch (err) {
      console.error('Error fetching chat:', err);
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  }, [missionId]);

  // Send a message
  const sendMessage = useCallback(async (content) => {
    if (!missionId || !content.trim()) return { success: false };

    setIsSending(true);
    try {
      const res = await fetch(`/api/missions/${missionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        // Add message to local state immediately for instant feedback
        const newMsg = {
          id: data.message.id,
          userId: data.message.userId,
          userName: data.message.userName,
          text: data.message.text,
          timestamp: new Date(data.message.timestamp).getTime(),
        };
        setMessages(prev => [...prev, newMsg]);
        return { success: true, message: newMsg };
      } else {
        const errorData = await res.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Failed to send' };
      }
    } catch (err) {
      console.error('Error sending message:', err);
      return { success: false, error: 'Network error' };
    } finally {
      setIsSending(false);
    }
  }, [missionId]);

  // Handle realtime case updates (for chat messages)
  const handleCaseUpdate = useCallback((payload) => {
    if (payload.missionId !== missionId) return;
    if (payload.event === 'message') {
      // Add message if we don't already have it
      setMessages(prev => {
        if (prev.some(m => m.id === payload.data.id)) return prev;
        return [...prev, {
          id: payload.data.id,
          userId: payload.data.userId,
          userName: payload.data.userName,
          text: payload.data.text,
          timestamp: new Date(payload.data.timestamp).getTime(),
        }];
      });
    }
  }, [missionId]);

  // Subscribe to realtime updates
  const { connected } = useRealtime({
    onCaseUpdate: handleCaseUpdate,
    enabled: !!missionId,
  });

  // Initial fetch
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Poll for new messages every 5 seconds (backup for SSE)
  useEffect(() => {
    if (!missionId) return;

    pollIntervalRef.current = setInterval(() => {
      fetchMessages();
    }, 5000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [missionId, fetchMessages]);

  return {
    messages,
    isLoading,
    isSending,
    error,
    connected,
    sendMessage,
    refreshMessages: fetchMessages,
  };
}
