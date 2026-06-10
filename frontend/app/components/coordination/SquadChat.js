'use client';

/**
 * Squad Chat Component - Phase 1.2
 *
 * Real-time chat interface for case coordination.
 * Supports regular messages and leader announcements.
 *
 * Features:
 * - Message list with author info
 * - Auto-scroll to new messages
 * - Announcement highlighting for leaders
 * - Polling for new messages (real-time later)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import LoadingSpinner from '@/app/components/LoadingSpinner';

export default function SquadChat({
  assignmentId,
  isParticipant,
  isLeader,
  currentUserId,
}) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!assignmentId) return;

    try {
      const res = await fetch(`/api/assignments/${assignmentId}/messages?limit=100`);

      if (!res.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data = await res.json();
      setMessages(data.messages || []);
      setError(null);
    } catch (err) {
      console.error('[SQUAD-CHAT] Error fetching messages:', err);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  // Initial fetch and polling setup
  useEffect(() => {
    fetchMessages();

    // Poll for new messages every 5 seconds
    pollIntervalRef.current = setInterval(() => {
      fetchMessages();
    }, 5000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchMessages]);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!newMessage.trim() || !isParticipant || sending) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/assignments/${assignmentId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newMessage.trim(),
          type: isAnnouncement && isLeader ? 'ANNOUNCEMENT' : 'CHAT',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send message');
      }

      const data = await res.json();
      // Add message to list
      setMessages((prev) => [...prev, data.message]);
      setNewMessage('');
      setIsAnnouncement(false);
    } catch (err) {
      console.error('[SQUAD-CHAT] Error sending message:', err);
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  // Format timestamp
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Get message style based on type
  const getMessageStyle = (message) => {
    const isOwn = message.authorId === currentUserId;
    const baseStyle = {
      maxWidth: '80%',
      padding: '0.75rem 1rem',
      borderRadius: '1rem',
      marginBottom: '0.5rem',
    };

    if (message.type === 'ANNOUNCEMENT') {
      return {
        ...baseStyle,
        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
        border: '1px solid #f59e0b',
        marginLeft: 0,
        marginRight: 0,
        maxWidth: '100%',
      };
    }

    if (message.type === 'SYSTEM') {
      return {
        ...baseStyle,
        background: '#f1f5f9',
        color: '#64748b',
        fontStyle: 'italic',
        textAlign: 'center',
        marginLeft: 'auto',
        marginRight: 'auto',
      };
    }

    if (isOwn) {
      return {
        ...baseStyle,
        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
        color: 'white',
        marginLeft: 'auto',
        borderBottomRightRadius: '0.25rem',
      };
    }

    return {
      ...baseStyle,
      background: 'white',
      border: '1px solid #e2e8f0',
      marginRight: 'auto',
      borderBottomLeftRadius: '0.25rem',
    };
  };

  // Loading state
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
      }}>
        <LoadingSpinner text="Loading chat..." />
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 280px)',
      minHeight: '500px',
      background: 'white',
      borderRadius: '1rem',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1.5rem',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc',
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '1.1rem',
          fontWeight: '600',
          color: '#0f172a',
        }}>
          💬 Team Chat
        </h2>
        <p style={{
          margin: '0.25rem 0 0 0',
          fontSize: '0.8rem',
          color: '#64748b',
        }}>
          {messages.length} messages • Updates every 5 seconds
        </p>
      </div>

      {/* Messages container */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1rem',
        background: '#f8fafc',
      }}>
        {messages.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: '#64748b',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
            <p>No messages yet. Be the first to say something!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                marginBottom: '1rem',
              }}
            >
              {/* Announcement header */}
              {message.type === 'ANNOUNCEMENT' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.25rem',
                  fontSize: '0.75rem',
                  color: '#92400e',
                  fontWeight: '600',
                }}>
                  📢 ANNOUNCEMENT
                </div>
              )}

              {/* Message bubble */}
              <div style={getMessageStyle(message)}>
                {/* Author info (not for own messages or system) */}
                {message.type !== 'SYSTEM' && message.authorId !== currentUserId && (
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: message.type === 'ANNOUNCEMENT' ? '#92400e' : '#64748b',
                    marginBottom: '0.25rem',
                  }}>
                    {message.author?.firstName || 'Unknown'} {message.author?.lastName?.[0] || ''}.
                    {message.author?.rescueLevel && (
                      <span style={{
                        marginLeft: '0.5rem',
                        padding: '0.125rem 0.375rem',
                        background: message.type === 'ANNOUNCEMENT' ? '#fef3c7' : '#e2e8f0',
                        borderRadius: '0.25rem',
                        fontSize: '0.65rem',
                      }}>
                        {message.author.rescueLevel}
                      </span>
                    )}
                  </div>
                )}

                {/* Message content */}
                <p style={{
                  margin: 0,
                  fontSize: '0.95rem',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {message.content}
                </p>

                {/* Location if present */}
                {message.location && (
                  <div style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem',
                    background: 'rgba(0,0,0,0.05)',
                    borderRadius: '0.5rem',
                    fontSize: '0.8rem',
                  }}>
                    📍 {JSON.parse(message.location).address || 'Location shared'}
                  </div>
                )}

                {/* Timestamp */}
                <div style={{
                  fontSize: '0.7rem',
                  color: message.authorId === currentUserId ? 'rgba(255,255,255,0.7)' : '#9ca3af',
                  marginTop: '0.25rem',
                  textAlign: message.authorId === currentUserId ? 'right' : 'left',
                }}>
                  {formatTime(message.createdAt)}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error display */}
      {error && (
        <div style={{
          padding: '0.75rem 1rem',
          background: '#fef2f2',
          borderTop: '1px solid #fecaca',
          color: '#dc2626',
          fontSize: '0.875rem',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Message input */}
      <form
        onSubmit={handleSendMessage}
        style={{
          padding: '1rem',
          borderTop: '1px solid #e2e8f0',
          background: 'white',
        }}
      >
        {/* Announcement toggle for leaders */}
        {isLeader && isParticipant && (
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.75rem',
            fontSize: '0.875rem',
            color: '#64748b',
            cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={isAnnouncement}
              onChange={(e) => setIsAnnouncement(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            📢 Send as announcement (highlighted for all)
          </label>
        )}

        <div style={{
          display: 'flex',
          gap: '0.75rem',
        }}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={isParticipant ? 'Type a message...' : 'Join the search to send messages'}
            disabled={!isParticipant || sending}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              outline: 'none',
              opacity: isParticipant ? 1 : 0.6,
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#2563eb';
              e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e2e8f0';
              e.target.style.boxShadow = 'none';
            }}
          />
          <button
            type="submit"
            disabled={!isParticipant || !newMessage.trim() || sending}
            style={{
              padding: '0.75rem 1.5rem',
              background: isParticipant && newMessage.trim() ? '#2563eb' : '#94a3b8',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: isParticipant && newMessage.trim() ? 'pointer' : 'not-allowed',
              opacity: sending ? 0.7 : 1,
              minWidth: '80px',
            }}
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
