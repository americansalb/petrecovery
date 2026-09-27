'use client';

/**
 * The recording studio on /geo/record: one sentence at a time, read into
 * one big microphone (record.css).
 *
 * The big button always does the obvious next thing, and the line under
 * it says what that is:
 *
 *   nothing yet   record          (red, pulsing, a live level meter)
 *   recording     stop
 *   a new take    play it back    then Keep, or Read it again
 *   kept          play it back    then Next, or Read it again
 *
 * Keys, for people doing forty in a row: Space is the big button, Enter
 * keeps or moves on, R reads again, and the arrows move between
 * sentences. A take is only sent when it is kept.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Flag, Loader2, Mic, Pause, Play, RotateCcw } from 'lucide-react';
import ScriptSample from '../script/ScriptSample';
import { recorderSupported, useRecorder } from './useRecorder';

const MAX_MS = 30000;
const SHORTEST_MS = 500;

const STATUS_LINE = {
  new: '',
  pending: 'Kept. Waiting for review.',
  approved: 'Approved. It is ready for the game.',
  flagged: 'You said this sentence is wrong.',
};

const FLAG_REASONS = ['It has a mistake', 'Nobody would say it like this', 'It is not in this language'];

const clock = (ms) => {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** The live level meter inside the button: sixteen bars over the voice range. */
function Bars({ analyserRef, active }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!active) return undefined;
    let frame = 0;
    let last = 0;
    const draw = (now) => {
      frame = requestAnimationFrame(draw);
      if (now - last < 33) return;
      last = now;
      const canvas = canvasRef.current;
      const analyser = analyserRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      const data = new Uint8Array(analyser ? analyser.frequencyBinCount : 64);
      if (analyser) analyser.getByteFrequencyData(data);
      const count = 16;
      const gap = 8;
      const barWidth = (width - gap * (count - 1)) / count;
      for (let i = 0; i < count; i++) {
        const level = data[Math.floor((i / count) * data.length * 0.6)] / 255;
        const barHeight = Math.max(height * 0.08, level * height * 0.92);
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;
        ctx.fillStyle = `rgba(255,255,255,${(0.55 + level * 0.45).toFixed(2)})`;
        ctx.beginPath();
        ctx.roundRect?.(x, y, barWidth, barHeight, Math.min(barWidth / 2, 6));
        if (!ctx.roundRect) ctx.rect(x, y, barWidth, barHeight);
        ctx.fill();
      }
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [active, analyserRef]);
  return <canvas ref={canvasRef} className="pe-rec-bars" width={300} height={168} aria-hidden="true" />;
}

function firstToDo(sentences) {
  const next = sentences.findIndex((sentence) => sentence.status === 'new' || sentence.status === 'rejected');
  return next >= 0 ? next : 0;
}

export default function Studio({ language, sentences, onChanged, onDone }) {
  const recorder = useRecorder({ maxMs: MAX_MS });
  const [index, setIndex] = useState(() => firstToDo(sentences));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [flagging, setFlagging] = useState(false);
  const [note, setNote] = useState('');
  const audioRef = useRef(null);
  const micRef = useRef(null);
  const sentence = sentences[Math.min(index, sentences.length - 1)];
  const { take } = recorder;

  const read = sentences.filter((row) => row.status === 'pending' || row.status === 'approved').length;
  const approved = sentences.filter((row) => row.status === 'approved').length;
  const kept = sentence && (sentence.status === 'pending' || sentence.status === 'approved');
  const mode = recorder.state === 'recording' || recorder.state === 'stopping' ? 'recording' : take ? 'take' : kept ? 'kept' : 'ready';

  const stopPlayback = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  const go = useCallback(
    (next) => {
      if (recorder.state === 'recording') return;
      stopPlayback();
      recorder.discard();
      setError('');
      setFlagging(false);
      setIndex(Math.max(0, Math.min(sentences.length - 1, next)));
    },
    [recorder, sentences.length, stopPlayback],
  );

  const playSource = useCallback(
    async (url) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (playing) {
        stopPlayback();
        return;
      }
      audio.src = url;
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setError('That take would not play.');
      }
    },
    [playing, stopPlayback],
  );

  const big = useCallback(() => {
    setError('');
    if (mode === 'recording') recorder.stop();
    else if (mode === 'take') playSource(take.url);
    else if (mode === 'kept' && sentence.id) playSource(`/api/geo/record/take?id=${encodeURIComponent(sentence.id)}&at=${Date.now()}`);
    else {
      stopPlayback();
      recorder.start();
    }
  }, [mode, recorder, take, sentence, playSource, stopPlayback]);

  const again = useCallback(() => {
    stopPlayback();
    recorder.discard();
    setError('');
    recorder.start();
  }, [recorder, stopPlayback]);

  const nextToDo = useCallback(
    (after) => {
      const order = [...sentences.keys()].map((offset) => (after + 1 + offset) % sentences.length);
      const next = order.find((i) => i !== after && (sentences[i].status === 'new' || sentences[i].status === 'rejected'));
      return next ?? Math.min(after + 1, sentences.length - 1);
    },
    [sentences],
  );

  const keep = useCallback(async () => {
    if (!take || saving) return;
    if (take.durationMs < SHORTEST_MS) {
      setError('That was very short. Read the whole sentence, then stop.');
      return;
    }
    stopPlayback();
    setSaving(true);
    setError('');
    const params = new URLSearchParams({ language: language.code, n: String(sentence.n), ms: String(take.durationMs) });
    const response = await fetch(`/api/geo/record/take?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': take.type || 'audio/webm' },
      body: take.blob,
    }).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    setSaving(false);
    if (!response?.ok) {
      setError(body?.error || 'The take did not upload. Check the connection and press Keep again.');
      return;
    }
    recorder.discard();
    const fresh = await onChanged();
    const rows = fresh || sentences;
    const left = rows.filter((row) => row.status === 'new' || row.status === 'rejected').length;
    if (!left) onDone?.();
    else setIndex(nextToDo(sentence.n));
  }, [take, saving, stopPlayback, language.code, sentence, recorder, onChanged, sentences, onDone, nextToDo]);

  const flag = useCallback(async () => {
    const why = note.trim();
    if (!why) return;
    setSaving(true);
    const response = await fetch('/api/geo/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'flag', language: language.code, n: sentence.n, note: why }),
    }).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    setSaving(false);
    if (!response?.ok) {
      setError(body?.error || 'That did not send.');
      return;
    }
    setFlagging(false);
    setNote('');
    await onChanged();
    setIndex(nextToDo(sentence.n));
  }, [note, language.code, sentence, onChanged, nextToDo]);

  // Keys, except while typing.
  useEffect(() => {
    const onKey = (event) => {
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === ' ') {
        event.preventDefault();
        big();
      } else if (event.key === 'Enter') {
        if (mode === 'take') keep();
        else if (mode === 'kept') go(index + 1);
      } else if (event.key === 'r' || event.key === 'R') {
        if (mode === 'take' || mode === 'kept') again();
      } else if (event.key === 'ArrowRight') go(index + 1);
      else if (event.key === 'ArrowLeft') go(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [big, keep, again, go, mode, index]);

  // Stop playback when the take or the sentence changes.
  useEffect(() => stopPlayback, [index, stopPlayback]);

  const counts = useMemo(() => ({ total: sentences.length, read, approved }), [sentences.length, read, approved]);

  if (!recorderSupported()) {
    return (
      <p role="alert" className="ui-error">
        This browser cannot record audio. Open this page in a current version of Chrome, Edge, Firefox or Safari.
      </p>
    );
  }
  if (!sentence) return null;

  const label = {
    ready: sentence.status === 'rejected' ? 'Tap to read it again' : 'Tap to record',
    recording: `Recording ${clock(recorder.elapsed)}  ·  tap to stop`,
    take: playing ? 'Playing your take' : 'Tap to hear your take',
    kept: playing ? 'Playing your take' : 'Tap to hear it',
  }[mode];

  return (
    <div className="mx-auto w-full max-w-2xl">
      <audio ref={audioRef} onEnded={() => setPlaying(false)} hidden />

      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold text-pe-fg">
          Sentence {sentence.n + 1} <span className="font-normal text-pe-muted">of {counts.total}</span>
        </span>
        <span className="text-pe-muted">
          {counts.read} read · {counts.approved} approved
        </span>
      </div>
      <div className="pe-rec-track mt-2" role="group" aria-label="Sentences">
        {sentences.map((row) => (
          <button
            key={row.n}
            type="button"
            data-status={row.status}
            aria-current={row.n === sentence.n ? 'step' : undefined}
            aria-label={`Sentence ${row.n + 1}: ${row.status === 'new' ? 'not read yet' : row.status}`}
            title={`Sentence ${row.n + 1}`}
            onClick={() => go(row.n)}
          />
        ))}
      </div>

      <div className="pe-paper mt-5 rounded-3xl bg-[#fffdf8] px-5 py-7 text-center shadow-[0_18px_40px_rgba(0,0,0,0.28)] sm:px-8">
        <ScriptSample text={sentence.text} script={language.script} size="lg" />
      </div>
      {sentence.status === 'rejected' ? (
        <p className="mt-3 text-center text-sm font-semibold text-red-400">Sent back: {sentence.reason || 'please read it again'}.</p>
      ) : STATUS_LINE[sentence.status] ? (
        <p className={`mt-3 text-center text-sm ${sentence.status === 'approved' ? 'text-pe-good' : sentence.status === 'flagged' ? 'text-pe-warm' : 'text-pe-muted'}`}>
          {STATUS_LINE[sentence.status]}
        </p>
      ) : (
        <p className="mt-3 text-center text-sm text-pe-muted">Read it aloud the way you would say it to a friend.</p>
      )}

      <div className="mt-6 flex flex-col items-center gap-4">
        <button
          ref={micRef}
          type="button"
          className="pe-rec-mic"
          data-state={mode === 'ready' ? undefined : mode}
          onClick={big}
          disabled={saving || recorder.state === 'asking' || recorder.state === 'stopping'}
          aria-label={label}
        >
          <span className="pe-rec-icon">
            {recorder.state === 'asking' ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : mode === 'take' || mode === 'kept' ? (
              playing ? <Pause aria-hidden="true" /> : mode === 'kept' ? <Check aria-hidden="true" /> : <Play aria-hidden="true" />
            ) : (
              <Mic aria-hidden="true" />
            )}
          </span>
          <Bars analyserRef={recorder.analyserRef} active={mode === 'recording'} />
        </button>
        <span className="pe-rec-pill" data-state={mode === 'recording' ? 'recording' : mode === 'kept' ? 'kept' : undefined} role="status">
          {recorder.state === 'asking' ? 'Waiting for the microphone' : label}
        </span>

        {mode === 'take' ? (
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="ui-btn ui-btn--primary ui-btn--lg" onClick={keep} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
              Keep
            </button>
            <button type="button" className="ui-btn ui-btn--secondary ui-btn--lg" onClick={again} disabled={saving}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Read it again
            </button>
          </div>
        ) : mode === 'kept' ? (
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="ui-btn ui-btn--primary ui-btn--lg" onClick={() => go(nextToDo(sentence.n))}>
              Next sentence <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" className="ui-btn ui-btn--secondary ui-btn--lg" onClick={again}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Read it again
            </button>
          </div>
        ) : null}

        {error || recorder.error ? (
          <p role="alert" className="ui-error max-w-md text-center">{error || recorder.error}</p>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-pe-line pt-4">
        <div className="flex gap-2">
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => go(index - 1)} disabled={index === 0 || mode === 'recording'}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
          </button>
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => go(index + 1)} disabled={index >= sentences.length - 1 || mode === 'recording'}>
            Skip <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" aria-expanded={flagging} onClick={() => setFlagging((value) => !value)}>
          <Flag className="h-4 w-4" aria-hidden="true" /> Something wrong with this sentence?
        </button>
      </div>

      {flagging ? (
        <form
          method="post"
          className="mt-3 grid gap-3 rounded-xl bg-pe-surface p-4"
          onSubmit={(event) => {
            event.preventDefault();
            flag();
          }}
        >
          <p className="text-sm text-pe-muted">Tell us instead of reading it. Your note goes to the people who fix the sentences.</p>
          <div className="ui-seg flex-wrap" role="group" aria-label="What is wrong">
            {FLAG_REASONS.map((reason) => (
              <button key={reason} type="button" aria-pressed={note === reason} onClick={() => setNote(reason)}>
                {reason}
              </button>
            ))}
          </div>
          <label className="ui-field">
            <span className="ui-label">What is wrong with it</span>
            <input className="ui-input" value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} placeholder="For example: the second word is misspelled" />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="ui-btn ui-btn--primary" disabled={!note.trim() || saving}>Send</button>
            <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setFlagging(false)}>Cancel</button>
          </div>
        </form>
      ) : null}

      <p className="mt-6 hidden text-center text-xs text-pe-subtle sm:block">
        <span className="pe-rec-kbd">Space</span> record, stop or play · <span className="pe-rec-kbd">Enter</span> keep · <span className="pe-rec-kbd">R</span> read again · <span className="pe-rec-kbd">←</span> <span className="pe-rec-kbd">→</span> move
      </p>
    </div>
  );
}
