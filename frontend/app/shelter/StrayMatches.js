'use client';

/**
 * Possible-owner match review for the shelter dashboard. Side-by-side
 * photos of the roster animal and the lost-pet report; the shelter
 * confirms (which notifies the owner) or dismisses (silent). The owner
 * is NEVER contacted before a human confirms here.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PawPrint, Loader2, CheckCircle2, XCircle, Sparkles } from 'lucide-react';

function Photo({ url, alt }) {
  if (!url) {
    return (
      <div className="w-full aspect-square rounded-xl bg-midnight-50 flex items-center justify-center">
        <PawPrint className="w-8 h-8 text-midnight-300" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="w-full aspect-square rounded-xl object-cover" />;
}

function VisionChip({ verdict }) {
  if (verdict === 'SAME') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
        <Sparkles className="w-3.5 h-3.5" /> Photos look like the same animal
      </span>
    );
  }
  if (verdict === 'DIFFERENT') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-midnight-50 text-midnight-600 border border-midnight-200 text-xs font-semibold">
        Photos look different
      </span>
    );
  }
  return null;
}

function MatchCard({ match, onResolved }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const act = async (action) => {
    setBusy(action);
    setError('');
    try {
      const res = await fetch(`/api/shelter/matches/${match.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update match');
      onResolved(match.id);
    } catch (e) {
      setError(e.message);
      setBusy('');
    }
  };

  const pct = Math.round((match.pTrueMatch || 0) * 100);
  const intakeDate = match.pet.intakeDate
    ? new Date(match.pet.intakeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;
  const reportedAt = match.case.reportedAt
    ? new Date(match.case.reportedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <li className="rounded-2xl border border-flash-200 bg-flash-50/40 p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <p className="font-bold text-midnight-900">
          Could {match.pet.name} be {match.case.petName || 'this lost pet'}?
        </p>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${match.band === 'actionable' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
          {pct}% match{match.matchSource === 'microchip' ? ' (microchip!)' : ''}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <Photo url={match.pet.photoUrl} alt={match.pet.name} />
          <p className="text-sm font-semibold text-midnight-900 mt-1.5">{match.pet.name} (in your care)</p>
          <p className="text-xs text-midnight-500">
            {[match.pet.breed, intakeDate ? `intake ${intakeDate}` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div>
          <Photo url={match.case.photoUrl} alt={match.case.petName || 'Lost pet'} />
          <p className="text-sm font-semibold text-midnight-900 mt-1.5">
            {match.case.petName || 'Lost pet'} (reported lost)
          </p>
          <p className="text-xs text-midnight-500">
            {[match.case.breed, match.case.coarseArea, reportedAt ? `reported ${reportedAt}` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <VisionChip verdict={match.visualVerdict} />
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => act('dismiss')}
            disabled={Boolean(busy)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-midnight-600 hover:text-midnight-900 border border-midnight-200 rounded-lg px-3 py-1.5 disabled:opacity-50 transition"
          >
            {busy === 'dismiss' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Not a match
          </button>
          <button
            onClick={() => act('confirm')}
            disabled={Boolean(busy)}
            className="inline-flex items-center gap-1.5 text-sm font-bold bg-flash-400 hover:bg-flash-300 text-midnight-900 rounded-lg px-3 py-1.5 disabled:opacity-50 transition"
          >
            {busy === 'confirm' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Confirm and notify the owner
          </button>
        </div>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </div>
    </li>
  );
}

export default function StrayMatches() {
  const router = useRouter();
  const [matches, setMatches] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/shelter/matches')
      .then((r) => (r.ok ? r.json() : { matches: [] }))
      .then((d) => { if (alive) setMatches(d.matches || []); })
      .catch(() => { if (alive) setMatches([]); });
    return () => { alive = false; };
  }, []);

  if (!matches || matches.length === 0) return null;

  const resolved = (id) => {
    setMatches((ms) => ms.filter((m) => m.id !== id));
    router.refresh();
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-midnight-900 mb-1">Possible owner matches</h2>
      <p className="text-sm text-midnight-600 mb-4">
        These lost-pet reports look like animals in your care. Compare the photos; the
        owner is only notified after you confirm.
      </p>
      <ul className="space-y-4">
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} onResolved={resolved} />
        ))}
      </ul>
    </div>
  );
}
