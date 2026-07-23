/**
 * Public shelter page: the shelter's own corner of the site, editable
 * from its dashboard. Server-rendered with ONE client island (the
 * inquiry form), zero external dependencies, so it can't break for
 * shelters that have no way to run a website. Only active, CLAIMED
 * shelters get a page (unclaimed directory entries 404, non-probeable).
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Building2, MapPin, Phone, Mail, Globe, PawPrint, ShieldCheck, Search,
} from 'lucide-react';
import { getPublicShelter } from '@/app/lib/shelterPublic';
import { shelterShareMetadata, genericShareMetadata } from '@/app/lib/shareMetadata';
import { SHELTER_STATUS_LABELS } from '@/app/lib/shelterStatuses';
import InquirySection from './InquirySection';

export const dynamic = 'force-dynamic';

const SPECIES_LABEL = { DOG: 'Dog', CAT: 'Cat', BIRD: 'Bird', RABBIT: 'Rabbit', OTHER: 'Pet' };
const SEX_LABEL = { MALE: 'Male', FEMALE: 'Female' };

export async function generateMetadata({ params }) {
  const data = await getPublicShelter(params.id);
  if (!data) return genericShareMetadata();
  return shelterShareMetadata(data.shelter, data.profile, {
    canonicalPath: `/shelters/${data.shelter.id}`,
  });
}

function animalSubtitle(a) {
  return [
    SPECIES_LABEL[a.species] || 'Pet',
    a.breed,
    a.age != null ? `${a.age} yr${a.age === 1 ? '' : 's'}` : null,
    SEX_LABEL[a.sex] || null,
  ].filter(Boolean).join(' · ');
}

export default async function PublicShelterPage({ params }) {
  const data = await getPublicShelter(params.id);
  if (!data) notFound();
  const { shelter, profile, animals } = data;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Cover band */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0a1526] via-midnight-900 to-[#0c1a30]">
        {profile.coverPhotoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.coverPhotoUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
        )}
        <div className="relative max-w-4xl mx-auto px-4 py-16 md:py-20 text-center">
          {profile.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.logoUrl}
              alt={`${shelter.name} logo`}
              className="w-24 h-24 rounded-2xl object-cover mx-auto mb-5 border-4 border-white/20 bg-white"
            />
          ) : (
            <span className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-flash-400/10 border border-flash-400/25 mb-5">
              <Building2 className="w-10 h-10 text-flash-300" />
            </span>
          )}
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3 tracking-tight">{shelter.name}</h1>
          <p className="text-midnight-200 text-lg inline-flex items-center gap-2">
            <MapPin className="w-4 h-4" /> {shelter.city}, {shelter.state}
            {shelter.isVerified && (
              <span className="inline-flex items-center gap-1 text-sm text-blue-200 ml-2">
                <ShieldCheck className="w-4 h-4" /> Verified
              </span>
            )}
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-12 md:py-14 space-y-10">
        {/* About */}
        {(profile.mission || profile.about) && (
          <div className="rounded-2xl border border-midnight-100 bg-white shadow-sm p-6">
            {profile.mission && (
              <p className="text-lg font-semibold text-midnight-900 mb-3">{profile.mission}</p>
            )}
            {profile.about && (
              <p className="text-midnight-700 whitespace-pre-line">{profile.about}</p>
            )}
          </div>
        )}

        {/* Contact */}
        <div className="rounded-2xl border border-midnight-100 bg-white shadow-sm p-6">
          <h2 className="text-lg font-bold text-midnight-900 mb-4">Visit or contact</h2>
          <div className="grid sm:grid-cols-2 gap-3 text-midnight-700">
            <p className="inline-flex items-start gap-2">
              <MapPin className="w-4 h-4 mt-1 shrink-0 text-midnight-400" />
              <span>{[shelter.address, `${shelter.city}, ${shelter.state} ${shelter.zipCode || ''}`.trim()].filter(Boolean).join(', ')}</span>
            </p>
            {shelter.phone && (
              <p className="inline-flex items-center gap-2">
                <Phone className="w-4 h-4 shrink-0 text-midnight-400" />
                <a href={`tel:${shelter.phone}`} className="font-medium hover:underline">{shelter.phone}</a>
              </p>
            )}
            {shelter.email && (
              <p className="inline-flex items-center gap-2">
                <Mail className="w-4 h-4 shrink-0 text-midnight-400" />
                <a href={`mailto:${shelter.email}`} className="font-medium hover:underline">{shelter.email}</a>
              </p>
            )}
            {shelter.website && (
              <p className="inline-flex items-center gap-2">
                <Globe className="w-4 h-4 shrink-0 text-midnight-400" />
                <a href={shelter.website} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                  Website
                </a>
              </p>
            )}
          </div>
          {(profile.facebookUrl || profile.instagramUrl || profile.twitterUrl) && (
            <div className="flex gap-4 mt-4 text-sm font-semibold text-midnight-600">
              {profile.facebookUrl && <a href={profile.facebookUrl} target="_blank" rel="noopener noreferrer" className="hover:text-midnight-900 underline">Facebook</a>}
              {profile.instagramUrl && <a href={profile.instagramUrl} target="_blank" rel="noopener noreferrer" className="hover:text-midnight-900 underline">Instagram</a>}
              {profile.twitterUrl && <a href={profile.twitterUrl} target="_blank" rel="noopener noreferrer" className="hover:text-midnight-900 underline">X</a>}
            </div>
          )}
        </div>

        {/* Lost-pet pointer */}
        <div className="rounded-2xl border border-flash-200 bg-flash-50/60 p-5 flex items-start gap-3">
          <Search className="w-5 h-5 text-flash-600 mt-0.5 shrink-0" />
          <p className="text-midnight-800">
            <strong>Lost your pet?</strong> Animals taken in here are automatically checked
            against lost-pet reports on ReunitePets.{' '}
            <Link href="/report/new" className="font-semibold underline hover:text-midnight-900">
              File a free report
            </Link>{' '}
            so this shelter can match your pet the moment it arrives.
          </p>
        </div>

        {/* Adoptable animals */}
        <div>
          <h2 className="text-2xl font-black text-midnight-900 mb-5">
            Adoptable animals {animals.length > 0 && <span className="text-midnight-400 font-bold">({animals.length})</span>}
          </h2>
          {animals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-midnight-200 bg-white p-8 text-center">
              <PawPrint className="w-10 h-10 text-midnight-300 mx-auto mb-3" />
              <p className="text-midnight-600">No animals listed right now. Check back soon, or contact the shelter directly.</p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {animals.map((a) => (
                <li key={a.id} className="rounded-2xl border border-midnight-100 bg-white shadow-sm overflow-hidden">
                  {a.primaryPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.primaryPhotoUrl} alt={a.name} className="w-full aspect-square object-cover" />
                  ) : (
                    <div className="w-full aspect-square bg-midnight-50 flex items-center justify-center">
                      <PawPrint className="w-10 h-10 text-midnight-300" />
                    </div>
                  )}
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-bold text-midnight-900 truncate">{a.name}</p>
                      {a.shelterStatus === 'ADOPTION_PENDING' && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                          {SHELTER_STATUS_LABELS.ADOPTION_PENDING}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-midnight-500 truncate">{animalSubtitle(a)}</p>
                    <a
                      href="#ask"
                      className="mt-2 inline-flex items-center justify-center w-full bg-midnight-900 hover:bg-midnight-800 text-white text-xs font-bold rounded-lg px-2.5 py-1.5 transition"
                    >
                      Ask about {a.name}
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Structured inquiries land in the shelter's portal inbox */}
        <InquirySection
          shelterId={shelter.id}
          shelterName={shelter.name}
          animals={animals.map((a) => ({ id: a.id, name: a.name }))}
        />

        <p className="text-xs text-midnight-400 text-center">
          This page is provided free by ReunitePets. Shelters manage their animals and
          health records here at no cost, forever.
        </p>
      </section>
    </div>
  );
}
