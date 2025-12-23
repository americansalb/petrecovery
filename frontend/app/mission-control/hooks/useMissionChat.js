'use client';

/**
 * useMissionChat - Chat functionality for Mission Control
 *
 * Uses existing rescue squad chat API with mission filtering.
 * Includes realtime updates via SSE.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRealtime } from '@/app/hooks/useRealtime';

export default function useMissionChat(missionId, squadId) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const pollIntervalRef = useRef(null);

  // Fetch messages from API
  const fetchMessages = useCallback(async () => {
    if (!squadId) {
      setIsLoading(false);
      return;
    }

    try {
      const url = missionId
        ? `/api/rescue-squads/${squadId}/chat?missionId=${missionId}&limit=100`
        : `/api/rescue-squads/${squadId}/chat?limit=100`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages?.map(msg => ({
          id: msg.id,
          userId: msg.authorId,
          userName: msg.authorName,
          text: msg.content,
          timestamp: new Date(msg.createdAt).getTime(),
          role: msg.authorRole,
        })) || []);
        setError(null);
      } else if (res.status !== 503) {
        // Don't show error for 503 (database unavailable)
        setError('Failed to load messages');
      }
    } catch (err) {
      console.error('Error fetching chat:', err);
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  }, [missionId, squadId]);

  // Send a message
  const sendMessage = useCallback(async (content) => {
    if (!squadId || !content.trim()) return { success: false };

    setIsSending(true);
    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          missionId: missionId || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Add message to local state immediately for instant feedback
        const newMsg = {
          id: data.message.id,
          userId: data.message.authorId,
          userName: data.message.authorName,
          text: data.message.content,
          timestamp: new Date(data.message.createdAt).getTime(),
          role: data.message.authorRole,
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
  }, [missionId, squadId]);

  // Handle realtime squad messages
  const handleSquadMessage = useCallback((payload) => {
    // Check if message is for this mission
    if (missionId && payload.missionId && payload.missionId !== missionId) {
      return;
    }

    // Add message if we don't already have it
    setMessages(prev => {
      if (prev.some(m => m.id === payload.id)) return prev;
      return [...prev, {
        id: payload.id,
        userId: payload.authorId,
        userName: payload.authorName,
        text: payload.content,
        timestamp: new Date(payload.createdAt).getTime(),
        role: payload.authorRole,
      }];
    });
  }, [missionId]);

  // Subscribe to realtime updates
  const { connected } = useRealtime({
    onSquadMessage: handleSquadMessage,
    enabled: !!squadId,
  });

  // Initial fetch
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Poll for new messages every 10 seconds (backup for SSE)
  useEffect(() => {
    if (!squadId) return;

    pollIntervalRef.current = setInterval(() => {
      fetchMessages();
    }, 10000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [squadId, fetchMessages]);

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
