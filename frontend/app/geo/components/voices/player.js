'use client';

/**
 * One player for the whole Voices screen, so pressing a second play
 * button stops the first instead of talking over it, and every button
 * can show whether it is the one playing.
 *
 * A source is either a URL (ElevenLabs' free preview) or a function that
 * returns one, for audio this site has to make first: the function asks
 * the server to make the clip and gets its reason back if it cannot
 * ("today's limit is reached"), which an <audio> element on its own
 * would swallow into a silent failure.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Loader2, Play, Square } from 'lucide-react';

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const audioRef = useRef(null);
  const [now, setNow] = useState({ key: '', status: 'idle', error: '', errorKey: '' });
  const nowRef = useRef(now);
  nowRef.current = now;

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setNow((current) => ({ ...current, key: '', status: 'idle' }));
  }, []);

  const play = useCallback(async (key, source) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (nowRef.current.key === key && nowRef.current.status !== 'idle') {
      stop();
      return;
    }
    audio.pause();
    setNow({ key, status: 'loading', error: '', errorKey: '' });
    try {
      const url = typeof source === 'function' ? await source() : source;
      // Pressed again, or another button pressed, while this one loaded.
      if (nowRef.current.key !== key) return;
      audio.src = url;
      await audio.play();
      setNow({ key, status: 'playing', error: '', errorKey: '' });
    } catch (error) {
      if (nowRef.current.key !== key) return;
      // A browser that only starts sound straight from a click refuses
      // once the clip took a while to make; the clip is stored by then,
      // so the second press is quick enough.
      const message = error?.name === 'NotAllowedError' ? 'Ready. Press play again.' : error?.message || 'Could not play it';
      setNow({ key: '', status: 'idle', error: message, errorKey: key });
    }
  }, [stop]);

  const value = useMemo(() => ({ ...now, play, stop }), [now, play, stop]);
  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        preload="none"
        onEnded={() => setNow((current) => ({ ...current, key: '', status: 'idle' }))}
        onError={() => {
          if (nowRef.current.status === 'idle') return;
          setNow((current) => ({ key: '', status: 'idle', error: 'The audio did not load', errorKey: current.key }));
        }}
        hidden
      />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  return useContext(PlayerContext);
}

/**
 * Ask the server to make a clip (it answers with the reason if it
 * cannot), then hand back the URL that plays the stored copy.
 */
export function madeClip(voice, n, { remake = false } = {}) {
  return async () => {
    const response = await fetch('/api/geo/admin/voices/clip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voice, n, remake }),
    }).catch(() => null);
    if (!response?.ok) {
      const body = await response?.json().catch(() => ({}));
      throw new Error(body?.error || 'Could not make the audio');
    }
    return `/api/geo/admin/voices/clip?voice=${encodeURIComponent(voice)}&n=${n}&at=${Date.now()}`;
  };
}

/** A play button that knows whether it is the one playing. */
export function PlayButton({ playKey, source, label, className = 'ui-btn ui-btn--secondary ui-btn--sm', disabled = false, onPlayed }) {
  const player = usePlayer();
  const active = player.key === playKey;
  const Icon = active && player.status === 'loading' ? Loader2 : active && player.status === 'playing' ? Square : Play;
  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      aria-pressed={active && player.status === 'playing'}
      onClick={async () => {
        await player.play(playKey, source);
        onPlayed?.();
      }}
    >
      <Icon className={`h-4 w-4 ${active && player.status === 'loading' ? 'animate-spin' : ''}`} aria-hidden="true" />
      {label}
    </button>
  );
}

/** The last thing that would not play, next to the button that tried. */
export function PlayError({ playKey }) {
  const player = usePlayer();
  if (!player.error || player.errorKey !== playKey) return null;
  return <p role="alert" className="ui-error mt-1">{player.error}</p>;
}
