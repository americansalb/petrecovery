'use client';

/**
 * The force chat: messages oldest first, yours on the right, and a box to
 * send. It checks for new messages every 8 seconds while the tab is open.
 * Enter sends; Shift+Enter starts a new line.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui';
import { FORCE_ROLE_LABEL } from '@/app/lib/forceRoles';

const POLL_MS = 8000;

function timeLabel(iso) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function ChatClient({ forceId, userId, canSend }) {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | failed
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const listRef = useRef(null);
  const atBottom = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/rescue-forces/${forceId}/chat?limit=100`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setMessages(data.messages || []);
      setStatus('ready');
    } catch {
      setStatus((s) => (s === 'ready' ? s : 'failed'));
    }
  }, [forceId]);

  useEffect(() => {
    load();
    const tick = () => document.visibilityState === 'visible' && load();
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [load]);

  // Stay at the newest message unless the reader has scrolled up.
  useEffect(() => {
    const el = listRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function submit(e) {
    e?.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/rescue-forces/${forceId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.message) throw new Error(data.error || 'The message did not send. Try again.');
      atBottom.current = true;
      setMessages((prev) => [...prev, data.message]);
      setText('');
    } catch (err) {
      setError(err.message);
    }
    setSending(false);
  }

  if (status === 'loading') {
    return (
      <p className="flex items-center gap-2 text-midnight-500" aria-busy="true">
        <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        Loading the chat
      </p>
    );
  }
  if (status === 'failed') {
    return (
      <div className="rounded-2xl bg-white p-5 ring-1 ring-midnight-200">
        <p className="text-midnight-700">The chat did not load.</p>
        <Button className="mt-3" variant="outline" size="sm" onClick={() => { setStatus('loading'); load(); }}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-midnight-200">
      <ol
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        aria-label="Messages"
        className="h-[55vh] min-h-[18rem] space-y-3 overflow-y-auto p-4"
      >
        {messages.length === 0 && <li className="py-10 text-center text-midnight-500">No messages yet.</li>}
        {messages.map((m) => {
          const mine = m.authorId === userId;
          const role = m.authorRole && m.authorRole !== 'MEMBER' ? FORCE_ROLE_LABEL[m.authorRole] : null;
          return (
            <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] sm:max-w-[70%] ${mine ? 'text-right' : ''}`}>
                <p className="px-1 text-xs text-midnight-500">
                  {mine ? 'You' : m.authorName}
                  {!mine && role && ` · ${role}`}
                  {` · ${timeLabel(m.createdAt)}`}
                </p>
                <p
                  className={`mt-0.5 inline-block whitespace-pre-line break-words rounded-2xl px-3.5 py-2 text-left ${
                    mine ? 'bg-flash-300 text-midnight-900' : 'bg-midnight-100 text-midnight-900'
                  }`}
                >
                  {m.content}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      {canSend ? (
        <form method="post" onSubmit={submit} className="border-t border-midnight-200 p-3">
          <div className="flex items-end gap-2">
            <label htmlFor="chat-input" className="sr-only">
              Message
            </label>
            <textarea
              id="chat-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Write a message"
              className="max-h-40 min-h-[44px] min-w-0 flex-1 resize-none rounded-xl border border-midnight-200 px-3 py-2.5 text-midnight-900 placeholder:text-midnight-400 outline-none focus:border-midnight-400 focus:ring-2 focus:ring-flash-400"
            />
            <Button type="submit" loading={sending} disabled={!text.trim()} aria-label="Send">
              <Send size={18} aria-hidden="true" />
            </Button>
          </div>
          {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
        </form>
      ) : (
        <p className="border-t border-midnight-200 p-3 text-sm text-midnight-500">Only members can send messages.</p>
      )}
    </div>
  );
}
