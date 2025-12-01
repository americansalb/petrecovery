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
        <div className="mb-4 space-y-2">
          {announcements
            .filter(a => a.isPinned)
            .filter(a => !isDivisionPage || a.divisionId === divisionId)
            .slice(0, 3)
            .map(announcement => (
              <div
                key={announcement.id}
                className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4"
              >
                <div className="flex items-start gap-3">
                  <Pin className="text-amber-400 flex-shrink-0 mt-1" size={18} />
                  <div className="flex-1">
                    <h4 className="font-semibold text-amber-300 mb-1">
                      {announcement.title || 'Announcement'}
                    </h4>
                    <p className="text-slate-200 text-sm">{announcement.content}</p>
                    <p className="text-xs text-slate-400 mt-2">
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
        <div className="mb-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showDivisionMessages}
                onChange={(e) => setShowDivisionMessages(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500/50"
              />
              Include division messages
            </label>
            {showDivisionMessages && (
              <button
                onClick={() => setShowDivisionFilter(!showDivisionFilter)}
                className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colors"
              >
                <Filter size={14} />
                Filter divisions
                <ChevronDown
                  size={14}
                  className={`transition-transform ${showDivisionFilter ? 'rotate-180' : ''}`}
                />
              </button>
            )}
          </div>

          {/* Division Filter Checkboxes */}
          {showDivisionFilter && showDivisionMessages && (
            <div className="mt-3 pt-3 border-t border-slate-700/50 grid grid-cols-2 gap-2">
              {divisions.map(div => (
                <label
                  key={div.id}
                  className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedDivisions.has(div.id)}
                    onChange={() => toggleDivisionFilter(div.id)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500/50"
                  />
                  {div.name}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
        {filteredMessages.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">💬</div>
            <h3 className="text-xl font-semibold text-slate-300 mb-2">
              {isDivisionPage ? 'No division messages yet' : 'No messages yet'}
            </h3>
            <p className="text-slate-400">
              Be the first to start the conversation!
            </p>
          </div>
        ) : (
          <>
            {filteredMessages.map(msg => {
              const division = divisions.find(d => d.id === msg.divisionId);
              const roleColors = {
                FOUNDER: 'text-purple-400',
                LEADER: 'text-amber-400',
                COORDINATOR: 'text-blue-400',
                MEMBER: 'text-slate-400',
              };
              const roleColor = roleColors[msg.authorRole] || 'text-slate-400';

              return (
                <div
                  key={msg.id}
                  className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 hover:border-slate-600/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{msg.authorName}</span>
                      <span className={`text-xs ${roleColor}`}>
                        {msg.authorRole.toLowerCase()}
                      </span>
                      {division && !isDivisionPage && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30">
                          {division.name}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">
                      {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-slate-200">{msg.content}</p>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      {membership.isMember && (
        <div className="sticky bottom-0 bg-gradient-to-br from-slate-900 to-slate-800 border-t border-slate-700/50 p-4 rounded-t-lg">
          <div className="flex gap-3">
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
                flex-1 px-4 py-3 rounded-lg
                bg-slate-800 border border-slate-600
                text-white placeholder-slate-400
                focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50
                transition-all
              "
            />
            <button
              onClick={handleSend}
              disabled={!messageText.trim() || sending}
              className="
                px-6 py-3 rounded-lg
                bg-gradient-to-r from-orange-500 to-blue-500
                text-white font-semibold
                disabled:opacity-50 disabled:cursor-not-allowed
                hover:shadow-[0_0_20px_rgba(249,115,22,0.4)]
                transition-all duration-200
                flex items-center gap-2
              "
            >
              {sending ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Send size={18} />
                  Send
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {!membership.isMember && (
        <div className="sticky bottom-0 bg-slate-800/50 border-t border-slate-700/50 p-4 text-center">
          <p className="text-slate-400 text-sm">
            Join this squad to participate in community chat
          </p>
        </div>
      )}
    </div>
  );
}
