'use client';

/**
 * The dose checklist: Today's core, shared with the public care view.
 *
 * One question: what does this pet need now? Pending doses come first,
 * sorted by time, each with a single Give action. As-needed doses
 * follow. What is already handled drops to a quiet "Done" group so it
 * is out of the way but still checkable. Today is the ONLY surface
 * where doses are logged.
 *
 * `readOnly` renders the same rows as status only (the sitter/vet view
 * link uses this): one component, two audiences.
 */

import { useMemo } from 'react';
import { Loader2, Check } from 'lucide-react';
import { cn } from '@/components/ui';
import {
  formatTime, slotsWithStatus, sameDay,
} from '@/lib/medications';

function isOverdue(slot, day) {
  return !slot.status && sameDay(day, new Date()) && slot.scheduledFor < new Date();
}

export function DoseRow({ med, slot, busy, readOnly, onMark, onUndo, day }) {
  const given = slot.status === 'GIVEN';
  const skipped = slot.status === 'SKIPPED';
  const handled = given || skipped;
  const overdue = isOverdue(slot, day);

  return (
    <div className="flex items-center gap-3 py-3">
      <span
        className={cn(
          'w-14 shrink-0 text-[13px] tabular-nums',
          overdue ? 'text-red-600 font-medium' : 'text-neutral-500'
        )}
      >
        {formatTime(slot.time)}
      </span>

      <div className="flex-1 min-w-0">
        <p className={cn('text-[15px] font-medium truncate', handled ? 'text-neutral-400' : 'text-neutral-900')}>
          {med.name}
          {med.strength && <span className="font-normal text-neutral-400"> {med.strength}</span>}
        </p>
        {(med.instructions || overdue) && !handled && (
          <p className="text-[13px] text-neutral-500 truncate">
            {overdue ? 'Overdue' : med.instructions}
          </p>
        )}
        {slot.orphaned && handled && (
          <p className="text-[13px] text-neutral-400 truncate">Logged off schedule</p>
        )}
      </div>

      {busy ? (
        <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
      ) : handled ? (
        <span className="flex items-center gap-3 shrink-0">
          {given ? (
            <span className="inline-flex items-center gap-1 text-[13px] text-emerald-600">
              <Check size={15} />
              {slot.dose?.givenAt ? new Date(slot.dose.givenAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Given'}
            </span>
          ) : (
            <span className="text-[13px] text-neutral-400">Skipped</span>
          )}
          {!readOnly && (
            <button
              onClick={() => onUndo(med, slot)}
              className="text-[13px] font-medium text-neutral-400 hover:text-neutral-900 transition-colors"
            >
              Undo
            </button>
          )}
        </span>
      ) : readOnly ? (
        <span className="text-[13px] text-neutral-400 shrink-0">Due</span>
      ) : (
        <span className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onMark(med, slot, 'SKIPPED')}
            className="text-[13px] font-medium text-neutral-400 hover:text-neutral-900 transition-colors"
            aria-label={`Skip ${med.name} at ${formatTime(slot.time)}`}
          >
            Skip
          </button>
          <button
            onClick={() => onMark(med, slot, 'GIVEN')}
            className="rounded-full bg-care-teal text-white text-sm font-medium px-4 py-1.5 hover:bg-care-tealDark transition-colors"
            aria-label={`Give ${med.name} at ${formatTime(slot.time)}`}
          >
            Give
          </button>
        </span>
      )}
    </div>
  );
}

/**
 * As-needed medications: give now, the day's count, undo. On a past
 * day, a single control to record that a dose was given.
 */
export function PrnSection({ meds, day, busyKeys, readOnly, onLogPrnNow, onUndoPrnLast, onLogPrnFor }) {
  const isToday = sameDay(day, new Date());
  if (!meds.length) return null;

  return (
    <section className="mt-8">
      <p className="text-[13px] font-medium text-neutral-500 mb-1">As needed</p>
      <div className="divide-y divide-neutral-100">
        {meds.map((med) => {
          const count = (med.doses || []).filter(
            (d) => !d.deletedAt && d.status === 'GIVEN' && sameDay(new Date(d.scheduledFor), day)
          ).length;
          const busy = busyKeys?.has(`prn-${med.id}`);
          return (
            <div key={med.id} className="flex items-center gap-3 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-neutral-900 truncate">
                  {med.name}
                  {med.strength && <span className="font-normal text-neutral-400"> {med.strength}</span>}
                </p>
                {count > 0 && (
                  <p className="text-[13px] text-neutral-500">
                    {count} given {isToday ? 'today' : 'this day'}
                  </p>
                )}
              </div>

              {readOnly ? (
                count > 0 && <span className="text-[13px] text-emerald-600 shrink-0">{count} given</span>
              ) : busy ? (
                <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
              ) : isToday ? (
                <span className="flex items-center gap-3 shrink-0">
                  {count > 0 && (
                    <button
                      onClick={() => onUndoPrnLast(med)}
                      className="text-[13px] font-medium text-neutral-400 hover:text-neutral-900 transition-colors"
                      aria-label={`Undo last ${med.name}`}
                    >
                      Undo
                    </button>
                  )}
                  <button
                    onClick={() => onLogPrnNow(med)}
                    className="rounded-full bg-care-teal text-white text-sm font-medium px-4 py-1.5 hover:bg-care-tealDark transition-colors"
                    aria-label={`Give ${med.name} now`}
                  >
                    {count > 0 ? 'Give again' : 'Give'}
                  </button>
                </span>
              ) : (
                count === 0 && (
                  <button
                    onClick={() => onLogPrnFor(med, day)}
                    className="rounded-full border border-neutral-300 text-sm font-medium text-neutral-900 px-4 py-1.5 hover:border-care-teal transition-colors shrink-0"
                    aria-label={`Record a ${med.name} dose for this day`}
                  >
                    Record
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function DayChecklist({
  meds, day, busyKeys, readOnly,
  onMark, onUndo, onLogPrnNow, onUndoPrnLast, onLogPrnFor, onBackToToday,
}) {
  const isToday = sameDay(day, new Date());
  const scheduled = meds.filter((m) => m.isActive && m.scheduleType !== 'AS_NEEDED');
  const asNeeded = meds.filter((m) => m.isActive && m.scheduleType === 'AS_NEEDED');

  const slots = useMemo(() => {
    const out = [];
    for (const med of scheduled) {
      for (const slot of slotsWithStatus(med, med.doses, day)) {
        out.push({ med, slot });
      }
    }
    out.sort((a, b) => a.slot.time.localeCompare(b.slot.time));
    return out;
  }, [meds, day]); // eslint-disable-line react-hooks/exhaustive-deps

  const pending = slots.filter(({ slot }) => !slot.status);
  const done = slots.filter(({ slot }) => slot.status);

  // Today with nothing to do stays quiet; a past day always renders so
  // the record can be caught up.
  if (slots.length === 0 && asNeeded.length === 0 && isToday) return null;

  const rowFor = ({ med, slot }) => (
    <DoseRow
      key={`${med.id}-${slot.time}`}
      med={med}
      slot={slot}
      day={day}
      busy={busyKeys?.has(`${med.id}-${slot.scheduledFor.getTime()}`)}
      readOnly={readOnly}
      onMark={onMark}
      onUndo={onUndo}
    />
  );

  return (
    <section className="mb-2">
      {!isToday && (
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-[13px] font-medium text-neutral-500">
            {day.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          {onBackToToday && (
            <button
              onClick={onBackToToday}
              className="text-[13px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              Back to today
            </button>
          )}
        </div>
      )}

      {pending.length > 0 && (
        <div className="divide-y divide-neutral-100">
          {pending.map(rowFor)}
        </div>
      )}

      {pending.length === 0 && slots.length > 0 && (
        <p className="text-[15px] text-neutral-500 py-3">
          {isToday ? 'All doses given.' : 'Nothing left for this day.'}
        </p>
      )}

      {slots.length === 0 && !isToday && (
        <p className="text-[15px] text-neutral-500 py-3">Nothing was scheduled this day.</p>
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

      {done.length > 0 && (
        <div className="mt-8">
          <p className="text-[13px] font-medium text-neutral-500 mb-1">Done</p>
          <div className="divide-y divide-neutral-100">
            {done.map(rowFor)}
          </div>
        </div>
      )}
    </section>
  );
}
