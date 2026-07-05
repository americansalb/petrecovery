'use client';

/**
 * The dose checklist — Today's heart, shared with the public care view.
 *
 * In the Paper Passport world a day is a diary page: the date in the
 * diary hand, doses as ruled journal entries with ink checkboxes,
 * given doses stamped GIVEN, the one action a dashed red GIVE NOW.
 * Today is the ONLY surface where doses are logged — scheduled
 * check-offs, as-needed "give now", and past-day catch-up all live
 * here; the Health Book manages the record, never the taps.
 *
 * `readOnly` renders the same page with stamps instead of buttons
 * (the vet/sitter view link uses this — one page, two audiences).
 */

import { useMemo } from 'react';
import { Loader2, Undo2 } from 'lucide-react';
import { cn } from '@/components/ui';
import {
  formatTime, timeOfDayBucket, slotsWithStatus, sameDay,
} from '@/lib/medications';
import {
  Sheet, PageTitle, RuledList, RuledRow, InkCheckbox, StampText,
  GiveButton, InkFraction, SectionInk, MonoChip,
} from '@/app/components/care/paper/Paper';

export function DoseRow({ med, slot, busy, readOnly, onMark, onUndo }) {
  const given = slot.status === 'GIVEN';
  const skipped = slot.status === 'SKIPPED';

  return (
    <RuledRow faded={skipped}>
      <InkCheckbox done={given} skipped={skipped} />
      <div className="flex-1 min-w-0">
        <p className={cn('font-bold text-[14.5px] text-pen-900 truncate leading-tight', skipped && 'line-through text-pen-400 font-semibold')}>
          {med.name}
          {med.strength && <span className="font-medium text-pen-400"> · {med.strength}</span>}
        </p>
        <p className="font-diary italic text-[12px] text-pen-400 mt-0.5 truncate">
          {skipped
            ? 'skipped this time'
            : given
              ? (med.instructions || 'in the book')
              : [`due ${formatTime(slot.time)}`, med.instructions].filter(Boolean).join(' — ')}
        </p>
      </div>

      {busy ? (
        <Loader2 className="w-4 h-4 animate-spin text-pen-400 mr-1" />
      ) : given || skipped ? (
        <span className="flex items-center gap-2 shrink-0">
          <StampText tone={given ? 'green' : 'ink'} rotate={given ? -6 : 4}>
            {given
              ? `Given${slot.dose?.givenAt ? ` · ${new Date(slot.dose.givenAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}`
              : 'Skipped'}
          </StampText>
          {!readOnly && (
            <button
              onClick={() => onUndo(med, slot)}
              className="inline-flex items-center gap-1 font-stamp text-[9px] uppercase tracking-[0.1em] text-pen-400 hover:text-pen-900 transition-colors"
              title="Undo"
            >
              <Undo2 size={12} /> Undo
            </button>
          )}
        </span>
      ) : readOnly ? null : (
        <span className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onMark(med, slot, 'SKIPPED')}
            className="font-stamp text-[9px] uppercase tracking-[0.1em] text-pen-300 hover:text-pen-600 transition-colors px-1 py-2"
            title={`Skip ${med.name}`}
            aria-label={`Skip ${med.name} ${formatTime(slot.time)}`}
          >
            skip
          </button>
          <GiveButton
            onClick={() => onMark(med, slot, 'GIVEN')}
            ariaLabel={`Mark ${med.name} ${formatTime(slot.time)} as given`}
          >
            Give now
          </GiveButton>
        </span>
      )}
    </RuledRow>
  );
}

/**
 * As-needed medications: the ledger at the bottom of the page. On
 * today: give-now, the day's count, undo. On a past day: catch-up
 * logging so the record can be documented after the fact.
 */
export function PrnSection({ meds, day, busyKeys, readOnly, onLogPrnNow, onUndoPrnLast, onLogPrnFor }) {
  const isToday = sameDay(day, new Date());
  if (!meds.length) return null;

  return (
    <div className="mt-5">
      <SectionInk>as needed</SectionInk>
      <RuledList>
        {meds.map((med) => {
          const dayDoses = (med.doses || []).filter(
            (d) => !d.deletedAt && d.status === 'GIVEN' && sameDay(new Date(d.scheduledFor), day)
          );
          const count = dayDoses.length;
          const busy = busyKeys?.has(`prn-${med.id}`);
          return (
            <RuledRow key={med.id}>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[14.5px] text-pen-900 truncate leading-tight">
                  {med.name}
                  {med.strength && <span className="font-medium text-pen-400"> · {med.strength}</span>}
                </p>
                <p className="font-diary italic text-[12px] text-pen-400 mt-0.5">
                  {count > 0
                    ? `${count} dose${count !== 1 ? 's' : ''} ${isToday ? 'today' : 'this day'}`
                    : isToday ? 'when they need it, write it here' : 'nothing written this day'}
                </p>
              </div>

              {readOnly ? (
                count > 0 && <StampText tone="green" rotate={-5}>×{count} {isToday ? 'today' : ''}</StampText>
              ) : busy ? (
                <Loader2 className="w-4 h-4 animate-spin text-pen-400 mr-1" />
              ) : isToday ? (
                <span className="flex items-center gap-2 shrink-0">
                  {count > 0 && (
                    <>
                      <StampText tone="green" rotate={-5}>×{count}</StampText>
                      <button
                        onClick={() => onUndoPrnLast(med)}
                        aria-label={`Undo last ${med.name}`}
                        title="Undo last"
                        className="inline-flex items-center gap-1 font-stamp text-[9px] uppercase tracking-[0.1em] text-pen-400 hover:text-pen-900 transition-colors"
                      >
                        <Undo2 size={12} /> Undo
                      </button>
                    </>
                  )}
                  <GiveButton onClick={() => onLogPrnNow(med)} ariaLabel={`Log ${med.name} now`}>
                    {count > 0 ? 'Give another' : 'Give now'}
                  </GiveButton>
                </span>
              ) : (
                count === 0 && (
                  <GiveButton onClick={() => onLogPrnFor(med, day)} ariaLabel={`Log a ${med.name} dose for this day`}>
                    Log this day
                  </GiveButton>
                )
              )}
            </RuledRow>
          );
        })}
      </RuledList>
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
  const allDone = due > 0 && handled >= due;

  return (
    <Sheet perforated className="mb-5">
      <PageTitle
        aside={isToday
          ? (allDone ? 'all written in' : `${due - handled} to go`)
          : 'catching up the record'}
      >
        {dayLabel}
      </PageTitle>

      <div className="flex gap-4 items-start mt-4">
        {due > 0 && (
          <div className="hidden sm:block pt-1">
            <InkFraction given={given} due={due} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {due === 0 ? (
            <p className="font-diary italic text-[13.5px] text-pen-400 py-2">
              {isToday ? 'nothing on the schedule today.' : 'nothing was on the schedule this day.'}
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(buckets).map(([bucket, items]) => {
                if (!items.length) return null;
                return (
                  <div key={bucket}>
                    <p className="font-stamp text-[9px] uppercase tracking-[0.18em] text-pen-400 mb-0.5">
                      {bucket}
                    </p>
                    <RuledList>
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
                    </RuledList>
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
        </div>
      </div>

      {!isToday && onBackToToday && (
        <div className="mt-4 text-right">
          <MonoChip onClick={onBackToToday}>← back to today</MonoChip>
        </div>
      )}
    </Sheet>
  );
}
