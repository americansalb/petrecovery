'use client';

/**
 * OptionCardGrid — big-tap-target choice cards where the tap IS the decision.
 *
 * onSelect fires synchronously; the parent advances the wizard in the same
 * tick. Never wrap selection in a timer.
 */

import { Check } from 'lucide-react';
import { WIZARD_THEMES } from './wizardTheme';

const COLUMN_CLASSES = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
};

export default function OptionCardGrid({
  options, // [{ value, label, sublabel, icon, urgent }]
  value,
  onSelect,
  columns = 2,
  variant = 'lost',
  centered = false, // icon + label centered (species grids)
}) {
  const theme = WIZARD_THEMES[variant];

  return (
    <div className={`grid gap-3 ${COLUMN_CLASSES[columns] || COLUMN_CLASSES[2]}`}>
      {options.map((opt) => {
        const selected = value === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            aria-pressed={selected}
            className={`group relative rounded-2xl border-2 p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-card-hover active:translate-y-0 active:scale-[0.985] ${
              centered ? 'text-center' : 'text-left'
            } ${selected ? theme.selectedCard : 'border-midnight-100 bg-white hover:border-midnight-300'}`}
          >
            {Icon && (
              <Icon
                size={26}
                className={`mb-2 transition-transform duration-150 group-hover:scale-110 ${
                  centered ? 'mx-auto' : ''
                } ${selected ? theme.accentText : 'text-midnight-400'}`}
              />
            )}
            <span className="block font-bold text-midnight-900 leading-snug">{opt.label}</span>
            {opt.sublabel && (
              <span className="block text-xs text-midnight-400 mt-1 leading-snug">{opt.sublabel}</span>
            )}
            {opt.urgent && (
              <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[0.65rem] font-bold uppercase tracking-wide">
                Urgent
              </span>
            )}
            {selected && (
              <span
                className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center ${theme.accentBg}`}
              >
                <Check size={12} className="text-white" strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
