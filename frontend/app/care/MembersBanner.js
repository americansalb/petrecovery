'use client';

/**
 * Signed-in shortcut on the /care landing.
 *
 * Guests see the marketing pitch below (server-rendered, indexed).
 * Members get routed straight to their pets' Health Books instead of
 * being pitched a product they already have. Renders nothing while
 * logged out or loading, so the public page's SEO is untouched.
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';
import { ShieldIcon } from '@/app/components/icons/HealthIcons';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';

export default function MembersBanner() {
  const { data: session, status } = useSession();
  const [pets, setPets] = useState(null);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/pets')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPets(d?.pets || []))
      .catch(() => setPets([]));
  }, [status]);

  if (status !== 'authenticated') return null;

  const firstName = session?.user?.name || session?.user?.firstName || 'there';

  return (
    <section className="max-w-4xl mx-auto px-4 md:px-8 pt-8">
      <div className="bg-white border border-midnight-100 rounded-3xl p-6 md:p-7">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <ShieldIcon size={22} />
          </span>
          <div className="min-w-0">
            <h2 className="font-bold text-midnight-900 leading-tight">Welcome back, {firstName}.</h2>
            <p className="text-sm text-midnight-500">Open a Health Book, or start one for a new pet.</p>
          </div>
        </div>

        {pets === null ? (
          <div className="h-12 rounded-2xl bg-midnight-50 animate-pulse" />
        ) : pets.length === 0 ? (
          <Link
            href="/pets/new"
            className="inline-flex items-center gap-2 px-5 py-3 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold rounded-2xl transition-colors"
          >
            <Plus size={17} /> Add your first pet
          </Link>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {pets.slice(0, 6).map((p) => (
              <Link
                key={p.id}
                href={`/pets/${p.id}/health`}
                className="group inline-flex items-center gap-2.5 rounded-2xl border-2 border-midnight-200 hover:border-flash-400 pl-2 pr-3.5 py-2 transition-colors"
              >
                <span className="w-8 h-8 rounded-xl overflow-hidden bg-midnight-100 flex items-center justify-center shrink-0">
                  {p.primaryPhotoUrl ? (
                    <img src={p.primaryPhotoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <SpeciesIcon species={p.species} size={18} className="text-midnight-400" />
                  )}
                </span>
                <span className="text-sm font-bold text-midnight-900">{p.name}</span>
                <ArrowRight size={14} className="text-midnight-300 group-hover:text-flash-500 group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
            <Link
              href="/pets/new"
              className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-dashed border-midnight-300 px-3.5 py-2 text-sm font-bold text-midnight-400 hover:border-flash-400 hover:text-flash-500 transition-colors"
            >
              <Plus size={15} /> Add a pet
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
