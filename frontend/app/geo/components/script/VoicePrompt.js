'use client';

/**
 * Voices (beta): the round's passage, heard instead of read.
 *
 * The round carries only its sealed token and how many sentences it
 * has; each sentence is its own clip, fetched through the token from
 * /api/geo/voice/clip and played one after another. Nothing on the page
 * names the language or shows the text until the guess is in.
 *
 * Browsers will not start sound on their own, so the round starts with
 * a Play button. The clips are asked for as soon as the round arrives,
 * one at a time and in order: the first request for a sentence is the
 * one that makes it, which takes a moment, so the first sentence is
 * usually ready by the time the player presses Play. One at a time,
 * because ElevenLabs refuses more than a few requests at once.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Play, RotateCcw } from 'lucide-react';

export default function VoicePrompt({ token, clips, compact = false }) {
  const audioRef = useRef(null);
  const [state, setState] = useState('ready');
  const [index, setIndex] = useState(0);
  const urls = useMemo(
    () => Array.from({ length: Math.max(0, clips || 0) }, (_, n) => `/api/geo/voice/clip?t=${encodeURIComponent(token || '')}&n=${n}`),
    [token, clips],
  );

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      for (const url of urls) {
        try {
          // Read to the end, so the browser keeps it for the player.
          await (await fetch(url, { signal: controller.signal })).blob();
        } catch {
          return;
        }
      }
    })();
    return () => controller.abort();
  }, [urls]);

  const playFrom = (n) => {
    const audio = audioRef.current;
    if (!audio || !urls[n]) return;
    setIndex(n);
    setState('loading');
    audio.src = urls[n];
    audio.play().then(() => setState('playing')).catch(() => setState('error'));
  };
  const onEnded = () => {
    if (index + 1 < urls.length) playFrom(index + 1);
    else setState('done');
  };

  if (!token || !urls.length) return null;
  return (
    <div className={compact ? 'flex justify-center py-1' : 'flex flex-col items-center gap-3 py-4'}>
      <audio ref={audioRef} onEnded={onEnded} onError={() => setState('error')} preload="none" />
      {!compact ? <p className="text-sm text-sand-600">Listen, then pin where the language is spoken.</p> : null}
      {state === 'error' ? (
        <div className="flex flex-col items-center gap-2">
          <p role="alert" className="text-sm text-red-700">The audio did not load.</p>
          <button type="button" className="ui-btn ui-btn--secondary" onClick={() => playFrom(0)}>
            <RotateCcw className="h-4 w-4" /> Try again
          </button>
        </div>
      ) : state === 'playing' || state === 'loading' ? (
        <p role="status" className="flex items-center gap-2 text-sm font-semibold text-sand-800">
          <Loader2 className="h-4 w-4 animate-spin" />
          {urls.length > 1 ? `Playing ${index + 1} of ${urls.length}` : 'Playing'}
        </p>
      ) : (
        <button type="button" className={compact ? 'ui-btn ui-btn--ghost ui-btn--sm' : 'ui-btn ui-btn--primary ui-btn--lg'} onClick={() => playFrom(0)}>
          {state === 'done' ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {state === 'done' ? 'Play again' : 'Play'}
        </button>
      )}
    </div>
  );
}
