'use client';

/**
 * The pet shell — the cover of the book.
 *
 * The care product's world is the Paper Passport: cream paper, ink,
 * stamps (app/components/care/paper/Paper.js). This layout is the
 * book's cover and identity plate — polaroid photo, the pet's name in
 * the diary hand, a rubber-stamped status — with the rooms below as
 * physical index tabs. Identity lives here EXACTLY ONCE; rooms render
 * page content only.
 *
 * Focused flows (edit, the medication wizard) are not tabs: they get a
 * quiet mono context bar (a way back + what you're doing) and the
 * family switcher steps aside.
 *
 * Pet data is fetched ONCE here via PetProvider; rooms read it from
 * context instead of refetching /api/pets/[id] per tab.
 */

import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Pencil } from 'lucide-react';
import { cn } from '@/components/ui';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import { PetProvider, usePet } from '@/app/components/care/PetProvider';
import { PaperScaffold, Polaroid, IndexTabs, StampText } from '@/app/components/care/paper/Paper';

const TABS = [
  { id: '', label: 'Overview' },
  { id: 'today', label: 'Today' },
  { id: 'health', label: 'Health Book' },
  { id: 'share', label: 'Care team' },
];

// Flows that own the screen: no tabs, no pet switcher, just a way back.
const FOCUSED = {
  edit: { label: 'Editing the profile', backLabel: 'Overview', backTo: '' },
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
    <PaperScaffold className="pb-20 lg:pb-10">
      <div className="max-w-4xl mx-auto px-4 md:px-8 pt-5">
        {focused ? (
          /* Context bar: the way back, and what you're doing — in mono ink */
          <div className="flex items-center gap-2">
            <Link
              href={`/pets/${petId}${focused.backTo}`}
              className="inline-flex items-center gap-1.5 font-stamp text-[10.5px] uppercase tracking-[0.14em] text-pen-600 hover:text-pen-900 transition-colors"
            >
              <ArrowLeft size={13} /> {focused.backLabel}
            </Link>
            <span className="text-pen-300">·</span>
            <span className="font-stamp text-[10.5px] uppercase tracking-[0.14em] text-pen-400">{focused.label}</span>
          </div>
        ) : (
          /* Breadcrumb row: the way out, and the rest of the family as
             little polaroids clipped to the top of the cover */
          <div className="flex items-center justify-between gap-3">
            <Link href="/pets" className="inline-flex items-center gap-1.5 font-stamp text-[10.5px] uppercase tracking-[0.14em] text-pen-600 hover:text-pen-900 transition-colors">
              <ArrowLeft size={13} /> My Pets
            </Link>
            {allPets.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pt-1.5 pr-1">
                {allPets.map((p, i) => {
                  const current = p.id === petId;
                  return (
                    <Link
                      key={p.id}
                      href={`/pets/${p.id}${sectionForSwitch}`}
                      title={p.name}
                      aria-current={current ? 'page' : undefined}
                      aria-label={current ? `${p.name} (current)` : `Switch to ${p.name}`}
                      className={cn(
                        'block w-8 h-8 bg-white p-[2px] shadow-[0_2px_6px_rgba(35,42,61,0.25)] shrink-0 transition-all',
                        current ? 'ring-2 ring-stampred' : 'opacity-60 hover:opacity-100'
                      )}
                      style={{ transform: `rotate(${i % 2 ? 3 : -3}deg)` }}
                    >
                      {p.primaryPhotoUrl ? (
                        <img src={p.primaryPhotoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="w-full h-full flex items-center justify-center bg-paper-200">
                          <SpeciesIcon species={p.species} size={16} className="text-pen-400" />
                        </span>
                      )}
                    </Link>
                  );
                })}
                <Link
                  href="/care/start"
                  aria-label="Add a pet"
                  title="Add a pet"
                  className="w-8 h-8 border-[1.5px] border-dashed border-pen-300 flex items-center justify-center text-pen-400 hover:border-stampred hover:text-stampred transition-colors shrink-0"
                >
                  <Plus size={13} />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* The identity plate: who this book belongs to */}
        <div className={cn('flex items-center gap-4 pt-4', focused ? 'pb-4' : 'pb-1')}>
          <Polaroid
            src={pet?.primaryPhotoUrl}
            alt={pet?.name || ''}
            fallback={pet && <SpeciesIcon species={pet.species} size={30} />}
            size="sm"
            rotate={-3}
            className="shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-diary italic text-[30px] leading-none text-pen-900 truncate">
                {pet?.name || ' '}
              </h1>
              {pet && (
                activeCase ? (
                  <Link href={`/mission-control?mission=${activeCase.caseNumber}`} className="shrink-0">
                    <StampText tone="red" rotate={-4}>Missing · open mission</StampText>
                  </Link>
                ) : (
                  <StampText tone="green" rotate={-4} size="sm">Home</StampText>
                )
              )}
            </div>
            {detailLine && (
              <p className="font-stamp text-[9.5px] uppercase tracking-[0.16em] text-pen-400 truncate mt-1.5">{detailLine}</p>
            )}
          </div>
          {pet && !focused && (
            <Link
              href={`/pets/${petId}/edit`}
              className="inline-flex items-center gap-1.5 font-stamp text-[10px] uppercase tracking-[0.12em] border-[1.5px] border-pen-900 text-pen-900 rounded-[4px] px-3 py-2 hover:bg-pen-900 hover:text-paper-50 transition-colors shrink-0"
            >
              <Pencil size={12} />
              <span className="hidden sm:inline">Edit</span>
            </Link>
          )}
        </div>

        {/* The hallway: index tabs standing on the page's top rule */}
        {!focused && (
          <div className="border-b-2 border-pen-900 mt-2">
            <IndexTabs
              activeId={segment}
              tabs={TABS.map(({ id, label }) => ({ id, label, href: `/pets/${petId}${id ? `/${id}` : ''}` }))}
            />
          </div>
        )}
      </div>

      {children}
    </PaperScaffold>
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
