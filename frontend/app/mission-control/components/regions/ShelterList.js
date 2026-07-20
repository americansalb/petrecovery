'use client';

/**
 * ShelterList - real places to call, sorted by distance
 *
 * Fed by usePOIs (live shelters, vets, animal control near the last
 * seen point). Calling shelters early is one of the highest-value
 * moves in a lost pet search; checked-off calls persist per mission
 * on this device.
 */

import { useState, useEffect } from 'react';
import { Phone, Check, ExternalLink, Building2 } from 'lucide-react';

const TYPE_LABEL = {
  SHELTER: 'Shelter',
  RESCUE: 'Rescue',
  VET: 'Vet',
  ANIMAL_CONTROL: 'Animal control',
};

export default function ShelterList({ pois = [], missionId, isLoading = false }) {
  const calledKey = missionId ? `mc_called_${missionId}` : null;
  const [called, setCalled] = useState({});

  useEffect(() => {
    if (!calledKey) return;
    try {
      setCalled(JSON.parse(localStorage.getItem(calledKey) || '{}'));
    } catch (e) {}
  }, [calledKey]);

  const markCalled = (id) => {
    setCalled((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        if (calledKey) localStorage.setItem(calledKey, JSON.stringify(next));
        // Let the HelpChecklist's "X of Y called" progress update live
        window.dispatchEvent(new CustomEvent('mc:actions'));
      } catch (e) {}
      return next;
    });
  };

  if (isLoading && pois.length === 0) {
    return <p className="text-sm text-slate-500 py-3 text-center">Finding shelters near the last seen spot...</p>;
  }
  if (pois.length === 0) {
    return <p className="text-sm text-slate-500 py-3 text-center">No shelters found within 10 miles.</p>;
  }

  return (
    <ul className="space-y-2">
      {pois.map((poi) => {
        const done = !!called[poi.id || poi.name];
        const key = poi.id || poi.name;
        return (
          <li
            key={key}
            className={`rounded-2xl border-2 p-3 transition ${done ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-800 bg-slate-900'}`}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => markCalled(key)}
                aria-label={done ? 'Mark as not called' : 'Mark as called'}
                className={`shrink-0 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition ${done ? 'bg-emerald-500 border-emerald-500 text-midnight-950' : 'border-slate-600 text-transparent hover:border-slate-400'}`}
              >
                <Check size={15} strokeWidth={3} />
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${done ? 'text-emerald-300 line-through decoration-emerald-500/50' : 'text-white'}`}>
                  {poi.name}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {TYPE_LABEL[poi.type?.toUpperCase()] || 'Shelter'}
                  {poi.distance != null && ` · ${poi.distance} mi`}
                  {poi.address && ` · ${poi.address}`}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {poi.phone && (
                  <a
                    href={`tel:${poi.phone}`}
                    onClick={() => !done && markCalled(key)}
                    aria-label={`Call ${poi.name}`}
                    className="w-9 h-9 rounded-xl bg-flash-400 text-midnight-950 flex items-center justify-center hover:bg-flash-300 transition"
                  >
                    <Phone size={16} />
                  </a>
                )}
                {poi.latitude && poi.longitude && (
                  <a
                    href={`https://maps.google.com/?q=${poi.latitude},${poi.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${poi.name} in maps`}
                    className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center hover:text-white transition"
                  >
                    <ExternalLink size={15} />
                  </a>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ShelterEmptyIcon() {
  return <Building2 size={18} />;
}
