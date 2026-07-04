'use client';

/**
 * The pet shell - one house, a visible hallway
 *
 * Every page under a pet shares this header, and identity lives here
 * EXACTLY ONCE: breadcrumb row (with the rest of the family one tap
 * away), then one identity row — photo, name, status, Edit — then the
 * tabs. Rooms below render content only; none of them repeats who the
 * pet is. Switching pets keeps you in the same room (Today to Today),
 * because that is what you meant.
 *
 * Focused flows (edit, the medication wizard) are not rooms on the
 * hallway: they get a quiet context bar (a way back + what you're
 * doing) instead of tabs, and the family switcher steps aside so a
 * mid-edit tap can't silently drop you on another pet's Overview.
 *
 * Pet data is fetched ONCE here via PetProvider; rooms read it from
 * context instead of refetching /api/pets/[id] per tab.
 */

import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Heart, AlertTriangle, Plus, LayoutGrid, Sun, Share2, Pencil,
} from 'lucide-react';
import { ShieldIcon } from '@/app/components/icons/HealthIcons';
import { cn } from '@/components/ui';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import { PetProvider, usePet } from '@/app/components/care/PetProvider';

const TABS = [
  { id: '', label: 'Overview', icon: LayoutGrid },
  { id: 'today', label: 'Today', icon: Sun },
  { id: 'health', label: 'Health Book', icon: ShieldIcon },
  { id: 'share', label: 'Care team', icon: Share2 },
];

// Flows that own the screen: no tabs, no pet switcher, just a way back.
const FOCUSED = {
  edit: { label: 'Editing profile', backLabel: 'Overview', backTo: '' },
  medications: { label: 'Medication', backLabel: 'Health Book', backTo: '/health' },
};

function activeCaseOf(pet) {
  const c = pet?.cases?.[0];
  if (!c) return null;
  if (['REUNITED', 'CLOSED_OTHER', 'RESOLVED'].includes(c.status)) return null;
  return c;
}

function PetShell({ children }) {
  const params = useParams();
  const pathname = usePathname();
  const petId = params.id;
  const { pet, allPets } = usePet();

  // Which room are we in? ('' = overview, 'today', 'health', 'share', 'edit'...)
  const segment = pathname.split('/')[3] || '';
  const focused = FOCUSED[segment];
  const sectionForSwitch = ['today', 'share', 'health'].includes(segment) ? `/${segment}` : '';
  const activeCase = activeCaseOf(pet);

  const detailLine = pet
    ? [
        pet.breed || pet.species,
        pet.age != null && `${pet.age} yr${pet.age !== 1 ? 's' : ''}`,
      ].filter(Boolean).join(' · ')
    : '';

  return (
    /* The care product's warm daylight register, worn by every room —
       not just the Health Book. Rescue surfaces stay midnight. */
    <div className="min-h-screen bg-gradient-to-b from-amber-50/50 via-midnight-50 to-midnight-50 pb-20 lg:pb-0">
      <div className="bg-white border-b border-midnight-100">
        <div className="max-w-4xl mx-auto px-4 pt-4 md:px-8">
          {focused ? (
            /* Context bar: the way back, and what you're doing */
            <div className="flex items-center gap-2 text-sm">
              <Link
                href={`/pets/${petId}${focused.backTo}`}
                className="inline-flex items-center gap-1.5 font-semibold text-midnight-500 hover:text-midnight-800 transition-colors"
              >
                <ArrowLeft size={16} /> {focused.backLabel}
              </Link>
              <span className="text-midnight-300">·</span>
              <span className="font-semibold text-midnight-400">{focused.label}</span>
            </div>
          ) : (
            /* Breadcrumb row: the way out, and the rest of the family */
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
                    href="/care/start"
                    aria-label="Add a pet"
                    title="Add a pet"
                    className="w-8 h-8 rounded-full border-2 border-dashed border-midnight-300 flex items-center justify-center text-midnight-400 hover:border-flash-400 hover:text-flash-500 transition-colors shrink-0"
                  >
                    <Plus size={14} />
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* The identity row: who this is, how they're doing, what you can do */}
          <div className={cn('flex items-center gap-3 pt-4 min-h-[56px]', focused && 'pb-4')}>
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
                  {pet?.name || ' '}
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
            {pet && !focused && (
              <Link
                href={`/pets/${petId}/edit`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-midnight-200 text-midnight-600 text-sm font-bold hover:border-midnight-300 hover:text-midnight-900 transition-colors shrink-0"
              >
                <Pencil size={14} />
                <span className="hidden sm:inline">Edit</span>
              </Link>
            )}
          </div>

          {/* The hallway */}
          {!focused && (
            <nav className="flex gap-1 pt-2 -mb-px overflow-x-auto" aria-label="Pet sections">
              {TABS.map(({ id, label, icon: Icon }) => {
                const href = `/pets/${petId}${id ? `/${id}` : ''}`;
                const active = segment === id;
                return (
                  <Link
                    key={label}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors whitespace-nowrap',
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
          )}
        </div>
      </div>

      {children}
    </div>
  );
}

export default function PetShellLayout({ children }) {
  const params = useParams();
  return (
    <PetProvider petId={params.id}>
      <PetShell>{children}</PetShell>
    </PetProvider>
  );
}
