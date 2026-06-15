'use client';

/**
 * The pet shell - identity, exactly once.
 *
 * Every page under a pet shares this header. It carries the way out
 * (breadcrumb), the rest of the family (the avatar switcher), and one
 * identity row: photo, name, status, and the two whole-pet actions
 * (Edit, Share). The dashboard below owns the content and its own
 * section nav, so nothing here repeats who the pet is.
 */

import { useState, useEffect } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Heart, AlertTriangle, Plus, Share2, Pencil,
} from 'lucide-react';
import { cn } from '@/components/ui';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';

function activeCaseOf(pet) {
  const c = pet?.cases?.[0];
  if (!c) return null;
  if (['REUNITED', 'CLOSED_OTHER', 'RESOLVED'].includes(c.status)) return null;
  return c;
}

export default function PetShellLayout({ children }) {
  const params = useParams();
  const pathname = usePathname();
  const petId = params.id;

  const [pet, setPet] = useState(null);
  const [allPets, setAllPets] = useState([]);

  useEffect(() => {
    if (!petId) return;
    let alive = true;
    fetch(`/api/pets/${petId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (alive && data) setPet(data.pet || data); })
      .catch(() => {});
    fetch('/api/pets')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (alive && data?.pets) setAllPets(data.pets); })
      .catch(() => {});
    return () => { alive = false; };
  }, [petId]);

  // Switching pets keeps you in Sharing if that is where you are; everything
  // else (the dashboard, edit) lands on the other pet's dashboard.
  const segment = pathname.split('/')[3] || '';
  const sectionForSwitch = segment === 'share' ? '/share' : '';
  const activeCase = activeCaseOf(pet);

  const detailLine = pet
    ? [
        pet.breed || pet.species,
        pet.age != null && `${pet.age} yr${pet.age !== 1 ? 's' : ''}`,
      ].filter(Boolean).join(' · ')
    : '';

  return (
    <div className="min-h-screen bg-midnight-50">
      <div className="bg-white border-b border-midnight-100">
        <div className="max-w-4xl mx-auto px-4 pt-4 pb-4 md:px-8">
          {/* Breadcrumb row: the way out, and the rest of the family */}
          <div className="flex items-center justify-between gap-3">
            <Link href="/pets" className="inline-flex items-center gap-1.5 text-sm font-semibold text-midnight-500 hover:text-midnight-800 transition-colors">
              <ArrowLeft size={16} /> My Pets
            </Link>
            {allPets.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {allPets.map((p) => {
                  const current = p.id === petId;
                  return (
                    <Link
                      key={p.id}
                      href={`/pets/${p.id}${sectionForSwitch}`}
                      title={p.name}
                      aria-current={current ? 'page' : undefined}
                      aria-label={current ? `${p.name} (current)` : `Switch to ${p.name}`}
                      className={cn(
                        'w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-base bg-midnight-100 shrink-0 transition-all',
                        current
                          ? 'ring-2 ring-flash-400 ring-offset-1 ring-offset-white'
                          : 'ring-1 ring-midnight-200 opacity-60 hover:opacity-100'
                      )}
                    >
                      {p.primaryPhotoUrl ? (
                        <img src={p.primaryPhotoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <SpeciesIcon species={p.species} size={18} className="text-midnight-400" />
                      )}
                    </Link>
                  );
                })}
                <Link
                  href="/pets/new"
                  aria-label="Add a pet"
                  title="Add a pet"
                  className="w-8 h-8 rounded-full border-2 border-dashed border-midnight-300 flex items-center justify-center text-midnight-400 hover:border-flash-400 hover:text-flash-500 transition-colors shrink-0"
                >
                  <Plus size={14} />
                </Link>
              </div>
            )}
          </div>

          {/* The identity row: who this is, how they're doing, what you can do */}
          <div className="flex items-center gap-3 pt-4 min-h-[56px]">
            <span className="w-12 h-12 rounded-2xl overflow-hidden bg-midnight-100 flex items-center justify-center text-2xl shrink-0">
              {pet?.primaryPhotoUrl ? (
                <img src={pet.primaryPhotoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                pet && <SpeciesIcon species={pet.species} size={26} className="text-midnight-400" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-midnight-900 truncate leading-tight">
                  {pet?.name || ' '}
                </h1>
                {pet && (
                  activeCase ? (
                    <Link
                      href={`/mission-control?mission=${activeCase.caseNumber}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-[11px] font-bold hover:bg-red-500 transition-colors"
                    >
                      <AlertTriangle size={11} />
                      Missing · open mission
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                      <Heart size={11} /> Home
                    </span>
                  )
                )}
              </div>
              {detailLine && <p className="text-xs text-midnight-400 truncate mt-0.5">{detailLine}</p>}
            </div>
            {pet && (
              <div className="flex items-center gap-1.5 shrink-0">
                <Link
                  href={`/pets/${petId}/edit`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-midnight-200 text-midnight-600 text-sm font-bold hover:border-midnight-300 hover:text-midnight-900 transition-colors"
                >
                  <Pencil size={14} />
                  <span className="hidden sm:inline">Edit</span>
                </Link>
                <Link
                  href={`/pets/${petId}/share`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-midnight-200 text-midnight-600 text-sm font-bold hover:border-midnight-300 hover:text-midnight-900 transition-colors"
                >
                  <Share2 size={14} />
                  <span className="hidden sm:inline">Share</span>
                </Link>
              </div>
            )}
          </div>

        </div>
      </div>

      {children}
    </div>
  );
}
