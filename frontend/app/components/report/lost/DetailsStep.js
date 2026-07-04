'use client';

/**
 * DetailsStep — the optional "anything that helps searchers?" screen on the
 * lost flow. Everything here is skippable: distinctive marks, breed, and how
 * the pet got out (escapeScenario).
 */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import BreedSelector from '../../BreedSelector';
import { ESCAPE_OPTIONS, WIZARD_THEMES } from '../wizardTheme';

export default function DetailsStep({
  variant = 'lost',
  species,
  marks,
  onMarksChange,
  breed,
  onBreedChange,
  escapeScenario,
  onEscapeChange,
}) {
  const theme = WIZARD_THEMES[variant];
  const [showBreed, setShowBreed] = useState(Boolean(breed));

  return (
    <div className="space-y-7">
      <div>
        <label htmlFor="details-marks" className="block text-sm font-semibold text-midnight-700 mb-1.5">
          What should someone look for?
        </label>
        <textarea
          id="details-marks"
          value={marks}
          onChange={(e) => onMarksChange(e.target.value)}
          rows={3}
          placeholder="White chest patch, blue collar with a bell, limps a little, very shy — don't chase…"
          className={`w-full px-4 py-3.5 bg-white border-2 border-midnight-100 rounded-2xl outline-none transition-colors resize-none leading-relaxed ${theme.focusRing}`}
          autoFocus
        />
        <p className="text-xs text-midnight-400 mt-1.5">
          Collars, markings, temperament — this goes on the poster.
        </p>
      </div>

      <div>
        {showBreed ? (
          <div>
            <label className="block text-sm font-semibold text-midnight-700 mb-1.5">Breed</label>
            <BreedSelector species={(species || '').toUpperCase()} value={breed} onChange={onBreedChange} />
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
        <p className="text-sm font-semibold text-midnight-700 mb-2.5">How did they get out?</p>
        <div className="flex flex-wrap gap-2">
          {ESCAPE_OPTIONS.map((opt) => {
            const selected = escapeScenario === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onEscapeChange(selected ? '' : opt.value)}
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
    </div>
  );
}
