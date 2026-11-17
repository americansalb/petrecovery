'use client';

/**
 * PetStep - the lost report's second screen: what kind of pet, and the name
 * it answers to, on one screen. The kinds are one row of tiles (dog and cat
 * first); the name is typed under them, and the footer's Continue goes on
 * once both are there. A kind read from the photo arrives already picked.
 */

import { useRef } from 'react';
import { Check } from 'lucide-react';
import { SPECIES_OPTIONS, WIZARD_THEMES } from '../wizardTheme';

export default function PetStep({ variant = 'lost', species, onSpecies, name, onName, onSubmit }) {
  const theme = WIZARD_THEMES[variant];
  const nameRef = useRef(null);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Kind of pet">
        {SPECIES_OPTIONS.map((opt) => {
          const on = species === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                onSpecies(opt.value);
                // The name is next: the keyboard comes up after the tap, not over the tiles.
                if (!name?.trim()) nameRef.current?.focus();
              }}
              className={`relative flex min-h-[80px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-1 transition-all active:scale-[0.97] ${
                on ? theme.selectedCard : 'border-midnight-100 bg-white hover:border-midnight-300'
              }`}
            >
              <Icon size={26} className={on ? 'text-midnight-900' : 'text-midnight-400'} aria-hidden="true" />
              <span className="text-[15px] font-bold text-midnight-900">{opt.label}</span>
              {on && (
                <span className={`absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full ${theme.selectedMark}`}>
                  <Check size={10} strokeWidth={3} className="text-white" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div>
        <label htmlFor="pet-name" className="mb-1.5 block text-[16px] font-bold text-midnight-900">
          Name
        </label>
        <input
          ref={nameRef}
          id="pet-name"
          type="text"
          value={name}
          onChange={(e) => onName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && species && name.trim()) onSubmit?.();
          }}
          enterKeyHint="next"
          autoComplete="off"
          placeholder="Max, Bella, Charlie…"
          aria-label="Your pet's name"
          className={`w-full rounded-2xl border-2 border-midnight-100 bg-white px-5 py-4 text-xl font-semibold outline-none transition-colors placeholder:font-normal placeholder:text-midnight-300 ${theme.focusRing}`}
        />
        <p className="mt-1.5 text-[15px] text-midnight-600">The name they answer to. It goes on the flyer.</p>
      </div>
    </div>
  );
}
