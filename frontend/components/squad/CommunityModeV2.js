'use client';

/**
 * CommunityModeV2 - Community posts, discussions, and engagement
 *
 * Features:
 * - Featured urgent cases carousel
 * - Pinned announcements
 * - Post feed with upvotes/downvotes (Reddit-style)
 * - Threaded comments (Reddit-style)
 * - Rich post creation with images
 * - Chat messages section
 */

import { useState, useRef, useEffect } from 'react';
import { Pin, Send, Filter, ChevronDown, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import FeaturedCasesCarousel from './FeaturedCasesCarousel';
import PostFeed from './PostFeed';
import CreatePostModal from './CreatePostModal';

export default function CommunityModeV2({
  squadId,
  messages = [],
  announcements = [],
  membership,
  isDivisionPage = false,
  divisionId = null,
  divisions = [],
  cases = [],
}) {
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [showDivisionMessages, setShowDivisionMessages] = useState(true);
  const [selectedDivisions, setSelectedDivisions] = useState(new Set());
  const [showDivisionFilter, setShowDivisionFilter] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showChatSection, setShowChatSection] = useState(false);
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
    <div className="space-y-6">
      {/* Featured Cases Carousel */}
      <FeaturedCasesCarousel cases={cases} />

      {/* Pinned Announcements */}
      {announcements.length > 0 && (
        <div className="space-y-3">
          {announcements
            .filter(a => a.isPinned)
            .filter(a => !isDivisionPage || a.divisionId === divisionId)
            .slice(0, 3)
            .map(announcement => (
              <div
                key={announcement.id}
                className="relative overflow-hidden bg-gradient-to-br from-flash-400/10 via-flash-400/5 to-transparent backdrop-blur-sm border border-flash-400/40 rounded-2xl p-6 shadow-lg shadow-flash-400/10"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-flash-400/5 rounded-full blur-2xl" />
                <div className="relative flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-flash-400/20 border border-flash-400/30">
                    <Pin className="text-flash-300 flex-shrink-0" size={20} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-lg text-flash-200 mb-2">
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

      {/* Main Post Feed */}
      <PostFeed
        squadId={squadId}
        divisionId={isDivisionPage ? divisionId : null}
        membership={membership}
        onCreatePost={() => setShowCreatePost(true)}
        currentUserId={membership?.userId}
      />

      {/* Chat Messages Section (Collapsible) */}
      {messages.length > 0 && (
        <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowChatSection(!showChatSection)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-800/50 transition-all"
          >
            <div className="flex items-center gap-3">
              <MessageSquare size={20} className="text-flash-400" />
              <span className="font-bold text-white">Squad Chat</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-700/70 text-slate-300">
                {filteredMessages.length}
              </span>
            </div>
            <ChevronDown
              size={20}
              className={`text-slate-400 transition-transform duration-200 ${showChatSection ? 'rotate-180' : ''}`}
            />
          </button>

          {showChatSection && (
            <div className="border-t border-slate-700/50 p-6 space-y-4">
              {/* Filter Controls */}
              {!isDivisionPage && divisions.length > 0 && (
                <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-700/50">
                  <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center gap-3 text-sm text-slate-200 font-medium cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={showDivisionMessages}
                        onChange={(e) => setShowDivisionMessages(e.target.checked)}
                        className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-flash-500 focus:ring-2 focus:ring-cyan-500/50 cursor-pointer"
                      />
                      <span className="group-hover:text-white transition-colors">Include division messages</span>
                    </label>
                    {showDivisionMessages && (
                      <button
                        onClick={() => setShowDivisionFilter(!showDivisionFilter)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-flash-400 bg-flash-500/10 border border-flash-500/30 hover:bg-flash-500/20 hover:text-flash-300 transition-all"
                      >
                        <Filter size={14} />
                        Filter
                        <ChevronDown
                          size={14}
                          className={`transition-transform duration-200 ${showDivisionFilter ? 'rotate-180' : ''}`}
                        />
                      </button>
                    )}
                  </div>

                  {showDivisionFilter && showDivisionMessages && (
                    <div className="mt-3 pt-3 border-t border-slate-700/50 grid grid-cols-2 gap-2">
                      {divisions.map(div => (
                        <label
                          key={div.id}
                          className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-700/30 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedDivisions.has(div.id)}
                            onChange={() => toggleDivisionFilter(div.id)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-flash-500"
                          />
                          <span className="text-xs">{div.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Messages */}
              <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
                {filteredMessages.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No messages to show</p>
                  </div>
                ) : (
                  <>
                    {filteredMessages.map(msg => {
                      const division = divisions.find(d => d.id === msg.divisionId);
                      const roleColors = {
                        FOUNDER: 'text-purple-400',
                        LEADER: 'text-flash-300',
                        COORDINATOR: 'text-blue-400',
                        MEMBER: 'text-slate-400',
                      };
                      const roleColor = roleColors[msg.authorRole] || 'text-slate-400';

                      return (
                        <div
                          key={msg.id}
                          className="bg-slate-800/40 rounded-lg p-4 hover:bg-slate-800/60 transition-all"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-white text-sm">{msg.authorName}</span>
                            <span className={`text-xs font-semibold uppercase ${roleColor}`}>
                              {msg.authorRole.toLowerCase()}
                            </span>
                            {division && !isDivisionPage && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/20 text-flash-300">
                                {division.name}
                              </span>
                            )}
                            <span className="text-xs text-slate-500 ml-auto">
                              {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-slate-200 text-sm">{msg.content}</p>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Message Input */}
              {membership.isMember && (
                <div className="pt-4 border-t border-slate-700/50">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      placeholder="Quick message..."
                      className="flex-1 px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-flash-500/70 focus:ring-1 focus:ring-flash-500/30 transition-all"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!messageText.trim() || sending}
                      className="px-4 py-2 rounded-lg bg-gradient-to-r from-flash-500 to-flash-400 text-white font-semibold text-sm disabled:opacity-50 hover:shadow-lg transition-all"
                    >
                      {sending ? '...' : 'Send'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        onSubmit={() => window.location.reload()}
        squadId={squadId}
        divisionId={isDivisionPage ? divisionId : null}
      />
    </div>
  );
}
