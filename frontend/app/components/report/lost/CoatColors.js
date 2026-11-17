'use client';

/**
 * CoatColors - the coat colours as swatches to tap (app/lib/coatColors.js).
 *
 * One answer (`multi` off): the lost report's "main color" screen, where the
 * tap is the answer and moves on (onPick), with "Another color" for a word
 * the palette does not have. Several (`multi`): the other colours, asked
 * after posting, with "No other colors" standing alone.
 */

import { useState } from 'react';
import { Check } from 'lucide-react';
import { COAT_COLORS } from '@/app/lib/coatColors';

const NONE = 'NONE';

function Swatch({ hex, border }) {
  return (
    <span
      aria-hidden="true"
      className={`h-7 w-7 shrink-0 rounded-full ${border ? 'ring-1 ring-midnight-300' : ''}`}
      style={{ backgroundColor: hex }}
    />
  );
}

export default function CoatColors({ value, onPick, multi = false, exclude = '', otherLabel = 'Another color' }) {
  const list = multi ? (Array.isArray(value) ? value : []) : [];
  const custom = !multi && value && !COAT_COLORS.some((c) => c.name === value) ? value : '';
  const [typing, setTyping] = useState(Boolean(custom));
  const [text, setText] = useState(custom);
  const on = (name) => (multi ? list.includes(name) : value === name);
  const colors = COAT_COLORS.filter((c) => c.name.toLowerCase() !== String(exclude || '').toLowerCase());

  const tap = (name) => {
    if (!multi) {
      onPick(name);
      return;
    }
    if (list.includes(name)) onPick(list.filter((x) => x !== name));
    else if (name === NONE) onPick([NONE]);
    else onPick([...list.filter((x) => x !== NONE), name]);
  };

  const cell = (selected) =>
    `flex min-h-[52px] items-center gap-2.5 rounded-xl border-2 px-3 text-left text-[16px] font-semibold transition-all active:scale-[0.985] ${
      selected ? 'border-midnight-900 bg-midnight-50 text-midnight-900' : 'border-midnight-100 bg-white text-midnight-800 hover:border-midnight-300'
    }`;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role={multi ? 'group' : 'radiogroup'} aria-label={multi ? 'Other colors' : 'Main color'}>
        {colors.map((c) => (
          <button key={c.name} type="button" aria-pressed={on(c.name)} onClick={() => tap(c.name)} className={cell(on(c.name))}>
            <Swatch hex={c.hex} border={c.border} />
            <span className="min-w-0 flex-1">{c.name}</span>
            {on(c.name) && <Check size={16} strokeWidth={3} className="shrink-0" aria-hidden="true" />}
          </button>
        ))}
        {multi ? (
          <button type="button" aria-pressed={on(NONE)} onClick={() => tap(NONE)} className={`${cell(on(NONE))} col-span-2 sm:col-span-1`}>
            <span className="min-w-0 flex-1">No other colors</span>
            {on(NONE) && <Check size={16} strokeWidth={3} className="shrink-0" aria-hidden="true" />}
          </button>
        ) : (
          <button type="button" aria-pressed={Boolean(custom)} onClick={() => setTyping(true)} className={`${cell(Boolean(custom))} border-dashed`}>
            <span className="min-w-0 flex-1">{custom || otherLabel}</span>
          </button>
        )}
      </div>
      {!multi && typing && (
        <form
          method="post"
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) onPick(text.trim().slice(0, 40));
          }}
        >
          <label htmlFor="coat-color-other" className="sr-only">
            The color, in your words
          </label>
          <input
            id="coat-color-other"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={40}
            placeholder="Brindle, tabby, merle"
            enterKeyHint="done"
            autoFocus
            className="min-w-0 flex-1 rounded-2xl border-2 border-midnight-100 bg-white px-4 py-3 text-[16px] outline-none focus:border-flash-400 focus:ring-2 focus:ring-flash-100"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="min-h-[52px] shrink-0 rounded-2xl bg-midnight-900 px-5 text-[16px] font-bold text-white disabled:bg-midnight-100 disabled:text-midnight-400"
          >
            Use it
          </button>
        </form>
      )}
    </div>
  );
}
