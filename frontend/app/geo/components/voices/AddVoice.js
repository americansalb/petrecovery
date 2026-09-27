'use client';

/**
 * Adding a voice to a language, three ways:
 *
 *   Voice Library  voices other people shared on ElevenLabs, filtered to
 *                  the ones that speak this language. Adding one saves it
 *                  to the account's My Voices too, which is what lets the
 *                  API speak with it.
 *   My voices      the voices already in the account.
 *   Paste an id    anything else, by its ElevenLabs voice id.
 *
 * The previews are ElevenLabs' own samples and cost nothing. They are
 * not v3 reading this language's sentences, which is what "Hear it"
 * on the voice is for once it is added.
 */

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Plus, Search } from 'lucide-react';
import Card from '../ui/Card';
import Tabs from '../ui/Tabs';
import { PlayButton, PlayError } from './player';

const TABS = [
  { id: 'library', label: 'Voice Library' },
  { id: 'account', label: 'My voices' },
  { id: 'paste', label: 'Paste an id' },
];

function VoiceResult({ voice, added, adding, onAdd }) {
  const key = `preview:${voice.ownerId || 'account'}:${voice.voiceId}`;
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-pe-fg">{voice.name}</p>
        {voice.about ? <p className="text-sm text-pe-muted">{voice.about}</p> : null}
        {voice.description ? <p className="mt-0.5 line-clamp-2 text-sm text-pe-subtle">{voice.description}</p> : null}
        <PlayError playKey={key} />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {voice.previewUrl ? <PlayButton playKey={key} source={voice.previewUrl} label="Preview" /> : null}
        {added ? (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-pe-good">
            <Check className="h-4 w-4" aria-hidden="true" /> Added
          </span>
        ) : (
          <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" disabled={adding} onClick={onAdd}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
            Add
          </button>
        )}
      </div>
    </li>
  );
}

export default function AddVoice({ language, onAdded, full }) {
  const [tab, setTab] = useState('library');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [onlyLanguage, setOnlyLanguage] = useState(Boolean(language.libraryLanguage));
  const [gender, setGender] = useState('');
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState('');
  const [pasteId, setPasteId] = useState('');
  const [pasteName, setPasteName] = useState('');
  const added = new Set(language.voices.map((voice) => voice.voiceId));

  const load = useCallback(async (nextPage = 0) => {
    if (tab === 'paste') return;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ source: tab, search: query });
    if (tab === 'library') {
      if (onlyLanguage && language.libraryLanguage) params.set('language', language.libraryLanguage);
      if (gender) params.set('gender', gender);
      params.set('page', String(nextPage));
    }
    const response = await fetch(`/api/geo/admin/voices/browse?${params}`, { cache: 'no-store' }).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    setLoading(false);
    if (!response?.ok) {
      setError(body?.error || 'Could not reach ElevenLabs');
      if (!nextPage) setResults([]);
      return;
    }
    let voices = body.voices || [];
    // The account's voices that speak this language first.
    if (tab === 'account' && language.libraryLanguage) {
      const speaks = (voice) => voice.languages?.includes(language.libraryLanguage);
      voices = [...voices.filter(speaks), ...voices.filter((voice) => !speaks(voice))];
    }
    setResults((current) => (nextPage ? [...current, ...voices] : voices));
    setHasMore(Boolean(body.hasMore));
    setPage(nextPage);
  }, [tab, query, onlyLanguage, gender, language.libraryLanguage]);

  useEffect(() => {
    load(0);
  }, [load]);

  const add = async (voice) => {
    setAdding(voice.voiceId);
    setError('');
    const response = await fetch('/api/geo/admin/voices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', language: language.code, ...voice }),
    }).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    setAdding('');
    if (!response?.ok) {
      setError(body?.error || 'Could not add the voice');
      return false;
    }
    await onAdded();
    return true;
  };

  if (full) {
    return (
      <Card>
        <h3 className="text-base font-semibold text-pe-fg">Add a voice</h3>
        <p className="ui-hint mt-1">{language.name} has as many voices as it can take. Remove one to add another.</p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-base font-semibold text-pe-fg">Add a voice</h3>
      <Tabs items={TABS} value={tab} onChange={(id) => { setTab(id); setResults([]); setError(''); }} label="Where the voice comes from" className="mt-3" />

      {tab === 'paste' ? (
        <form
          method="post"
          className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await add({ voiceId: pasteId.trim(), name: pasteName.trim() })) {
              setPasteId('');
              setPasteName('');
            }
          }}
        >
          <label className="ui-field">
            <span className="ui-label">Voice id</span>
            <input className="ui-input font-mono" value={pasteId} onChange={(event) => setPasteId(event.target.value)} placeholder="e.g. JBFqnCBsd6RMkjVDRZzb" autoComplete="off" spellCheck={false} />
          </label>
          <label className="ui-field">
            <span className="ui-label">Name to show here</span>
            <input className="ui-input" value={pasteName} onChange={(event) => setPasteName(event.target.value)} placeholder="Optional" />
          </label>
          <button type="submit" className="ui-btn ui-btn--primary" disabled={!pasteId.trim() || Boolean(adding)}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
            Add
          </button>
          {error ? <p role="alert" className="ui-error sm:col-span-3">{error}</p> : null}
          <p className="ui-hint sm:col-span-3">The id is on the voice in ElevenLabs, under the three dots, as &quot;Copy voice ID&quot;.</p>
        </form>
      ) : (
        <>
          <form
            method="post"
            className="mt-4 flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setQuery(search.trim());
            }}
          >
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pe-subtle" aria-hidden="true" />
              <input
                type="search"
                className="ui-input ui-input--icon"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={tab === 'library' ? 'Search the library: accent, age, style' : 'Search your voices'}
                aria-label="Search voices"
              />
            </div>
            <button type="submit" className="ui-btn ui-btn--secondary">Search</button>
          </form>
          {tab === 'library' ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {language.libraryLanguage ? (
                <div className="ui-seg" role="group" aria-label="Language">
                  <button type="button" aria-pressed={onlyLanguage} onClick={() => setOnlyLanguage(true)}>Speaks {language.name}</button>
                  <button type="button" aria-pressed={!onlyLanguage} onClick={() => setOnlyLanguage(false)}>Any language</button>
                </div>
              ) : null}
              <div className="ui-seg" role="group" aria-label="Voice">
                {[['', 'Any voice'], ['female', 'Female'], ['male', 'Male']].map(([value, label]) => (
                  <button key={value || 'any'} type="button" aria-pressed={gender === value} onClick={() => setGender(value)}>{label}</button>
                ))}
              </div>
            </div>
          ) : null}

          {error ? <p role="alert" className="ui-error mt-3">{error}</p> : null}
          {loading && !results.length ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-pe-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Asking ElevenLabs</p>
          ) : results.length ? (
            <ul className="mt-2 divide-y divide-pe-line">
              {results.map((voice) => (
                <VoiceResult
                  key={`${voice.ownerId || 'account'}:${voice.voiceId}`}
                  voice={voice}
                  added={added.has(voice.voiceId)}
                  adding={adding === voice.voiceId}
                  onAdd={() => add({ voiceId: voice.voiceId, ownerId: voice.ownerId, name: voice.name, about: voice.about, previewUrl: voice.previewUrl })}
                />
              ))}
            </ul>
          ) : !error ? (
            <p className="ui-hint mt-4">
              {tab === 'library'
                ? onlyLanguage
                  ? `No library voices are filed under ${language.name}. Try Any language and search for "${language.name}" or an accent.`
                  : 'Nothing matches that search.'
                : 'No voices in the account match. Add voices in ElevenLabs, or use the Voice Library tab.'}
            </p>
          ) : null}
          {hasMore ? (
            <button type="button" className="ui-btn ui-btn--ghost mt-2" disabled={loading} onClick={() => load(page + 1)}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Show more
            </button>
          ) : null}
          {tab === 'library' ? (
            <p className="ui-hint mt-3">Adding a library voice also saves it to My Voices on ElevenLabs, and your plan limits how many voices that can hold.</p>
          ) : null}
        </>
      )}
    </Card>
  );
}
