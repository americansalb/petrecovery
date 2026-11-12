'use client';

/**
 * What was said to this person, on their card, and the one line they
 * answer in.
 *
 *   Word    one message, as someone's own words, with whose they are
 *   Answer  the line to write back in: one to a card, under the words
 *
 * A message is always shown as someone's, and the screen adds nothing to
 * it and writes none of its own (founder, 2026-11-11). Neither piece asks
 * for anything: the card's one yellow button is still the next step.
 *
 * `onShown` is how the desk comes to read "seen": a Word says so itself
 * once it is on a screen someone can see (the tab is in front), and never
 * because the phone only fetched it. The answer line is its own piece so
 * that a new word arriving above it does not throw away what is being
 * typed.
 */
import { useEffect, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { wordFrom } from '../lib/team';

/** Run `tell` once the page is in front of someone: now if it is, else when it next is. */
export function useShown(key, tell) {
  useEffect(() => {
    if (!key || !tell) return undefined;
    let done = false;
    const check = () => {
      if (done || document.visibilityState !== 'visible') return;
      done = true;
      tell();
    };
    check();
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
    // Once per thing shown: `tell` is a new function on every render and is not what this waits on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

export default function Word({ word, timeZone, now, onShown = null, children = null }) {
  // Only a word written to this person is one whose reading is reported, and only until it has been.
  useShown(word && word.kind === 'yours' && word.seen === false ? word.id : null, onShown ? () => onShown(word.id) : null);
  if (!word) return null;
  return (
    <div className="mt-3 rounded-2xl bg-[var(--mc-raised)] px-3.5 py-3">
      <p className="text-[13px] font-bold leading-[18px] text-[var(--mc-muted)]">{wordFrom(word, { timeZone, now })}</p>
      <p className="mt-0.5 whitespace-pre-line break-words text-[15px] font-medium leading-[22px] text-[var(--mc-ink)]">{word.text}</p>
      {word.about && <p className="mt-0.5 text-[13px] font-medium leading-[18px] text-[var(--mc-muted)]">About {word.about}</p>}
      {children}
    </div>
  );
}

/** The line to answer in. `who` is who it goes to, as the placeholder says it. */
export function Answer({ who, onSay, id = 'mc-answer' }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState('');

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
    <>
      <div className="mt-2 flex items-center gap-2">
        <label htmlFor={id} className="sr-only">
          Answer {who}
        </label>
        <input
          id={id}
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
  );
}
