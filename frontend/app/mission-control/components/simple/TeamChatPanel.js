'use client';

/**
 * TeamChatPanel - Combined team members and chat
 *
 * Features:
 * - Team members at top with status
 * - Chat messages below
 * - Quick location sharing
 */

import { useState, useRef, useEffect } from 'react';
import {
  Send,
  MapPin,
  Users,
  CheckCheck,
  Circle,
  Navigation,
} from 'lucide-react';

// Quick message templates
const QUICK_MESSAGES = [
  { id: 'searching', text: "I'm searching now", icon: '🔍' },
  { id: 'sighting', text: 'I saw them!', icon: '👁' },
  { id: 'help', text: 'Need help here', icon: '🆘' },
  { id: 'clear', text: 'Area clear', icon: '✅' },
];

export default function TeamChatPanel({
  team = [],
  activeParticipants = [],
  messages = [],
  onSendMessage,
  onShareLocation,
  currentUserId,
  isLoading = false,
}) {
  const [newMessage, setNewMessage] = useState('');
  const [showQuickMessages, setShowQuickMessages] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Handle visual viewport changes (keyboard open/close)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const viewport = window.visualViewport;

    const handleResize = () => {
      const newKeyboardHeight = window.innerHeight - viewport.height;
      setKeyboardHeight(Math.max(0, newKeyboardHeight));

      if (newKeyboardHeight > 0 && inputRef.current) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    };

    viewport.addEventListener('resize', handleResize);
    viewport.addEventListener('scroll', handleResize);

    return () => {
      viewport.removeEventListener('resize', handleResize);
      viewport.removeEventListener('scroll', handleResize);
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    onSendMessage?.(newMessage.trim());
    setNewMessage('');
  };

  const handleQuickMessage = (text) => {
    onSendMessage?.(text);
    setShowQuickMessages(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Get active team member IDs
  const activeIds = new Set(activeParticipants.map(p => p.id || p.oderId || p.userId));

  return (
    <div
      className="flex-1 flex flex-col bg-slate-950 overflow-hidden"
      style={{ paddingBottom: keyboardHeight > 0 ? `${keyboardHeight}px` : undefined }}
    >
      {/* Team Members Strip */}
      <div className="shrink-0 px-4 py-3 bg-slate-900/50 border-b border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Users size={12} />
            Team ({team.length})
          </h3>
          {activeParticipants.length > 0 && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {activeParticipants.length} searching
            </span>
          )}
        </div>

        {/* Member avatars */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {team.length > 0 ? (
            team.slice(0, 10).map((member, i) => {
              const isActive = activeIds.has(member.id) || activeIds.has(member.userId);
              const initials = member.firstName?.[0] || member.name?.[0] || '?';

              return (
                <div key={member.id || i} className="flex flex-col items-center gap-1 shrink-0">
                  <div className="relative">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500'
                        : 'bg-slate-800 text-slate-400 border-2 border-slate-700'
                    }`}>
                      {initials}
                    </div>
                    {isActive && (
                      <Navigation size={10} className="absolute -bottom-0.5 -right-0.5 text-emerald-400" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 truncate max-w-[50px]">
                    {member.firstName || member.name?.split(' ')[0] || 'Member'}
                  </span>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-slate-500">No team members yet. Share the case to invite helpers!</p>
          )}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length > 0 ? (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.userId === currentUserId ? 'justify-end' : 'justify-start'}`}
            >
              {msg.isSystem ? (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2 max-w-[85%]">
                  <p className="text-slate-400 text-sm">{msg.text}</p>
                </div>
              ) : msg.userId === currentUserId ? (
                <div className="max-w-[85%]">
                  <div className="bg-amber-500/20 border border-amber-500/30 rounded-2xl rounded-br-md px-4 py-2">
                    <p className="text-white text-sm">{msg.text}</p>
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[10px] text-slate-600">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <CheckCheck size={12} className="text-amber-500" />
                  </div>
                </div>
              ) : (
                <div className="max-w-[85%]">
                  <p className="text-xs text-slate-500 mb-1 ml-1">{msg.userName}</p>
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-md px-4 py-2">
                    <p className="text-white text-sm">{msg.text}</p>
                  </div>
                  <span className="text-[10px] text-slate-600 mt-1 ml-1 block">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
              <Send size={20} className="text-slate-600" />
            </div>
            <p className="text-sm text-slate-400">Team chat is ready</p>
            <p className="text-xs text-slate-500 mt-1">Coordinate your search with the team</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Messages */}
      {showQuickMessages && (
        <div className="shrink-0 p-3 border-t border-slate-800 bg-slate-900">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {QUICK_MESSAGES.map(qm => (
              <button
                key={qm.id}
                onClick={() => handleQuickMessage(qm.text)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-full text-sm text-white transition shrink-0"
              >
                <span>{qm.icon}</span>
                <span>{qm.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="shrink-0 p-3 border-t border-slate-800 bg-slate-900">
        <div className="flex items-end gap-2">
          {/* Quick actions */}
          <button
            onClick={() => setShowQuickMessages(!showQuickMessages)}
            className={`p-2.5 rounded-xl transition shrink-0 ${
              showQuickMessages
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            ⚡
          </button>
          <button
            onClick={onShareLocation}
            className="p-2.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl transition shrink-0"
          >
            <MapPin size={18} />
          </button>

          {/* Text input */}
          <div className="flex-1">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Message team..."
              enterKeyHint="send"
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 border border-slate-700 focus:border-amber-500 focus:outline-none placeholder-slate-500"
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || isLoading}
            className={`p-2.5 rounded-xl transition shrink-0 ${
              newMessage.trim()
                ? 'bg-amber-500 text-white hover:bg-amber-400'
                : 'bg-slate-800 text-slate-600'
            }`}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
