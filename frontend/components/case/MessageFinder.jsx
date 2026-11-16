'use client';

/**
 * MessageFinder: write to the person who found a pet.
 *
 * The site sends the message on by email or text (POST
 * /api/reports/[id]/message, app/lib/finderMessage.js). The finder's own
 * email and phone are never shown here. The person writing adds an email or
 * phone for the finder to write back to, which is passed on only because
 * they typed it in for that.
 *
 * Used on /report/found/message, which the owner's match email links to,
 * and meant for the found pet's page (app/cases/[caseNumber]).
 *
 * Props: caseNumber, kind ('cat', 'dog', 'pet'), reachBy ('email' | 'text'
 * | null, from GET /api/reports/[id]/message).
 */

import { useState } from 'react';
import { Send, Loader2, Check } from 'lucide-react';
import { captchaHeaders } from '@/app/lib/captchaClient';

const MESSAGE_MAX = 600; // app/lib/finderMessage.js

const FIELD =
  'w-full rounded-2xl border-2 border-midnight-100 bg-white px-4 py-3 text-[15px] outline-none transition-colors focus:border-midnight-400';

export function MessageFinder({ caseNumber, kind = 'pet', reachBy = null }) {
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [sentVia, setSentVia] = useState(null);

  if (!reachBy) {
    return (
      <p className="rounded-xl bg-midnight-50 px-4 py-3 text-[15px] text-midnight-700">
        This report has no email or phone a message can be sent to.
      </p>
    );
  }

  if (sentVia) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-green-50 px-4 py-3 text-[15px] text-green-800 ring-1 ring-green-200" role="status">
        <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>Sent. The finder gets your message by {sentVia === 'text' ? 'text' : 'email'}.</p>
      </div>
    );
  }

  async function send(e) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      // The bot check middleware asks for on every POST to /api/reports when CAPTCHA is on.
      const res = await fetch(`/api/reports/${encodeURIComponent(caseNumber)}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await captchaHeaders('finder_message')) },
        body: JSON.stringify({ message, name, replyTo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.sent) throw new Error(data.error || 'The message did not send. Try again in a few minutes.');
      setSentVia(data.via);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={send} className="space-y-4">
      <div>
        <label htmlFor="finder-message" className="mb-1.5 block text-sm font-semibold text-midnight-700">
          Your message
        </label>
        <textarea
          id="finder-message"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
          rows={5}
          required
          placeholder={`Why you think the ${kind} is yours: a mark, the collar, the name it answers to.`}
          className={FIELD}
        />
      </div>
      <div>
        <label htmlFor="finder-name" className="mb-1.5 block text-sm font-semibold text-midnight-700">
          Your first name (optional)
        </label>
        <input id="finder-name" type="text" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
      </div>
      <div>
        <label htmlFor="finder-reply" className="mb-1.5 block text-sm font-semibold text-midnight-700">
          Your email or phone, so the finder can write back
        </label>
        <input id="finder-reply" type="text" autoComplete="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} className={FIELD} />
        <p className="mt-1.5 text-xs text-midnight-500">
          The finder gets your message and what you put here, nothing else. You do not see their email or phone.
        </p>
      </div>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={sending || !message.trim()}
        className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-midnight-900 px-4 text-[15px] font-bold text-white transition-colors hover:bg-midnight-800 disabled:opacity-50"
      >
        {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
        Send to the finder
      </button>
    </form>
  );
}

export default MessageFinder;
