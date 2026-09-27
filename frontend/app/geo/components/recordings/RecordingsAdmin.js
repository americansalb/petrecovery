'use client';

/**
 * /geo/admin/recordings: what the public read aloud on /geo/record
 * (server/recordings.js), and the three things to do with it.
 *
 *   Review     one take at a time, playing as it opens. A approves, R and
 *              a number sends it back with a reason, S skips, Space plays
 *              again. Sentences people flagged as wrong are listed under it.
 *   Speakers   each person's language: how far it has got, approve what
 *              is left, and once every sentence is approved, one button
 *              puts them in Voices games as a voice.
 *   Languages  which languages the public page offers, each with the
 *              link to send to its speakers.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Copy, ExternalLink, Flag, Loader2, Pause, Play, Search, ShieldAlert, SkipForward, Undo2 } from 'lucide-react';
import Card from '../ui/Card';
import Tabs from '../ui/Tabs';
import ScriptSample from '../script/ScriptSample';
import '../record/record.css';

const DENIALS = {
  signed_out: 'Sign in first.',
  no_account: 'That session does not match an account.',
  suspended: 'This account is suspended.',
  not_admin: 'This account is not an admin.',
};

const REASONS = [
  ['noise', 'Background noise'],
  ['text', 'Did not match the sentence'],
  ['unclear', 'Hard to make out'],
  ['volume', 'Too quiet or too loud'],
  ['cut', 'Cut off'],
  ['other', 'Something else'],
];

async function post(body) {
  const response = await fetch('/api/geo/admin/recordings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => null);
  const data = await response?.json().catch(() => ({}));
  if (!response?.ok) throw new Error(data?.error || 'Could not save');
  return data;
}

const seconds = (ms) => (ms ? `${(ms / 1000).toFixed(1)} s` : '');

function Speaker({ speaker }) {
  return (
    <span className="text-sm text-pe-muted">
      <span className="font-semibold text-pe-fg">{speaker.name}</span>
      {speaker.region ? `, from ${speaker.region}` : ''}
      {speaker.email ? <span className="ml-2 text-xs text-pe-subtle">{speaker.email}</span> : null}
    </span>
  );
}

function Review({ onCounts }) {
  const [data, setData] = useState(null);
  const [language, setLanguage] = useState('');
  const [current, setCurrent] = useState(0);
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [last, setLast] = useState(null);
  const audioRef = useRef(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/geo/admin/recordings?view=queue${language ? `&language=${language}` : ''}`, { cache: 'no-store' }).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    if (!response?.ok) {
      setError(body?.error || 'Could not load the queue');
      return;
    }
    setError('');
    setData(body);
    setCurrent(0);
    onCounts?.(body.waiting);
  }, [language, onCounts]);

  useEffect(() => {
    load();
  }, [load]);

  const item = data?.items?.[current] || null;

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !item) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    audio.play().catch(() => {});
  }, [item]);

  // Open each take playing: reviewing is listening.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setProgress(0);
    setRejecting(false);
    if (!item) {
      audio.removeAttribute('src');
      return;
    }
    audio.src = `/api/geo/admin/recordings/audio?id=${encodeURIComponent(item.id)}`;
    audio.play().catch(() => setPlaying(false));
  }, [item]);

  const decide = useCallback(
    async (decision, reason) => {
      if (!item || busy) return;
      setBusy(true);
      setError('');
      try {
        await post({ action: 'review', id: item.id, decision, reason });
        setLast({ item, decision, reason });
        setData((old) => ({ ...old, items: old.items.filter((row) => row.id !== item.id), waiting: old.waiting - 1 }));
        onCounts?.(Math.max(0, (data?.waiting || 1) - 1));
        setCurrent((index) => Math.min(index, Math.max(0, (data?.items?.length || 1) - 2)));
      } catch (failure) {
        setError(failure.message);
      }
      setBusy(false);
    },
    [item, busy, data, onCounts],
  );

  const skip = useCallback(() => {
    if (!data?.items?.length) return;
    setCurrent((index) => (index + 1) % data.items.length);
  }, [data]);

  // An undo for the last decision: it goes back to waiting, at the front.
  const undo = useCallback(async () => {
    if (!last) return;
    setBusy(true);
    try {
      await post({ action: 'review', id: last.item.id, decision: 'reopen' });
      setData((old) => ({ ...old, items: [last.item, ...old.items], waiting: old.waiting + 1 }));
      onCounts?.((data?.waiting || 0) + 1);
      setCurrent(0);
      setLast(null);
    } catch (failure) {
      setError(failure.message);
    }
    setBusy(false);
  }, [last, data, onCounts]);

  useEffect(() => {
    const onKey = (event) => {
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === ' ') {
        event.preventDefault();
        play();
      } else if (key === 'a') decide('approve');
      else if (key === 'r') setRejecting((value) => !value);
      else if (key === 's' || key === 'arrowright') skip();
      else if (key === 'arrowleft') setCurrent((index) => Math.max(0, index - 1));
      else if (key === 'z') undo();
      else if (rejecting && /^[1-6]$/.test(key)) decide('reject', REASONS[Number(key) - 1][0]);
      else if (key === 'escape') setRejecting(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [play, decide, skip, undo, rejecting]);

  const languages = useMemo(() => {
    const seen = new Map();
    for (const row of [...(data?.items || []), ...(data?.flags || [])]) seen.set(row.language.code, row.language.name);
    return [...seen].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  if (!data) return <p className="flex items-center gap-2 text-pe-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading</p>;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <audio
        ref={audioRef}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => {
          const { currentTime, duration } = event.currentTarget;
          setProgress(duration ? currentTime / duration : 0);
        }}
        hidden
      />
      <div className="min-w-0">
        {item ? (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-pe-canvas px-3 py-1 text-sm font-semibold text-pe-fg">
                {item.language.name}
                {item.language.endonym && item.language.endonym !== item.language.name ? <span className="ml-1.5 font-normal text-pe-muted">{item.language.endonym}</span> : null}
              </span>
              <Speaker speaker={item.speaker} />
            </div>
            <div className="pe-paper mt-4 rounded-3xl bg-[#fffdf8] px-5 py-6 text-center">
              <ScriptSample text={item.text} script={item.language.script} size="lg" />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button type="button" className="ui-btn ui-btn--secondary" onClick={play} aria-label={playing ? 'Pause' : 'Play'}>
                {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
              </button>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-pe-canvas">
                <div className="h-full rounded-full bg-pe-accent transition-[width] duration-100" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <span className="w-14 text-right text-sm tabular-nums text-pe-muted">{seconds(item.durationMs)}</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className="ui-btn ui-btn--primary ui-btn--lg" onClick={() => decide('approve')} disabled={busy}>
                <Check className="h-4 w-4" aria-hidden="true" /> Approve <kbd className="pe-rec-kbd">A</kbd>
              </button>
              <button type="button" className="ui-btn ui-btn--danger ui-btn--lg" aria-expanded={rejecting} onClick={() => setRejecting((value) => !value)} disabled={busy}>
                Send back <kbd className="pe-rec-kbd">R</kbd>
              </button>
              <button type="button" className="ui-btn ui-btn--ghost ui-btn--lg" onClick={skip} disabled={busy}>
                <SkipForward className="h-4 w-4" aria-hidden="true" /> Skip <kbd className="pe-rec-kbd">S</kbd>
              </button>
            </div>
            {rejecting ? (
              <div className="mt-4 rounded-xl bg-pe-canvas p-3">
                <p className="text-sm text-pe-muted">Why? The speaker sees this and reads it again.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {REASONS.map(([value, label], index) => (
                    <button key={value} type="button" className="ui-btn ui-btn--secondary ui-btn--sm" onClick={() => decide('reject', value)} disabled={busy}>
                      <kbd className="pe-rec-kbd">{index + 1}</kbd> {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {error ? <p role="alert" className="ui-error mt-3">{error}</p> : null}
          </Card>
        ) : (
          <Card tone="sunken" className="text-center">
            <Check className="mx-auto h-8 w-8 text-pe-good" aria-hidden="true" />
            <p className="mt-2 font-semibold text-pe-fg">Nothing waiting</p>
            <p className="ui-hint mt-1">New recordings show up here as people read them.</p>
          </Card>
        )}
        {last ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-pe-muted">
            {last.decision === 'approve' ? 'Approved' : `Sent back (${REASONS.find(([value]) => value === last.reason)?.[1] || 'reason'})`}: {last.item.speaker.name}, {last.item.language.name}.
            <button type="button" className="ui-link inline-flex items-center gap-1" onClick={undo} disabled={busy}>
              <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> Undo <kbd className="pe-rec-kbd">Z</kbd>
            </button>
          </p>
        ) : null}

        {data.flags.length ? (
          <section className="mt-8" aria-label="Flagged sentences">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-pe-subtle">
              <Flag className="h-4 w-4 text-pe-warm" aria-hidden="true" /> Sentences people say are wrong
            </h3>
            <p className="ui-hint mt-1">Native speakers flagged these instead of reading them. If one is wrong, fix it in the corpus: the new sentence goes to everyone to read. If it is fine, say so and it goes back on the speaker&apos;s list.</p>
            <ul className="mt-3 grid gap-2">
              {data.flags.map((flag) => (
                <li key={flag.id}>
                  <Card pad="sm" className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-pe-muted">{flag.language.name} · <Speaker speaker={flag.speaker} /></p>
                      <p className="mt-1 text-pe-fg" lang={flag.language.script}>{flag.text}</p>
                      <p className="mt-1 text-sm font-semibold text-pe-warm">{flag.note}</p>
                    </div>
                    <button
                      type="button"
                      className="ui-btn ui-btn--ghost ui-btn--sm"
                      onClick={async () => {
                        try {
                          await post({ action: 'review', id: flag.id, decision: 'dismiss' });
                          setData((old) => ({ ...old, flags: old.flags.filter((row) => row.id !== flag.id) }));
                        } catch (failure) {
                          setError(failure.message);
                        }
                      }}
                    >
                      It is fine
                    </button>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <aside className="lg:sticky lg:top-20">
        <Card pad="sm">
          <p className="text-2xl font-bold tabular-nums text-pe-fg">{data.waiting}</p>
          <p className="text-sm text-pe-muted">{data.waiting === 1 ? 'take waiting' : 'takes waiting'}</p>
          <label className="ui-field mt-3">
            <span className="ui-label">Language</span>
            <select className="ui-input" value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option value="">All languages</option>
              {languages.map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </label>
          {data.items.length ? (
            <ol className="mt-3 max-h-[50vh] divide-y divide-pe-line overflow-y-auto">
              {data.items.map((row, index) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setCurrent(index)}
                    aria-current={index === current ? 'true' : undefined}
                    className={`block w-full px-2 py-2 text-left text-sm transition hover:bg-pe-raised ${index === current ? 'bg-pe-raised' : ''}`}
                  >
                    <span className="block truncate font-medium text-pe-fg">{row.speaker.name} · {row.language.name}</span>
                    <span className="block truncate text-xs text-pe-subtle">{row.text}</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : null}
          <p className="mt-3 hidden text-xs text-pe-subtle lg:block">
            <kbd className="pe-rec-kbd">Space</kbd> play · <kbd className="pe-rec-kbd">←</kbd> <kbd className="pe-rec-kbd">→</kbd> move
          </p>
        </Card>
      </aside>
    </div>
  );
}

function SpeakerBar({ progress }) {
  const { total, approved, pending, rejected } = progress;
  const width = (count) => `${total ? (count / total) * 100 : 0}%`;
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-pe-canvas" aria-hidden="true">
      <div className="h-full bg-pe-good" style={{ width: width(approved) }} />
      <div className="h-full bg-pe-accent" style={{ width: width(pending) }} />
      <div className="h-full bg-red-500" style={{ width: width(rejected) }} />
    </div>
  );
}

function Speakers() {
  const [sets, setSets] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const response = await fetch('/api/geo/admin/recordings?view=speakers', { cache: 'no-store' }).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    if (response?.ok) setSets(body.sets);
    else setError(body?.error || 'Could not load');
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const act = async (setId, action) => {
    setBusy(`${setId}:${action}`);
    setError('');
    try {
      await post({ action, setId });
      await load();
    } catch (failure) {
      setError(failure.message);
    }
    setBusy('');
  };
  if (!sets) return <p className="flex items-center gap-2 text-pe-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading</p>;
  if (!sets.length) return <Card tone="sunken"><p className="text-pe-muted">Nobody has started recording yet. Open a language in the Languages tab and send its link to speakers.</p></Card>;
  return (
    <div>
      {error ? <p role="alert" className="ui-error mb-3">{error}</p> : null}
      <ul className="grid gap-3">
        {sets.map((set) => {
          const { progress } = set;
          const notRead = progress.total - progress.recorded - progress.flagged;
          return (
            <li key={set.id}>
              <Card pad="sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-pe-fg">
                      {set.language.name}
                      {set.language.endonym && set.language.endonym !== set.language.name ? <span className="ml-1.5 font-normal text-pe-muted">{set.language.endonym}</span> : null}
                    </p>
                    <Speaker speaker={set.speaker} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {progress.pending ? (
                      <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" disabled={Boolean(busy)} onClick={() => act(set.id, 'approveSet')}>
                        {busy === `${set.id}:approveSet` ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                        Approve all {progress.pending} waiting
                      </button>
                    ) : null}
                    {set.voice ? (
                      <Link href={`/geo/admin/voices?lang=${set.language.code}`} className="ui-btn ui-btn--ghost ui-btn--sm">
                        <Check className="h-4 w-4" aria-hidden="true" /> In Voices games{set.voice.enabled ? '' : ' (off)'}
                      </Link>
                    ) : (
                      <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" disabled={!set.complete || Boolean(busy)} onClick={() => act(set.id, 'addVoice')} title={set.complete ? '' : 'Every sentence has to be approved first'}>
                        {busy === `${set.id}:addVoice` ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                        Add to Voices games
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <SpeakerBar progress={progress} />
                  <p className="mt-1.5 text-xs text-pe-muted">
                    {progress.approved} of {progress.total} approved
                    {progress.pending ? ` · ${progress.pending} waiting` : ''}
                    {progress.rejected ? ` · ${progress.rejected} sent back` : ''}
                    {notRead > 0 ? ` · ${notRead} not read yet` : ''}
                    {progress.flagged ? ` · ${progress.flagged} flagged` : ''}
                  </p>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Languages() {
  const [rows, setRows] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('open');
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const response = await fetch('/api/geo/admin/recordings?view=languages', { cache: 'no-store' }).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    if (response?.ok) setRows(body.languages);
    else setError(body?.error || 'Could not load');
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows || [])
      .filter((row) => (filter === 'open' ? row.open || row.speakers : true))
      .filter((row) => !q || row.name.toLowerCase().includes(q) || (row.endonym || '').toLowerCase().includes(q) || row.code === q)
      .sort((a, b) => Number(b.open) - Number(a.open) || a.name.localeCompare(b.name));
  }, [rows, query, filter]);
  const toggle = async (row, open) => {
    setBusy(row.code);
    setError('');
    try {
      await post({ action: 'open', language: row.code, open });
      setRows((old) => old.map((item) => (item.code === row.code ? { ...item, open } : item)));
    } catch (failure) {
      setError(failure.message);
    }
    setBusy('');
  };
  const copy = async (code) => {
    await navigator.clipboard?.writeText(`${window.location.origin}/geo/record?lang=${code}`).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(''), 1500);
  };
  if (!rows) return <p className="flex items-center gap-2 text-pe-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading</p>;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pe-subtle" aria-hidden="true" />
          <input type="search" className="ui-input ui-input--icon" value={query} onChange={(event) => { setQuery(event.target.value); if (event.target.value) setFilter('all'); }} placeholder="Find a language to open" aria-label="Find a language" />
        </div>
        <div className="ui-seg" role="group" aria-label="Show">
          <button type="button" aria-pressed={filter === 'open'} onClick={() => setFilter('open')}>Open</button>
          <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
        </div>
      </div>
      <p className="ui-hint mt-2">Only open languages are named on the public page. Opening one shows its sentences to anyone signed in.</p>
      {error ? <p role="alert" className="ui-error mt-2">{error}</p> : null}
      <Card pad="none" className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="text-left text-xs font-semibold uppercase tracking-wide text-pe-subtle">
            <tr>
              <th className="px-4 py-2">Language</th>
              <th className="px-4 py-2 text-right">Sentences</th>
              <th className="px-4 py-2 text-right">Speakers</th>
              <th className="px-4 py-2 text-right">Waiting</th>
              <th className="px-4 py-2">Recording</th>
              <th className="px-4 py-2" aria-label="Link" />
            </tr>
          </thead>
          <tbody className="divide-y divide-pe-line">
            {shown.map((row) => (
              <tr key={row.code}>
                <td className="px-4 py-2">
                  <span className="font-medium text-pe-fg">{row.name}</span>
                  {row.endonym && row.endonym !== row.name ? <span className="ml-2 text-pe-muted">{row.endonym}</span> : null}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-pe-muted">{row.sentences}</td>
                <td className="px-4 py-2 text-right tabular-nums text-pe-muted">{row.speakers}</td>
                <td className="px-4 py-2 text-right tabular-nums text-pe-muted">{row.pending}</td>
                <td className="px-4 py-2">
                  <div className="ui-seg" role="group" aria-label={`${row.name} recording`}>
                    <button type="button" aria-pressed={row.open} disabled={busy === row.code || !row.sentences} onClick={() => !row.open && toggle(row, true)}>Open</button>
                    <button type="button" aria-pressed={!row.open} disabled={busy === row.code} onClick={() => row.open && toggle(row, false)}>Closed</button>
                  </div>
                </td>
                <td className="px-4 py-2 text-right">
                  {row.open ? (
                    <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => copy(row.code)}>
                      {copied === row.code ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                      {copied === row.code ? 'Copied' : 'Copy link'}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {!shown.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-pe-muted">{filter === 'open' ? 'No language is open yet. Show All, then open one.' : 'Nothing matches.'}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export default function RecordingsAdmin() {
  const [tab, setTab] = useState('review');
  const [waiting, setWaiting] = useState(null);
  const [denied, setDenied] = useState('');

  useEffect(() => {
    fetch('/api/geo/admin/recordings?view=languages', { cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 403) setDenied((await response.json().catch(() => ({})))?.error || 'not_admin');
      })
      .catch(() => {});
  }, []);

  if (denied) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-pe-warm" />
        <h1 className="mt-4 text-2xl font-bold text-pe-fg">Recordings</h1>
        <p className="mt-2 text-pe-muted">{DENIALS[denied] || 'You cannot open this page.'}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/geo/admin" className="ui-link inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Admin
      </Link>
      <header className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-pe-fg">Recordings</h1>
          <p className="mt-1 text-pe-muted">
            Sentences the public read aloud for Voices (beta). Approve the good takes. When every sentence of a language is approved for one person, add them to Voices games as a voice.
          </p>
        </div>
        <Link href="/geo/record" target="_blank" className="ui-btn ui-btn--secondary">
          The recording page <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </Link>
      </header>
      <Tabs
        className="mt-6"
        label="Recordings"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'review', label: waiting ? `Review (${waiting})` : 'Review' },
          { id: 'speakers', label: 'Speakers' },
          { id: 'languages', label: 'Languages' },
        ]}
      />
      <div className="mt-5">
        {tab === 'review' ? <Review onCounts={setWaiting} /> : tab === 'speakers' ? <Speakers /> : <Languages />}
      </div>
    </main>
  );
}
