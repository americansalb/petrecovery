'use client';

/**
 * Mission Activity Panel - Right side of Command Center
 *
 * Shows:
 * - Activity timeline (updates, status changes)
 * - Quick note input
 * - Chat integration (if squad assigned)
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export default function MissionActivityPanel({ missionData, userRole, currentUserId, onUpdate }) {
  const [activeTab, setActiveTab] = useState('timeline');
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const messagesEndRef = useRef(null);

  const canAddNotes = userRole === 'OWNER' || userRole === 'ADMIN' || userRole === 'PARTICIPANT';

  // Fetch updates/notes
  const fetchUpdates = useCallback(async () => {
    if (!missionData?.id) return;

    try {
      const res = await fetch(`/api/missions/${missionData.id}/notes`);
      if (res.ok) {
        const data = await res.json();
        setUpdates(data.updates || []);
      }
    } catch (err) {
      console.error('Error fetching updates:', err);
    } finally {
      setLoading(false);
    }
  }, [missionData?.id]);

  useEffect(() => {
    fetchUpdates();
    // Poll for updates
    const interval = setInterval(fetchUpdates, 30000);
    return () => clearInterval(interval);
  }, [fetchUpdates]);

  // Auto-scroll on new updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [updates]);

  // Submit new note
  const handleSubmitNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() || submitting || !canAddNotes) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/missions/${missionData.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote.trim() }),
      });

      if (res.ok) {
        setNewNote('');
        fetchUpdates();
        onUpdate?.();
      }
    } catch (err) {
      console.error('Error adding note:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Format time
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // Get update icon based on content
  const getUpdateIcon = (update) => {
    const content = update.content?.toLowerCase() || '';
    if (content.includes('status changed')) return '🔄';
    if (content.includes('reunited')) return '🎉';
    if (content.includes('sighting')) return '👁️';
    if (content.includes('joined')) return '👋';
    if (update.isPinned) return '📌';
    return '💬';
  };

  // Build combined timeline from updates and case events
  const buildTimeline = () => {
    const timeline = [];

    // Add case creation
    if (missionData?.createdAt) {
      timeline.push({
        id: 'created',
        type: 'system',
        content: `Case #${missionData.missionNumber} created`,
        createdAt: missionData.createdAt,
        icon: '📋',
      });
    }

    // Add updates
    updates.forEach(u => {
      timeline.push({
        ...u,
        type: 'update',
        icon: getUpdateIcon(u),
      });
    });

    // Add sightings summary
    if (missionData?._count?.sightings > 0) {
      // This is just a placeholder - in real impl we'd fetch sighting details
    }

    // Sort by date (newest first for timeline, oldest first for chat)
    return timeline.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  const timeline = buildTimeline();

  return (
    <div className="h-full flex flex-col bg-slate-900 lg:bg-slate-900/50">
      {/* Tabs */}
      <div className="flex border-b border-slate-700/50 bg-slate-800/50">
        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex-1 py-3 px-4 text-sm font-medium transition ${
            activeTab === 'timeline'
              ? 'text-cyan-400 border-b-2 border-cyan-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          📋 Timeline
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-3 px-4 text-sm font-medium transition ${
            activeTab === 'chat'
              ? 'text-cyan-400 border-b-2 border-cyan-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          💬 Chat
        </button>
      </div>

      {/* Timeline View */}
      {activeTab === 'timeline' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Updates list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
              </div>
            ) : timeline.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <span className="text-3xl mb-2 block">📝</span>
                <p>No updates yet</p>
                <p className="text-sm">Add the first note below</p>
              </div>
            ) : (
              <>
                {timeline.map((item, index) => (
                  <div
                    key={item.id}
                    className={`
                      relative pl-6 pb-3
                      ${index < timeline.length - 1 ? 'border-l-2 border-slate-700/50 ml-2' : ''}
                    `}
                  >
                    {/* Timeline dot */}
                    <div className="absolute left-0 -translate-x-1/2 w-6 h-6 rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center text-xs">
                      {item.icon}
                    </div>

                    {/* Content card */}
                    <div className={`
                      rounded-xl p-3 ml-2
                      ${item.type === 'system'
                        ? 'bg-slate-800/30 border border-slate-700/30'
                        : item.isPinned
                          ? 'bg-yellow-500/10 border border-yellow-500/30'
                          : 'bg-slate-800/50 border border-slate-700/50'}
                    `}>
                      {/* Author info */}
                      {item.author && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-slate-300">
                            {item.author.firstName} {item.author.lastName?.[0]}.
                          </span>
                          {item.authorId === currentUserId && (
                            <span className="text-xs bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded">
                              You
                            </span>
                          )}
                        </div>
                      )}

                      {/* Content */}
                      <p className={`text-sm ${item.type === 'system' ? 'text-slate-400' : 'text-slate-200'}`}>
                        {item.content}
                      </p>

                      {/* Timestamp */}
                      <p className="text-xs text-slate-500 mt-1">
                        {formatTime(item.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Add note input */}
          {canAddNotes && (
            <form onSubmit={handleSubmitNote} className="p-4 border-t border-slate-700/50 bg-slate-800/30">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note or update..."
                  className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
                />
                <button
                  type="submit"
                  disabled={!newNote.trim() || submitting}
                  className="px-4 py-2.5 bg-cyan-500 text-white rounded-xl font-medium hover:bg-cyan-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? '...' : 'Add'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Chat View */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {missionData?.assignments?.[0]?.id ? (
            <ChatView
              assignmentId={missionData.assignments[0].id}
              currentUserId={currentUserId}
              canSend={canAddNotes}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center text-slate-500">
                <span className="text-4xl mb-3 block">💬</span>
                <p className="font-medium mb-1">No Squad Assigned</p>
                <p className="text-sm">Squad chat will be available once a rescue squad is assigned to this case.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Simple chat view component that works with the assignment messages
function ChatView({ assignmentId, currentUserId, canSend }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/messages?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage.trim(), type: 'CHAT' }),
      });

      if (res.ok) {
        setNewMessage('');
        fetchMessages();
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <span className="text-3xl mb-2 block">💬</span>
            <p>No messages yet</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isOwn = msg.authorId === currentUserId;
              const isAnnouncement = msg.type === 'ANNOUNCEMENT';

              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`
                    max-w-[85%] rounded-2xl px-4 py-2.5
                    ${isAnnouncement
                      ? 'bg-yellow-500/20 border border-yellow-500/30 w-full max-w-full'
                      : isOwn
                        ? 'bg-cyan-500 text-white'
                        : 'bg-slate-800 border border-slate-700'}
                  `}>
                    {isAnnouncement && (
                      <div className="text-xs font-semibold text-yellow-400 mb-1">
                        📢 ANNOUNCEMENT
                      </div>
                    )}
                    {!isOwn && (
                      <p className="text-xs font-medium text-slate-400 mb-1">
                        {msg.author?.firstName || 'Unknown'}
                      </p>
                    )}
                    <p className={`text-sm ${isOwn && !isAnnouncement ? 'text-white' : 'text-slate-200'}`}>
                      {msg.content}
                    </p>
                    <p className={`text-xs mt-1 ${isOwn ? 'text-cyan-200/70' : 'text-slate-500'}`}>
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {canSend && (
        <form onSubmit={handleSend} className="p-4 border-t border-slate-700/50 bg-slate-800/30">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="px-4 py-2.5 bg-cyan-500 text-white rounded-xl font-medium hover:bg-cyan-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? '...' : 'Send'}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
