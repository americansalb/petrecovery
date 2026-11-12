'use client';

/**
 * What was said to this person, on their card: the newest word from the
 * people running the search, or what the owner told everyone. Under it,
 * one line to answer with, for someone who is on the search.
 *
 * It is always shown as someone's own words, with whose they are. The
 * screen adds nothing to them and writes none of its own (founder,
 * 2026-11-11). It is one block and it asks for nothing: the card's one
 * yellow button is still the next step.
 */
import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { wordFrom } from '../lib/team';

export default function Word({ word, timeZone, now, onSay = null }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState('');
  if (!word) return null;
  const who = word.from || 'the people running the search';

  async function say() {
    const words = text.trim();
    if (!words || busy) return;
    setBusy(true);
    setProblem('');
    setSent(false);
    try {
      const result = await onSay(words);
      if (result?.error) setProblem(result.error);
      else {
        setText('');
        setSent(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-2xl bg-[var(--mc-raised)] px-3.5 py-3">
      <p className="text-[13px] font-bold leading-[18px] text-[var(--mc-muted)]">{wordFrom(word, { timeZone, now })}</p>
      <p className="mt-0.5 whitespace-pre-line break-words text-[15px] font-medium leading-[22px] text-[var(--mc-ink)]">{word.text}</p>
      {onSay && (
        <>
          <div className="mt-2 flex items-center gap-2">
            <label htmlFor={`mc-answer-${word.id}`} className="sr-only">
              Answer {who}
            </label>
            <input
              id={`mc-answer-${word.id}`}
              type="text"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setSent(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') say();
              }}
              maxLength={400}
              placeholder={`Answer ${who}`}
              className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--mc-line-strong)] !bg-[var(--mc-surface)] px-3 text-[16px] font-medium !text-[var(--mc-ink)] placeholder:text-[var(--mc-muted)] focus:border-[var(--mc-ink)] focus:outline-none focus:ring-2 focus:ring-flash-400"
            />
            <button type="button" onClick={say} disabled={busy || !text.trim()} aria-label="Send" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--mc-line-strong)] bg-[var(--mc-surface)] text-[var(--mc-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 disabled:opacity-50">
              {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
            </button>
          </div>
          {sent && (
            <p role="status" className="mt-1.5 text-[13px] font-semibold leading-[18px] text-[var(--mc-soft)]">
              Sent.
            </p>
          )}
          {problem && (
            <p role="alert" className="mt-1.5 text-sm font-semibold text-[var(--mc-danger)]">
              {problem}
            </p>
          )}
        </>
      )}
    </div>
  );
}
