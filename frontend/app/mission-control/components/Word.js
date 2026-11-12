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
 * once it is on a screen someone can see (the tab is in front, and the
 * word is in the part of the card that shows: not scrolled out of it and
 * not under the buttons kept at its bottom), and never because the phone
 * only fetched it. A phone on a street loses its signal, so while the
 * search still says "not seen" it says so again every half minute until
 * it is heard. The answer line is its own piece so that a new word
 * arriving above it does not throw away what is being typed.
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { wordFrom } from '../lib/team';

/**
 * The part of a phone's sheet that someone can read: from its top down to
 * the buttons kept at its bottom (components/kit.js, Pinned). Null where
 * `el` is not in a sheet (a desk), and there the window is what shows.
 */
export function readable(el) {
  const sheet = el?.closest?.('[data-sheet]');
  if (!sheet) return null;
  const box = sheet.getBoundingClientRect();
  const pinned = sheet.querySelector('[data-pinned]');
  const bottom = pinned ? Math.min(box.bottom, pinned.getBoundingClientRect().top) : box.bottom;
  return { sheet, top: box.top, bottom: Math.min(bottom, window.innerHeight) };
}

/** Whether `el` is where someone can read it: its middle is in what shows. With nothing to measure, it is. */
export function onScreen(el) {
  if (!el) return true;
  const box = el.getBoundingClientRect();
  if (!box.width && !box.height) return false;
  const view = readable(el);
  const middle = (box.top + box.bottom) / 2;
  return middle >= (view ? view.top : 0) && middle <= (view ? view.bottom : window.innerHeight);
}

/** Move a phone's sheet so the end of `el` is above the buttons kept at its bottom. On a desk, nothing moves. */
export function keepInView(el) {
  const view = readable(el);
  if (!view) return;
  const over = el.getBoundingClientRect().bottom - view.bottom;
  if (over > 0) view.sheet.scrollTop += Math.ceil(over) + 8;
}

/** How long before a card that has not been heard says again that it showed something. */
export const SAY_AGAIN_MS = 30 * 1000;
/** A number that changes once in that long, from the screen's clock. */
export const beatOf = (now) => Math.floor((Number(now) || 0) / SAY_AGAIN_MS);

/**
 * Run `tell` once the thing is in front of someone: now if it is, else when it next is. `key` is the thing shown,
 * and is empty once the search knows it was. `beat` runs it again while it is not: whoever sends it sends once
 * per thing heard, so saying it again costs nothing when it was. `at` is the element that shows it: with one,
 * the page being in front is not enough, and it waits until that element is where it can be read.
 */
export function useShown(key, tell, beat = 0, at = null) {
  useEffect(() => {
    if (!key || !tell) return undefined;
    let done = false;
    const el = at?.current || null;
    const sheet = el?.closest?.('[data-sheet]') || null;
    const check = () => {
      if (done || document.visibilityState !== 'visible' || !onScreen(el)) return;
      done = true;
      tell();
    };
    check();
    document.addEventListener('visibilitychange', check);
    // Scrolled into what shows, or the window changed shape (a phone turned, a keyboard closed).
    sheet?.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      document.removeEventListener('visibilitychange', check);
      sheet?.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
    // Once per thing shown, and again on the beat: `tell` is a new function on every render and is not what this waits on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, beat]);
}

export default function Word({ word, timeZone, now, onShown = null, children = null }) {
  const box = useRef(null);
  // Only a word written to this person is one whose reading is reported, and only until it has been.
  useShown(word && word.kind === 'yours' && word.seen === false ? word.id : null, onShown ? () => onShown(word.id) : null, beatOf(now), box);
  if (!word) return null;
  return (
    <div ref={box} className="mt-3 rounded-2xl bg-[var(--mc-raised)] px-3.5 py-3">
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
