'use client';

/**
 * The desk's Messages: everything said and everything that happened on
 * the search, in one stream, oldest at the top and the newest by the box
 * you write in. A search run from a group chat loses its sightings among
 * the talk; here a sighting, a street walked and a helper's word each
 * keep their own line and their own colour, and each can be clicked to
 * see it on the map.
 *
 * The owner writes to everyone helping (a case update: it goes on the
 * pet's page too, and shows on every helper's card) or to one person.
 * Someone leading a force writes to one person. A word to one person is
 * closed like a radio call: it says when their phone showed it.
 *
 * Everyone else at a desk reads the same stream without the private
 * words, which the server never sends them, and without the box.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Eye, Loader2, Send } from 'lucide-react';
import { clockTime, dayAndTime } from '../lib/words';
import { activity } from '../lib/insight';
import { stream } from '../lib/team';

const FIELD =
  'w-full resize-none rounded-xl border border-[var(--mc-line-strong)] !bg-[var(--mc-surface)] px-3 py-2 text-[15px] font-medium leading-[22px] !text-[var(--mc-ink)] placeholder:text-[var(--mc-muted)] focus:border-[var(--mc-ink)] focus:outline-none focus:ring-2 focus:ring-flash-400';

export default function Messages({ picture, items, now, people = [], words = [], to, onTo, onSelect, onFocus, onTell, onWord, onAdd }) {
  const viewer = picture.viewer;
  const leads = Boolean(viewer?.leads);
  const isOwner = Boolean(viewer?.isOwner);
  const zone = picture.timeZone;
  const name = picture.pet?.name || 'the pet';
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const lines = useMemo(
    () => stream({ events: activity({ items, picture, now }), words }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, picture, words, Math.floor(now / 60000)]
  );
  // The owner can write to everyone; anyone else leading writes to one person, the first on the list until they pick.
  const everyone = isOwner ? 'everyone' : null;
  const target = to && people.some((p) => p.handle === to) ? to : everyone || people[0]?.handle || null;
  const person = target && target !== 'everyone' ? people.find((p) => p.handle === target) : null;

  // The newest line stays in view, as in any conversation.
  const end = useRef(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [lines.length]);

  async function send() {
    const say = text.trim();
    if (!say || busy || !target) return;
    setBusy(true);
    setProblem('');
    try {
      const result = person ? await onWord(person, say) : await onTell(say);
      if (result?.error) setProblem(result.error);
      else setText('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-1 pt-3">
        <h2 className="text-[16px] font-bold leading-[22px] text-[var(--mc-ink)]">What has been said and done</h2>
        <button type="button" onClick={onAdd} className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-[var(--mc-line-strong)] bg-[var(--mc-surface)] px-3 text-[13px] font-bold text-[var(--mc-ink)] hover:bg-[var(--mc-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400">
          <Eye size={15} className="text-[var(--mc-seen-ink)]" aria-hidden="true" /> Add a sighting
        </button>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" aria-label="Messages and what happened, oldest first">
        {lines.length === 0 && <li className="px-2 py-6 text-[15px] font-medium leading-[22px] text-[var(--mc-muted)]">Nothing has happened yet.</li>}
        {lines.map((l) => {
          if (l.kind === 'mine' || l.kind === 'theirs') {
            const mine = l.kind === 'mine';
            return (
              <li key={l.id} className={`flex flex-col px-2 py-1 ${mine ? 'items-end' : 'items-start'}`}>
                <span className={`max-w-[270px] whitespace-pre-line break-words rounded-2xl px-3 py-2 text-[15px] font-medium leading-[21px] ${mine ? 'bg-[var(--mc-ink)] text-[var(--mc-surface)]' : 'bg-[var(--mc-raised)] text-[var(--mc-ink)]'}`}>{l.text}</span>
                <span className="mt-0.5 flex items-center gap-2 px-1 text-[13px] font-semibold leading-[17px] text-[var(--mc-muted)]">
                  <span>
                    {mine ? `${l.who}, to ${l.to}` : l.who} · {dayAndTime(l.at, zone, now)}
                    {mine ? (l.seenAt ? ` · seen ${clockTime(l.seenAt, zone)}` : ' · not seen yet') : ''}
                  </span>
                  {!mine && leads && l.handle && (
                    <button type="button" onClick={() => onTo(l.handle)} className="font-bold text-[var(--mc-ink)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400">
                      Answer
                    </button>
                  )}
                </span>
              </li>
            );
          }
          const act = l.streetId ? () => onSelect(l.streetId) : l.sightingId ? () => onFocus(l.sightingId) : null;
          const seen = l.kind === 'seen';
          const row = (
            <>
              <span className={`w-[58px] shrink-0 text-[13px] font-semibold leading-5 tabular-nums ${seen ? 'text-[var(--mc-seen-ink)]' : 'text-[var(--mc-muted)]'}`}>{clockTime(l.at, zone)}</span>
              <span className={`min-w-0 flex-1 text-[14px] leading-5 ${seen ? 'font-semibold text-[var(--mc-ink)]' : l.kind === 'said' ? 'font-semibold text-[var(--mc-ink)]' : 'font-medium text-[var(--mc-soft)]'}`}>{l.text}</span>
            </>
          );
          const look = `flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left ${seen ? 'my-0.5 border border-[var(--mc-seen)] bg-[var(--mc-seen-bg)]' : ''}`;
          return (
            <li key={l.id}>
              {act ? (
                <button type="button" onClick={act} className={`${look} hover:bg-[var(--mc-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400`}>
                  {row}
                </button>
              ) : (
                <div className={look}>{row}</div>
              )}
            </li>
          );
        })}
        <li ref={end} aria-hidden="true" />
      </ol>

      {leads && (
        <div className="shrink-0 border-t border-[var(--mc-line)] px-3 pb-3 pt-2.5">
          {target ? (
            <>
              <div className="flex items-center gap-2">
                <label htmlFor="mc-to" className="text-[13px] font-semibold text-[var(--mc-muted)]">
                  To
                </label>
                <span className="relative inline-flex items-center">
                  <select id="mc-to" value={target} onChange={(e) => onTo(e.target.value)} className="min-h-[32px] appearance-none rounded-full border border-[var(--mc-line-strong)] !bg-[var(--mc-raised)] py-0 pl-3 pr-8 text-[13px] font-bold !text-[var(--mc-ink)] focus:outline-none focus:ring-2 focus:ring-flash-400">
                    {isOwner && <option value="everyone">Everyone helping</option>}
                    {people.map((p) => (
                      <option key={p.handle} value={p.handle}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-2.5 text-[var(--mc-soft)]" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-2 flex items-end gap-2">
                <label htmlFor="mc-say" className="sr-only">
                  {person ? `A word for ${person.name}` : 'A word for everyone helping'}
                </label>
                <textarea
                  id="mc-say"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={2}
                  maxLength={400}
                  placeholder={person ? `Write to ${person.name}` : 'Write to everyone helping'}
                  className={FIELD}
                />
                <button type="button" onClick={send} disabled={busy || !text.trim()} aria-label="Send" className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl border border-flash-600 bg-flash-400 text-[var(--mc-on-flash)] hover:bg-flash-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mc-ink)] disabled:opacity-50">
                  {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
                </button>
              </div>
              {problem && (
                <p role="alert" className="mt-1 text-sm font-semibold text-[var(--mc-danger)]">
                  {problem}
                </p>
              )}
              <p className="mt-1.5 text-[13px] font-medium leading-[18px] text-[var(--mc-muted)]">
                {person ? `It shows on ${person.name}'s card on their phone, while ${name}'s search is open there.` : `It shows on every helper's card and on ${name}'s page.`}
              </p>
            </>
          ) : (
            <p className="text-[14px] font-medium leading-5 text-[var(--mc-muted)]">When someone joins the search you can write to them here.</p>
          )}
        </div>
      )}
    </div>
  );
}
