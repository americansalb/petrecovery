'use client';

/**
 * The pet shell: one identity row and three tabs. Nothing else.
 *
 * The row says whose page this is (photo, name, and a Missing badge
 * only when there is an open case; being home is not news). The tabs
 * are the product's three rooms: Today (act), Health (the record),
 * People (who can see and do what). Identity renders here exactly
 * once; pages render content only.
 *
 * Focused flows (edit, the medication wizard) replace the tabs with a
 * single way back.
 *
 * Pet data is fetched ONCE here via PetProvider; pages read it from
 * context instead of refetching /api/pets/[id] per tab.
 */

import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/components/ui';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import { PetProvider, usePet } from '@/app/components/care/PetProvider';

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'health', label: 'Health' },
  { id: 'share', label: 'People' },
];

// Flows that own the screen: no tabs, just a way back.
const FOCUSED = {
  edit: { backLabel: 'Back', backTo: '/health' },
  medications: { backLabel: 'Back', backTo: '/health' },
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
  const { pet } = usePet();

  const segment = pathname.split('/')[3] || '';
  const focused = FOCUSED[segment];
  const activeCase = activeCaseOf(pet);

  return (
    <div className="min-h-screen bg-white pb-20 lg:pb-10">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6">
        {focused ? (
          <Link
            href={`/pets/${petId}${focused.backTo}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            <ArrowLeft size={15} /> {focused.backLabel}
          </Link>
        ) : (
          <>
            <div className="flex items-center gap-3">
              {pet?.primaryPhotoUrl ? (
                <img src={pet.primaryPhotoUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <span className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400">
                  {pet && <SpeciesIcon species={pet.species} size={20} />}
                </span>
              )}
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900 truncate">
                {pet?.name || ' '}
              </h1>
              {activeCase && (
                <Link
                  href={`/mission-control?mission=${activeCase.caseNumber}`}
                  className="text-[12px] font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5 shrink-0 hover:bg-red-100 transition-colors"
                >
                  Missing
                </Link>
              )}
            </div>

            <nav className="flex gap-6 mt-4 border-b border-neutral-200" aria-label="Pet sections">
              {TABS.map(({ id, label }) => {
                const active = segment === id;
                return (
                  <Link
                    key={id}
                    href={`/pets/${petId}/${id}`}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'py-2.5 -mb-px text-sm font-medium border-b-2 transition-colors',
                      active
                        ? 'text-neutral-900 border-neutral-900'
                        : 'text-neutral-500 border-transparent hover:text-neutral-900'
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </>
        )}
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
