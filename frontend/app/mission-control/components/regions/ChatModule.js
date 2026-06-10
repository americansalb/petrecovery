'use client';

/**
 * ChatModule - the mission's voice channel
 *
 * Message bubbles, quick phrases for cold thumbs, share-my-location.
 * Fed by useMissionChat (SSE with a 5s polling net underneath).
 */

import { useState, useRef, useEffect } from 'react';
import { Send, MapPin, Loader2 } from 'lucide-react';

const QUICK_MESSAGES = [
  "I'm out searching",
  'Heading there now',
  'Nothing on my street',
  'Checking the park',
];

function timeLabel(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}

export default function ChatModule({
  messages = [],
  onSend,
  onShareLocation,
  currentUserId,
  isLoading = false,
  isSending = false,
  connected = false,
}) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = async (text) => {
    const content = (text ?? draft).trim();
    if (!content || isSending) return;
    setDraft('');
    await onSend?.(content);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Connection state */}
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-2">
        <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
        {connected ? 'Live' : 'Updates every few seconds'}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
        {isLoading && messages.length === 0 ? (
          <div className="flex justify-center py-6">
            <Loader2 size={18} className="animate-spin text-slate-500" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">
            No messages yet. Say where you are looking.
          </p>
        ) : (
          messages.map((msg) => {
            const mine = msg.userId === currentUserId;
            return (
              <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 ${mine ? 'bg-flash-400 text-midnight-950' : 'bg-slate-800 text-white'}`}>
                  {!mine && (
                    <p className="text-[11px] font-bold text-flash-300 mb-0.5">{msg.userName || 'Searcher'}</p>
                  )}
                  <p className="text-sm break-words whitespace-pre-wrap">{msg.text}</p>
                  <p className={`text-[10px] mt-0.5 ${mine ? 'text-midnight-800' : 'text-slate-500'}`}>{timeLabel(msg.timestamp)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick phrases */}
      <div className="flex gap-1.5 overflow-x-auto py-2 -mx-1 px-1">
        {QUICK_MESSAGES.map((qm) => (
          <button
            key={qm}
            type="button"
            onClick={() => send(qm)}
            className="shrink-0 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:text-white hover:border-slate-500 transition"
          >
            {qm}
          </button>
        ))}
      </div>

      {/* Composer */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onShareLocation}
          aria-label="Share my location"
          className="shrink-0 w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 text-emerald-300 flex items-center justify-center hover:bg-slate-700 transition"
        >
          <MapPin size={18} />
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Message the team..."
          className="flex-1 min-w-0 h-11 px-3.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-flash-400"
        />
        <button
          type="button"
          onClick={() => send()}
          disabled={!draft.trim() || isSending}
          aria-label="Send"
          className="shrink-0 w-11 h-11 rounded-xl bg-flash-400 text-midnight-950 flex items-center justify-center hover:bg-flash-300 transition disabled:opacity-50"
        >
          {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}
