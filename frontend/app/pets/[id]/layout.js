'use client';

/**
 * The pet shell - one house, a visible hallway
 *
 * Every page under a pet (overview, medications, sharing, edit) used
 * to be its own window with its own ad-hoc header and disagreeing
 * back links. This layout is the hallway they all share: breadcrumb,
 * the pet's identity with live status, the family switcher, and three
 * honest tabs. Switching pets keeps you in the same room (meds tab to
 * meds tab), because that is what you meant.
 */

import { useState, useEffect } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, PawPrint, Heart, AlertTriangle, Plus, LayoutGrid, Pill, Share2, Bone } from 'lucide-react';
import { cn } from '@/components/ui';

const SPECIES_EMOJI = { DOG: '🐕', CAT: '🐈', BIRD: '🦜', RABBIT: '🐇', OTHER: '🐾' };

const TABS = [
  { id: '', label: 'Overview', icon: LayoutGrid },
  { id: 'care', label: 'Care', icon: Bone },
  { id: 'medications', label: 'Meds', icon: Pill },
  { id: 'share', label: 'Sharing', icon: Share2 },
];

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

  // Which room are we in? ('' = overview, 'medications', 'share', 'edit'...)
  const segment = pathname.split('/')[3] || '';
  const sectionForSwitch = ['medications', 'share', 'care'].includes(segment) ? `/${segment}` : '';
  const isOverview = segment === '';
  const activeCase = activeCaseOf(pet);

  return (
    <div className="min-h-screen bg-midnight-50">
      <div className="bg-white border-b border-midnight-100">
        <div className="max-w-3xl mx-auto px-4 pt-4 md:px-8">
          <div className="flex items-center justify-between gap-3">
            <Link href="/pets" className="inline-flex items-center gap-1.5 text-sm font-semibold text-midnight-500 hover:text-midnight-800 transition-colors">
              <ArrowLeft size={16} /> My Pets
            </Link>
            {pet && (
              activeCase ? (
                <Link
                  href={`/mission-control?mission=${activeCase.caseNumber}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-bold hover:bg-red-500 transition-colors"
                >
                  <AlertTriangle size={12} />
                  Missing · open mission
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                  <Heart size={12} /> Home
                </span>
              )
            )}
          </div>

          {/* The family, one tap apart, staying in the same room */}
          <div className="flex items-center gap-3 overflow-x-auto pt-4 pb-1 -mx-1 px-1">
            {allPets.map((p) => {
              const current = p.id === petId;
              return (
                <Link
                  key={p.id}
                  href={`/pets/${p.id}${sectionForSwitch}`}
                  className="flex flex-col items-center gap-1 shrink-0 group"
                  aria-current={current ? 'page' : undefined}
                >
                  <span
                    className={cn(
                      'w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-xl bg-midnight-100 transition-all',
                      current
                        ? 'ring-[3px] ring-flash-400 ring-offset-2 ring-offset-white'
                        : 'ring-1 ring-midnight-200 opacity-70 group-hover:opacity-100'
                    )}
                  >
                    {p.primaryPhotoUrl ? (
                      <img src={p.primaryPhotoUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      SPECIES_EMOJI[p.species] || '🐾'
                    )}
                  </span>
                  <span className={cn('text-[10px] font-semibold', current ? 'text-midnight-900' : 'text-midnight-400')}>
                    {p.name}
                  </span>
                </Link>
              );
            })}
            <Link href="/pets/new" className="flex flex-col items-center gap-1 shrink-0 group" aria-label="Add a pet">
              <span className="w-12 h-12 rounded-full border-2 border-dashed border-midnight-300 flex items-center justify-center text-midnight-400 group-hover:border-flash-400 group-hover:text-flash-500 transition-colors">
                <Plus size={18} />
              </span>
              <span className="text-[10px] font-semibold text-midnight-400">Add</span>
            </Link>
          </div>

          {/* The identity strip carries context into the inner rooms;
              the overview's big hero speaks for itself */}
          {!isOverview && pet && (
            <div className="flex items-center gap-2.5 pt-3">
              <span className="w-7 h-7 rounded-full overflow-hidden bg-midnight-100 flex items-center justify-center text-sm shrink-0">
                {pet.primaryPhotoUrl ? (
                  <img src={pet.primaryPhotoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  SPECIES_EMOJI[pet.species] || '🐾'
                )}
              </span>
              <span className="font-bold text-midnight-900">{pet.name}</span>
              <span className="text-xs text-midnight-400 truncate">{pet.breed || pet.species}</span>
            </div>
          )}

          {/* The hallway */}
          <nav className="flex gap-1 pt-3 -mb-px" aria-label="Pet sections">
            {TABS.map(({ id, label, icon: Icon }) => {
              const href = `/pets/${petId}${id ? `/${id}` : ''}`;
              const active = segment === id || (id === 'medications' && segment === 'medications');
              return (
                <Link
                  key={label}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors',
                    active
                      ? 'border-flash-400 text-midnight-900'
                      : 'border-transparent text-midnight-400 hover:text-midnight-700'
                  )}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {children}
    </div>
  );
}
