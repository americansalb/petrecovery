'use client';

/**
 * A compact picker for the last seven days, revealed under "Past days"
 * on Today so a missed dose can be recorded after the fact. Each button
 * shows the weekday and that day's given/due count; the selected day
 * drives the checklist above.
 */

import { useMemo } from 'react';
import { cn } from '@/components/ui';
import { adherenceForDay, startOfDay, sameDay } from '@/lib/medications';

export default function WeekStrip({ meds, selectedDay, onSelectDay }) {
  const scheduled = meds.filter((m) => m.scheduleType !== 'AS_NEEDED');

  const days = useMemo(() => {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const day = startOfDay(new Date(Date.now() - i * 86400000));
      let due = 0; let given = 0;
      for (const med of scheduled) {
        const a = adherenceForDay(med, med.doses, day);
        due += a.due; given += a.given;
      }
      out.push({ day, due, given });
    }
    return out;
  }, [meds]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!onSelectDay) return null;

  return (
    <div>
      <p className="text-[13px] font-medium text-neutral-500 mb-2">Past days</p>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map(({ day, due, given }, i) => {
          const isToday = i === 6;
          const isSelected = selectedDay && sameDay(day, selectedDay);
          const complete = due > 0 && given >= due;
          return (
            <button
              key={day.getTime()}
              type="button"
              onClick={() => onSelectDay(day)}
              aria-pressed={isSelected}
              aria-label={`${day.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}: ${due ? `${given} of ${due} given` : 'nothing due'}. Tap to review or log.`}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border py-2 px-1 transition-colors',
                isSelected ? 'border-care-teal bg-neutral-50' : 'border-neutral-200 hover:border-neutral-400'
              )}
            >
              <span className="text-[12px] font-medium text-neutral-500">
                {isToday ? 'Today' : day.toLocaleDateString([], { weekday: 'short' }).slice(0, 2)}
              </span>
              <span className={cn(
                'text-[13px] tabular-nums',
                complete ? 'text-emerald-600' : due ? 'text-neutral-900' : 'text-neutral-300'
              )}>
                {due ? `${given}/${due}` : '.'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
