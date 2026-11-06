'use client';

/**
 * Chips - tap-to-answer pills for the report's questions. One answer
 * (`multi` off) or several; a value in `exclusive` (such as "NONE") clears
 * the others when tapped, and is cleared when anything else is.
 */

import { WIZARD_THEMES } from './wizardTheme';

export default function Chips({
  options, // [{ value, label, sublabel }]
  value, // string | null, or string[] when multi
  onChange,
  multi = false,
  exclusive = [], // values that stand alone
  variant = 'lost',
  size = 'md', // 'md' | 'sm'
  ariaLabel,
}) {
  const theme = WIZARD_THEMES[variant];
  const selected = (v) => (multi ? Array.isArray(value) && value.includes(v) : value === v);

  const pick = (v) => {
    if (!multi) {
      onChange(value === v ? null : v);
      return;
    }
    const current = Array.isArray(value) ? value : [];
    if (current.includes(v)) {
      onChange(current.filter((x) => x !== v));
      return;
    }
    if (exclusive.includes(v)) {
      onChange([v]);
      return;
    }
    onChange([...current.filter((x) => !exclusive.includes(x)), v]);
  };

  const pad = size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-3.5 py-2.5 text-sm';

  return (
    <div role={multi ? 'group' : 'radiogroup'} aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const on = selected(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => pick(opt.value)}
            aria-pressed={on}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border-2 font-semibold transition-all active:scale-[0.98] ${pad} ${
              on ? theme.selectedCard : 'border-midnight-100 bg-white text-midnight-700 hover:border-midnight-300'
            }`}
          >
            <span>{opt.label}</span>
            {opt.sublabel && <span className="text-xs font-medium text-midnight-400">{opt.sublabel}</span>}
          </button>
        );
      })}
    </div>
  );
}
