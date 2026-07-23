/**
 * Portal overview: the numbers that matter this morning and the doors
 * into each section. Matches needing review lead, because that's the
 * one task with a worried owner on the other end.
 */

import Link from 'next/link';
import prisma from '@/app/lib/prisma';
import { requirePortal } from './lib';
import {
  PawPrint, Radar, HeartHandshake, Users, Globe2, Plus, ArrowRight, ExternalLink,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PortalOverview() {
  const { session, shelter } = await requirePortal();

  const [inCare, available, pendingMatches, sentHome, teamSize] = await Promise.all([
    prisma.pet.count({ where: { managedByShelterId: shelter.id, isDeleted: false } }),
    prisma.pet.count({
      where: { managedByShelterId: shelter.id, isDeleted: false, shelterStatus: 'AVAILABLE' },
    }),
    prisma.shelterStrayMatch.count({ where: { shelterId: shelter.id, status: 'PENDING' } }),
    prisma.petTransfer.count({ where: { status: 'ACCEPTED', invitedById: session.user.id } }),
    prisma.shelterMember.count({ where: { shelterId: shelter.id, status: 'ACTIVE' } }),
  ]);

  const stats = [
    { label: 'In your care', value: inCare, icon: PawPrint, href: '/my-shelter/animals' },
    { label: 'Available now', value: available, icon: PawPrint, href: '/my-shelter/animals' },
    { label: 'Sent home', value: sentHome, icon: HeartHandshake, href: '/my-shelter/animals' },
    { label: 'Team seats', value: teamSize + 1, icon: Users, href: '/my-shelter/team' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-midnight-900">Good day, {shelter.name}</h1>
          <p className="text-midnight-500">Here&rsquo;s where things stand.</p>
        </div>
        <Link
          href={`/care/start?shelter=${shelter.id}`}
          className="inline-flex items-center gap-2 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold px-4 py-2.5 rounded-xl transition"
        >
          <Plus className="w-4 h-4" /> Add animal
        </Link>
      </div>

      {pendingMatches > 0 && (
        <Link
          href="/my-shelter/matches"
          className="block rounded-2xl border-2 border-flash-400 bg-flash-50 p-5 hover:bg-flash-100 transition"
        >
          <div className="flex items-center gap-4">
            <span className="w-11 h-11 rounded-xl bg-flash-400 flex items-center justify-center shrink-0">
              <Radar className="w-5 h-5 text-midnight-900" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-midnight-900">
                {pendingMatches === 1
                  ? 'One animal in your care may match a lost-pet report'
                  : `${pendingMatches} animals in your care may match lost-pet reports`}
              </p>
              <p className="text-sm text-midnight-600">
                Somewhere, an owner is still searching. Review the photos; they&rsquo;re only
                contacted if you confirm.
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-midnight-400 shrink-0" />
          </div>
        </Link>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href} className="rounded-2xl bg-white border border-midnight-100 shadow-sm p-4 hover:border-flash-300 transition">
            <Icon className="w-5 h-5 text-midnight-400 mb-2" />
            <p className="text-2xl font-black text-midnight-900 tabular-nums">{value}</p>
            <p className="text-sm text-midnight-500">{label}</p>
          </Link>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link href="/my-shelter/site" className="rounded-2xl bg-white border border-midnight-100 shadow-sm p-5 hover:border-flash-300 transition">
          <Globe2 className="w-5 h-5 text-midnight-400 mb-2" />
          <p className="font-bold text-midnight-900 mb-1">Your public page</p>
          <p className="text-sm text-midnight-500">
            Adoptable animals, contact info, and your story, live at your own address.
          </p>
        </Link>
        <a
          href={`/shelters/${shelter.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-2xl bg-white border border-midnight-100 shadow-sm p-5 hover:border-flash-300 transition"
        >
          <ExternalLink className="w-5 h-5 text-midnight-400 mb-2" />
          <p className="font-bold text-midnight-900 mb-1">See it as visitors do</p>
          <p className="text-sm text-midnight-500">Open your live public page in a new tab.</p>
        </a>
      </div>

      <p className="text-xs text-midnight-400">
        Shelter accounts are free. Forever. Every animal you log here is automatically
        checked against local lost-pet reports.
      </p>
    </div>
  );
}
