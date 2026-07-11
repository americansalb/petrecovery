'use client';

/**
 * Medication rows for the Meds tab (direction D). Each row: the med, its
 * schedule and supply, and quiet actions (edit, pause, delete). Doses are
 * logged on Today; this is management only.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { Pencil, Pause, Play, Trash2 } from 'lucide-react';
import { cn } from '@/components/ui';
import { MedIconChip } from '@/app/components/medications/MedIcon';
import { formatSchedule, isLowSupply } from '@/lib/medications';

function formatWhen(value) {
  const d = new Date(value);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return `Today ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} ${time}`;
}

export function MedCard({ med, petId, busy, canManage, onTogglePause, onDelete }) {
  const low = isLowSupply(med);
  return (
    <div className={cn('flex items-start gap-3.5 px-5 py-4', !med.isActive && 'opacity-55')}>
      <MedIconChip med={med} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-[15px] font-semibold text-care-ink">{med.name}</p>
          {med.strength && <span className="text-[13px] text-care-faint">{med.strength}</span>}
          {!med.isActive && <span className="text-[11.5px] font-semibold text-care-faint uppercase tracking-wide">Paused</span>}
        </div>
        <p className="text-[13px] text-care-sub mt-0.5">{formatSchedule(med)}{med.purpose && `, for ${med.purpose.toLowerCase()}`}</p>
        {med.instructions && <p className="text-[13px] text-care-sub">{med.instructions}</p>}
        {med.quantityRemaining != null && (
          <p className={cn('text-[12.5px] mt-1 font-medium', low ? 'text-care-amber' : 'text-care-faint')}>
            {Math.round(med.quantityRemaining * 10) / 10} dose{med.quantityRemaining !== 1 ? 's' : ''} left{low && ' · time to refill'}
          </p>
        )}
      </div>
      {canManage && (
        <div className="flex items-center gap-1 shrink-0">
          <Link href={`/pets/${petId}/medications/new?edit=${med.id}`} aria-label={`Edit ${med.name}`} className="p-2 rounded-lg text-care-faint hover:text-care-ink hover:bg-care-bg transition-colors"><Pencil size={16} /></Link>
          <button onClick={() => onTogglePause(med)} disabled={busy} aria-label={med.isActive ? `Pause ${med.name}` : `Resume ${med.name}`} className="p-2 rounded-lg text-care-faint hover:text-care-ink hover:bg-care-bg transition-colors disabled:opacity-50">{med.isActive ? <Pause size={16} /> : <Play size={16} />}</button>
          <button onClick={() => onDelete(med)} disabled={busy} aria-label={`Delete ${med.name}`} className="p-2 rounded-lg text-care-faint hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"><Trash2 size={16} /></button>
        </div>
      )}
    </div>
  );
}

export function ActivityFeed({ meds }) {
  const { events, total } = useMemo(() => {
    const out = [];
    for (const med of meds) for (const dose of med.doses || []) out.push({ med, dose, at: new Date(dose.givenAt || dose.scheduledFor) });
    out.sort((a, b) => b.at - a.at);
    return { events: out.slice(0, 60), total: out.length };
  }, [meds]);

  if (!events.length) return <p className="text-[14px] text-care-sub px-5 py-4">No doses logged yet.</p>;

  return (
    <div>
      {total > events.length && (
        <p className="text-[12px] text-care-faint px-5 pt-1">Showing the latest {events.length} of {total}. The full record is in the backup download below.</p>
      )}
      {events.map(({ med, dose, at }, i) => (
        <div key={dose.id} className={cn('flex items-center gap-3 px-5 py-3', i > 0 && 'border-t border-care-lineSoft')}>
          <span className={cn('w-2 h-2 rounded-full shrink-0', dose.status === 'GIVEN' ? 'bg-care-teal' : 'bg-care-faint')} aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-care-ink truncate">{med.name}<span className="font-normal text-care-faint ml-1.5">{med.strength}</span></p>
            {dose.notes && <p className="text-[12.5px] text-care-sub truncate">{dose.notes}</p>}
          </div>
          <span className="text-[12.5px] text-care-sub whitespace-nowrap tabular-nums">{formatWhen(at)}</span>
        </div>
      ))}
    </div>
  );
}
