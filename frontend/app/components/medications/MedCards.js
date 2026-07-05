'use client';

/**
 * Medication rows in the Health record. Each row shows the medication,
 * its schedule and supply, and quiet actions to edit, pause, or delete.
 * Doses, scheduled and as-needed alike, are logged on Today.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { Pause, Play, Trash2, Pencil } from 'lucide-react';
import { cn } from '@/components/ui';
import { formatSchedule, isLowSupply } from '@/lib/medications';

function formatWhen(value) {
  const d = new Date(value);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `Today ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} ${time}`;
}

export function MedCard({ med, petId, busy, canManage, onTogglePause, onDelete }) {
  const low = isLowSupply(med);

  return (
    <div className={cn('flex items-start gap-3 py-3', !med.isActive && 'opacity-50')}>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-[15px] font-medium text-neutral-900">{med.name}</p>
          {med.strength && <span className="text-[13px] text-neutral-400">{med.strength}</span>}
          {!med.isActive && <span className="text-[13px] text-neutral-400">Paused</span>}
        </div>
        <p className="text-[13px] text-neutral-500">{formatSchedule(med)}{med.purpose && `, for ${med.purpose.toLowerCase()}`}</p>
        {med.instructions && <p className="text-[13px] text-neutral-500">{med.instructions}</p>}
        {med.quantityRemaining != null && (
          <p className={cn('text-[13px] mt-0.5', low ? 'text-red-600' : 'text-neutral-400')}>
            {Math.round(med.quantityRemaining * 10) / 10} dose{med.quantityRemaining !== 1 ? 's' : ''} left{low && ', time to refill'}
          </p>
        )}
      </div>

      {canManage && (
        <div className="flex items-center gap-3 shrink-0 pt-0.5">
          <Link
            href={`/pets/${petId}/medications/new?edit=${med.id}`}
            className="text-neutral-400 hover:text-neutral-900 transition-colors"
            aria-label={`Edit ${med.name}`}
          >
            <Pencil size={15} />
          </Link>
          <button
            onClick={() => onTogglePause(med)}
            disabled={busy}
            className="text-neutral-400 hover:text-neutral-900 transition-colors disabled:opacity-50"
            aria-label={med.isActive ? `Pause ${med.name}` : `Resume ${med.name}`}
          >
            {med.isActive ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button
            onClick={() => onDelete(med)}
            disabled={busy}
            className="text-neutral-400 hover:text-red-600 transition-colors disabled:opacity-50"
            aria-label={`Delete ${med.name}`}
          >
            <Trash2 size={15} />
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
      <p className="text-[13px] font-medium text-neutral-500 mb-1">Recent activity</p>
      <div className="divide-y divide-neutral-100">
        {events.map(({ med, dose, at }) => (
          <div key={dose.id} className="flex items-center gap-3 py-2">
            <span className={cn('w-2 h-2 rounded-full shrink-0', dose.status === 'GIVEN' ? 'bg-emerald-500' : 'bg-neutral-300')} aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium text-neutral-900 truncate">{med.name}</p>
              {dose.notes && <p className="text-[13px] text-neutral-500 truncate">{dose.notes}</p>}
            </div>
            <span className="text-[13px] text-neutral-500 whitespace-nowrap">{formatWhen(at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
