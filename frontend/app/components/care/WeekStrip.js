'use client';

/**
 * Seven days of adherence as a row of little journal squares. Complete
 * days get the marker-yellow highlight wash a diarist would swipe over
 * a good day; today wears the marker outline. Interactive on Today
 * (tap a day to review/backfill it); the public care view renders it
 * without the tap affordance by omitting onSelectDay.
 */

import { useMemo } from 'react';
import { cn } from '@/components/ui';
import { adherenceForDay, startOfDay, sameDay } from '@/lib/medications';
import { Sheet, SectionInk, StampText } from '@/app/components/care/paper/Paper';

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

  // Consecutive fully-given days ending today (in-progress today doesn't break it).
  const streak = useMemo(() => {
    let count = 0;
    for (let i = 0; i < 35; i++) {
      const day = startOfDay(new Date(Date.now() - i * 86400000));
      let due = 0; let given = 0;
      for (const med of scheduled) {
        const a = adherenceForDay(med, med.doses, day);
        due += a.due; given += a.given;
      }
      if (due === 0) continue;
      if (given >= due) count++;
      else if (i === 0) continue;
      else break;
    }
    return count;
  }, [meds]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!days.some((d) => d.due > 0)) return null;

  const interactive = Boolean(onSelectDay);

  return (
    <Sheet className="mb-5">
      <SectionInk
        action={streak > 1 && <StampText tone="green" rotate={-4}>{streak}-day streak</StampText>}
      >
        this week
      </SectionInk>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map(({ day, due, given }, i) => {
          const isToday = i === 6;
          const isSelected = selectedDay && sameDay(day, selectedDay);
          const complete = due > 0 && given >= due;
          const partial = given > 0 && !complete;
          const Cell = interactive ? 'button' : 'div';
          return (
            <Cell
              key={day.getTime()}
              {...(interactive ? { type: 'button', onClick: () => onSelectDay(day), 'aria-pressed': isSelected } : {})}
              className={cn(
                'flex flex-col items-center gap-1 rounded-[4px] border py-2 px-1 transition-colors',
                isSelected
                  ? 'border-marker bg-marker-wash'
                  : complete
                    ? 'border-paper-400 bg-marker-wash/70'
                    : 'border-paper-300 bg-transparent',
                interactive && !isSelected && 'hover:border-pen-300'
              )}
              aria-label={`${day.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}: ${due ? `${given} of ${due} given` : 'nothing due'}${interactive ? '. Tap to review or log.' : ''}`}
            >
              <span className={cn(
                'font-stamp text-[9px] uppercase tracking-[0.1em]',
                isToday || isSelected ? 'text-pen-900' : 'text-pen-400'
              )}>
                {isToday ? 'Today' : day.toLocaleDateString([], { weekday: 'short' }).slice(0, 2)}
              </span>
              <span className={cn(
                'font-diary italic text-[15px] leading-none tabular-nums',
                complete ? 'text-stampgreen' : partial ? 'text-pen-900' : due ? 'text-pen-300' : 'text-pen-300/50'
              )}>
                {complete ? '✓' : due ? `${given}/${due}` : '·'}
              </span>
            </Cell>
          );
        })}
      </div>
      <p className="font-diary italic text-[11.5px] text-pen-400 mt-2.5">
        {days.slice(0, 6).every((d) => d.due === 0)
          ? 'history starts today; it fills in as doses are written in.'
          : interactive
            ? 'tap a day to review it, or to write in doses you gave but never recorded.'
            : 'how the last seven days went.'}
      </p>
    </Sheet>
  );
}
