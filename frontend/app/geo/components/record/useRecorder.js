'use client';

/**
 * The microphone, for /geo/record.
 *
 * The stream opens on the first take and stays open while the studio is
 * on screen, so every later take starts the moment the button is
 * pressed instead of clipping its first syllable while the browser wakes
 * the microphone. It closes when the studio closes or the tab is hidden.
 *
 * A take is whatever the browser records natively (Opus in WebM or Ogg,
 * AAC in MP4 on Safari); the server keeps it as it came.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'];

function pickType() {
  if (typeof MediaRecorder === 'undefined') return '';
  return TYPES.find((type) => MediaRecorder.isTypeSupported?.(type)) || '';
}

export function recorderSupported() {
  return typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

const BLOCKED = 'The browser did not let this page use your microphone. Allow it for this site (the icon in the address bar), then try again.';

export function useRecorder({ maxMs = 30000 } = {}) {
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const contextRef = useRef(null);
  const analyserRef = useRef(null);
  const chunksRef = useRef([]);
  const startedRef = useRef(0);
  const timerRef = useRef(0);
  const [state, setState] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [take, setTake] = useState(null);

  const close = useCallback(() => {
    clearInterval(timerRef.current);
    try {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    } catch {
      // Already stopped.
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    contextRef.current?.close().catch(() => {});
    contextRef.current = null;
    analyserRef.current = null;
  }, []);

  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === 'hidden') close();
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      close();
    };
  }, [close]);

  const open = useCallback(async () => {
    if (streamRef.current?.active) return streamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: false, noiseSuppression: true, autoGainControl: true },
    });
    streamRef.current = stream;
    // The level meter is decoration: recording works without it.
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      const context = new Context();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.7;
      context.createMediaStreamSource(stream).connect(analyser);
      contextRef.current = context;
      analyserRef.current = analyser;
    } catch {
      analyserRef.current = null;
    }
    return stream;
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state === 'recording') {
      setState('stopping');
      recorder.stop();
    }
  }, []);

  const start = useCallback(async () => {
    if (state === 'recording' || state === 'asking') return;
    setError('');
    setTake((old) => {
      if (old?.url) URL.revokeObjectURL(old.url);
      return null;
    });
    setState('asking');
    let stream;
    try {
      stream = await open();
    } catch (failure) {
      setState('error');
      setError(failure?.name === 'NotAllowedError' || failure?.name === 'SecurityError' ? BLOCKED : 'No microphone was found. Plug one in or try another device.');
      return;
    }
    await contextRef.current?.resume?.().catch(() => {});
    const type = pickType();
    let recorder;
    try {
      recorder = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 64000 } : undefined);
    } catch {
      recorder = new MediaRecorder(stream);
    }
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      clearInterval(timerRef.current);
      const durationMs = Math.round(performance.now() - startedRef.current);
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || type || 'audio/webm' });
      chunksRef.current = [];
      setTake({ blob, url: URL.createObjectURL(blob), durationMs, type: blob.type });
      setState('idle');
    };
    recorderRef.current = recorder;
    startedRef.current = performance.now();
    setElapsed(0);
    recorder.start(250);
    setState('recording');
    timerRef.current = setInterval(() => {
      const ms = performance.now() - startedRef.current;
      setElapsed(ms);
      if (ms >= maxMs) stop();
    }, 100);
  }, [state, open, maxMs, stop]);

  const discard = useCallback(() => {
    setTake((old) => {
      if (old?.url) URL.revokeObjectURL(old.url);
      return null;
    });
  }, []);

  return { state, elapsed, error, take, start, stop, discard, analyserRef, close };
}
