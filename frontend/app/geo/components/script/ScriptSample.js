'use client';

/**
 * The sentence a round shows.
 *
 * Two jobs. Render the text in a face that has the glyphs, which is
 * what app/geo/script/fonts.js is for; and notice when that failed,
 * which is what the rest of this file is for.
 *
 * The noticing is not defensive padding. A language game that draws
 * empty boxes is not a hard round, it is an unplayable one, and it
 * fails hardest on cheap Android hardware in exactly the places this
 * mode exists to represent (docs/WANDERGUESSER_STRATEGY.md, bet 5a).
 * Telling the player "your device has no font for this alphabet" costs
 * one line and turns a broken round into an explained one.
 *
 * How the check works: a font renders any character it lacks as the
 * same .notdef box, so every missing glyph measures the same width.
 * U+FFFF is a permanent non-character, so no font may have a glyph for
 * it and its width IS that box. Measure it, then measure the sentence
 * character by character: if most of them are exactly box-width, the
 * device is drawing boxes. It runs after document.fonts.ready, so a
 * face still downloading is not mistaken for a missing one.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { fontStackFor } from '@/app/geo/script/fonts';

const RIGHT_TO_LEFT = new Set(['arab', 'hebr']);

/** True if the device is drawing .notdef boxes instead of the script. */
export function measureTofu(text, fontStack, makeCanvas) {
  const canvas = makeCanvas();
  const ctx = canvas?.getContext?.('2d');
  if (!ctx) return false;
  ctx.font = `32px ${fontStack}`;
  const box = ctx.measureText('￿').width;
  if (!box) return false;
  let boxes = 0;
  let total = 0;
  for (const ch of text) {
    // Spaces have no glyph, and a combining mark measures zero whether
    // it rendered or not; neither says anything about coverage.
    if (/\s/.test(ch) || ctx.measureText(ch).width === 0) continue;
    total += 1;
    if (Math.abs(ctx.measureText(ch).width - box) < 0.01) boxes += 1;
  }
  return total >= 4 && boxes / total > 0.5;
}

export default function ScriptSample({ text, script, size = 'lg' }) {
  const [tofu, setTofu] = useState(false);
  const nodeRef = useRef(null);
  const stack = useMemo(() => fontStackFor(script), [script]);

  useEffect(() => {
    let cancelled = false;
    setTofu(false);
    const check = () => {
      if (cancelled || !text) return;
      try {
        setTofu(measureTofu(text, stack, () => document.createElement('canvas')));
      } catch {
        /* no canvas: say nothing rather than warn wrongly */
      }
    };
    // Wait for the bundled face, or the check would fail every round
    // during the first paint.
    if (typeof document !== 'undefined' && document.fonts?.ready) document.fonts.ready.then(check).catch(check);
    else check();
    return () => {
      cancelled = true;
    };
  }, [text, stack]);

  const rtl = RIGHT_TO_LEFT.has(script);
  const textSize = size === 'sm' ? 'text-lg sm:text-xl' : 'text-2xl leading-relaxed sm:text-4xl sm:leading-relaxed';

  return (
    <div className="w-full">
      <p
        ref={nodeRef}
        dir={rtl ? 'rtl' : 'ltr'}
        lang={script}
        style={{ fontFamily: stack }}
        className={`select-none break-words text-midnight-900 ${textSize} ${rtl ? 'text-right' : ''}`}
      >
        {text}
      </p>
      {tofu ? (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Your device has no font for this writing system, so the sentence above is showing as empty boxes. The round still
            works, but you are guessing blind. Installing a Noto font for this script fixes it.
          </span>
        </p>
      ) : null}
    </div>
  );
}
