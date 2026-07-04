'use client';

/**
 * Medication record components: the management card and the activity
 * feed. Lifted verbatim from the old Meds tab when medication
 * management moved into the Health Book (docs/PRODUCT_IA_PLAN.md §3).
 */

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Pause, Play, Trash2, Pencil, AlertTriangle,
  PackageOpen, History, Sun,
} from 'lucide-react';
import { Card, Badge, cn } from '@/components/ui';
import { MedIconChip } from '@/app/components/medications/MedIcon';
import { formatSchedule, isLowSupply, medColor } from '@/lib/medications';

function formatWhen(value) {
  const d = new Date(value);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `Today · ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · ${time}`;
}

export function MedCard({ med, petId, busy, canManage, onTogglePause, onDelete }) {
  const colors = medColor(med.color);
  const low = isLowSupply(med);

  return (
    <Card padding="none" className={cn('border-l-4 overflow-hidden', colors.accent, !med.isActive && 'opacity-70')}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <MedIconChip med={med} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-midnight-900 truncate">{med.name}</h4>
              {med.strength && <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', colors.chip)}>{med.strength}</span>}
              {!med.isActive && <Badge variant="default" size="sm">Paused</Badge>}
            </div>
            {med.purpose && <p className="text-xs text-midnight-500 mt-0.5">{med.purpose}</p>}
            <p className="text-sm text-midnight-700 mt-1.5">{formatSchedule(med)}</p>
            {med.instructions && <p className="text-xs text-midnight-500 mt-1 italic">{med.instructions}</p>}

            {med.quantityRemaining != null && (
              <p className={cn('inline-flex items-center gap-1.5 text-xs font-semibold mt-2 px-2 py-1 rounded-lg',
                low ? 'bg-red-50 text-red-700' : 'bg-midnight-50 text-midnight-600')}>
                {low && <AlertTriangle size={12} />}
                <PackageOpen size={12} />
                {Math.round(med.quantityRemaining * 10) / 10} dose{med.quantityRemaining !== 1 ? 's' : ''} left
                {low && ', time to refill'}
              </p>
            )}
          </div>
        </div>
      </div>

      {canManage && (
      <div className="flex items-center gap-1 px-3 py-2 border-t border-midnight-100 bg-midnight-50/50">
        {/* Doses — scheduled and as-needed alike — are logged in Today,
            the one action surface. This card only manages the record. */}
        {med.scheduleType === 'AS_NEEDED' && med.isActive && (
          <Link
            href={`/pets/${petId}/today`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-midnight-500 hover:text-midnight-900 px-2 py-1.5 rounded-lg hover:bg-midnight-100 transition-colors"
          >
            <Sun size={13} /> Log doses in Today
          </Link>
        )}
        <div className="flex-1" />
        <Link
          href={`/pets/${petId}/medications/new?edit=${med.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-midnight-600 hover:text-midnight-900 px-2.5 py-1.5 rounded-lg hover:bg-midnight-100 transition-colors"
        >
          <Pencil size={13} /> Edit
        </Link>
        <button
          onClick={() => onTogglePause(med)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-midnight-600 hover:text-midnight-900 px-2.5 py-1.5 rounded-lg hover:bg-midnight-100 transition-colors"
        >
          {med.isActive ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Resume</>}
        </button>
        <button
          onClick={() => onDelete(med)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          aria-label={`Delete ${med.name}`}
        >
          <Trash2 size={13} />
        </button>
      </div>
      )}
    </Card>
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
    <Card padding="lg" className="mb-6">
      <h3 className="flex items-center gap-2 font-bold text-midnight-900 mb-3"><History size={18} className="text-midnight-400" /> Recent activity</h3>
      <ul className="divide-y divide-midnight-100">
        {events.map(({ med, dose, at }) => (
          <li key={dose.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
            <MedIconChip med={med} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-midnight-800 truncate">{med.name}</p>
              {dose.notes && <p className="text-xs text-midnight-500 truncate">{dose.notes}</p>}
            </div>
            <Badge variant={dose.status === 'GIVEN' ? 'success' : 'default'} size="sm">
              {dose.status === 'GIVEN' ? 'Given' : 'Skipped'}
            </Badge>
            <span className="text-xs text-midnight-500 whitespace-nowrap">{formatWhen(at)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
