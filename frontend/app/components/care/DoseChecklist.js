'use client';

/**
 * The dose checklist — Today's heart, shared with the public care view.
 *
 * DayChecklist renders one day of scheduled doses (bucketed Morning /
 * Afternoon / Evening around a progress ring) plus the as-needed
 * section. Today is the ONLY surface where doses are logged — scheduled
 * check-offs, as-needed "log now", and past-day catch-up all live here;
 * the Health Book manages the medication list, never the taps.
 *
 * `readOnly` renders the same layout with statuses instead of buttons
 * (the vet/sitter view link uses this — one component, two audiences).
 */

import { useMemo } from 'react';
import { Check, X, Undo2, PartyPopper, Sun, Sunset, Moon, Loader2 } from 'lucide-react';
import { Card, cn } from '@/components/ui';
import { MedIconChip } from '@/app/components/medications/MedIcon';
import {
  medColor, formatTime, timeOfDayBucket, slotsWithStatus, sameDay,
} from '@/lib/medications';

const BUCKET_ICONS = { Morning: Sun, Afternoon: Sunset, Evening: Moon };

export function ProgressRing({ given, due }) {
  const pct = due > 0 ? given / due : 0;
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-20 h-20 flex-shrink-0" role="img" aria-label={`${given} of ${due} doses given today`}>
      <svg viewBox="0 0 72 72" className="w-20 h-20 -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" className="stroke-midnight-100" />
        <circle
          cx="36" cy="36" r={r} fill="none" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          className={cn('transition-all duration-500', pct >= 1 ? 'stroke-emerald-500' : 'stroke-flash-400')}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-midnight-900 leading-none">{given}<span className="text-midnight-400 text-sm">/{due}</span></span>
        <span className="text-[10px] text-midnight-500 mt-0.5">doses</span>
      </div>
    </div>
  );
}

export function DoseRow({ med, slot, busy, readOnly, onMark, onUndo }) {
  const given = slot.status === 'GIVEN';
  const skipped = slot.status === 'SKIPPED';

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors',
      given ? 'bg-emerald-50/70 border-emerald-200' : skipped ? 'bg-midnight-50 border-midnight-200' : 'bg-white border-midnight-200'
    )}>
      <MedIconChip med={med} size="sm" />
      <div className="flex-1 min-w-0">
        <p className={cn('font-semibold text-sm text-midnight-900 truncate', skipped && 'line-through text-midnight-400')}>
          {med.name}
          {med.strength && <span className="font-normal text-midnight-500"> · {med.strength}</span>}
        </p>
        <p className="text-xs text-midnight-500">
          {given && slot.dose?.givenAt
            ? `Given at ${new Date(slot.dose.givenAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
            : skipped ? 'Skipped' : `Due ${formatTime(slot.time)}`}
        </p>
      </div>

      {busy ? (
        <Loader2 className="w-5 h-5 animate-spin text-midnight-400 mr-1" />
      ) : readOnly ? (
        (given || skipped) && (
          <span className={cn('text-xs font-bold px-2 py-1 rounded-full', given ? 'bg-emerald-100 text-emerald-700' : 'bg-midnight-100 text-midnight-500')}>
            {given ? 'Given' : 'Skipped'}
          </span>
        )
      ) : given || skipped ? (
        <button
          onClick={() => onUndo(med, slot)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-midnight-500 hover:text-midnight-800 px-2 py-1.5 rounded-lg hover:bg-midnight-100 transition-colors"
          title="Undo"
        >
          <Undo2 size={14} /> Undo
        </button>
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onMark(med, slot, 'SKIPPED')}
            className="p-2 rounded-full text-midnight-400 hover:text-midnight-700 hover:bg-midnight-100 transition-colors"
            title={`Skip ${med.name}`}
            aria-label={`Skip ${med.name} ${formatTime(slot.time)}`}
          >
            <X size={16} />
          </button>
          <button
            onClick={() => onMark(med, slot, 'GIVEN')}
            className={cn(
              'w-9 h-9 rounded-full border-2 border-midnight-300 text-transparent',
              'hover:border-emerald-500 hover:bg-emerald-500 hover:text-white',
              'flex items-center justify-center transition-all duration-150 active:scale-90'
            )}
            title={`Mark ${med.name} given`}
            aria-label={`Mark ${med.name} ${formatTime(slot.time)} as given`}
          >
            <Check size={18} strokeWidth={3} />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * As-needed medications. On today: log-now / log-another, the day's
 * count, and undo — the whole PRN story in the same room as every other
 * tap. On a past day: catch-up logging so the record can be documented
 * after the fact.
 */
export function PrnSection({ meds, day, busyKeys, readOnly, onLogPrnNow, onUndoPrnLast, onLogPrnFor }) {
  const isToday = sameDay(day, new Date());
  if (!meds.length) return null;

  return (
    <div className="mt-5 pt-4 border-t border-midnight-100">
      <p className="text-xs font-bold uppercase tracking-wide text-midnight-400 mb-2">As needed</p>
      <div className="space-y-2">
        {meds.map((med) => {
          const dayDoses = (med.doses || []).filter(
            (d) => !d.deletedAt && d.status === 'GIVEN' && sameDay(new Date(d.scheduledFor), day)
          );
          const count = dayDoses.length;
          const busy = busyKeys?.has(`prn-${med.id}`);
          return (
            <div key={med.id} className="flex items-center gap-3 rounded-xl border border-midnight-200 bg-white px-3 py-2.5 flex-wrap">
              <MedIconChip med={med} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-midnight-900 truncate">
                  {med.name}
                  {med.strength && <span className="font-normal text-midnight-500"> · {med.strength}</span>}
                </p>
                <p className="text-xs text-midnight-500">
                  {count > 0
                    ? `${count} dose${count !== 1 ? 's' : ''} ${isToday ? 'today' : 'this day'}`
                    : isToday ? 'When they need it, log it here' : 'Not logged this day'}
                </p>
              </div>

              {readOnly ? (
                count > 0 && (
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                    ×{count} {isToday ? 'today' : ''}
                  </span>
                )
              ) : busy ? (
                <Loader2 className="w-5 h-5 animate-spin text-midnight-400 mr-1" />
              ) : isToday ? (
                <div className="flex items-center gap-1.5">
                  {count > 0 && (
                    <button
                      onClick={() => onUndoPrnLast(med)}
                      aria-label={`Undo last ${med.name}`}
                      title="Undo last"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-midnight-500 hover:text-midnight-900 px-2 py-1.5 rounded-lg hover:bg-midnight-100 transition-colors"
                    >
                      <Undo2 size={13} /> Undo
                    </button>
                  )}
                  <button
                    onClick={() => onLogPrnNow(med)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-midnight-900 bg-flash-400 hover:bg-flash-500 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Check size={13} strokeWidth={3} /> {count > 0 ? 'Log another' : 'Log dose now'}
                  </button>
                </div>
              ) : (
                count === 0 && (
                  <button
                    onClick={() => onLogPrnFor(med, day)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-midnight-900 bg-flash-400 hover:bg-flash-500 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Check size={13} strokeWidth={3} /> Log a dose this day
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DayChecklist({
  meds, day, busyKeys, readOnly,
  onMark, onUndo, onLogPrnNow, onUndoPrnLast, onLogPrnFor, onBackToToday,
}) {
  const isToday = sameDay(day, new Date());
  const scheduled = meds.filter((m) => m.isActive && m.scheduleType !== 'AS_NEEDED');
  const asNeeded = meds.filter((m) => m.isActive && m.scheduleType === 'AS_NEEDED');

  const buckets = useMemo(() => {
    const grouped = { Morning: [], Afternoon: [], Evening: [] };
    for (const med of scheduled) {
      for (const slot of slotsWithStatus(med, med.doses, day)) {
        grouped[timeOfDayBucket(slot.time)].push({ med, slot });
      }
    }
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => a.slot.time.localeCompare(b.slot.time));
    }
    return grouped;
  }, [meds, day]); // eslint-disable-line react-hooks/exhaustive-deps

  const all = Object.values(buckets).flat();
  const given = all.filter(({ slot }) => slot.status === 'GIVEN').length;
  const handled = all.filter(({ slot }) => slot.status).length;
  const due = all.length;

  // Today with nothing scheduled AND nothing loggable stays invisible. A
  // selected PAST day always renders so history can be documented even when
  // nothing was on the schedule.
  if (due === 0 && isToday && asNeeded.length === 0) return null;

  const dayLabel = day.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <Card padding="lg" className="mb-6">
      <div className="flex items-center gap-4 mb-5">
        <ProgressRing given={given} due={due} />
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-midnight-900">
            {isToday ? (
              due > 0 && handled >= due ? (
                <span className="inline-flex items-center gap-2">All done for today <PartyPopper className="w-5 h-5 text-flash-500" /></span>
              ) : 'Today'
            ) : dayLabel}
          </h2>
          <p className="text-sm text-midnight-500">
            {isToday
              ? `${dayLabel}${handled < due ? ` · ${due - handled} dose${due - handled !== 1 ? 's' : ''} to go` : ''}`
              : 'Catching up the record. Past doses go straight into the history.'}
          </p>
        </div>
        {!isToday && onBackToToday && (
          <button
            onClick={onBackToToday}
            className="text-xs font-bold text-midnight-500 hover:text-midnight-900 px-3 py-1.5 rounded-lg border border-midnight-200 hover:border-midnight-400 transition-colors whitespace-nowrap"
          >
            Back to today
          </button>
        )}
      </div>

      {due === 0 ? (
        <p className="text-sm text-midnight-500 mb-1">
          {isToday ? 'Nothing on the schedule today.' : 'Nothing was on the schedule this day.'}
        </p>
      ) : (
        <div className="space-y-4">
          {Object.entries(buckets).map(([bucket, items]) => {
            if (!items.length) return null;
            const BucketIcon = BUCKET_ICONS[bucket];
            return (
              <div key={bucket}>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-midnight-400 mb-2">
                  <BucketIcon size={14} /> {bucket}
                </p>
                <div className="space-y-2">
                  {items.map(({ med, slot }) => (
                    <DoseRow
                      key={`${med.id}-${slot.time}`}
                      med={med}
                      slot={slot}
                      busy={busyKeys?.has(`${med.id}-${slot.scheduledFor.getTime()}`)}
                      readOnly={readOnly}
                      onMark={onMark}
                      onUndo={onUndo}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PrnSection
        meds={asNeeded}
        day={day}
        busyKeys={busyKeys}
        readOnly={readOnly}
        onLogPrnNow={onLogPrnNow}
        onUndoPrnLast={onUndoPrnLast}
        onLogPrnFor={onLogPrnFor}
      />
    </Card>
  );
}
