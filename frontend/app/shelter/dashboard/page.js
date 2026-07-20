import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { isAdmin } from '@/app/lib/authz';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Building2, ArrowLeft, CheckCircle2, ShieldCheck, AlertCircle, Plus, HeartHandshake } from 'lucide-react';
import ShelterRoster from '../ShelterRoster';

// Session-dependent — never statically rendered.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Shelter Dashboard — ReunitePets.org',
  description: 'Manage your shelter on ReunitePets.org.',
};

export default async function ShelterDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/shelter/dashboard');
  }

  // AUTHZ: only ever load the requester's OWN claimed shelter (by claimedById).
  // We never query or expose any other shelter, so no shelter's existence/status
  // can leak to a non-owner. A claimant sees their shelter; an admin sees a
  // generic panel; anyone else sees an honest "you don't manage a shelter".
  const profile = await prisma.shelterProfile.findFirst({
    where: { claimedById: session.user.id },
    select: { shelterId: true },
  });

  let shelter = null;
  let roster = [];
  let sentHome = 0;
  if (profile) {
    shelter = await prisma.shelter.findUnique({
      where: { id: profile.shelterId },
      select: { id: true, name: true, city: true, state: true, isActive: true, isVerified: true },
    });

    // The shelter's animals are full Health Book records tagged to its roster.
    const [pets, adopted] = await Promise.all([
      prisma.pet.findMany({
        where: { managedByShelterId: profile.shelterId, isDeleted: false },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          species: true,
          breed: true,
          primaryPhotoUrl: true,
          transfers: {
            where: { status: 'PENDING' },
            select: { toEmail: true },
            take: 1,
          },
        },
      }),
      // Records that left this roster via an accepted handoff.
      prisma.petTransfer.count({
        where: { status: 'ACCEPTED', invitedById: session.user.id },
      }),
    ]);
    roster = pets.map((p) => ({
      id: p.id,
      name: p.name,
      species: p.species,
      breed: p.breed,
      primaryPhotoUrl: p.primaryPhotoUrl,
      pendingTransferEmail: p.transfers[0]?.toEmail || null,
    }));
    sentHome = adopted;
  }

  const admin = profile ? false : await isAdmin(session.user.id);

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
              Dashboard
            </span>
          </h1>
          <p className="text-midnight-200 text-lg max-w-xl mx-auto">
            {shelter
              ? `Welcome back, ${shelter.name}.`
              : admin
              ? 'Administrator view.'
              : 'Your shelter portal.'}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-3xl mx-auto px-4 py-14 md:py-16">
        {shelter ? (
          <div className="space-y-6">
            {/* Status card — only the owner's own shelter */}
            <div className="rounded-2xl border border-midnight-100 bg-white shadow-sm p-6">
              <h2 className="text-xl font-bold text-midnight-900 mb-4">{shelter.name}</h2>
              <p className="text-midnight-600 mb-5">{shelter.city}, {shelter.state}</p>
              <div className="flex flex-wrap gap-3">
                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${shelter.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  {shelter.isActive ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {shelter.isActive ? 'Active' : 'Pending activation'}
                </span>
                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${shelter.isVerified ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-midnight-50 text-midnight-600 border border-midnight-200'}`}>
                  <ShieldCheck className="w-4 h-4" />
                  {shelter.isVerified ? 'Verified' : 'Verification pending'}
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-flash-50 text-midnight-800 border border-flash-200">
                  {roster.length} in your care
                </span>
                {sentHome > 0 && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <HeartHandshake className="w-4 h-4" /> {sentHome} sent home
                  </span>
                )}
              </div>
            </div>

            {/* Animal roster: the free pet-management account */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-midnight-900">Animals in your care</h2>
                <Link
                  href={`/care/start?shelter=${shelter.id}`}
                  className="inline-flex items-center gap-2 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold px-4 py-2 rounded-xl transition"
                >
                  <Plus className="w-4 h-4" /> Add animal
                </Link>
              </div>
              <ShelterRoster pets={roster} />
              <p className="text-sm text-midnight-500 mt-4">
                Every animal gets a full Health Book: medications, vaccinations, weight
                tracking, and shareable care pages. When an animal is adopted, send the
                record home with the adopter; it arrives with the complete medical
                history attached. Shelter accounts are free. Forever.
              </p>
            </div>
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
              If you run a shelter or rescue, you can claim or request to add it.
              Shelter accounts include free pet management for every animal in your care.
            </p>
            <Link href="/shelter/request" className="inline-flex items-center gap-2 bg-midnight-900 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-midnight-800 transition">
              Add your shelter
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
