'use client';

/**
 * Seven days of adherence at a glance, with the streak. Interactive on
 * Today (tap a day to review/backfill it); the public care view renders
 * it without the tap affordance by omitting onSelectDay.
 */

import { useMemo } from 'react';
import { CalendarDays, Sparkles } from 'lucide-react';
import { Card, Badge, cn } from '@/components/ui';
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
    <Card padding="lg" className="mb-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="flex items-center gap-2 font-bold text-midnight-900"><CalendarDays size={18} className="text-midnight-400" /> This week</h3>
        {streak > 1 && (
          <Badge variant="primary" icon={Sparkles}>{streak}-day streak</Badge>
        )}
      </div>
      <p className="text-xs text-midnight-400 mb-4">
        {days.slice(0, 6).every((d) => d.due === 0)
          ? 'History starts today. It fills in as doses are checked off.'
          : interactive
            ? 'Tap a day to review it or log doses you gave but did not record.'
            : 'How the last seven days went.'}
      </p>
      <div className="grid grid-cols-7 gap-2">
        {days.map(({ day, due, given }, i) => {
          const isToday = i === 6;
          const isSelected = selectedDay && sameDay(day, selectedDay);
          const pct = due > 0 ? given / due : null;
          const Cell = interactive ? 'button' : 'div';
          return (
            <Cell
              key={day.getTime()}
              {...(interactive ? { type: 'button', onClick: () => onSelectDay(day), 'aria-pressed': isSelected } : {})}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl p-1 -m-1 transition-all',
                isSelected ? 'ring-2 ring-flash-400 bg-flash-50' : interactive ? 'hover:bg-midnight-50' : ''
              )}
              aria-label={`${day.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}: ${due ? `${given} of ${due} given` : 'nothing due'}${interactive ? '. Tap to review or log.' : ''}`}
            >
              <span className="flex flex-col items-center leading-tight">
                <span className={cn('text-[11px] font-semibold', isToday || isSelected ? 'text-midnight-900' : 'text-midnight-400')}>
                  {isToday ? 'Today' : day.toLocaleDateString([], { weekday: 'short' }).slice(0, 2)}
                </span>
                <span className={cn('text-[10px] tabular-nums', isToday || isSelected ? 'text-midnight-500' : 'text-midnight-400')}>
                  {day.getDate()}
                </span>
              </span>
              <div
                className={cn('w-full h-12 rounded-lg relative overflow-hidden', due ? 'bg-midnight-100' : 'bg-transparent')}
                title={due ? `${given}/${due} given` : 'Nothing scheduled'}
              >
                {pct != null ? (
                  <div
                    className={cn('absolute bottom-0 left-0 right-0 rounded-lg transition-all',
                      pct >= 1 ? 'bg-emerald-400' : pct > 0 ? 'bg-flash-400' : 'bg-midnight-200')}
                    style={{ height: `${Math.max(pct * 100, pct > 0 ? 18 : 8)}%` }}
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-midnight-200 text-lg leading-none">·</span>
                )}
              </div>
              <span className={cn('text-[10px] tabular-nums', due ? 'text-midnight-500' : 'text-transparent')}>{due ? `${given}/${due}` : '·'}</span>
            </Cell>
          );
        })}
      </div>
    </Card>
  );
}
