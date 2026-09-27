'use client';

/**
 * /geo/record: read sentences aloud for Voices rounds.
 *
 * Four steps, each on screen only when it is the one to do:
 *   1. sign in (an email address and the code it is sent)
 *   2. how to be credited, and the terms
 *   3. a language, from the ones an admin has opened, and where you
 *      learned it
 *   4. the studio (Studio.js)
 *
 * The language is in the address (?lang=guj), so a link sent to a
 * speaker lands them on it, and a refresh keeps their place.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Copy, Loader2, Mic, Trash2 } from 'lucide-react';
import Card from '../ui/Card';
import SignInCard from '../SignInCard';
import Studio from './Studio';
import './record.css';

async function send(body) {
  const response = await fetch('/api/geo/record', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => null);
  const data = await response?.json().catch(() => ({}));
  if (!response?.ok) throw new Error(data?.error || 'Something went wrong');
  return data;
}

function Progress({ progress }) {
  const { total, approved, pending } = progress;
  const share = (count) => `${total ? (count / total) * 100 : 0}%`;
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-pe-canvas" aria-hidden="true">
      <div className="h-full bg-pe-good" style={{ width: share(approved) }} />
      <div className="h-full bg-pe-accent" style={{ width: share(pending) }} />
    </div>
  );
}

function Intro({ open }) {
  return (
    <header className="text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-pe-accent/15 text-pe-accent">
        <Mic className="h-8 w-8" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-pe-fg sm:text-4xl">Record your language</h1>
      <p className="mx-auto mt-3 max-w-xl text-lg text-pe-muted">
        In Probably Earth, players hear a language and guess where in the world it is spoken. Read a few sentences aloud and they will hear your voice.
      </p>
      <ol className="mx-auto mt-6 grid max-w-xl gap-2 text-left text-sm text-pe-muted sm:grid-cols-3 sm:text-center">
        <li><span className="font-semibold text-pe-fg">1.</span> Sign in with your email</li>
        <li><span className="font-semibold text-pe-fg">2.</span> Pick your language</li>
        <li><span className="font-semibold text-pe-fg">3.</span> Read each sentence aloud</li>
      </ol>
      {open.length ? (
        <p className="mx-auto mt-6 max-w-2xl text-sm text-pe-subtle">
          Wanted now: {open.map((language) => language.name).join(', ')}
        </p>
      ) : null}
    </header>
  );
}

function Join({ onJoined }) {
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Card className="mx-auto max-w-lg">
      <form
        method="post"
        className="grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          try {
            onJoined(await send({ action: 'join', name, agree }));
          } catch (failure) {
            setError(failure.message);
          }
          setBusy(false);
        }}
      >
        <h2 className="text-xl font-semibold text-pe-fg">Before you record</h2>
        <label className="ui-field">
          <span className="ui-label">Your name, as players will see it</span>
          <input className="ui-input" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="For example: Priya S." autoComplete="name" />
          <span className="ui-hint">A first name, a nickname or initials is fine.</span>
        </label>
        <label className="flex items-start gap-3 text-sm text-pe-muted">
          <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[rgb(var(--pe-accent))]" checked={agree} onChange={(event) => setAgree(event.target.checked)} />
          <span>
            The voice is mine. Probably Earth can keep these recordings and play them to players, credited with the name above. I can delete them from this page.{' '}
            <Link className="ui-link" href="/geo/privacy">Privacy</Link> · <Link className="ui-link" href="/legal/terms">Terms</Link>
          </span>
        </label>
        {error ? <p role="alert" className="ui-error">{error}</p> : null}
        <button type="submit" className="ui-btn ui-btn--primary ui-btn--lg" disabled={busy || !name.trim() || !agree}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          Continue
        </button>
      </form>
    </Card>
  );
}

function Languages({ state, onPick, onDeleted }) {
  const [deleting, setDeleting] = useState('');
  const started = new Map(state.sets.map((set) => [set.code, set]));
  const choices = [...state.open, ...state.sets.filter((set) => !state.open.some((open) => open.code === set.code))];
  if (!choices.length) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <p className="font-semibold text-pe-fg">No languages are open for recording right now.</p>
        <p className="ui-hint mt-1">Check back soon, or keep the link: the page will list them here when they open.</p>
      </Card>
    );
  }
  const remove = async (code) => {
    if (!window.confirm('Delete your recordings of this language? This cannot be undone.')) return;
    setDeleting(code);
    try {
      onDeleted(await send({ action: 'delete', language: code }));
    } catch (failure) {
      window.alert(failure.message);
    }
    setDeleting('');
  };
  return (
    <section className="mx-auto max-w-2xl" aria-label="Languages">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-pe-subtle">Pick your language</h2>
      <ul className="mt-3 grid gap-3">
        {choices.map((language) => {
          const set = started.get(language.code);
          const isOpen = state.open.some((open) => open.code === language.code);
          return (
            <li key={language.code}>
              <Card pad="sm" className="flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold text-pe-fg">
                    {language.name}
                    {language.endonym && language.endonym !== language.name ? <span className="ml-2 font-normal text-pe-muted">{language.endonym}</span> : null}
                  </p>
                  {set ? (
                    <>
                      <p className="mt-0.5 text-sm text-pe-muted">
                        {set.progress.recorded - set.progress.rejected} of {set.progress.total} read · {set.progress.approved} approved
                        {set.progress.rejected ? ` · ${set.progress.rejected} to read again` : ''}
                        {set.inGame ? ' · in the game' : ''}
                      </p>
                      <div className="mt-2 max-w-xs">
                        <Progress progress={set.progress} />
                      </div>
                    </>
                  ) : (
                    <p className="mt-0.5 text-sm text-pe-muted">{language.sentences} sentences, about {Math.max(2, Math.round(language.sentences / 4))} minutes</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {set ? (
                    <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => remove(language.code)} disabled={deleting === language.code} aria-label={`Delete my ${language.name} recordings`} title="Delete my recordings">
                      {deleting === language.code ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  ) : null}
                  {isOpen ? (
                    <button type="button" className="ui-btn ui-btn--primary" onClick={() => onPick(language.code)}>
                      {set ? (set.progress.left ? 'Continue' : 'Open') : 'Start'}
                    </button>
                  ) : (
                    <span className="text-sm text-pe-subtle">Closed for now</span>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Region({ language, onStarted, onBack }) {
  const [region, setRegion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Card className="mx-auto max-w-lg">
      <form
        method="post"
        className="grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          try {
            onStarted(await send({ action: 'start', language: language.code, region }));
          } catch (failure) {
            setError(failure.message);
            setBusy(false);
          }
        }}
      >
        <h2 className="text-xl font-semibold text-pe-fg">
          {language.name}
          {language.endonym && language.endonym !== language.name ? <span className="ml-2 font-normal text-pe-muted">{language.endonym}</span> : null}
        </h2>
        <label className="ui-field">
          <span className="ui-label">Where did you learn to speak it?</span>
          <input className="ui-input" value={region} onChange={(event) => setRegion(event.target.value)} maxLength={80} placeholder="A city, a region or a country" />
          <span className="ui-hint">Accents differ from place to place, and the game shows where each one is from.</span>
        </label>
        <div className="rounded-xl bg-pe-canvas p-4 text-sm text-pe-muted">
          <p className="font-semibold text-pe-fg">For a good recording</p>
          <p className="mt-1">A quiet room · the phone or microphone a hand&apos;s width away · read at your normal pace</p>
        </div>
        {error ? <p role="alert" className="ui-error">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="ui-btn ui-btn--primary ui-btn--lg" disabled={busy || !region.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
            Start recording
          </button>
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--lg" onClick={onBack}>Back</button>
        </div>
      </form>
    </Card>
  );
}

function Finished({ language, total, onReview, onBack }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== 'undefined' ? `${window.location.origin}/geo/record?lang=${language.code}` : '';
  return (
    <Card className="mx-auto max-w-lg text-center">
      <div className="pe-rec-check">
        <Check aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-2xl font-bold text-pe-fg">All {total} sentences are in</h2>
      <p className="mt-2 text-pe-muted">Thank you. Someone listens to each recording before it goes into the game, and this page shows where each one stands.</p>
      <div className="mt-5 rounded-xl bg-pe-canvas p-4 text-left">
        <p className="text-sm font-semibold text-pe-fg">Know someone else who speaks {language.name}?</p>
        <div className="mt-2 flex gap-2">
          <input className="ui-input" readOnly value={link} aria-label="Link to record this language" onFocus={(event) => event.target.select()} />
          <button
            type="button"
            className="ui-btn ui-btn--secondary shrink-0"
            onClick={async () => {
              await navigator.clipboard?.writeText(link).catch(() => {});
              setCopied(true);
            }}
          >
            {copied ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Copy className="h-4 w-4 shrink-0" aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" className="ui-btn ui-btn--secondary" onClick={onReview}>Listen to my takes</button>
        <button type="button" className="ui-btn ui-btn--ghost" onClick={onBack}>Record another language</button>
      </div>
    </Card>
  );
}

export default function RecordClient() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const lang = params.get('lang') || '';
  const [state, setState] = useState(null);
  const [set, setSet] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('studio');

  const load = useCallback(async () => {
    const response = await fetch('/api/geo/record', { cache: 'no-store' }).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    if (!response?.ok) {
      setError(body?.error || 'The page could not load. Try again in a moment.');
      return;
    }
    setError('');
    setState(body);
  }, []);

  const loadSet = useCallback(async () => {
    if (!lang) return null;
    const response = await fetch(`/api/geo/record/set?language=${encodeURIComponent(lang)}`, { cache: 'no-store' }).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    if (!response?.ok) {
      setSet(null);
      return null;
    }
    setSet(body);
    return body.sentences;
  }, [lang]);

  useEffect(() => {
    load();
  }, [load]);

  // An action answers with the person's progress only; the rest (signed
  // in, the open languages) stays as it was.
  const merge = useCallback((body) => setState((old) => ({ ...old, ...body })), []);
  const started = state?.sets?.some((row) => row.code === lang);
  useEffect(() => {
    setSet(null);
    setView('studio');
    if (state?.signedIn && started) loadSet();
  }, [state?.signedIn, started, loadSet]);

  // Moving between the list and a language re-reads progress, so the
  // list shows what was just recorded.
  const pick = useCallback(
    (code) => {
      load();
      router.push(code ? `${pathname}?lang=${encodeURIComponent(code)}` : pathname, { scroll: true });
    },
    [router, pathname, load],
  );

  if (error) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <p role="alert" className="ui-error">{error}</p>
        <button type="button" className="ui-btn ui-btn--secondary mt-4" onClick={load}>Try again</button>
      </main>
    );
  }
  if (!state) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-pe-muted" aria-label="Loading" />
      </main>
    );
  }

  const chosen = lang ? state.open.find((row) => row.code === lang) || state.sets.find((row) => row.code === lang) : null;
  const inStudio = Boolean(state.signedIn && state.contributor?.agreed && chosen && started && set);
  const allIn = set && !set.sentences.some((row) => row.status === 'new' || row.status === 'rejected');

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      {inStudio ? (
        <div className="mx-auto mb-6 flex max-w-2xl flex-wrap items-center justify-between gap-3">
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => pick('')}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Languages
          </button>
          <p className="text-right text-sm text-pe-muted">
            <span className="font-semibold text-pe-fg">{set.language.name}</span>
            {set.language.endonym && set.language.endonym !== set.language.name ? ` · ${set.language.endonym}` : ''} · from {set.language.region}
          </p>
        </div>
      ) : (
        <Intro open={state.open} />
      )}

      <div className={inStudio ? '' : 'mt-10'}>
        {!state.signedIn ? (
          <div className="mx-auto max-w-md">
            <SignInCard returnTo={`${pathname}${lang ? `?lang=${lang}` : ''}`} onAuthenticated={load} />
          </div>
        ) : !state.contributor?.agreed ? (
          <Join onJoined={merge} />
        ) : !chosen ? (
          <>
            {lang ? <p role="alert" className="ui-error mx-auto mb-4 max-w-2xl">That language is not open for recording.</p> : null}
            <Languages state={state} onPick={pick} onDeleted={merge} />
          </>
        ) : !started ? (
          <Region language={chosen} onBack={() => pick('')} onStarted={merge} />
        ) : !set ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-pe-muted" aria-label="Loading" />
          </div>
        ) : !set.language.open ? (
          <Card className="mx-auto max-w-lg text-center">
            <p className="font-semibold text-pe-fg">{set.language.name} is closed for recording for now.</p>
            <p className="ui-hint mt-1">What you already recorded is kept.</p>
          </Card>
        ) : allIn && view === 'studio' ? (
          <Finished language={set.language} total={set.sentences.length} onReview={() => setView('review')} onBack={() => pick('')} />
        ) : (
          <Studio key={set.language.code} language={set.language} sentences={set.sentences} onChanged={loadSet} onDone={() => setView('studio')} />
        )}
      </div>

      {state.signedIn ? (
        <p className="mt-12 text-center text-xs text-pe-subtle">
          Signed in as {state.email}. <Link className="ui-link" href="/geo/privacy">How recordings are kept</Link>
        </p>
      ) : null}
    </main>
  );
}
