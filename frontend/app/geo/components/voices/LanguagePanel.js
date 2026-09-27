'use client';

/**
 * One language on /geo/admin/voices: whether it is in Voices games, its
 * voices with their settings, and a way to add more.
 *
 * Each voice can be heard three ways before it goes near a player: the
 * ElevenLabs preview (free), "Hear it" (v3 reading this language's first
 * sentence), and the sentence list, where every sentence can be played,
 * and a bad take thrown away and made again. What is made here is what
 * rounds play, so checking a voice costs nothing extra later.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ChevronDown, Flag, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import Card from '../ui/Card';
import AddVoice from './AddVoice';
import { madeClip, PlayButton, PlayError, usePlayer } from './player';

const WEIGHTS = [
  [1, 'Less often'],
  [2, 'Normal'],
  [4, 'More often'],
];
const DELIVERIES = [
  ['creative', 'Creative', 'Most expressive; can drift from the text'],
  ['natural', 'Natural', 'Closest to the voice as recorded'],
  ['robust', 'Robust', 'Steadiest; least expressive'],
];

async function post(body) {
  const response = await fetch('/api/geo/admin/voices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => null);
  const data = await response?.json().catch(() => ({}));
  if (!response?.ok) throw new Error(data?.error || 'Could not save');
  return data;
}

function Setting({ label, hint, children }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-pe-subtle">{label}</p>
      <div className="mt-1">{children}</div>
      {hint ? <p className="ui-hint mt-1">{hint}</p> : null}
    </div>
  );
}

function Sentences({ voice, sentences, onChanged }) {
  const player = usePlayer();
  const [remaking, setRemaking] = useState(-1);
  return (
    <ol className="mt-3 divide-y divide-pe-line rounded-xl border border-pe-line">
      {sentences.map((text, n) => {
        const key = `clip:${voice.id}:${n}`;
        return (
          <li key={n} className="flex flex-wrap items-start gap-3 px-3 py-2.5">
            <span className="w-6 shrink-0 pt-2 text-right text-xs tabular-nums text-pe-subtle">{n + 1}</span>
            <div className="min-w-0 flex-1 pt-1.5">
              <p className="text-sm text-pe-fg">{text}</p>
              <p className={`text-xs ${voice.made[n] ? 'text-pe-good' : 'text-pe-subtle'}`}>{voice.made[n] ? 'Made' : 'Not made yet'}</p>
              <PlayError playKey={key} />
            </div>
            <div className="flex shrink-0 gap-2">
              <PlayButton playKey={key} source={madeClip(voice.id, n)} label="Play" onPlayed={voice.made[n] ? undefined : onChanged} />
              {voice.made[n] && voice.kind !== 'recorded' ? (
                <button
                  type="button"
                  className="ui-btn ui-btn--ghost ui-btn--sm"
                  disabled={remaking === n}
                  title="Throw this take away and make a new one"
                  onClick={async () => {
                    setRemaking(n);
                    await player.play(key, madeClip(voice.id, n, { remake: true }));
                    setRemaking(-1);
                  }}
                >
                  {remaking === n ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
                  Remake
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function VoiceCard({ voice, language, onChanged }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [making, setMaking] = useState(null);
  const stopRef = useRef(false);
  const made = voice.made.filter(Boolean).length;
  const total = voice.made.length;

  const save = async (patch, what) => {
    setBusy(what);
    setError('');
    try {
      await post({ action: 'update', id: voice.id, ...patch });
      await onChanged();
    } catch (failure) {
      setError(failure.message);
    }
    setBusy('');
  };

  // One sentence at a time, so the progress is real and a refusal (the
  // day's limit, a voice ElevenLabs will not use) stops it at once.
  const makeTheRest = async () => {
    const missing = voice.made.map((done, n) => (done ? -1 : n)).filter((n) => n >= 0);
    stopRef.current = false;
    setError('');
    for (let i = 0; i < missing.length; i++) {
      if (stopRef.current) break;
      setMaking({ done: i, of: missing.length });
      const response = await fetch('/api/geo/admin/voices/clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: voice.id, n: missing[i] }),
      }).catch(() => null);
      if (!response?.ok) {
        const body = await response?.json().catch(() => ({}));
        setError(body?.error || 'Could not make the audio');
        break;
      }
    }
    setMaking(null);
    await onChanged();
  };

  const remove = async () => {
    const stored = voice.kind === 'recorded'
      ? '? Their recordings stay on the Recordings screen, where they can be added again'
      : made ? ` and its ${made} stored ${made === 1 ? 'sentence' : 'sentences'}?` : '?';
    if (!window.confirm(`Remove ${voice.name} from ${language.name}${stored}`)) return;
    setBusy('remove');
    setError('');
    try {
      await post({ action: 'remove', id: voice.id });
      await onChanged();
    } catch (failure) {
      setError(failure.message);
      setBusy('');
    }
  };

  return (
    <Card tone={voice.enabled ? 'panel' : 'sunken'} pad="sm" as="li">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-pe-fg">
            {voice.name}
            {voice.kind === 'recorded' ? <span className="rounded-full bg-pe-good/15 px-2 py-0.5 text-xs font-semibold text-pe-good">Recorded by a speaker</span> : null}
            {!voice.enabled ? <span className="rounded-full bg-pe-canvas px-2 py-0.5 text-xs font-semibold text-pe-subtle">Off</span> : null}
          </p>
          <p className="text-sm text-pe-muted">{voice.about || <span className="font-mono text-xs">{voice.voiceId}</span>}</p>
          {voice.reports ? (
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-pe-warm">
              <Flag className="h-4 w-4" aria-hidden="true" />
              {voice.reports === 1 ? '1 player said it sounds wrong' : `${voice.reports} players said it sounds wrong`}
            </p>
          ) : null}
        </div>
        <div className="ui-seg" role="group" aria-label={`${voice.name} in rounds`}>
          <button type="button" aria-pressed={voice.enabled} disabled={Boolean(busy)} onClick={() => !voice.enabled && save({ enabled: true }, 'enabled')}>On</button>
          <button type="button" aria-pressed={!voice.enabled} disabled={Boolean(busy)} onClick={() => voice.enabled && save({ enabled: false }, 'enabled')}>Off</button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {voice.previewUrl ? <PlayButton playKey={`preview:${voice.id}`} source={voice.previewUrl} label="Preview" /> : null}
        <PlayButton playKey={`clip:${voice.id}:0`} source={madeClip(voice.id, 0)} label={`Hear it in ${language.name}`} onPlayed={voice.made[0] ? undefined : onChanged} />
      </div>
      <PlayError playKey={`preview:${voice.id}`} />
      <PlayError playKey={`clip:${voice.id}:0`} />

      <div className={`mt-4 grid gap-4 ${voice.kind === 'recorded' ? '' : 'sm:grid-cols-2'}`}>
        <Setting label="How often it reads">
          <div className="ui-seg" role="group" aria-label="How often it reads">
            {WEIGHTS.map(([value, label]) => (
              <button key={value} type="button" aria-pressed={voice.weight === value} disabled={Boolean(busy)} onClick={() => voice.weight !== value && save({ weight: value }, 'weight')}>
                {label}
              </button>
            ))}
          </div>
        </Setting>
        {voice.kind === 'recorded' ? null : (
        <Setting label="Delivery" hint={DELIVERIES.find(([value]) => value === voice.delivery)?.[2]}>
          <div className="ui-seg" role="group" aria-label="Delivery">
            {DELIVERIES.map(([value, label, hint]) => (
              <button
                key={value}
                type="button"
                title={hint}
                aria-pressed={voice.delivery === value}
                disabled={Boolean(busy)}
                onClick={() => {
                  if (voice.delivery === value) return;
                  if (made && !window.confirm(`A new delivery is new audio: the ${made} ${made === 1 ? 'sentence' : 'sentences'} made so far will be made again as rounds need them. Change it?`)) return;
                  save({ delivery: value }, 'delivery');
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </Setting>
        )}
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-pe-muted">
            {making ? `Making ${making.done + 1} of ${making.of}` : voice.kind === 'recorded' ? `${made} of ${total} sentences approved` : `${made} of ${total} sentences made`}
          </span>
          <div className="flex flex-wrap gap-2">
            {making ? (
              <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => { stopRef.current = true; }}>Stop</button>
            ) : made < total && voice.kind !== 'recorded' ? (
              <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" disabled={Boolean(busy)} onClick={makeTheRest}>
                Make the rest
              </button>
            ) : null}
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
              <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
              {open ? 'Hide sentences' : 'Check every sentence'}
            </button>
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-pe-canvas" aria-hidden="true">
          <div className="h-full rounded-full bg-pe-good transition-all" style={{ width: `${total ? Math.round(((making ? made + making.done : made) / total) * 100) : 0}%` }} />
        </div>
        {open ? <Sentences voice={voice} sentences={language.sentences} onChanged={onChanged} /> : null}
      </div>

      {error ? <p role="alert" className="ui-error mt-3">{error}</p> : null}
      <div className="mt-4 flex justify-end">
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={Boolean(busy) || Boolean(making)} onClick={remove}>
          {busy === 'remove' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
          Remove
        </button>
      </div>
    </Card>
  );
}

export default function LanguagePanel({ code, onBack, onOverviewChanged }) {
  const [language, setLanguage] = useState(null);
  const [error, setError] = useState('');
  const [switching, setSwitching] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/geo/admin/voices?language=${encodeURIComponent(code)}`, { cache: 'no-store' }).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    if (!response?.ok) {
      setError(body?.error || 'Could not load the language');
      return;
    }
    setError('');
    setLanguage(body.language);
  }, [code]);

  useEffect(() => {
    setLanguage(null);
    load();
  }, [load]);

  const changed = useCallback(async () => {
    await load();
    onOverviewChanged();
  }, [load, onOverviewChanged]);

  const setEnabled = async (enabled) => {
    setSwitching(true);
    setError('');
    try {
      await post({ action: 'language', language: code, enabled });
      await changed();
    } catch (failure) {
      setError(failure.message);
    }
    setSwitching(false);
  };

  // Only on a phone, where the list and the language take turns.
  const back = (
    <div className="lg:hidden">
      <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All languages
      </button>
    </div>
  );

  if (!language) {
    return (
      <div>
        {back}
        {error ? <p role="alert" className="ui-error mt-4">{error}</p> : <p className="mt-4 flex items-center gap-2 text-pe-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading</p>}
      </div>
    );
  }

  const voicesOn = language.voices.filter((voice) => voice.enabled).length;
  return (
    <section aria-label={language.name} className="min-w-0">
      {back}
      <Card className="mt-2 lg:mt-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-pe-fg">
              {language.name}
              {language.endonym && language.endonym !== language.name ? <span className="ml-2 font-normal text-pe-muted">{language.endonym}</span> : null}
            </h2>
            <p className="mt-1 text-sm text-pe-muted">
              <span className="font-mono">{language.code}</span> · {language.sentences.length} sentences · a round reads one to six of them, all in one voice
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-pe-subtle">In Voices games</p>
            <div className="ui-seg mt-1" role="group" aria-label="In Voices games">
              <button type="button" aria-pressed={language.enabled} disabled={switching || (!language.enabled && !voicesOn)} onClick={() => !language.enabled && setEnabled(true)}>On</button>
              <button type="button" aria-pressed={!language.enabled} disabled={switching} onClick={() => language.enabled && setEnabled(false)}>Off</button>
            </div>
            {!language.enabled && !voicesOn ? <p className="ui-hint mt-1">Add a voice and switch it on first.</p> : null}
          </div>
        </div>
        {!language.v3 ? (
          <p className="mt-3 flex items-start gap-2 text-sm text-pe-warm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ElevenLabs does not list {language.name} for v3. It may still read it; listen to every sentence before switching it on.
          </p>
        ) : null}
        {error ? <p role="alert" className="ui-error mt-3">{error}</p> : null}
      </Card>

      <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-pe-subtle">
        Voices {language.voices.length ? `(${voicesOn} on, ${language.voices.length} in all)` : ''}
      </h3>
      {language.voices.length ? (
        <ul className="mt-2 grid gap-3">
          {language.voices.map((voice) => (
            <VoiceCard key={voice.id} voice={voice} language={language} onChanged={changed} />
          ))}
        </ul>
      ) : (
        <p className="ui-hint mt-2">No voices yet. Add one below: a round picks one of the voices that are on, so two or three make the language sound less like one person.</p>
      )}

      <div className="mt-6">
        <AddVoice language={language} onAdded={changed} full={language.voices.length >= 12} />
      </div>
    </section>
  );
}
