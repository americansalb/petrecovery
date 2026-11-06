'use client';

/**
 * HealthStep - "Does {name} take medication or have a health condition?"
 * Chips, more than one allowed; "No, healthy" clears the rest. Medication
 * asks what and how often, and the screen shows the line the flyer gets.
 */

import { HEALTH_OPTIONS, healthLine, needsMedication } from '@/app/lib/caseDetails';
import Chips from '../Chips';
import { WIZARD_THEMES } from '../wizardTheme';

export default function HealthStep({ variant = 'lost', name, value = {}, onChange }) {
  const theme = WIZARD_THEMES[variant];
  const health = Array.isArray(value.health) ? value.health : [];
  const meds = needsMedication(value);
  const other = health.includes('OTHER');
  const line = healthLine(value, { name });

  return (
    <div className="space-y-6">
      <Chips
        variant={variant}
        multi
        exclusive={['NONE']}
        options={HEALTH_OPTIONS}
        value={health}
        onChange={(next) => onChange({ health: next })}
        ariaLabel="Medication and health conditions"
      />

      {(meds || other) && (
        <div>
          <label htmlFor="health-note" className="mb-1.5 block text-sm font-semibold text-midnight-700">
            {meds ? 'What, and how often?' : 'What is it?'}
          </label>
          <input
            id="health-note"
            type="text"
            value={value.healthNote || ''}
            onChange={(e) => onChange({ healthNote: e.target.value })}
            maxLength={120}
            placeholder={meds ? 'Insulin twice a day' : 'Three legs, moves slowly'}
            className={`w-full rounded-2xl border-2 border-midnight-100 bg-white px-4 py-3.5 text-[16px] outline-none ${theme.focusRing}`}
            autoFocus
          />
        </div>
      )}

      {line && (
        <div className={`rounded-2xl border ${theme.softBorder} ${theme.softBg} p-4`}>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-midnight-600">On the flyer</p>
          <p className="mt-1.5 text-[15px] font-semibold leading-snug text-midnight-900">{line}</p>
          {meds && <p className="mt-1.5 text-sm text-midnight-600">The report is marked urgent, and the Rescue Forces see why.</p>}
        </div>
      )}
    </div>
  );
}
