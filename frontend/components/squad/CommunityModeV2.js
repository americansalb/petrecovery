'use client';

/**
 * CommunityModeV2 - Community chat and announcements
 *
 * Features:
 * - Pinned announcements at top
 * - Scrollable message feed
 * - Division tags on messages from divisions
 * - Text input to send messages
 * - Filter to show/hide division messages
 */

import { useState, useRef, useEffect } from 'react';
import { Pin, Send, Filter, ChevronDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function CommunityModeV2({
  squadId,
  messages = [],
  announcements = [],
  membership,
  isDivisionPage = false,
  divisionId = null,
  divisions = [],
}) {
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [showDivisionMessages, setShowDivisionMessages] = useState(true);
  const [selectedDivisions, setSelectedDivisions] = useState(new Set());
  const [showDivisionFilter, setShowDivisionFilter] = useState(false);
  const messagesEndRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Filter messages based on division settings
  const filteredMessages = messages.filter(msg => {
    // If on division page, only show division messages
    if (isDivisionPage) {
      return msg.divisionId === divisionId;
    }

    // If on squad page
    // Squad-level messages (no divisionId) always show
    if (!msg.divisionId) return true;

    // Division messages: check filter settings
    if (!showDivisionMessages) return false;

    // If specific divisions selected, only show those
    if (selectedDivisions.size > 0) {
      return selectedDivisions.has(msg.divisionId);
    }

    // Otherwise show all division messages
    return true;
  });

  const handleSend = async () => {
    if (!messageText.trim()) return;

    setSending(true);
    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          divisionId: isDivisionPage ? divisionId : null,
        }),
      });

      if (res.ok) {
        setMessageText('');
        // Refresh messages - parent should handle this
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const toggleDivisionFilter = (divId) => {
    const newSet = new Set(selectedDivisions);
    if (newSet.has(divId)) {
      newSet.delete(divId);
    } else {
      newSet.add(divId);
    }
    setSelectedDivisions(newSet);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-300px)] min-h-[500px]">
      {/* Pinned Announcements */}
      {announcements.length > 0 && (
        <div className="mb-6 space-y-3">
          {announcements
            .filter(a => a.isPinned)
            .filter(a => !isDivisionPage || a.divisionId === divisionId)
            .slice(0, 3)
            .map(announcement => (
              <div
                key={announcement.id}
                className="relative overflow-hidden bg-gradient-to-br from-cyan-400/10 via-cyan-400/5 to-transparent backdrop-blur-sm border border-cyan-400/40 rounded-2xl p-6 shadow-lg shadow-cyan-400/10"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-400/5 rounded-full blur-2xl" />
                <div className="relative flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-cyan-400/20 border border-cyan-400/30">
                    <Pin className="text-amber-300 flex-shrink-0" size={20} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-lg text-amber-200 mb-2">
                      {announcement.title || 'Announcement'}
                    </h4>
                    <p className="text-slate-200 text-base leading-relaxed mb-3">{announcement.content}</p>
                    <p className="text-xs text-slate-500 font-medium">
                      {announcement.authorName} · {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Filter Controls (Squad Page Only) */}
      {!isDivisionPage && divisions.length > 0 && (
        <div className="mb-6 p-5 bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-3 text-sm text-slate-200 font-medium cursor-pointer group">
              <input
                type="checkbox"
                checked={showDivisionMessages}
                onChange={(e) => setShowDivisionMessages(e.target.checked)}
                className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-2 focus:ring-cyan-500/50 cursor-pointer"
              />
              <span className="group-hover:text-white transition-colors">Include division messages</span>
            </label>
            {showDivisionMessages && (
              <button
                onClick={() => setShowDivisionFilter(!showDivisionFilter)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 hover:text-cyan-300 transition-all"
              >
                <Filter size={14} />
                Filter divisions
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${showDivisionFilter ? 'rotate-180' : ''}`}
                />
              </button>
            )}
          </div>

          {/* Division Filter Checkboxes */}
          {showDivisionFilter && showDivisionMessages && (
            <div className="mt-4 pt-4 border-t border-slate-700/50 grid grid-cols-2 gap-3">
              {divisions.map(div => (
                <label
                  key={div.id}
                  className="flex items-center gap-3 text-sm text-slate-200 font-medium cursor-pointer p-2 rounded-lg hover:bg-slate-700/30 transition-colors group"
                >
                  <input
                    type="checkbox"
                    checked={selectedDivisions.has(div.id)}
                    onChange={() => toggleDivisionFilter(div.id)}
                    className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-2 focus:ring-cyan-500/50 cursor-pointer"
                  />
                  <span className="group-hover:text-white transition-colors">{div.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2">
        {filteredMessages.length === 0 ? (
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-20 text-center">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl" />
            <div className="relative">
              <div className="text-7xl mb-6">💬</div>
              <h3 className="text-2xl font-bold text-white mb-3">
                {isDivisionPage ? 'No division messages yet' : 'No messages yet'}
              </h3>
              <p className="text-slate-400 text-lg">
                Be the first to start the conversation!
              </p>
            </div>
          </div>
        ) : (
          <>
            {filteredMessages.map(msg => {
              const division = divisions.find(d => d.id === msg.divisionId);
              const roleColors = {
                FOUNDER: 'text-purple-400',
                LEADER: 'text-cyan-300',
                COORDINATOR: 'text-blue-400',
                MEMBER: 'text-slate-400',
              };
              const roleColor = roleColors[msg.authorRole] || 'text-slate-400';

              return (
                <div
                  key={msg.id}
                  className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-5 hover:border-slate-600/70 hover:shadow-lg hover:shadow-slate-900/50 transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-white">{msg.authorName}</span>
                      <span className={`text-xs font-semibold uppercase tracking-wide ${roleColor}`}>
                        {msg.authorRole.toLowerCase()}
                      </span>
                      {division && !isDivisionPage && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 backdrop-blur-sm">
                          📍 {division.name}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 font-medium whitespace-nowrap ml-2">
                      {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-slate-200 leading-relaxed">{msg.content}</p>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      {membership.isMember && (
        <div className="sticky bottom-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-t-2 border-slate-700/60 p-6 rounded-t-2xl shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
          <div className="flex gap-4">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={
                isDivisionPage
                  ? 'Share an update with your division...'
                  : 'Share an update with your city...'
              }
              className="
                flex-1 px-5 py-4 rounded-xl
                bg-slate-800/50 backdrop-blur-sm border-2 border-slate-600/50
                text-white placeholder-slate-500 font-medium
                focus:outline-none focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/30
                hover:border-slate-500/50
                transition-all duration-200
              "
            />
            <button
              onClick={handleSend}
              disabled={!messageText.trim() || sending}
              className="
                px-8 py-4 rounded-xl
                bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500
                text-white font-bold text-base
                disabled:opacity-50 disabled:cursor-not-allowed
                enabled:hover:shadow-[0_0_25px_rgba(249,115,22,0.5)]
                enabled:hover:scale-105
                transition-all duration-300
                flex items-center gap-2.5
              "
            >
              {sending ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Send size={20} strokeWidth={2.5} />
                  <span>Send</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {!membership.isMember && (
        <div className="sticky bottom-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-t-2 border-slate-700/60 p-6 rounded-t-2xl text-center shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
          <p className="text-slate-400 text-base font-medium">
            Join this squad to participate in community chat
          </p>
        </div>
      )}
    </div>
  );
}
