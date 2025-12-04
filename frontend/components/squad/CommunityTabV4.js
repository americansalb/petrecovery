'use client';

/**
 * CommunityTabV4 - Full Social Media Experience
 *
 * Features:
 * - Pinned announcements
 * - Featured urgent cases carousel
 * - Post feed with upvotes/comments (Reddit/Facebook style)
 * - Squad chat section
 * - Create post modal
 * - Stories-style case updates at top
 *
 * Mobile-first scrollable experience
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Pin,
  Send,
  Plus,
  TrendingUp,
  Clock,
  Trophy,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Filter,
  Image,
  Heart,
  AlertTriangle,
  Shield,
  PawPrint,
  Users,
  Radio,
  Megaphone,
  X,
} from 'lucide-react';
import { formatDistanceToNow, isValid, parseISO } from 'date-fns';
import PostFeed from './PostFeed';
import CreatePostModal from './CreatePostModal';

// ============================================================================
// Helper Functions - Must be defined before components to avoid hoisting issues
// ============================================================================

function getSpeciesEmoji(species) {
  const emojis = {
    DOG: '🐕',
    CAT: '🐈',
    BIRD: '🐦',
    RABBIT: '🐰',
    OTHER: '🐾',
  };
  return emojis[species] || '🐾';
}

function safeFormatTime(dateValue) {
  if (!dateValue) return null;
  try {
    const date = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue);
    if (!isValid(date)) return null;
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return null;
  }
}

export default function CommunityTabV4({
  squadId,
  squad,
  cases,
  divisions,
  chatMessages,
  announcements,
  membership,
  stats,
  isDivisionPage = false,
  divisionId = null,
}) {
  const router = useRouter();
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  // Pinned announcements
  const pinnedAnnouncements = useMemo(() => {
    return announcements
      .filter(a => a.isPinned)
      .filter(a => !isDivisionPage || a.divisionId === divisionId)
      .slice(0, 3);
  }, [announcements, isDivisionPage, divisionId]);

  // Urgent cases for the stories carousel
  const urgentCases = useMemo(() => {
    return cases
      .filter(c => {
        if (c.status === 'REUNITED') return false;
        if (!c.lastSeenAt) return false;
        const hours = (Date.now() - new Date(c.lastSeenAt).getTime()) / 3600000;
        return hours < 48; // 48 hours
      })
      .sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt))
      .slice(0, 10);
  }, [cases]);

  // Recent reunions for celebration
  const recentReunions = useMemo(() => {
    return cases
      .filter(c => c.status === 'REUNITED')
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .slice(0, 5);
  }, [cases]);

  // Filter chat messages
  const filteredMessages = useMemo(() => {
    if (isDivisionPage) {
      return chatMessages.filter(msg => msg.divisionId === divisionId);
    }
    return chatMessages;
  }, [chatMessages, isDivisionPage, divisionId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredMessages.length]);

  const handleSendMessage = async () => {
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
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-900">
      <div className="max-w-2xl mx-auto px-4 py-4 pb-20 space-y-5">
        {/* Squad Quick Stats Bar */}
        <div className="flex items-center justify-between gap-2 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
          <StatChip icon={PawPrint} value={stats.active} label="Active" color="red" />
          <StatChip icon={Heart} value={stats.reunited} label="Reunited" color="green" />
          <StatChip icon={Users} value={stats.members} label="Members" color="blue" />
          <StatChip icon={Radio} value={stats.onDuty} label="On Duty" color="flash" />
        </div>

        {/* Stories-Style Urgent Cases */}
        {urgentCases.length > 0 && (
          <div className="overflow-visible">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-400" />
              <span className="text-sm font-bold text-red-400 uppercase tracking-wide">Needs Help</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {urgentCases.map(c => (
                <CaseStory
                  key={c.id}
                  caseData={c}
                  onClick={() => router.push(`/mission-control?mission=${c.caseNumber}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Pinned Announcements */}
        {pinnedAnnouncements.length > 0 && (
          <div className="space-y-3">
            {pinnedAnnouncements.map(announcement => (
              <AnnouncementCard key={announcement.id} announcement={announcement} />
            ))}
          </div>
        )}

        {/* Recent Reunions Celebration */}
        {recentReunions.length > 0 && (
          <div className="bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent border border-green-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Heart size={16} className="text-green-400" />
              <span className="text-sm font-bold text-green-400 uppercase tracking-wide">Recently Reunited</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {recentReunions.map(c => (
                <div
                  key={c.id}
                  className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50"
                >
                  {c.photoUrl ? (
                    <img src={c.photoUrl} alt={c.petName} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm">
                      {getSpeciesEmoji(c.species)}
                    </div>
                  )}
                  <span className="text-white font-medium text-sm">{c.petName}</span>
                  <span className="text-green-400 text-sm">✓</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create Post Button (Floating-style) */}
        {membership?.isMember && (
          <button
            onClick={() => setShowCreatePost(true)}
            className="w-full flex items-center gap-3 p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-flash-500/30 rounded-xl transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center group-hover:bg-flash-500/20 transition-colors">
              <Plus size={20} className="text-slate-400 group-hover:text-flash-400" />
            </div>
            <span className="text-slate-400 group-hover:text-slate-300 transition-colors">
              Share something with the squad...
            </span>
          </button>
        )}

        {/* Post Feed */}
        <PostFeed
          squadId={squadId}
          divisionId={isDivisionPage ? divisionId : null}
          membership={membership}
          onCreatePost={() => setShowCreatePost(true)}
          currentUserId={membership?.userId}
        />

        {/* Squad Chat Section */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowChat(!showChat)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <MessageSquare size={20} className="text-flash-400" />
              <span className="font-bold text-white">Squad Chat</span>
              <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full text-xs font-medium">
                {filteredMessages.length}
              </span>
            </div>
            <ChevronDown
              size={20}
              className={`text-slate-400 transition-transform ${showChat ? 'rotate-180' : ''}`}
            />
          </button>

          {showChat && (
            <div className="border-t border-slate-700/50">
              {/* Messages */}
              <div className="max-h-80 overflow-y-auto p-4 space-y-3">
                {filteredMessages.length === 0 ? (
                  <div className="text-center py-6 text-slate-500">
                    <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  filteredMessages.map(msg => (
                    <ChatMessage
                      key={msg.id}
                      message={msg}
                      divisions={divisions}
                      isDivisionPage={isDivisionPage}
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              {membership?.isMember && (
                <div className="p-4 border-t border-slate-700/50 bg-slate-900/50">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-flash-500/50 focus:ring-1 focus:ring-flash-500/30"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!messageText.trim() || sending}
                      className="px-4 py-2.5 bg-flash-500 text-slate-900 font-bold rounded-xl disabled:opacity-50 hover:bg-flash-400 transition-colors"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Join Squad CTA for non-members */}
        {!membership?.isMember && (
          <div className="bg-gradient-to-r from-flash-500/20 via-flash-500/10 to-transparent border border-flash-500/30 rounded-xl p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-flash-500/20 rounded-xl">
                <Shield className="text-flash-400" size={28} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-white text-lg mb-1">
                  Join {squad.cityName || ''} Rescue Squad
                </h3>
                <p className="text-slate-400 text-sm">
                  Help reunite lost pets with their families
                </p>
              </div>
            </div>
            <button className="w-full mt-4 px-4 py-3 bg-flash-500 text-slate-900 font-bold rounded-xl hover:bg-flash-400 transition-colors">
              Join This Squad
            </button>
          </div>
        )}
      </div>

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        onSubmit={() => window.location.reload()}
        squadId={squadId}
        divisionId={isDivisionPage ? divisionId : null}
      />

      {/* Hide scrollbar styles */}
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Stat Chip Component
// ============================================================================

function StatChip({ icon: Icon, value, label, color }) {
  const colors = {
    red: 'text-red-400',
    green: 'text-green-400',
    blue: 'text-blue-400',
    flash: 'text-flash-400',
  };

  return (
    <div className="flex items-center gap-2">
      <Icon size={14} className={colors[color]} />
      <span className="text-white font-bold text-sm">{value}</span>
      <span className="text-slate-500 text-xs hidden sm:inline">{label}</span>
    </div>
  );
}

// ============================================================================
// Case Story Component (Instagram Stories style)
// ============================================================================

function CaseStory({ caseData, onClick }) {
  const speciesEmoji = getSpeciesEmoji(caseData.species);
  const isUrgent = caseData.urgency === 'HIGH' ||
    (caseData.lastSeenAt && (Date.now() - new Date(caseData.lastSeenAt).getTime()) / 3600000 < 24);

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 flex flex-col items-center gap-2 group"
    >
      <div className={`
        relative p-0.5 rounded-full
        ${isUrgent
          ? 'bg-gradient-to-br from-red-500 via-orange-500 to-red-500'
          : 'bg-gradient-to-br from-flash-400 to-amber-500'
        }
      `}>
        <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-800 border-2 border-slate-900">
          {caseData.photoUrl ? (
            <img
              src={caseData.photoUrl}
              alt={caseData.petName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl bg-slate-700">
              {speciesEmoji}
            </div>
          )}
        </div>
        {isUrgent && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
            <AlertTriangle size={10} className="text-white" />
          </div>
        )}
      </div>
      <span className="text-xs text-slate-300 font-medium max-w-[70px] truncate group-hover:text-white transition-colors">
        {caseData.petName}
      </span>
    </button>
  );
}

// ============================================================================
// Announcement Card Component
// ============================================================================

function AnnouncementCard({ announcement }) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-flash-500/15 via-flash-500/5 to-transparent border border-flash-500/30 rounded-xl p-4">
      <div className="absolute top-0 right-0 w-20 h-20 bg-flash-500/10 rounded-full blur-2xl" />
      <div className="relative flex items-start gap-3">
        <div className="p-2 bg-flash-500/20 rounded-lg flex-shrink-0">
          <Megaphone className="text-flash-400" size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-flash-400 uppercase tracking-wide">Pinned</span>
          </div>
          {announcement.title && (
            <h4 className="font-bold text-white mb-1">{announcement.title}</h4>
          )}
          <p className="text-slate-200 text-sm leading-relaxed">{announcement.content}</p>
          <p className="text-slate-500 text-xs mt-2">
            {announcement.authorName}{safeFormatTime(announcement.createdAt) ? ` · ${safeFormatTime(announcement.createdAt)}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Chat Message Component
// ============================================================================

function ChatMessage({ message, divisions, isDivisionPage }) {
  const division = divisions.find(d => d.id === message.divisionId);

  const roleColors = {
    FOUNDER: 'text-purple-400',
    LEADER: 'text-flash-400',
    COORDINATOR: 'text-blue-400',
    MEMBER: 'text-slate-400',
  };

  return (
    <div className="bg-slate-800/40 rounded-lg p-3 hover:bg-slate-800/60 transition-colors">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-bold text-white text-sm">{message.authorName}</span>
        <span className={`text-xs font-medium ${roleColors[message.authorRole] || 'text-slate-400'}`}>
          {message.authorRole?.toLowerCase()}
        </span>
        {division && !isDivisionPage && (
          <span className="px-2 py-0.5 bg-flash-500/20 text-flash-300 rounded-full text-xs">
            {division.name}
          </span>
        )}
        {safeFormatTime(message.createdAt) && (
          <span className="text-xs text-slate-500 ml-auto">
            {safeFormatTime(message.createdAt)}
          </span>
        )}
      </div>
      <p className="text-slate-200 text-sm">{message.content}</p>
    </div>
  );
}

