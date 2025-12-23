'use client';

/**
 * ChatPanel - Team communication
 *
 * Features:
 * - Real-time team chat
 * - Quick status updates
 * - Location sharing
 * - Sighting alerts
 */

import { useState, useRef, useEffect } from 'react';
import {
  Send,
  MapPin,
  Camera,
  AlertCircle,
  CheckCheck,
  Clock
} from 'lucide-react';

// Quick message templates
const QUICK_MESSAGES = [
  { id: 'searching', text: "I'm searching the area now", icon: '🔍' },
  { id: 'sighting', text: 'I think I saw them!', icon: '👁' },
  { id: 'help', text: 'Need backup at my location', icon: '🆘' },
  { id: 'clear', text: 'Area cleared, moving on', icon: '✅' },
];

export default function ChatPanel({
  messages = [],
  onSendMessage,
  onShareLocation,
  currentUserId,
  isLoading = false,
}) {
  const [newMessage, setNewMessage] = useState('');
  const [showQuickMessages, setShowQuickMessages] = useState(false);
  const messagesEndRef = useRef(null);

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

  // Demo messages if none provided
  const displayMessages = messages.length > 0 ? messages : [
    {
      id: '1',
      userId: 'system',
      userName: 'System',
      text: 'Team chat is ready. Coordinate your search here!',
      timestamp: Date.now() - 3600000,
      isSystem: true,
    },
  ];

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
      {/* Chat Header */}
      <div className="p-4 bg-slate-900/50 border-b border-slate-800">
        <h2 className="text-lg font-bold text-white">Team Chat</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {messages.length > 0 ? `${messages.length} messages` : 'Coordinate with your team'}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {displayMessages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.userId === currentUserId ? 'justify-end' : 'justify-start'}`}
          >
            {msg.isSystem ? (
              // System message
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2 max-w-[85%]">
                <p className="text-slate-400 text-sm">{msg.text}</p>
              </div>
            ) : msg.userId === currentUserId ? (
              // Own message
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
              // Other's message
              <div className="max-w-[85%]">
                <p className="text-xs text-slate-500 mb-1 ml-1">{msg.userName}</p>
                <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-md px-4 py-2">
                  <p className="text-white text-sm">{msg.text}</p>
                  {msg.location && (
                    <button className="flex items-center gap-1 mt-2 text-xs text-blue-400 hover:text-blue-300">
                      <MapPin size={12} />
                      View location
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-slate-600 mt-1 ml-1 block">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Messages */}
      {showQuickMessages && (
        <div className="p-3 border-t border-slate-800 bg-slate-900/50">
          <p className="text-xs text-slate-500 mb-2">Quick Messages</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_MESSAGES.map(qm => (
              <button
                key={qm.id}
                onClick={() => handleQuickMessage(qm.text)}
                className="flex items-center gap-2 p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm text-white transition text-left"
              >
                <span>{qm.icon}</span>
                <span className="truncate">{qm.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/50">
        <div className="flex items-end gap-2">
          {/* Quick actions */}
          <div className="flex gap-1">
            <button
              onClick={() => setShowQuickMessages(!showQuickMessages)}
              className={`p-2 rounded-xl transition ${
                showQuickMessages
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Quick messages"
            >
              <AlertCircle size={20} />
            </button>
            <button
              onClick={onShareLocation}
              className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-xl transition"
              title="Share location"
            >
              <MapPin size={20} />
            </button>
          </div>

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Message team..."
              rows={1}
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 pr-12 border border-slate-700 focus:border-amber-500 focus:outline-none resize-none placeholder-slate-500"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || isLoading}
            className={`p-3 rounded-xl transition ${
              newMessage.trim()
                ? 'bg-amber-500 text-white hover:bg-amber-400'
                : 'bg-slate-800 text-slate-600'
            }`}
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
