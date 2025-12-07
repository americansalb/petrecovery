'use client';

/**
 * SquadChat Component
 *
 * In-mission chat for squad coordination with Scout tip integration.
 * Features:
 * - Real-time message display
 * - Scout tip sharing
 * - Message input with send
 * - Compact/expanded variants
 *
 * Per Actions_Guide.md Phase 5 specification.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, MessageCircle, X, ChevronDown, ChevronUp, Users } from 'lucide-react';

// =============================================================================
// SQUAD CHAT HOOK
// =============================================================================

export function useSquadChat(squadId, caseId, options = {}) {
  const { autoRefresh = true, refreshInterval = 10000 } = options;

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const refreshIntervalRef = useRef(null);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!squadId) return;

    try {
      const url = caseId
        ? `/api/rescue-squads/${squadId}/chat?caseId=${caseId}`
        : `/api/rescue-squads/${squadId}/chat`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch messages');

      const data = await res.json();
      setMessages(data.messages || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching chat:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [squadId, caseId]);

  // Send message
  const sendMessage = useCallback(async (content) => {
    if (!squadId || !content?.trim()) return { success: false };

    setSending(true);

    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, caseId }),
      });

      if (!res.ok) throw new Error('Failed to send message');

      const data = await res.json();

      // Add message to local state immediately
      setMessages((prev) => [...prev, data.message]);

      return { success: true, message: data.message };
    } catch (err) {
      console.error('Error sending message:', err);
      return { success: false, error: err.message };
    } finally {
      setSending(false);
    }
  }, [squadId, caseId]);

  // Share Scout tip to chat
  const shareScoutTip = useCallback(async (tip) => {
    const tipMessage = `Scout says: "${tip.message}" (${tip.tipType || 'Tip'})`;
    return sendMessage(tipMessage);
  }, [sendMessage]);

  // Initial fetch
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && squadId) {
      refreshIntervalRef.current = setInterval(fetchMessages, refreshInterval);
      return () => clearInterval(refreshIntervalRef.current);
    }
  }, [autoRefresh, refreshInterval, squadId, fetchMessages]);

  return {
    messages,
    loading,
    sending,
    error,
    sendMessage,
    shareScoutTip,
    fetchMessages,
  };
}

// =============================================================================
// SQUAD CHAT COMPONENT
// =============================================================================

export default function SquadChat({
  squadId,
  caseId,
  variant = 'compact', // 'compact' | 'expanded' | 'floating'
  onClose,
  className = '',
}) {
  const {
    messages,
    loading,
    sending,
    error,
    sendMessage,
    fetchMessages,
  } = useSquadChat(squadId, caseId);

  const [inputValue, setInputValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(variant === 'expanded');
  const messagesEndRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handle send
  const handleSend = async () => {
    if (!inputValue.trim() || sending) return;

    const result = await sendMessage(inputValue);
    if (result.success) {
      setInputValue('');
    }
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Compact variant - just a button to expand
  if (variant === 'compact' && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white hover:bg-slate-700 transition ${className}`}
      >
        <MessageCircle size={18} />
        <span>Team Chat</span>
        {messages.length > 0 && (
          <span className="px-2 py-0.5 bg-flash-500 text-white text-xs rounded-full">
            {messages.length}
          </span>
        )}
      </button>
    );
  }

  // Floating variant
  if (variant === 'floating') {
    return (
      <div className={`fixed bottom-20 right-4 w-80 z-50 ${className}`}>
        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 bg-slate-800 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-flash-400" />
              <span className="font-semibold text-white">Team Chat</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="h-64 overflow-y-auto p-3 space-y-2">
            {loading ? (
              <p className="text-slate-500 text-center py-4">Loading...</p>
            ) : messages.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No messages yet</p>
            ) : (
              messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-flash-500"
                disabled={sending}
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || sending}
                className="p-2 bg-flash-500 text-white rounded-lg hover:bg-flash-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Expanded/default variant
  return (
    <div className={`bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-800/70"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <MessageCircle size={18} className="text-flash-400" />
          <span className="font-semibold text-white">Team Chat</span>
          {messages.length > 0 && (
            <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded-full">
              {messages.length}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp size={18} className="text-slate-400" />
        ) : (
          <ChevronDown size={18} className="text-slate-400" />
        )}
      </div>

      {isExpanded && (
        <>
          {/* Messages */}
          <div className="h-48 overflow-y-auto p-3 space-y-2 border-t border-slate-700/50">
            {loading ? (
              <p className="text-slate-500 text-center py-4">Loading...</p>
            ) : messages.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No messages yet. Start the conversation!</p>
            ) : (
              messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-700/50">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-flash-500 text-sm"
                disabled={sending}
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || sending}
                className="p-2 bg-flash-500 text-white rounded-lg hover:bg-flash-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </>
      )}

      {error && (
        <div className="px-3 py-2 bg-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// CHAT MESSAGE COMPONENT
// =============================================================================

function ChatMessage({ message }) {
  const isScoutTip = message.content?.startsWith('Scout says:');
  const timeStr = formatMessageTime(message.createdAt);

  return (
    <div className={`flex flex-col ${isScoutTip ? 'bg-amber-500/10 border border-amber-500/30 rounded-lg p-2' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-white text-sm">
          {isScoutTip ? 'Scout' : message.authorName}
        </span>
        {message.authorRole === 'CAPTAIN' && !isScoutTip && (
          <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">
            Captain
          </span>
        )}
        <span className="text-slate-500 text-xs">{timeStr}</span>
      </div>
      <p className={`text-sm mt-0.5 ${isScoutTip ? 'text-amber-200 italic' : 'text-slate-300'}`}>
        {isScoutTip ? message.content.replace('Scout says: ', '') : message.content}
      </p>
    </div>
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatMessageTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffMins < 1440) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
