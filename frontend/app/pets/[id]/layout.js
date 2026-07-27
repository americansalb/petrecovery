'use client';

/**
 * The pet shell (direction D, clinical-lux).
 *
 * The global universal navbar (lib/navChrome.js) is untouched. Below it,
 * the pet section is a page-level layout: a persistent LEFT NAV RAIL on
 * desktop (pet identity + the five rooms + pet switcher) that becomes a
 * horizontal tab strip on mobile. The five rooms:
 *   Today · Meds · Health · Profile · People
 * Each room owns its content (and its own subtabs); identity + nav render
 * here exactly once. Focused flows (edit, the medication wizard) drop the
 * rail for a single way back.
 *
 * Pet data is fetched ONCE via PetProvider; rooms read it from context.
 */

import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Home, Pill, Activity, User, Users, PawPrint } from 'lucide-react';
import { cn } from '@/components/ui';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import { PetProvider, usePet } from '@/app/components/care/PetProvider';

const TABS = [
  { id: 'today', label: 'Today', icon: Home },
  { id: 'meds', label: 'Meds', icon: Pill },
  { id: 'health', label: 'Health', icon: Activity },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'share', label: 'People', icon: Users },
];

const FOCUSED = {
  edit: { backLabel: 'Back', backTo: '/profile' },
  medications: { backLabel: 'Back', backTo: '/meds' },
};

function activeCaseOf(pet) {
  const c = pet?.cases?.[0];
  if (!c) return null;
  if (['REUNITED', 'CLOSED_OTHER', 'RESOLVED'].includes(c.status)) return null;
  return c;
}

function initials(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

function PetIdentity({ pet }) {
  return (
    <div className="flex items-center gap-3">
      <span className="relative w-11 h-11 rounded-full shrink-0 bg-gradient-to-br from-[#f1f6f4] to-[#e7efec] ring-1 ring-care-tealRing flex items-center justify-center overflow-hidden">
        {pet?.primaryPhotoUrl ? (
          <img src={pet.primaryPhotoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="font-serif text-[19px] font-semibold text-care-teal">{initials(pet?.name)}</span>
        )}
      </span>
      <div className="min-w-0">
        <p className="text-[17px] font-semibold tracking-tight text-care-ink leading-tight truncate">{pet?.name || ' '}</p>
        {pet && (
          <p className="text-[11.5px] text-care-sub truncate">
            {[pet.breed || pet.species, pet.age != null && `${pet.age} yr${pet.age !== 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * The pet couldn't be loaded: a bad or stale link, a deleted pet, or one
 * this account can't see. Every room reads the same pet from context, so a
 * single guard here stops any of them from spinning forever (Profile) or
 * presenting a phantom pet — an "empty" Health record inviting a first
 * vaccine, a People page offering to share a pet that doesn't exist.
 */
function PetUnavailable() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-4 flex w-14 h-14 items-center justify-center rounded-full bg-care-bg ring-1 ring-care-line">
          <PawPrint size={24} className="text-care-faint" strokeWidth={1.8} />
        </span>
        <h1 className="text-[19px] font-semibold text-care-ink">This pet isn't available</h1>
        <p className="mt-2 text-[14px] text-care-sub">
          It may have been removed, or you may not have access. Check the link, or head back to your pets.
        </p>
        <Link
          href="/pets"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-care-teal px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-care-tealDark transition-colors"
        >
          <ArrowLeft size={16} /> Back to my pets
        </Link>
      </div>
    </div>
  );
}

function PetShell({ children }) {
  const params = useParams();
  const pathname = usePathname();
  const petId = params.id;
  const { pet, allPets, loading, error } = usePet();

  // Once the fetch settles with no usable pet, never render a room around it.
  if (!loading && (error || !pet)) return <PetUnavailable />;

  const segment = pathname.split('/')[3] || 'today';
  const focused = FOCUSED[segment];
  const activeCase = activeCaseOf(pet);

  if (focused) {
    return (
      <div className="min-h-screen bg-care-bg">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6">
          <Link
            href={`/pets/${petId}${focused.backTo}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-care-sub hover:text-care-ink transition-colors"
          >
            <ArrowLeft size={15} /> {focused.backLabel}
          </Link>
        </div>
        {children}
      </div>
    );
  }

  const tabHref = (id) => `/pets/${petId}/${id}`;

  return (
    <div className="min-h-screen bg-care-bg">
      <div className="lg:grid lg:grid-cols-[240px_1fr] max-w-[1240px] mx-auto">
        {/* LEFT NAV RAIL — desktop */}
        <aside className="hidden lg:flex flex-col gap-6 px-5 py-7 border-r border-care-line bg-care-surface min-h-[calc(100vh-4rem)]">
          <PetIdentity pet={pet} />

          {activeCase && (
            <Link
              href={`/mission-control?mission=${activeCase.caseNumber}`}
              className="flex items-center gap-2 text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 hover:bg-red-100 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> {pet?.name} is missing
            </Link>
          )}

          <nav className="flex flex-col gap-0.5" aria-label="Pet sections">
            <p className="px-2 pb-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-care-faint">Menu</p>
            {TABS.map(({ id, label, icon: Icon }) => {
              const on = segment === id;
              return (
                <Link
                  key={id}
                  href={tabHref(id)}
                  aria-current={on ? 'page' : undefined}
                  className={cn(
                    'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-colors',
                    on ? 'bg-care-tealWash text-care-teal font-semibold' : 'text-care-sub hover:text-care-ink hover:bg-care-bg'
                  )}
                >
                  {on && <span className="absolute -left-5 top-2.5 bottom-2.5 w-[3px] rounded-r bg-care-teal" />}
                  <Icon size={18} strokeWidth={1.9} />
                  {label}
                </Link>
              );
            })}
          </nav>

          {allPets.length > 1 && (
            <div className="pt-5 border-t border-care-line">
              <p className="px-2 pb-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-care-faint">Pets</p>
              {allPets.map((p) => {
                const on = p.id === petId;
                return (
                  <Link
                    key={p.id}
                    href={`/pets/${p.id}/${segment}`}
                    className={cn('flex items-center gap-3 px-2.5 py-2 rounded-xl', on ? 'bg-care-bg ring-1 ring-care-tealRing' : 'hover:bg-care-bg')}
                  >
                    <span className="w-7 h-7 rounded-full shrink-0 bg-gradient-to-br from-[#f1f6f4] to-[#e7efec] ring-1 ring-care-tealRing flex items-center justify-center overflow-hidden">
                      {p.primaryPhotoUrl ? <img src={p.primaryPhotoUrl} alt="" className="w-full h-full object-cover" /> : <span className="font-serif text-[13px] font-semibold text-care-teal">{initials(p.name)}</span>}
                    </span>
                    <span className="text-[13px] font-semibold text-care-ink truncate">{p.name}</span>
                    {activeCaseOf(p) && (
                      <span className="ml-auto w-2 h-2 rounded-full bg-red-500 shrink-0" title={`${p.name} is missing`} aria-label={`${p.name} is missing`} />
                    )}
                  </Link>
                );
              })}
            </div>
          )}

          <Link href="/pets" className="mt-auto text-[12px] font-medium text-care-sub hover:text-care-ink transition-colors">
            All pets
          </Link>
        </aside>

        {/* MOBILE: identity + horizontal tab strip */}
        <div className="lg:hidden px-4 sm:px-6 pt-5 bg-care-surface border-b border-care-line">
          <PetIdentity pet={pet} />
          {activeCase && (
            <Link href={`/mission-control?mission=${activeCase.caseNumber}`} className="inline-flex items-center gap-1.5 mt-3 text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Missing
            </Link>
          )}
          {/* Wrap instead of overflow: on a 320px screen "People" was clipped
              off the right edge with no scroll affordance at all. */}
          <nav className="flex flex-wrap gap-x-5 mt-3 -mb-px" aria-label="Pet sections">
            {TABS.map(({ id, label }) => {
              const on = segment === id;
              return (
                <Link
                  key={id}
                  href={tabHref(id)}
                  aria-current={on ? 'page' : undefined}
                  className={cn('py-2.5 text-[13.5px] font-medium border-b-2 whitespace-nowrap transition-colors', on ? 'text-care-teal border-care-teal' : 'text-care-sub border-transparent')}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <main className="min-w-0 pb-24 lg:pb-10">{children}</main>
      </div>
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
