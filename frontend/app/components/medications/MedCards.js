'use client';

/**
 * Medication record components — prescription-pad entries in the
 * Health Book (Paper Passport world). This card manages the record:
 * edit, pause, supply, delete. Doses — scheduled and as-needed alike —
 * are written in on Today, the one action surface.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { Pause, Play, Trash2, Pencil, Sun } from 'lucide-react';
import { cn } from '@/components/ui';
import { formatSchedule, isLowSupply } from '@/lib/medications';
import { RuledList, RuledRow, StampText } from '@/app/components/care/paper/Paper';

function formatWhen(value) {
  const d = new Date(value);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `Today · ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · ${time}`;
}

export function MedCard({ med, petId, busy, canManage, onTogglePause, onDelete }) {
  const low = isLowSupply(med);

  return (
    <div className={cn(
      'relative border border-paper-400 bg-paper-50 rounded-[6px] px-4 pt-3.5 pb-3',
      !med.isActive && 'opacity-60'
    )}>
      {/* The Rx corner mark — this is a prescription entry */}
      <span aria-hidden="true" className="absolute top-2.5 right-3 font-diary italic text-[15px] text-pen-300 select-none">℞</span>

      <div className="pr-6">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h4 className="font-bold text-[15px] text-pen-900">{med.name}</h4>
          {med.strength && <span className="font-stamp text-[10px] text-pen-400">{med.strength}</span>}
          {!med.isActive && <StampText tone="ink" rotate={-4} size="sm">Paused</StampText>}
        </div>
        {med.purpose && <p className="font-diary italic text-[12px] text-pen-400 mt-0.5">for {med.purpose.toLowerCase()}</p>}
        <p className="text-[13px] text-pen-600 mt-1.5">{formatSchedule(med)}</p>
        {med.instructions && <p className="font-diary italic text-[12px] text-pen-400 mt-0.5">{med.instructions}</p>}

        {med.quantityRemaining != null && (
          <p className={cn(
            'font-stamp text-[9.5px] uppercase tracking-[0.1em] mt-2',
            low ? 'text-stampred' : 'text-pen-400'
          )}>
            {Math.round(med.quantityRemaining * 10) / 10} dose{med.quantityRemaining !== 1 ? 's' : ''} left{low && ' — time to refill'}
          </p>
        )}
      </div>

      {canManage && (
        <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-pen-900/[0.12]">
          {med.scheduleType === 'AS_NEEDED' && med.isActive && (
            <Link
              href={`/pets/${petId}/today`}
              className="inline-flex items-center gap-1 font-stamp text-[9px] uppercase tracking-[0.1em] text-pen-400 hover:text-pen-900 transition-colors"
            >
              <Sun size={11} /> log in Today
            </Link>
          )}
          <span className="flex-1" />
          <Link
            href={`/pets/${petId}/medications/new?edit=${med.id}`}
            className="inline-flex items-center gap-1 font-stamp text-[9px] uppercase tracking-[0.1em] text-pen-600 hover:text-pen-900 transition-colors"
          >
            <Pencil size={11} /> edit
          </Link>
          <button
            onClick={() => onTogglePause(med)}
            disabled={busy}
            className="inline-flex items-center gap-1 font-stamp text-[9px] uppercase tracking-[0.1em] text-pen-600 hover:text-pen-900 transition-colors disabled:opacity-50"
          >
            {med.isActive ? <><Pause size={11} /> pause</> : <><Play size={11} /> resume</>}
          </button>
          <button
            onClick={() => onDelete(med)}
            disabled={busy}
            className="inline-flex items-center gap-1 font-stamp text-[9px] uppercase tracking-[0.1em] text-stampred hover:text-stampred-dark transition-colors disabled:opacity-50"
            aria-label={`Delete ${med.name}`}
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

export function ActivityFeed({ meds }) {
  const events = useMemo(() => {
    const out = [];
    for (const med of meds) {
      for (const dose of med.doses || []) {
        out.push({ med, dose, at: new Date(dose.givenAt || dose.scheduledFor) });
      }
    }
    return out.sort((a, b) => b.at - a.at).slice(0, 10);
  }, [meds]);

  if (!events.length) return null;

  return (
    <div>
      <h3 className="font-diary italic text-[16px] text-pen-600 mb-1">recent activity</h3>
      <RuledList>
        {events.map(({ med, dose, at }) => (
          <RuledRow key={dose.id} className="py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-pen-900 truncate">{med.name}</p>
              {dose.notes && <p className="font-diary italic text-[11.5px] text-pen-400 truncate">{dose.notes}</p>}
            </div>
            <StampText tone={dose.status === 'GIVEN' ? 'green' : 'ink'} rotate={-4} size="sm">
              {dose.status === 'GIVEN' ? 'Given' : 'Skipped'}
            </StampText>
            <span className="font-stamp text-[9px] text-pen-400 whitespace-nowrap">{formatWhen(at)}</span>
          </RuledRow>
        ))}
      </RuledList>
    </div>
  );
}
