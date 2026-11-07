'use client';

/**
 * BehaviourStep - "How does {name} act around strangers?" The tap picks a
 * temperament; the screen shows, at once, the line it puts on the flyer
 * ("If you see Max: don't chase..."), and the owner can write their own.
 */

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { TEMPERAMENT_OPTIONS, approachLine, speciesKey } from '@/app/lib/caseDetails';
import OptionCardGrid from '../OptionCardGrid';
import OnTheFlyer from '../OnTheFlyer';
import { WIZARD_THEMES } from '../wizardTheme';

export default function BehaviourStep({ variant = 'lost', species, name, value = {}, onChange }) {
  const theme = WIZARD_THEMES[variant];
  const [editing, setEditing] = useState(Boolean(value.approachNote));
  const options = TEMPERAMENT_OPTIONS[speciesKey(species)];
  const line = approachLine(value, { name, species });

  return (
    <div className="space-y-6">
      <OptionCardGrid
        variant={variant}
        options={options}
        value={value.temperament || null}
        onSelect={(temperament) => onChange({ temperament })}
        columns={2}
      />

      {value.temperament && (
        <OnTheFlyer label={`On the flyer: if you see ${name}`}>
          {editing ? (
            <div className="mt-2">
              <textarea
                value={value.approachNote || ''}
                onChange={(e) => onChange({ approachNote: e.target.value })}
                rows={3}
                maxLength={160}
                placeholder={line}
                className={`w-full rounded-xl border-2 border-midnight-100 bg-white px-3.5 py-3 text-[16px] leading-relaxed outline-none ${theme.focusRing}`}
                autoFocus
              />
              <div className="mt-1.5 flex items-center justify-between text-xs text-midnight-500">
                <span>{(value.approachNote || '').length} of 160</span>
                <button
                  type="button"
                  className="font-semibold text-midnight-700 underline underline-offset-2"
                  onClick={() => {
                    onChange({ approachNote: '' });
                    setEditing(false);
                  }}
                >
                  Use the suggested line
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-1 text-[15px] font-bold leading-snug text-midnight-900">{line}</p>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border-2 border-midnight-200 bg-white px-3 text-sm font-semibold text-midnight-700 hover:border-midnight-400"
              >
                <Pencil size={14} />
                Change the wording
              </button>
            </>
          )}
        </OnTheFlyer>
      )}
    </div>
  );
}
