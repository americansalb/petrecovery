import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { isAdmin } from '@/app/lib/authz';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Building2, ArrowLeft, Clock } from 'lucide-react';
import InviteBanner from '../InviteBanner';
import { getShelterForUser } from '@/app/lib/shelterAuth';

// Session-dependent - never statically rendered.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Shelter Dashboard - ReunitePets.org',
  description: 'Manage your shelter on ReunitePets.org.',
};

/**
 * The pre-portal surface. Anyone who actually manages a shelter is
 * redirected into the portal (/my-shelter, its own immersive chrome);
 * this page only ever shows the states BEFORE the hat exists: a seat
 * invite waiting, an application under review, or the pitch to start.
 * Old links (emails, notifications, wizard CTAs) all point here and
 * keep working forever via the redirect.
 */
export default async function ShelterDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/shelter/dashboard');
  }

  const membership = await getShelterForUser(session.user.id, session.user.email);
  if (membership) {
    redirect('/my-shelter');
  }

  // Not on a team yet: surface any waiting seat invite...
  let pendingInvite = null;
  let pendingClaim = null;
  if (session.user.email) {
    const invite = await prisma.shelterMember.findFirst({
      where: {
        status: 'PENDING',
        OR: [{ email: session.user.email.toLowerCase() }, { userId: session.user.id }],
      },
      select: { shelterId: true },
    });
    if (invite) {
      const invitingShelter = await prisma.shelter.findUnique({
        where: { id: invite.shelterId },
        select: { name: true },
      });
      pendingInvite = { shelterName: invitingShelter?.name || 'a shelter' };
    } else {
      // ...or an application still in the review queue.
      const claim = await prisma.shelterClaim.findFirst({
        where: {
          claimantId: session.user.id,
          status: { in: ['PENDING', 'VERIFICATION_SENT', 'UNDER_REVIEW'] },
        },
        orderBy: { createdAt: 'desc' },
        select: { shelterId: true, createdAt: true },
      });
      if (claim) {
        const claimShelter = await prisma.shelter.findUnique({
          where: { id: claim.shelterId },
          select: { name: true },
        });
        pendingClaim = {
          shelterName: claimShelter?.name || 'Your shelter',
          submittedAt: claim.createdAt,
        };
      }
    }
  }

  const admin = await isAdmin(session.user.id);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0a1526] via-midnight-900 to-[#0c1a30] py-16 md:py-20">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[620px] h-[620px] bg-flash-400/15 rounded-full blur-[130px] pointer-events-none" />
        <div className="max-w-3xl mx-auto px-4 text-center relative">
          <span className="inline-flex items-center gap-2 bg-flash-400/10 text-flash-200 px-4 py-2 rounded-full border border-flash-400/25 backdrop-blur-sm text-sm font-medium mb-5">
            <Building2 className="w-4 h-4" /> Shelter portal
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
            Shelter{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-flash-300 via-flash-400 to-amber-300 drop-shadow-[0_0_24px_rgba(250,204,21,0.35)]">
              Portal
            </span>
          </h1>
          <p className="text-midnight-200 text-lg max-w-xl mx-auto">
            {pendingInvite ? 'You have an invitation.' : pendingClaim ? 'Your application is in.' : 'Your shelter portal.'}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-3xl mx-auto px-4 py-14 md:py-16">
        {pendingInvite ? (
          <InviteBanner shelterName={pendingInvite.shelterName} />
        ) : pendingClaim ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 text-center">
            <Clock className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-midnight-900 mb-2">
              {pendingClaim.shelterName} is under review
            </h2>
            <p className="text-midnight-700">
              Submitted {pendingClaim.submittedAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.
              A human reviews every shelter, usually within a day or two. We&rsquo;ll email
              you the moment it&rsquo;s approved and your portal unlocks.
            </p>
          </div>
        ) : admin ? (
          <div className="rounded-2xl border border-midnight-100 bg-white shadow-sm p-6">
            <h2 className="text-xl font-bold text-midnight-900 mb-2">Administrator</h2>
            <p className="text-midnight-700">
              To manage shelters, use the{' '}
              <Link href="/admin" className="font-semibold underline hover:text-flash-700">admin panel</Link>.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-midnight-100 bg-white shadow-sm p-6 text-center">
            <Building2 className="w-10 h-10 text-midnight-300 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-midnight-900 mb-2">You don’t manage a shelter yet</h2>
            <p className="text-midnight-700 mb-5">
              If you run a shelter or rescue, your free account takes about a minute to
              set up: medical records for every animal, lost-pet matching, adoption
              inquiries, accounts for your staff, and a public page. Everything is free.
            </p>
            <Link href="/shelter/start" className="inline-flex items-center gap-2 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold px-5 py-2.5 rounded-xl transition">
              Get your free shelter account
            </Link>
          </div>
        )}

        <div className="mt-10">
          <Link href="/" className="inline-flex items-center gap-2 text-midnight-600 hover:text-midnight-900 font-medium">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
        </div>
      </section>
    </div>
  );
}
