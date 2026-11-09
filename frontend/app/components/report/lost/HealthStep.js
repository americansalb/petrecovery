'use client';

/**
 * HealthStep - "Does {name} take medication or have a health condition?"
 * Chips, more than one allowed; "No, healthy" clears the rest. Medication
 * asks what and how often, and the screen shows the line the flyer gets.
 */

import { HEALTH_OPTIONS, healthLine, needsMedication } from '@/app/lib/caseDetails';
import Chips from '../Chips';
import OnTheFlyer from '../OnTheFlyer';
import { WIZARD_THEMES } from '../wizardTheme';

export default function HealthStep({ variant = 'lost', name, value = {}, onChange, onNone }) {
  const theme = WIZARD_THEMES[variant];
  const health = Array.isArray(value.health) ? value.health : [];
  const meds = needsMedication(value);
  const other = health.includes('OTHER');
  const none = health.includes('NONE');
  const line = healthLine(value, { name });

  return (
    <div className="space-y-5">
      {/* Most pets are healthy, so "No" is the one big answer and moves on by
          itself; the conditions are the exception and stay as chips. */}
      <button
        type="button"
        onClick={() => {
          onChange({ health: ['NONE'], healthNote: '' });
          onNone?.();
        }}
        aria-pressed={none}
        className={`w-full rounded-2xl border-2 px-5 py-4 text-left text-lg font-bold transition-colors ${
          none ? theme.selectedCard : 'border-midnight-200 bg-white text-midnight-900 hover:border-midnight-400'
        }`}
      >
        No, {name} is healthy
      </button>
      <p className="text-sm font-semibold text-midnight-500">Or tap what applies:</p>
      <Chips
        variant={variant}
        multi
        exclusive={['NONE']}
        options={HEALTH_OPTIONS.filter((o) => o.value !== 'NONE')}
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
        <OnTheFlyer line={line}>
          {meds && <p className="mt-1.5 text-sm text-midnight-600">The report is marked urgent, and the Rescue Forces see why.</p>}
        </OnTheFlyer>
      )}
    </div>
  );
}
