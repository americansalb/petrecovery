'use client';

/**
 * /geo/admin/voices: Voices (beta), where Script languages get the
 * ElevenLabs voices that read them aloud (server/voice.js).
 *
 * Built for many languages with many voices each: the languages down
 * the left, searchable and filtered to the ones that matter now, and the
 * chosen one on the right with its voices and their settings. The chosen
 * language is in the address (?lang=fra), so a refresh or a shared link
 * opens the same one. On a phone the list and the language take turns.
 *
 * Authorisation is the server's, as on /geo/admin: this screen shows
 * the refusal when the API refuses.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Mic, Play, Search, ShieldAlert } from 'lucide-react';
import Card from '../ui/Card';
import LanguagePanel from './LanguagePanel';
import { PlayerProvider } from './player';

const DENIALS = {
  signed_out: 'Sign in first.',
  no_account: 'That session does not match an account.',
  suspended: 'This account is suspended.',
  not_admin: 'This account is not an admin.',
};

const FILTERS = [
  ['v3', 'v3', 'The languages ElevenLabs lists for v3', (row) => row.v3],
  ['on', 'On', 'In Voices games', (row) => row.enabled],
  ['voiced', 'Voiced', 'Has at least one voice, on or off', (row) => row.voices > 0],
  ['all', 'All', 'Every Script language', () => true],
];

const fold = (text) => String(text || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function Usage({ usedToday, cap }) {
  const share = cap ? Math.min(1, usedToday / cap) : 0;
  return (
    <div className="min-w-[14rem]">
      <p className="text-xs font-semibold uppercase tracking-wide text-pe-subtle">New audio today</p>
      <p className="mt-0.5 text-sm tabular-nums text-pe-fg">
        {usedToday.toLocaleString('en-US')} of {cap.toLocaleString('en-US')} characters
      </p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-pe-canvas" aria-hidden="true">
        <div className={`h-full rounded-full ${share >= 0.9 ? 'bg-pe-bad' : 'bg-pe-accent'}`} style={{ width: `${Math.round(share * 100)}%` }} />
      </div>
      <p className="ui-hint mt-1">GEO_VOICE_DAILY_CHARACTERS in Render sets the limit.</p>
    </div>
  );
}

function LanguageList({ rows, selected, onSelect, className }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('v3');
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(([id, , , test]) => [id, rows.filter(test).length])), [rows]);
  const shown = useMemo(() => {
    const test = FILTERS.find(([id]) => id === filter)?.[3] || (() => true);
    const q = fold(query.trim());
    return rows
      .filter(test)
      .filter((row) => !q || fold(row.name).includes(q) || fold(row.endonym).includes(q) || row.code === q)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, filter, query]);

  return (
    <Card pad="none" className={`flex flex-col overflow-hidden lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] ${className}`}>
      <div className="border-b border-pe-line p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pe-subtle" aria-hidden="true" />
          <input type="search" className="ui-input ui-input--icon" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a language" aria-label="Find a language" />
        </div>
        <div className="ui-seg ui-seg--block mt-2" role="group" aria-label="Show">
          {FILTERS.map(([id, label, hint]) => (
            <button key={id} type="button" title={hint} aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label} <span className="tabular-nums text-pe-subtle">{counts[id]}</span>
            </button>
          ))}
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto py-1" aria-label="Languages">
        {shown.map((row) => (
          <li key={row.code}>
            <button
              type="button"
              aria-current={selected === row.code ? 'true' : undefined}
              onClick={() => onSelect(row.code)}
              className={`flex min-h-[44px] w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-pe-raised ${selected === row.code ? 'bg-pe-raised' : ''}`}
            >
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${row.enabled ? 'bg-pe-good' : row.voices ? 'border-2 border-pe-good' : 'border border-pe-line-strong'}`}
                title={row.enabled ? 'On' : row.voices ? 'Has voices, off' : 'No voices'}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-pe-fg">{row.name}</span>
                {row.endonym && row.endonym !== row.name ? <span className="block truncate text-xs text-pe-subtle">{row.endonym}</span> : null}
              </span>
              <span className="shrink-0 text-right text-xs text-pe-muted">
                {row.voices ? `${row.voicesOn}/${row.voices} ${row.voices === 1 ? 'voice' : 'voices'}` : ''}
                {row.enabled ? <span className="block font-semibold text-pe-good">On</span> : null}
              </span>
            </button>
          </li>
        ))}
        {!shown.length ? <li className="px-3 py-6 text-center text-sm text-pe-muted">Nothing matches.</li> : null}
      </ul>
    </Card>
  );
}

export default function VoicesClient() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.get('lang') || '';
  const [overview, setOverview] = useState(null);
  const [denied, setDenied] = useState('');

  const loadOverview = useCallback(async () => {
    const response = await fetch('/api/geo/admin/voices', { cache: 'no-store' }).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    if (response?.status === 403) {
      setDenied(body?.error || 'not_admin');
      return;
    }
    if (response?.ok) setOverview(body);
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const select = useCallback((code) => {
    router.replace(code ? `${pathname}?lang=${encodeURIComponent(code)}` : pathname, { scroll: false });
  }, [router, pathname]);

  if (denied) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-pe-warm" />
        <h1 className="mt-4 text-2xl font-bold text-pe-fg">Voices</h1>
        <p className="mt-2 text-pe-muted">{DENIALS[denied] || 'You cannot open this page.'}</p>
      </main>
    );
  }

  return (
    <PlayerProvider>
      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* On a phone the list and a language take turns, and while a
            language is open the introduction steps aside for it. */}
        <div className={selected ? 'hidden lg:block' : ''}>
          <Link href="/geo/admin" className="ui-link inline-flex items-center gap-1 text-sm">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Admin
          </Link>
          <header className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-pe-fg">
                <Mic className="h-7 w-7 text-pe-warm" aria-hidden="true" /> Voices (beta)
              </h1>
              <p className="mt-1 text-pe-muted">
                Script rounds read aloud by ElevenLabs v3. Give a language a few voices, listen to them, then switch the language on. Each sentence is made the first time it is needed and stored, so it is paid for once per voice.
              </p>
            </div>
            <Link href="/geo/script/play?voice=1" className="ui-btn ui-btn--primary">
              <Play className="h-4 w-4" aria-hidden="true" /> Play a Voices game
            </Link>
          </header>

          {overview ? (
            <Card pad="sm" className="mt-5 flex flex-wrap items-center justify-between gap-4">
              {overview.keySet ? (
                <p className="flex items-center gap-2 text-sm font-semibold text-pe-good">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> ElevenLabs is connected
                </p>
              ) : (
                <p className="max-w-xl text-sm text-pe-warm">
                  <strong>ElevenLabs is not connected.</strong> Add ELEVENLABS_API_KEY to the environment in Render. Until then, stored audio still plays and nothing new can be made or looked up.
                </p>
              )}
              <Usage usedToday={overview.usedToday} cap={overview.cap} />
            </Card>
          ) : null}
        </div>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
          {overview ? (
            <LanguageList rows={overview.languages} selected={selected} onSelect={select} className={selected ? 'hidden lg:flex' : ''} />
          ) : (
            <p className="text-pe-muted">Loading</p>
          )}
          {selected ? (
            <LanguagePanel key={selected} code={selected} onBack={() => select('')} onOverviewChanged={loadOverview} />
          ) : (
            <Card tone="sunken" className="hidden lg:block">
              <p className="font-semibold text-pe-fg">Pick a language</p>
              <p className="ui-hint mt-1">
                A filled dot is a language in Voices games; a ring has voices but is off. The v3 filter shows the languages ElevenLabs lists for its v3 model, which is where to start.
              </p>
            </Card>
          )}
        </div>
      </main>
    </PlayerProvider>
  );
}
