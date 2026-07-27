'use client';

/**
 * TagDetailsStep - the optional "anything from a collar or tag?" screen on
 * the found flow. Name-if-visible, breed, size, distinguishing details, and
 * microchip number (if a vet/shelter already scanned).
 */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import BreedSelector from '../../BreedSelector';
import { GENERIC_SIZE_OPTIONS, WIZARD_THEMES } from '../wizardTheme';

export default function TagDetailsStep({
  variant = 'found',
  species,
  value, // { petName, breed, size, marks, microchipId }
  onChange,
}) {
  const theme = WIZARD_THEMES[variant];
  const [showBreed, setShowBreed] = useState(Boolean(value.breed));
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-7">
      <div>
        <label htmlFor="tag-name" className="block text-sm font-semibold text-midnight-700 mb-1.5">
          Name on the tag (if any)
        </label>
        <input
          id="tag-name"
          type="text"
          value={value.petName || ''}
          onChange={(e) => set({ petName: e.target.value })}
          placeholder="e.g. Max"
          className={`w-full px-4 py-3.5 bg-white border-2 border-midnight-100 rounded-2xl outline-none transition-colors ${theme.focusRing}`}
          autoFocus
        />
      </div>

      <div>
        <p className="text-sm font-semibold text-midnight-700 mb-2.5">Roughly how big?</p>
        <div className="flex flex-wrap gap-2">
          {GENERIC_SIZE_OPTIONS.map((opt) => {
            const selected = value.size === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => set({ size: selected ? '' : opt.value })}
                aria-pressed={selected}
                className={`px-3.5 py-2 rounded-full border-2 text-sm font-semibold transition-all ${
                  selected
                    ? theme.selectedCard
                    : 'border-midnight-100 bg-white text-midnight-600 hover:border-midnight-300'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {showBreed ? (
          <div>
            <label className="block text-sm font-semibold text-midnight-700 mb-1.5">Breed (best guess)</label>
            <BreedSelector
              species={(species || '').toUpperCase()}
              value={value.breed}
              onChange={(breed) => set({ breed })}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowBreed(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-midnight-200 text-sm font-semibold text-midnight-500 hover:border-midnight-400 hover:text-midnight-700 transition-all"
          >
            <Plus size={15} />
            Add breed
          </button>
        )}
      </div>

      <div>
        <label htmlFor="tag-marks" className="block text-sm font-semibold text-midnight-700 mb-1.5">
          Anything distinctive?
        </label>
        <textarea
          id="tag-marks"
          value={value.marks || ''}
          onChange={(e) => set({ marks: e.target.value })}
          rows={3}
          placeholder="Red collar, white paws, very friendly, favors one leg…"
          className={`w-full px-4 py-3.5 bg-white border-2 border-midnight-100 rounded-2xl outline-none transition-colors resize-none leading-relaxed ${theme.focusRing}`}
        />
      </div>

      <div>
        <label htmlFor="tag-chip" className="block text-sm font-semibold text-midnight-700 mb-1.5">
          Microchip number (if scanned)
        </label>
        <input
          id="tag-chip"
          type="text"
          inputMode="numeric"
          value={value.microchipId || ''}
          onChange={(e) => set({ microchipId: e.target.value })}
          placeholder="15-digit number from a vet or shelter scan"
          className={`w-full px-4 py-3.5 bg-white border-2 border-midnight-100 rounded-2xl outline-none transition-colors ${theme.focusRing}`}
        />
        <p className="text-xs text-midnight-400 mt-1.5">
          Any vet or shelter can scan for free - a chip match reunites instantly.
        </p>
      </div>
    </div>
  );
}
