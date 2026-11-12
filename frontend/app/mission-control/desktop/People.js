'use client';

/**
 * The desk's People: everyone on the search, what each is doing right
 * now, and for the person running the search (the owner), the two things
 * they do with a person: give them a street, and send them a word.
 *
 *   the list     free first, then asked, then walking. One line each.
 *   one person   what they have done, "Give Dana a street" (pick one, add
 *                a word, ask), and the words between them and the desk.
 *
 * An ask is closed, the way a radio call is: the row says asked, then
 * seen (their phone showed it), then walking. Nobody at the desk has to
 * wonder whether it landed.
 *
 * Names are here because this person may see them (the owner and the
 * forces looking for the pet); for anyone else the tab says how many are
 * out and who sees names, and nothing more. Giving a street and writing
 * to a helper are for whoever runs the search (`viewer.leads`: the owner),
 * checked again by the server.
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Loader2, Send, Share2 } from 'lucide-react';
import { clockTime } from '../lib/words';
import { lookFirst } from '../lib/insight';
import { grouped, outLong, personLine, shortTitle } from '../lib/team';

const NOTE_MAX = 140;
const BUTTON =
  'inline-flex min-h-[36px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--mc-line-strong)] bg-[var(--mc-surface)] px-3 text-[13px] font-bold leading-5 text-[var(--mc-ink)] hover:bg-[var(--mc-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 disabled:opacity-60';
const PRIMARY =
  'inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-flash-600 bg-flash-400 px-4 text-[15px] font-extrabold text-[var(--mc-on-flash)] hover:bg-flash-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mc-ink)] disabled:opacity-60';
const FIELD =
  'w-full rounded-xl border border-[var(--mc-line-strong)] !bg-[var(--mc-surface)] px-3 py-2 text-[15px] font-medium leading-[22px] !text-[var(--mc-ink)] placeholder:text-[var(--mc-muted)] focus:border-[var(--mc-ink)] focus:outline-none focus:ring-2 focus:ring-flash-400';

/** The mark beside a name: what the person is doing, in the colours the map uses for it. */
function Mark({ person, size = 32 }) {
  const look = person.state === 'walking' ? 'bg-[var(--mc-teal)] text-[var(--mc-on-teal)]' : person.state === 'asked' ? 'border border-flash-600 bg-flash-400 text-[var(--mc-on-flash)]' : 'bg-[var(--mc-raised)] text-[var(--mc-ink)]';
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-lg font-extrabold ${look}`} style={{ width: size, height: size, fontSize: Math.max(13, Math.round(size * 0.44)) }} aria-hidden="true">
      {String(person.name || '?').charAt(0).toUpperCase()}
    </span>
  );
}

const Label = ({ children, count }) => (
  <p className="px-2 pb-0.5 pt-3 text-[13px] font-bold leading-[18px] text-[var(--mc-muted)]">
    {children}
    {count != null && <span className="text-[var(--mc-ink)]"> · {count}</span>}
  </p>
);

function Row({ person, minutes, zone, now, unit, leads, onOpen }) {
  const thing = unit === 'block' ? 'block' : 'street';
  const long = outLong(person, minutes, now);
  return (
    <li>
      <div className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-[var(--mc-raised)]">
        <button type="button" onClick={() => onOpen(person.handle)} className="flex min-w-0 flex-1 items-start gap-2.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400">
          <Mark person={person} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[15px] font-bold leading-5 text-[var(--mc-ink)]">{person.name}</span>
              {long && <span className="shrink-0 rounded-md bg-[var(--mc-seen-bg)] px-1.5 text-[13px] font-bold leading-[18px] text-[var(--mc-seen-ink)]">{long} min</span>}
            </span>
            {/* The whole line, on two rows where it needs them: what someone is doing is not cut short. */}
            <span className="block text-[13px] font-medium leading-[18px] text-[var(--mc-muted)]">{personLine(person, { timeZone: zone, now, unit })}</span>
          </span>
          {!(leads && unit === 'street' && person.state === 'free') && <ChevronRight size={16} className="shrink-0 text-[var(--mc-muted)]" aria-hidden="true" />}
        </button>
        {leads && unit === 'street' && person.state === 'free' && (
          <button type="button" onClick={() => onOpen(person.handle, 'give')} className={BUTTON}>
            Give a {thing}
          </button>
        )}
      </div>
    </li>
  );
}

/** One person: what they are on, a street to give them, and the words between them and the desk. */
function Person({ person, picture, items, unit, now, leads, selected, words, onBack, onAsk, onUnask, onWord, onPick }) {
  const zone = picture.timeZone;
  const thing = unit === 'block' ? 'block' : 'street';
  // What could be given: still to walk, most urgent first, and not kept for someone else.
  const open = useMemo(() => lookFirst(items).filter((i) => !i.reserved || i.askedOfHandle === person.handle), [items, person.handle]);
  const options = useMemo(() => {
    const top = open.slice(0, 4);
    const picked = selected && open.find((i) => i.id === selected);
    return picked && !top.some((i) => i.id === picked.id) ? [picked, ...top.slice(0, 3)] : top;
  }, [open, selected]);
  const [choice, setChoice] = useState(null);
  const [note, setNote] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState('');
  const chosen = options.find((i) => i.id === choice) || options.find((i) => i.id === selected) || options[0] || null;
  // The street about to be given is shown on the map.
  useEffect(() => {
    if (chosen && leads && !person.asked && person.state !== 'walking') onPick(chosen.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen?.id]);

  const run = async (name, work) => {
    if (busy) return;
    setBusy(name);
    setProblem('');
    try {
      const result = await work();
      if (result?.error) setProblem(result.error);
      return result;
    } finally {
      setBusy(null);
    }
  };
  const ask = () =>
    run('ask', async () => {
      const result = await onAsk(person, chosen, note.trim());
      if (!result?.error) setNote('');
      return result;
    });
  const say = () =>
    run('say', async () => {
      const result = await onWord(person, text.trim());
      if (!result?.error) setText('');
      return result;
    });
  const thread = words.filter((w) => (w.fromDesk ? w.toHandle : w.fromHandle) === person.handle);
  const canGive = leads && unit === 'street' && person.state !== 'walking' && !person.asked;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4">
      <button type="button" onClick={onBack} className="-ml-1 mt-3 inline-flex min-h-[32px] items-center gap-1.5 self-start rounded-lg px-1 text-[13px] font-bold text-[var(--mc-soft)] hover:text-[var(--mc-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400">
        <ArrowLeft size={16} aria-hidden="true" /> People
      </button>
      <div className="mt-2 flex items-center gap-3">
        <Mark person={person} size={44} />
        <div className="min-w-0">
          <h2 className="truncate text-[19px] font-extrabold leading-[25px] text-[var(--mc-ink)]">{person.name}</h2>
          <p className="text-[13px] font-medium leading-[19px] text-[var(--mc-muted)]">{personLine(person, { timeZone: zone, now, unit })}</p>
        </div>
      </div>

      {person.asked && (
        <div className="mt-3 rounded-xl border border-[var(--mc-line)] bg-[var(--mc-ground)] p-3">
          <p className="text-[13px] font-bold leading-[18px] text-[var(--mc-muted)]">
            {person.on?.id === person.asked.id ? 'Walking what was asked' : person.asked.seenAt ? `Asked ${clockTime(person.asked.at, zone)}. Seen ${clockTime(person.asked.seenAt, zone)}, not started.` : `Asked ${clockTime(person.asked.at, zone)}. Not seen yet.`}
          </p>
          <p className="mt-0.5 text-[15px] font-bold leading-[21px] text-[var(--mc-ink)]">{person.asked.title}</p>
          {person.asked.note && <p className="mt-0.5 text-[14px] font-medium leading-5 text-[var(--mc-soft)]">&quot;{person.asked.note}&quot;</p>}
          {!person.asked.holds && person.on?.id !== person.asked.id && (
            <p className="mt-1 text-[13px] font-medium leading-[18px] text-[var(--mc-muted)]">
              It was kept for {person.name} for half an hour. Anyone who asks for a {thing} can be given it now.
            </p>
          )}
          {leads && person.on?.id !== person.asked.id && (
            <button type="button" onClick={() => run('unask', () => onUnask(person))} disabled={Boolean(busy)} className={`${BUTTON} mt-2`}>
              {busy === 'unask' && <Loader2 size={15} className="animate-spin" aria-hidden="true" />} Take it back
            </button>
          )}
        </div>
      )}

      {canGive && (
        <div className="mt-4">
          <p className="text-[13px] font-bold leading-[18px] text-[var(--mc-muted)]">Give {person.name} a street</p>
          {options.length === 0 ? (
            <p className="mt-2 text-[15px] font-medium leading-[22px] text-[var(--mc-soft)]">Every street has been walked or has someone on it.</p>
          ) : (
            <>
              <div className="mt-2 flex flex-col gap-2" role="radiogroup" aria-label={`A street for ${person.name}`}>
                {options.map((street) => {
                  const on = chosen?.id === street.id;
                  return (
                    <button
                      key={street.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        setChoice(street.id);
                        onPick(street.id);
                      }}
                      className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 ${on ? 'border-2 border-[var(--mc-ink)] bg-[var(--mc-ground)]' : 'border border-[var(--mc-line)] hover:bg-[var(--mc-raised)]'}`}
                    >
                      <span className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-[var(--mc-ink)]' : 'border-[var(--mc-line-strong)]'}`} aria-hidden="true">
                        {on && <span className="h-2 w-2 rounded-full bg-[var(--mc-ink)]" />}
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-x-1.5">
                          <span className="text-[15px] font-bold leading-5 text-[var(--mc-ink)]">Walk {shortTitle(street.title)}</span>
                          {(street.priority || 0) === (open[0]?.priority || 0) && <span className="rounded-md bg-[var(--mc-seen-bg)] px-1.5 text-[13px] font-bold leading-[18px] text-[var(--mc-seen-ink)]">Most urgent</span>}
                        </span>
                        <span className="block text-[13px] font-medium leading-[19px] text-[var(--mc-muted)]">
                          {street.fromName && street.toName ? `${street.fromName} to ${street.toName}. ` : ''}About {street.minutes} minutes.
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <label htmlFor="mc-ask-note" className="sr-only">
                A note for {person.name}
              </label>
              <input id="mc-ask-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={NOTE_MAX} placeholder={`A note for ${person.name}, if there is one`} className={`${FIELD} mt-2`} />
              <button type="button" onClick={ask} disabled={Boolean(busy) || !chosen} className={`${PRIMARY} mt-2`}>
                {busy === 'ask' && <Loader2 size={17} className="animate-spin" aria-hidden="true" />} Ask {person.name}
              </button>
              <p className="mt-2 text-[13px] font-medium leading-[19px] text-[var(--mc-muted)]">
                It becomes the card on {person.name}&apos;s phone while {picture.pet?.name || 'the pet'}&apos;s search is open there, with one button, and is kept for {person.name} for half an hour. You see when their phone has shown it and when {person.name} starts.
              </p>
            </>
          )}
        </div>
      )}
      {leads && unit !== 'street' && person.state !== 'walking' && (
        <p className="mt-4 text-[14px] font-medium leading-5 text-[var(--mc-muted)]">This search is on blocks, which are given out as people ask for one. A word to {person.name} still reaches their phone.</p>
      )}

      {problem && (
        <p role="alert" className="mt-2 text-sm font-semibold text-[var(--mc-danger)]">
          {problem}
        </p>
      )}

      {(leads || thread.length > 0) && (
        <div className="mt-5 border-t border-[var(--mc-line)] pt-3">
          <p className="text-[13px] font-bold leading-[18px] text-[var(--mc-muted)]">Between {person.name} and the desk</p>
          {thread.length === 0 && <p className="mt-1.5 text-[14px] font-medium leading-5 text-[var(--mc-muted)]">Nothing yet.</p>}
          <ul className="mt-1.5 flex flex-col gap-2">
            {thread.map((w) => (
              <li key={w.id} className={`flex flex-col ${w.fromDesk ? 'items-end' : 'items-start'}`}>
                <span className={`max-w-[280px] whitespace-pre-line break-words rounded-2xl px-3 py-2 text-[15px] font-medium leading-[21px] ${w.fromDesk ? 'bg-[var(--mc-ink)] text-[var(--mc-surface)]' : 'bg-[var(--mc-raised)] text-[var(--mc-ink)]'}`}>{w.text}</span>
                <span className="mt-0.5 px-1 text-[13px] font-semibold leading-[17px] text-[var(--mc-muted)]">
                  {w.fromDesk ? w.from : person.name} · {clockTime(w.at, zone)}
                  {w.fromDesk ? (w.seenAt ? ` · seen ${clockTime(w.seenAt, zone)}` : ' · not seen yet') : w.about ? ` · about ${w.about}` : ''}
                </span>
              </li>
            ))}
          </ul>
          {leads && (
            <div className="mt-2 flex items-end gap-2">
              <label htmlFor="mc-word" className="sr-only">
                A word for {person.name}
              </label>
              <textarea id="mc-word" value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={400} placeholder={`Write to ${person.name}`} className={`${FIELD} resize-none`} />
              <button type="button" onClick={say} disabled={Boolean(busy) || !text.trim()} aria-label={`Send to ${person.name}`} className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl border border-flash-600 bg-flash-400 text-[var(--mc-on-flash)] hover:bg-flash-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mc-ink)] disabled:opacity-50">
                {busy === 'say' ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
              </button>
            </div>
          )}
          {leads && (
            <p className="mt-1.5 text-[13px] font-medium leading-[18px] text-[var(--mc-muted)]">
              It shows on {person.name}&apos;s card on their phone, while {picture.pet?.name || 'the pet'}&apos;s search is open there.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function People({ picture, people = [], items, unit, now, selected, words = [], open, onOpen, onAsk, onUnask, onWord, onPick, onShare }) {
  const viewer = picture.viewer;
  const leads = Boolean(viewer?.leads);
  const zone = picture.timeZone;
  const thing = unit === 'block' ? 'block' : 'street';
  const name = picture.pet?.name || 'the pet';
  const count = picture.looking?.helpers || 0;
  if (!viewer?.seesNames) {
    return (
      <p className="px-4 py-6 text-[15px] font-medium leading-[22px] text-[var(--mc-muted)]">
        {count === 0 ? 'Nobody is out looking right now.' : count === 1 ? '1 person is out looking.' : `${count} people are out looking.`} Who they are is shown to {picture.owner?.firstName || 'the owner'}
        {picture.forces > 0 ? ` and the Rescue Force looking for ${name}` : ''}. Everyone else sees {thing}s, not people.
      </p>
    );
  }
  const person = open ? people.find((p) => p.handle === open) : null;
  if (person) {
    return <Person key={person.handle} person={person} picture={picture} items={items} unit={unit} now={now} leads={leads} selected={selected} words={words} onBack={() => onOpen(null)} onAsk={onAsk} onUnask={onUnask} onWord={onWord} onPick={onPick} />;
  }
  const g = grouped(people);
  const minutesOf = (p) => (p.on ? items.find((i) => i.id === p.on.id)?.minutes : null);
  const list = (rows) => (
    <ul>
      {rows.map((p) => (
        <Row key={p.handle} person={p} minutes={minutesOf(p)} zone={zone} now={now} unit={unit} leads={leads} onOpen={onOpen} />
      ))}
    </ul>
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-4">
      <div className="flex items-center justify-between gap-3 px-2 pt-3">
        {/* Everyone who has joined, whether or not they are out right now: the groups below say who is. */}
        <h2 className="text-[16px] font-bold leading-[22px] text-[var(--mc-ink)]">{people.length === 0 ? 'Nobody has joined yet' : people.length === 1 ? '1 person has joined' : `${people.length} people have joined`}</h2>
        {onShare && (
          <button type="button" onClick={onShare} className={BUTTON}>
            <Share2 size={15} aria-hidden="true" /> Bring more people
          </button>
        )}
      </div>
      {people.length === 0 && (
        <p className="px-2 pt-2 text-[15px] font-medium leading-[22px] text-[var(--mc-soft)]">
          Everyone who opens {name}&apos;s link and takes a {thing} shows up here with what they are doing.{leads ? (unit === 'street' ? ' You can give any of them a street or send them a word.' : ' You can send any of them a word.') : ''}
        </p>
      )}
      {g.free.length > 0 && <Label count={g.free.length}>Free</Label>}
      {list(g.free)}
      {g.asked.length > 0 && <Label count={g.asked.length}>Asked</Label>}
      {list(g.asked)}
      {g.walking.length > 0 && <Label count={g.walking.length}>On a {thing}</Label>}
      {list(g.walking)}
    </div>
  );
}
