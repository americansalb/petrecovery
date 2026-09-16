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
 * mode exists to represent (docs/PROBABLY_EARTH_STRATEGY.md, bet 5a).
 * Telling the player "your device has no font for this alphabet" costs
 * one line and turns a broken round into an explained one.
 *
 * How the check works. U+FFFF is a permanent non-character, so no font
 * is allowed a glyph for it: whatever the browser draws for it IS this
 * font's .notdef box. Draw that once, then draw each character of the
 * sentence and compare the actual pixels. Characters that come out
 * pixel for pixel identical to the box are boxes.
 *
 * It used to compare widths instead, and that was wrong in a way that
 * accused working devices. A .notdef box is usually one em wide, and so
 * is every glyph in Chinese, Japanese and Korean, so a perfectly
 * rendered CJK sentence measured as 100% boxes and got the warning.
 * Width is kept only as a cheap gate: a glyph of a different width
 * cannot be the box, so there is no need to rasterise it.
 *
 * It runs after document.fonts.ready, so a face still downloading is
 * not mistaken for a missing one, and it needs a clear majority rather
 * than half, because half a sentence in boxes is not a thing that
 * happens when a font is simply absent.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { fontStackFor } from '@/app/geo/script/fonts';

const RIGHT_TO_LEFT = new Set(['arab', 'hebr']);

/** The permanent non-character every font must draw as .notdef. */
const NOT_A_CHARACTER = '\uFFFF';
const CELL = 48;
/** Nearly all of them, because a missing font misses everything. */
const ENOUGH = 0.85;

/** Draw one character and return its pixels, or null. */
function raster(ctx, ch) {
  try {
    ctx.clearRect(0, 0, CELL, CELL);
    ctx.fillText(ch, 4, CELL - 10);
    return ctx.getImageData(0, 0, CELL, CELL).data;
  } catch {
    // No getImageData here: a tainted or unimplemented canvas. The
    // caller treats that as "cannot tell", which means no warning.
    return null;
  }
}

function samePixels(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** True if the device is drawing .notdef boxes instead of the script. */
export function measureTofu(text, fontStack, makeCanvas) {
  const canvas = makeCanvas();
  if (!canvas) return false;
  canvas.width = CELL;
  canvas.height = CELL;
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return false;
  ctx.font = `32px ${fontStack}`;
  ctx.textBaseline = 'alphabetic';

  const boxWidth = ctx.measureText(NOT_A_CHARACTER).width;
  if (!boxWidth) return false;
  const boxPixels = raster(ctx, NOT_A_CHARACTER);
  // A canvas that will not give up its pixels cannot answer this, and
  // guessing from widths is what caused the false alarm.
  if (!boxPixels) return false;

  let boxes = 0;
  let total = 0;
  for (const ch of text) {
    // Spaces have no glyph, and a combining mark measures zero whether
    // it rendered or not; neither says anything about coverage.
    const width = ctx.measureText(ch).width;
    if (/\s/.test(ch) || width === 0) continue;
    total += 1;
    // A glyph of a different width is not this box, and does not need
    // drawing to prove it.
    if (Math.abs(width - boxWidth) > 0.01) continue;
    if (samePixels(raster(ctx, ch), boxPixels)) boxes += 1;
  }
  return total >= 4 && boxes / total >= ENOUGH;
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
