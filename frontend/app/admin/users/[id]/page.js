'use client';

/**
 * Admin User Detail - one user, their account, and their pets.
 * Read-only. Each pet links to its full record at /admin/pets/[id].
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, Mail, Phone, Calendar, Shield, Award,
  PawPrint, Syringe, Pill, AlertTriangle, UserCheck,
} from 'lucide-react';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';

const ACTIVE_CASE = new Set(['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED', 'OPEN']);

function PetCard({ pet }) {
  const activeCase = (pet.cases || []).find((c) => ACTIVE_CASE.has(c.status));
  const detail = [pet.breed || pet.species, pet.age != null ? `${pet.age} yr${pet.age === 1 ? '' : 's'}` : null, pet.sex ? pet.sex.toLowerCase() : null]
    .filter(Boolean).join(' · ');
  return (
    <Link
      href={`/admin/pets/${pet.id}`}
      className="group bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-blue-300 transition flex flex-col"
    >
      <div className="flex items-center gap-3">
        <span className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center shrink-0">
          {pet.primaryPhotoUrl
            ? <img src={pet.primaryPhotoUrl} alt="" className="w-full h-full object-cover" />
            : <SpeciesIcon species={pet.species} size={28} className="text-gray-400" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 truncate">{pet.name}</p>
          <p className="text-sm text-gray-500 truncate capitalize">{detail}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 shrink-0" />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-3 text-xs">
        {activeCase && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
            <AlertTriangle className="w-3 h-3" /> {activeCase.caseNumber || 'Missing'}
          </span>
        )}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
          <Syringe className="w-3 h-3" /> {pet._count?.vaccinations || 0}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
          <Pill className="w-3 h-3" /> {pet._count?.medications || 0}
        </span>
        {pet.microchipId && (
          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-mono">chip ····{String(pet.microchipId).slice(-4)}</span>
        )}
        {pet.weight != null && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{pet.weight} lb</span>}
      </div>
    </Link>
  );
}

export default function AdminUserDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push(`/login?callbackUrl=/admin/users/${id}`);
    else if (status === 'authenticated' && session?.user?.role !== 'ADMIN') router.push('/dashboard');
  }, [status, session, router, id]);

  useEffect(() => {
    if (session?.user?.role !== 'ADMIN') return;
    (async () => {
      try {
        const res = await fetch(`/api/admin/users/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load user');
        setUser(data.user);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [session, id]);

  if (status === 'loading' || loading) {
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>;
  }
  if (session?.user?.role !== 'ADMIN') return null;
  if (error || !user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow p-8 text-center max-w-md">
          <p className="text-gray-900 font-semibold mb-3">{error || 'User not found'}</p>
          <Link href="/admin/users" className="text-blue-600 hover:underline">Back to users</Link>
        </div>
      </div>
    );
  }

  const pets = user.pets || [];

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center gap-4">
          <Link href="/admin/users" className="text-gray-500 hover:text-gray-700"><ChevronLeft className="w-6 h-6" /></Link>
          <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-lg font-semibold shrink-0">
            {user.firstName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{[user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unnamed user'}</h1>
            <p className="text-sm text-gray-500 truncate">{user.email}</p>
          </div>
          {user.role === 'ADMIN' && (
            <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700"><Shield className="w-3 h-3" /> Admin</span>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Account facts */}
        <div className="bg-white rounded-lg shadow p-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-gray-500 flex items-center gap-1"><Mail className="w-3 h-3" /> Email</p><p className="font-medium text-gray-900 truncate">{user.email}</p></div>
          <div><p className="text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</p><p className="font-medium text-gray-900">{user.phone || 'Not set'} {user.phoneVerified && <UserCheck className="inline w-3 h-3 text-green-500" />}</p></div>
          <div><p className="text-gray-500 flex items-center gap-1"><Award className="w-3 h-3" /> Rescue level</p><p className="font-medium text-gray-900">{(user.rescueLevel || 'PET_OWNER').replace(/_/g, ' ').toLowerCase()}</p></div>
          <div><p className="text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> Joined</p><p className="font-medium text-gray-900">{new Date(user.createdAt).toLocaleDateString()}</p></div>
          <div><p className="text-gray-500">Pets</p><p className="font-medium text-gray-900">{user._count?.pets ?? pets.length}</p></div>
          <div><p className="text-gray-500">Cases reported</p><p className="font-medium text-gray-900">{user._count?.cases || 0}</p></div>
          <div><p className="text-gray-500">Reunions</p><p className="font-medium text-gray-900">{user.successfulReunions || 0}</p></div>
          <div><p className="text-gray-500">Last active</p><p className="font-medium text-gray-900">{user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'Never'}</p></div>
        </div>

        {/* Pets */}
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-4">
            <PawPrint className="w-5 h-5 text-gray-400" /> Pets ({pets.length})
          </h2>
          {pets.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-10 text-center text-gray-500">
              <PawPrint className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              This user has no pet profiles.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pets.map((pet) => <PetCard key={pet.id} pet={pet} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
