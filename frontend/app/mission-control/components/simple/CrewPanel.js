'use client';

/**
 * CrewPanel - Merged Team + Actions panel
 *
 * Combines:
 * - Team members list (from TeamChatPanel)
 * - Real-time chat (from TeamChatPanel)
 * - Share buttons (from ActionsPanel)
 * - Flyer download (from ActionsPanel)
 * - Shelter list (from ActionsPanel)
 *
 * Includes contextual tips woven into each section.
 */

import { useState, useRef, useEffect } from 'react';
import {
  Send,
  MapPin,
  Users,
  CheckCheck,
  Circle,
  Navigation,
  Share2,
  Printer,
  Phone,
  Building2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import ContextualTip, { TIPS } from './ContextualTip';

// Quick message templates
const QUICK_MESSAGES = [
  { id: 'searching', text: "I'm searching now", icon: '🔍' },
  { id: 'sighting', text: 'I saw them!', icon: '👁' },
  { id: 'help', text: 'Need help here', icon: '🆘' },
  { id: 'clear', text: 'Area clear', icon: '✅' },
];

// Share platforms
const SHARE_PLATFORMS = [
  { id: 'facebook', name: 'Facebook', icon: '📘', color: 'bg-blue-600' },
  { id: 'nextdoor', name: 'Nextdoor', icon: '🏘️', color: 'bg-green-600' },
  { id: 'twitter', name: 'X', icon: '𝕏', color: 'bg-slate-700' },
  { id: 'instagram', name: 'Instagram', icon: '📷', color: 'bg-pink-600' },
];

// Sample shelters (in production, fetch from API)
const NEARBY_SHELTERS = [
  { id: '1', name: 'City Animal Shelter', distance: '2.1 mi', phone: '(555) 123-4567', type: 'Municipal' },
  { id: '2', name: 'Humane Society', distance: '3.4 mi', phone: '(555) 234-5678', type: 'Non-profit' },
  { id: '3', name: 'Pet Rescue League', distance: '5.2 mi', phone: '(555) 345-6789', type: 'Rescue' },
  { id: '4', name: 'County Animal Control', distance: '6.8 mi', phone: '(555) 456-7890', type: 'Government' },
];

export default function CrewPanel({
  // Mission data
  mission,

  // Team data (from useMissionControl)
  team = [],
  activeParticipants = [],

  // Chat data (from useMissionChat)
  messages = [],
  onSendMessage,
  onShareLocation,
  currentUserId,
  isLoadingChat = false,

  // Action handlers
  onShare,
  onDownloadFlyer,
  onCallShelter,
}) {
  // Chat state
  const [newMessage, setNewMessage] = useState('');
  const [showQuickMessages, setShowQuickMessages] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Shelter state
  const [calledShelters, setCalledShelters] = useState(new Set());
  const [copiedPhone, setCopiedPhone] = useState(null);

  // Section collapse state
  const [collapsedSections, setCollapsedSections] = useState({
    chat: false,
    share: false,
    shelters: false,
  });

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Chat handlers
  const handleSend = () => {
    if (!newMessage.trim()) return;
    onSendMessage?.(newMessage.trim());
    setNewMessage('');
  };

  const handleQuickMessage = (msg) => {
    onSendMessage?.(msg.text);
    setShowQuickMessages(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Shelter handlers
  const handleCallShelter = (shelter) => {
    window.location.href = `tel:${shelter.phone.replace(/[^\d]/g, '')}`;
    setCalledShelters(prev => new Set([...prev, shelter.id]));
    onCallShelter?.(shelter);
  };

  const handleCopyPhone = async (shelter) => {
    await navigator.clipboard.writeText(shelter.phone);
    setCopiedPhone(shelter.id);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  // Share handler
  const handleShare = (platform) => {
    onShare?.(platform);
    if (navigator.share) {
      navigator.share({
        title: `Help find ${mission?.petName || 'missing pet'}!`,
        text: 'Please help us find our missing pet. Share to spread the word!',
        url: window.location.href
      }).catch(() => {});
    }
  };

  // Toggle section
  const toggleSection = (section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-y-auto">
      {/* ============================================ */}
      {/* TEAM MEMBERS SECTION */}
      {/* ============================================ */}
      <div className="shrink-0 p-4 border-b border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Users size={16} className="text-amber-400" />
            Crew
          </h2>
          {activeParticipants.length > 0 && (
            <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">
              {activeParticipants.length} searching now
            </span>
          )}
        </div>

        {/* Horizontal scroll of team members */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {team.slice(0, 10).map((member) => {
            const isActive = activeParticipants.some(p => p.id === member.id);
            const initials = (member.name || 'U').slice(0, 2).toUpperCase();

            return (
              <div
                key={member.id}
                className="flex flex-col items-center gap-1 shrink-0"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isActive && (
                    <Navigation size={10} className="absolute -bottom-1 -right-1 text-emerald-400" />
                  )}
                  {initials}
                </div>
                <span className="text-[10px] text-slate-500 max-w-[48px] truncate">
                  {member.name?.split(' ')[0] || 'User'}
                </span>
              </div>
            );
          })}

          {team.length === 0 && (
            <p className="text-xs text-slate-500">No team members yet</p>
          )}
        </div>
      </div>

      {/* ============================================ */}
      {/* CHAT SECTION */}
      {/* ============================================ */}
      <div className="border-b border-slate-800">
        <button
          onClick={() => toggleSection('chat')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-900/50 transition"
        >
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            💬 Team Chat
          </h2>
          {collapsedSections.chat ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronUp size={16} className="text-slate-500" />}
        </button>

        {!collapsedSections.chat && (
          <div className="px-4 pb-4">
            {/* Messages */}
            <div className="h-48 overflow-y-auto bg-slate-900/50 rounded-xl p-3 mb-3 space-y-2">
              {messages.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  No messages yet. Say hi to your crew!
                </p>
              ) : (
                messages.map((msg, i) => {
                  const isMe = msg.userId === currentUserId;
                  return (
                    <div
                      key={msg.id || i}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-xl px-3 py-2 ${
                          isMe
                            ? 'bg-amber-500/20 text-amber-100'
                            : 'bg-slate-800 text-slate-200'
                        }`}
                      >
                        {!isMe && (
                          <p className="text-[10px] text-slate-500 mb-0.5">{msg.userName}</p>
                        )}
                        <p className="text-sm">{msg.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick messages */}
            {showQuickMessages && (
              <div className="flex gap-2 mb-2 flex-wrap">
                {QUICK_MESSAGES.map(msg => (
                  <button
                    key={msg.id}
                    onClick={() => handleQuickMessage(msg)}
                    className="text-xs px-3 py-1.5 bg-slate-800 rounded-full hover:bg-slate-700 transition"
                  >
                    {msg.icon} {msg.text}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowQuickMessages(!showQuickMessages)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
              >
                ⚡
              </button>
              <button
                onClick={onShareLocation}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
              >
                <MapPin size={18} className="text-slate-400" />
              </button>
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message your crew..."
                className="flex-1 bg-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              />
              <button
                onClick={handleSend}
                disabled={!newMessage.trim()}
                className="p-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Send size={18} className="text-slate-900" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* SHARE SECTION */}
      {/* ============================================ */}
      <div className="border-b border-slate-800">
        <button
          onClick={() => toggleSection('share')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-900/50 transition"
        >
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Share2 size={16} className="text-blue-400" />
            Spread the Word
          </h2>
          {collapsedSections.share ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronUp size={16} className="text-slate-500" />}
        </button>

        {!collapsedSections.share && (
          <div className="px-4 pb-4">
            {/* Contextual tip */}
            <div className="mb-3">
              <ContextualTip {...TIPS.SHARE_NEXTDOOR} />
            </div>

            {/* Share buttons */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {SHARE_PLATFORMS.map(platform => (
                <button
                  key={platform.id}
                  onClick={() => handleShare(platform.id)}
                  className={`p-3 rounded-xl ${platform.color} flex flex-col items-center gap-1 active:scale-95 transition`}
                >
                  <span className="text-xl">{platform.icon}</span>
                  <span className="text-[10px] text-white/80">{platform.name}</span>
                </button>
              ))}
            </div>

            {/* Download Flyer */}
            <button
              onClick={onDownloadFlyer}
              className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 transition flex items-center justify-center gap-2"
            >
              <Printer size={18} className="text-amber-400" />
              <span className="text-white font-medium">Download & Print Flyers</span>
            </button>
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* SHELTERS SECTION */}
      {/* ============================================ */}
      <div className="border-b border-slate-800">
        <button
          onClick={() => toggleSection('shelters')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-900/50 transition"
        >
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Building2 size={16} className="text-emerald-400" />
            Nearby Shelters
            <span className="text-xs text-slate-500 font-normal">
              {calledShelters.size}/{NEARBY_SHELTERS.length} contacted
            </span>
          </h2>
          {collapsedSections.shelters ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronUp size={16} className="text-slate-500" />}
        </button>

        {!collapsedSections.shelters && (
          <div className="px-4 pb-4">
            {/* Contextual tip */}
            <div className="mb-3">
              <ContextualTip {...TIPS.CALL_SHELTERS_DAILY} />
            </div>

            {/* Shelter list */}
            <div className="space-y-2">
              {NEARBY_SHELTERS.map(shelter => {
                const called = calledShelters.has(shelter.id);

                return (
                  <div
                    key={shelter.id}
                    className={`rounded-xl border p-3 transition ${
                      called
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-slate-900/50 border-slate-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Status */}
                      <div className="mt-0.5">
                        {called ? (
                          <Check size={20} className="text-emerald-400" />
                        ) : (
                          <Circle size={20} className="text-slate-600" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium ${called ? 'text-emerald-400' : 'text-white'}`}>
                            {shelter.name}
                          </p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                            {shelter.type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {shelter.distance} away • {shelter.phone}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyPhone(shelter)}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
                          title="Copy phone number"
                        >
                          {copiedPhone === shelter.id ? (
                            <Check size={16} className="text-emerald-400" />
                          ) : (
                            <Copy size={16} className="text-slate-400" />
                          )}
                        </button>
                        <button
                          onClick={() => handleCallShelter(shelter)}
                          className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 transition"
                        >
                          <Phone size={16} className="text-emerald-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* More shelters link */}
            <button className="w-full mt-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700 hover:bg-slate-800 transition flex items-center justify-center gap-2 text-sm text-slate-400">
              <MapPin size={16} />
              <span>Find more shelters nearby</span>
              <ExternalLink size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Bottom padding for safe area */}
      <div className="h-20" />
    </div>
  );
}
