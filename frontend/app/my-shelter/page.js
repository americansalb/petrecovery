/**
 * Portal overview: a working desk, not a tile garden. The animals ARE
 * the content: a live in-care list with days-in-care, the match queue
 * when there is one, and the state of the public page. Numbers appear
 * inline in sentences and strips, never as icon-number-label cards.
 */

import Link from 'next/link';
import prisma from '@/app/lib/prisma';
import { requirePortal } from './lib';
import { SHELTER_STATUS_LABELS } from '@/app/lib/shelterStatuses';
import { PawPrint, Plus, ArrowRight, ArrowUpRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_DOT = {
  AVAILABLE: 'bg-emerald-500',
  ADOPTION_PENDING: 'bg-amber-500',
  ADOPTED: 'bg-blue-500',
  RECLAIMED: 'bg-violet-500',
};

function daysIn(date) {
  if (!date) return null;
  const d = Math.floor((Date.now() - new Date(date).getTime()) / 86400e3);
  return d < 0 ? 0 : d;
}

export default async function PortalOverview() {
  const { session, shelter } = await requirePortal();

  const [animals, pendingMatches, sentHome, team] = await Promise.all([
    prisma.pet.findMany({
      where: { managedByShelterId: shelter.id, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, species: true, breed: true, primaryPhotoUrl: true,
        shelterStatus: true, intakeDate: true, createdAt: true,
      },
    }),
    prisma.shelterStrayMatch.count({ where: { shelterId: shelter.id, status: 'PENDING' } }),
    prisma.petTransfer.count({ where: { status: 'ACCEPTED', invitedById: session.user.id } }),
    prisma.shelterMember.count({ where: { shelterId: shelter.id, status: 'ACTIVE' } }),
  ]);

  const available = animals.filter((a) => a.shelterStatus === 'AVAILABLE').length;
  const showingOnPage = animals.filter((a) =>
    ['AVAILABLE', 'ADOPTION_PENDING'].includes(a.shelterStatus)
  ).length;

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  // The digest reads like a person wrote it about this morning
  const digestParts = [
    `${animals.length} ${animals.length === 1 ? 'animal' : 'animals'} in care`,
    `${available} ready for adoption`,
  ];
  if (sentHome > 0) digestParts.push(`${sentHome} sent home so far`);

  return (
    <div>
      {/* Header: date, name, the day in one sentence */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-midnight-400">{today}</p>
          <h1 className="text-[26px] leading-tight font-black text-midnight-900 mt-0.5">{shelter.name}</h1>
          <p className="text-[15px] text-midnight-500 mt-1">{digestParts.join(' · ')}</p>
        </div>
        <Link
          href={`/care/start?shelter=${shelter.id}`}
          className="inline-flex items-center gap-2 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold px-4 py-2.5 rounded-xl transition"
        >
          <Plus className="w-4 h-4" /> Add animal
        </Link>
      </div>

      {/* The one urgent thing, when it exists */}
      {pendingMatches > 0 && (
        <Link
          href="/my-shelter/matches"
          className="mt-6 flex items-center gap-4 rounded-xl border border-midnight-100 border-l-4 border-l-flash-400 bg-white px-5 py-4 hover:bg-flash-50/50 transition group"
        >
          <div className="flex-1 min-w-0">
            <p className="font-bold text-midnight-900">
              {pendingMatches === 1
                ? 'A lost-pet report may match one of your animals'
                : `${pendingMatches} lost-pet reports may match your animals`}
            </p>
            <p className="text-sm text-midnight-500">
              Someone is still searching. Compare the photos; they&rsquo;re only contacted if you confirm.
            </p>
          </div>
          <span className="text-sm font-bold text-midnight-900 inline-flex items-center gap-1.5 shrink-0 group-hover:gap-2.5 transition-all">
            Review <ArrowRight className="w-4 h-4" />
          </span>
        </Link>
      )}

      <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-8 space-y-8 lg:space-y-0">
        {/* ---------------- In your care ---------------- */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-midnight-400">In your care</h2>
            <Link href="/my-shelter/animals" className="text-sm font-semibold text-midnight-600 hover:text-midnight-900 transition">
              Manage all
            </Link>
          </div>

          {animals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-midnight-200 bg-white px-6 py-10 text-center">
              <PawPrint className="w-8 h-8 text-midnight-300 mx-auto mb-2" />
              <p className="font-bold text-midnight-900">No animals yet</p>
              <p className="text-sm text-midnight-500 mt-1">
                Add your first and it gets a complete health record on the spot.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-midnight-100 bg-white divide-y divide-midnight-100 overflow-hidden">
              {animals.slice(0, 6).map((a) => {
                const days = daysIn(a.intakeDate || a.createdAt);
                return (
                  <Link
                    key={a.id}
                    href={`/pets/${a.id}/today`}
                    className="flex items-center gap-3.5 px-4 py-3 hover:bg-slate-50 transition"
                  >
                    {a.primaryPhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.primaryPhotoUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    ) : (
                      <span className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        <PawPrint className="w-4.5 h-4.5 w-[18px] h-[18px] text-midnight-300" />
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-midnight-900 text-[15px] leading-tight truncate">{a.name}</p>
                      <p className="text-[13px] text-midnight-400 truncate">{a.breed || a.species.toLowerCase()}</p>
                    </div>
                    {a.shelterStatus && (
                      <span className="hidden sm:inline-flex items-center gap-1.5 text-[13px] font-medium text-midnight-600 shrink-0">
                        <i className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[a.shelterStatus] || 'bg-midnight-300'}`} />
                        {SHELTER_STATUS_LABELS[a.shelterStatus]}
                      </span>
                    )}
                    {days !== null && (
                      <span className="text-[13px] text-midnight-400 tabular-nums text-right shrink-0 whitespace-nowrap">
                        {days === 0 ? 'today' : `${days}d in care`}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* ---------------- Right rail ---------------- */}
        <aside className="space-y-6">
          <section>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-midnight-400 mb-3">Your public page</h2>
            <div className="rounded-xl border border-midnight-100 bg-white p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-midnight-900">
                <i className={`w-1.5 h-1.5 rounded-full ${shelter.isActive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {shelter.isActive ? 'Live' : 'Pending activation'}
              </p>
              <p className="text-[13px] text-midnight-400 mt-1 truncate">reunitepets.org/shelters/{shelter.id.slice(0, 8)}…</p>
              <p className="text-[13px] text-midnight-500 mt-2">
                {showingOnPage === 0
                  ? 'No animals showing yet; mark one Available.'
                  : `${showingOnPage} ${showingOnPage === 1 ? 'animal' : 'animals'} showing to adopters.`}
              </p>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-midnight-100">
                <a
                  href={`/shelters/${shelter.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-bold text-midnight-900 hover:text-flash-600 transition"
                >
                  Open <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
                {/* the global 44px tap-target rule top-aligns block links;
                    inline-flex + items-center keeps the text on Open's line */}
                <Link href="/my-shelter/site" className="inline-flex items-center text-sm font-semibold text-midnight-500 hover:text-midnight-900 transition">
                  Edit
                </Link>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-midnight-400 mb-3">Team</h2>
            <div className="rounded-xl border border-midnight-100 bg-white p-4">
              <p className="text-sm text-midnight-600">
                {team === 0
                  ? 'Just you so far.'
                  : `You and ${team} ${team === 1 ? 'teammate' : 'teammates'}.`}
              </p>
              <Link href="/my-shelter/team" className="inline-flex items-center gap-1 text-sm font-bold text-midnight-900 hover:text-flash-600 transition mt-2">
                {team === 0 ? 'Invite your team' : 'Manage seats'} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>

          <p className="text-[12px] leading-relaxed text-midnight-400">
            Free forever. Every stray you log is checked against local lost-pet reports
            automatically.
          </p>
        </aside>
      </div>
    </div>
  );
}
