'use client';

/**
 * Voices (beta) on /geo/admin: which Script languages can be played by
 * ear, and in which ElevenLabs voice (server/voice.js).
 *
 * A voice is picked from the ElevenLabs account's own list, or pasted as
 * an id, then heard once with Listen, then switched on. Nothing here
 * uploads a file: the audio is made by ElevenLabs the first time a
 * sentence plays and stored after that.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Card from './ui/Card';
import { Check, Loader2, Play, Volume2 } from 'lucide-react';

const BUTTON = 'inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold text-white/70 transition hover:bg-white/5 disabled:opacity-50';

function VoiceRow({ row, voices, onSaved }) {
  const [draft, setDraft] = useState(row.voiceId);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [sample, setSample] = useState('');
  const sampleRef = useRef('');
  useEffect(() => () => sampleRef.current && URL.revokeObjectURL(sampleRef.current), []);
  const id = draft.trim();
  const known = voices.find((voice) => voice.id === id);

  const save = async (enabled) => {
    setBusy('save');
    setError('');
    const response = await fetch('/api/geo/admin/voices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: row.code, voiceId: id, enabled }),
    }).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    setBusy('');
    if (!response?.ok) {
      setError(body?.error || 'Could not save');
      return;
    }
    onSaved(row.code, { voiceId: body.voiceId, enabled: body.enabled });
  };

  // Fetched rather than handed to an <audio> straight away, so a refusal
  // (no key, a bad id) reads as its reason instead of a silent player.
  const listen = async () => {
    setBusy('listen');
    setError('');
    const response = await fetch(`/api/geo/admin/voices/sample?language=${row.code}&voiceId=${encodeURIComponent(id)}`).catch(() => null);
    if (!response?.ok) {
      const body = await response?.json().catch(() => ({}));
      setBusy('');
      setError(body?.error || 'Could not load the sample');
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    if (sampleRef.current) URL.revokeObjectURL(sampleRef.current);
    sampleRef.current = url;
    setSample(url);
    setBusy('');
  };

  return (
    <tr className="align-top">
      <td className="px-4 py-2">
        <span className="font-medium text-white">{row.name}</span>
        <span className="ml-2 font-mono text-xs text-white/50">{row.code}</span>
        {!row.v3 ? <span className="block text-xs text-white/40">Not on ElevenLabs&apos; v3 list</span> : null}
      </td>
      <td className="px-4 py-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          list="elevenlabs-voices"
          placeholder="Voice id"
          aria-label={`Voice for ${row.name}`}
          className="w-56 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 font-mono text-xs text-white placeholder:text-white/30"
        />
        {known ? <span className="mt-1 block text-xs text-white/60">{known.name}</span> : null}
        {error ? <span role="alert" className="mt-1 block max-w-[16rem] text-xs text-red-300">{error}</span> : null}
      </td>
      <td className="px-4 py-2">
        <button type="button" className={BUTTON} disabled={!id || Boolean(busy)} onClick={listen}>
          {busy === 'listen' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Listen
        </button>
        {sample ? <audio src={sample} controls autoPlay className="mt-2 h-8 w-56" /> : null}
      </td>
      <td className="whitespace-nowrap px-4 py-2">
        {id !== row.voiceId ? (
          <button type="button" className={`${BUTTON} mr-2`} disabled={Boolean(busy)} onClick={() => save(row.enabled && Boolean(id))}>
            {busy === 'save' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save
          </button>
        ) : null}
        <button
          type="button"
          aria-pressed={row.enabled}
          disabled={Boolean(busy) || (!row.enabled && !id)}
          onClick={() => save(!row.enabled)}
          className={`${BUTTON} ${row.enabled ? 'border-forest-400/60 bg-forest-500/20 text-forest-100' : ''}`}
        >
          {row.enabled ? 'On' : 'Off'}
        </button>
      </td>
      <td className="px-4 py-2 text-right tabular-nums text-white/70">{row.clips}</td>
    </tr>
  );
}

export default function VoicesAdmin() {
  const [data, setData] = useState(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/api/geo/admin/voices', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => live && setData(body))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!data) return null;
  const onSaved = (code, patch) =>
    setData((current) => ({ ...current, languages: current.languages.map((row) => (row.code === code ? { ...row, ...patch } : row)) }));
  const rows = data.languages
    .filter((row) => all || row.v3 || row.voiceId || row.enabled)
    .sort((a, b) => a.name.localeCompare(b.name));
  const on = data.languages.filter((row) => row.enabled).length;

  return (
    <section className="mt-10" aria-label="Voices">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <Volume2 className="h-5 w-5 text-clay-300" />
          Voices (beta)
        </h2>
        <Link href="/geo/script/play?voice=1" className="text-sm font-semibold text-clay-300 hover:text-clay-200">
          Play a Voices game
        </Link>
      </div>
      <p className="mt-1 text-sm text-white/60">
        Script rounds you hear instead of read. Give a language an ElevenLabs voice, press Listen, then switch it on. Each sentence is made by ElevenLabs (v3) the first time it plays and stored, so it is paid for once. {on} {on === 1 ? 'language is' : 'languages are'} on.
      </p>
      {!data.keySet ? (
        <p role="status" className="mt-2 text-sm text-amber-300">
          ELEVENLABS_API_KEY is not set on this server. Stored audio still plays; nothing new can be made.
        </p>
      ) : !data.voices.length ? (
        <p role="status" className="mt-2 text-sm text-amber-300">
          Could not list the voices on the ElevenLabs account. Paste a voice id instead.
        </p>
      ) : null}
      <datalist id="elevenlabs-voices">
        {data.voices.map((voice) => (
          <option key={voice.id} value={voice.id}>
            {voice.about ? `${voice.name} (${voice.about})` : voice.name}
          </option>
        ))}
      </datalist>
      <Card pad="none" className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="bg-white/5 text-left text-xs font-semibold uppercase tracking-wide text-white/60">
            <tr>
              <th className="px-4 py-2">Language</th>
              <th className="px-4 py-2">Voice</th>
              <th className="px-4 py-2">Sample</th>
              <th className="px-4 py-2">In the game</th>
              <th className="px-4 py-2 text-right">Stored clips</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((row) => (
              <VoiceRow key={row.code} row={row} voices={data.voices} onSaved={onSaved} />
            ))}
          </tbody>
        </table>
      </Card>
      <button type="button" className={`${BUTTON} mt-3`} onClick={() => setAll((value) => !value)}>
        {all ? 'Show the v3 languages only' : 'Show all languages'}
      </button>
    </section>
  );
}
