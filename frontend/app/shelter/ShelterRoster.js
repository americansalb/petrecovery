'use client';

/**
 * Shelter animal roster: one table-like surface, not a stack of cards.
 * Columns: the animal (photo, name, origin), status (dot + text edited
 * through an invisible select), days in care, and the adoption handoff.
 * Every row links into the animal's full Health Book.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PawPrint, Send, X, Loader2 } from 'lucide-react';
import {
  SHELTER_STATUSES, SHELTER_STATUS_LABELS, INTAKE_TYPE_LABELS,
} from '@/app/lib/shelterStatuses';

const SPECIES_LABEL = {
  DOG: 'Dog', CAT: 'Cat', BIRD: 'Bird', RABBIT: 'Rabbit', OTHER: 'Pet',
};

const STATUS_DOT = {
  AVAILABLE: 'bg-emerald-500',
  ADOPTION_PENDING: 'bg-amber-500',
  ADOPTED: 'bg-blue-500',
  RECLAIMED: 'bg-violet-500',
};

/* One template shared by the header strip and every row */
const COLS = 'md:grid-cols-[minmax(0,1fr)_10rem_5rem_13rem]';

function daysIn(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return null;
  const d = Math.floor((Date.now() - t) / 86400e3);
  return d < 0 ? 0 : d;
}

function subLine(pet) {
  const parts = [SPECIES_LABEL[pet.species] || 'Pet'];
  if (pet.breed) parts.push(pet.breed);
  if (pet.intakeType === 'STRAY' && pet.intakeFoundAddress) {
    parts.push(`found near ${pet.intakeFoundAddress.split(',').slice(0, 2).join(',')}`);
  } else if (pet.intakeType) {
    parts.push((INTAKE_TYPE_LABELS[pet.intakeType] || pet.intakeType).toLowerCase());
  }
  return parts.join(' · ');
}

function StatusControl({ pet, onChanged }) {
  const [busy, setBusy] = useState(false);
  if (!pet.shelterStatus) return null;

  const change = async (e) => {
    const shelterStatus = e.target.value;
    if (shelterStatus === pet.shelterStatus) return;
    setBusy(true);
    try {
      await fetch(`/api/pets/${pet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shelterStatus }),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <label className={`relative inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-midnight-700 hover:text-midnight-900 cursor-pointer transition ${busy ? 'opacity-50' : ''}`}>
      <i className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[pet.shelterStatus] || 'bg-midnight-300'}`} />
      {SHELTER_STATUS_LABELS[pet.shelterStatus] || pet.shelterStatus}
      <svg className="w-3 h-3 text-midnight-400" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <select
        aria-label={`Status for ${pet.name}`}
        value={pet.shelterStatus}
        onChange={change}
        disabled={busy}
        className="absolute inset-0 opacity-0 cursor-pointer"
      >
        {SHELTER_STATUSES.map((s) => (
          <option key={s} value={s}>{SHELTER_STATUS_LABELS[s]}</option>
        ))}
      </select>
    </label>
  );
}

function Row({ pet, onChanged }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const invite = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/pets/${pet.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invite');
      setOpen(false);
      setEmail('');
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const cancelInvite = async () => {
    setBusy(true);
    try {
      await fetch(`/api/pets/${pet.id}/transfer`, { method: 'DELETE' });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const days = daysIn(pet.intakeDate);

  return (
    <li className="px-4 py-3">
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 md:grid ${COLS} md:gap-3 md:items-center`}>
        {/* On phones the animal takes its own line; status and the handoff
            share the second line so every row wraps the same way */}
        <div className="flex items-center gap-3.5 min-w-0 basis-full md:basis-auto">
          {pet.primaryPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pet.primaryPhotoUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
          ) : (
            <span className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <PawPrint className="w-[18px] h-[18px] text-midnight-300" />
            </span>
          )}
          <div className="min-w-0">
            <Link href={`/pets/${pet.id}/today`} className="font-bold text-midnight-900 text-[15px] leading-tight hover:underline">
              {pet.name}
            </Link>
            <p className="text-[13px] text-midnight-400 truncate">{subLine(pet)}</p>
          </div>
        </div>

        <div className="shrink-0">
          <StatusControl pet={pet} onChanged={onChanged} />
        </div>

        <span
          className="hidden md:block text-[13px] text-midnight-400 tabular-nums text-right"
          title={pet.intakeDate ? `Intake ${new Date(pet.intakeDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : undefined}
        >
          {days === null ? '' : days === 0 ? 'today' : `${days}d`}
        </span>

        <div className="min-w-0 flex ml-auto md:ml-0 md:w-full md:justify-end">
          {pet.pendingTransferEmail ? (
            <span
              className="inline-flex items-center gap-1.5 min-w-0 text-[13px] font-medium text-midnight-600"
              title={`Adoption invite sent to ${pet.pendingTransferEmail}`}
            >
              <i className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              <span className="truncate">{pet.pendingTransferEmail}</span>
              <button
                onClick={cancelInvite}
                disabled={busy}
                aria-label={`Cancel adoption invite for ${pet.name}`}
                className="text-midnight-400 hover:text-red-600 disabled:opacity-50 shrink-0 p-0.5"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
              </button>
            </span>
          ) : open ? (
            <span className="hidden md:block" />
          ) : (
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-midnight-600 hover:text-midnight-900 transition"
            >
              <Send className="w-3.5 h-3.5" /> Send home
            </button>
          )}
        </div>
      </div>

      {open && !pet.pendingTransferEmail && (
        /* globals.css forces email inputs to width:100%; grid tracks shape
           the row instead of input width utilities */
        <form onSubmit={invite} className="mt-3 md:pl-[54px] grid gap-2 sm:grid-cols-[minmax(0,16rem)_auto_auto] sm:items-center">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="adopter@email.com"
            className="border border-midnight-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-flash-400"
            autoFocus
          />
          <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-1.5 bg-midnight-900 hover:bg-midnight-800 text-white text-sm font-semibold rounded-lg px-3 py-1.5 disabled:opacity-50 transition">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Send invite
          </button>
          <button type="button" onClick={() => { setOpen(false); setError(''); }} aria-label="Close" className="justify-self-start text-midnight-400 hover:text-midnight-700 p-1">
            <X className="w-4 h-4" />
          </button>
          {error && <p className="sm:col-span-3 text-sm text-red-600">{error}</p>}
        </form>
      )}
    </li>
  );
}

export default function ShelterRoster({ pets }) {
  const router = useRouter();
  const refresh = () => router.refresh();

  if (pets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-midnight-200 bg-white px-6 py-10 text-center">
        <PawPrint className="w-8 h-8 text-midnight-300 mx-auto mb-2" />
        <p className="font-bold text-midnight-900">No animals yet</p>
        <p className="text-sm text-midnight-500 mt-1">
          Add your first animal and its full health record: medications, vaccinations, and weight tracking, free.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-midnight-100 bg-white overflow-hidden">
      <div className={`hidden md:grid ${COLS} md:gap-3 px-4 py-2 border-b border-midnight-100 bg-slate-50/60 text-[11px] font-bold uppercase tracking-[0.14em] text-midnight-400`}>
        <span>Animal</span>
        <span>Status</span>
        <span className="text-right">In care</span>
        <span className="text-right">Adoption</span>
      </div>
      <ul className="divide-y divide-midnight-100">
        {pets.map((pet) => (
          <Row key={pet.id} pet={pet} onChanged={refresh} />
        ))}
      </ul>
    </div>
  );
}
