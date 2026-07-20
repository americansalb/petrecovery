'use client';

/**
 * Shelter animal roster: the working part of the free shelter account.
 * Each animal is a full Health Book record (meds, vaccinations, weights)
 * owned by the shelter's claiming user; this list links into those pages
 * and drives the adoption handoff (transfer to the adopter's email).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PawPrint, Send, X, Loader2, ArrowRight } from 'lucide-react';

const SPECIES_LABEL = {
  DOG: 'Dog', CAT: 'Cat', BIRD: 'Bird', RABBIT: 'Rabbit', OTHER: 'Pet',
};

function TransferControl({ pet, onChanged }) {
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

  const cancel = async () => {
    setBusy(true);
    try {
      await fetch(`/api/pets/${pet.id}/transfer`, { method: 'DELETE' });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  if (pet.pendingTransferEmail) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
          <Send className="w-3.5 h-3.5" /> Invite sent to {pet.pendingTransferEmail}
        </span>
        <button onClick={cancel} disabled={busy} className="text-midnight-500 hover:text-red-600 font-medium disabled:opacity-50">
          Cancel
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-midnight-700 hover:text-midnight-900 border border-midnight-200 hover:border-midnight-300 rounded-lg px-3 py-1.5 transition"
      >
        <Send className="w-3.5 h-3.5" /> Send home with adopter
      </button>
    );
  }

  return (
    <form onSubmit={invite} className="flex flex-wrap items-center gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="adopter@email.com"
        className="border border-midnight-200 rounded-lg px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-flash-400"
        autoFocus
      />
      <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 bg-midnight-900 hover:bg-midnight-800 text-white text-sm font-semibold rounded-lg px-3 py-1.5 disabled:opacity-50 transition">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Invite
      </button>
      <button type="button" onClick={() => { setOpen(false); setError(''); }} className="text-midnight-400 hover:text-midnight-700 p-1">
        <X className="w-4 h-4" />
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}

export default function ShelterRoster({ pets }) {
  const router = useRouter();
  const refresh = () => router.refresh();

  if (pets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-midnight-200 bg-white p-8 text-center">
        <PawPrint className="w-10 h-10 text-midnight-300 mx-auto mb-3" />
        <h3 className="font-bold text-midnight-900 mb-1">No animals yet</h3>
        <p className="text-midnight-600">
          Add your first animal and its full health record: medications, vaccinations, and weight tracking, free.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {pets.map((pet) => (
        <li key={pet.id} className="rounded-2xl border border-midnight-100 bg-white shadow-sm p-4 flex flex-wrap items-center gap-4">
          {pet.primaryPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pet.primaryPhotoUrl} alt={pet.name} className="w-14 h-14 rounded-xl object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-midnight-50 flex items-center justify-center">
              <PawPrint className="w-6 h-6 text-midnight-300" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <Link href={`/pets/${pet.id}/today`} className="font-bold text-midnight-900 hover:underline inline-flex items-center gap-1">
              {pet.name} <ArrowRight className="w-3.5 h-3.5 text-midnight-400" />
            </Link>
            <p className="text-sm text-midnight-500 truncate">
              {[SPECIES_LABEL[pet.species] || 'Pet', pet.breed].filter(Boolean).join(' · ')}
            </p>
          </div>
          <TransferControl pet={pet} onChanged={refresh} />
        </li>
      ))}
    </ul>
  );
}
