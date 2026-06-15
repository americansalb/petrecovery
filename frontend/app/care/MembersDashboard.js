'use client';

/**
 * The signed-in face of /care: your pets' Health Books, calm and on the
 * light background (no dark marketing hero to clash with). Each pet is
 * one tap from its Health Book; a new pet starts a fresh one.
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';
import { ShieldIcon } from '@/app/components/icons/HealthIcons';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';

export default function MembersDashboard() {
  const { data: session } = useSession();
  const [pets, setPets] = useState(null);

  useEffect(() => {
    fetch('/api/pets')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPets(d?.pets || []))
      .catch(() => setPets([]));
  }, []);

  const firstName = session?.user?.name || session?.user?.firstName || 'there';

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-12 md:py-16">
      <div className="flex items-center gap-3 mb-8">
        <span className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
          <ShieldIcon size={26} />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-midnight-900 tracking-tight leading-tight">
            Welcome back, {firstName}.
          </h1>
          <p className="text-midnight-500">Your pets&apos; Health Books, one tap away.</p>
        </div>
      </div>

      {pets === null ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 rounded-3xl bg-white border border-midnight-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {pets.map((p) => {
            const detail = [p.breed || p.species, p.weight ? `${p.weight} lb` : null]
              .filter(Boolean)
              .join(' · ');
            return (
              <Link
                key={p.id}
                href={`/pets/${p.id}`}
                className="group flex items-center gap-4 bg-white border border-midnight-100 rounded-3xl p-5 transition-all hover:shadow-lg hover:shadow-midnight-200/50 hover:-translate-y-0.5"
              >
                <span className="w-14 h-14 rounded-2xl overflow-hidden bg-midnight-100 flex items-center justify-center shrink-0">
                  {p.primaryPhotoUrl ? (
                    <img src={p.primaryPhotoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <SpeciesIcon species={p.species} size={28} className="text-midnight-400" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-midnight-900 truncate">{p.name}</p>
                  <p className="text-sm text-midnight-400 truncate">{detail}</p>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 text-sm font-bold text-midnight-400 group-hover:text-flash-600 transition-colors">
                  Open
                  <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                </span>
              </Link>
            );
          })}

          <Link
            href="/pets/new"
            className="flex items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-midnight-200 p-5 text-midnight-400 font-bold hover:border-flash-400 hover:text-flash-500 transition-colors"
          >
            <Plus size={18} /> Add a pet
          </Link>
        </div>
      )}

      <p className="text-center text-xs text-midnight-400 mt-10">
        A record you keep, not medical advice. Your vet&apos;s guidance comes first.
      </p>
    </div>
  );
}
