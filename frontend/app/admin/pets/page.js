'use client';

/**
 * Admin Pets Page
 *
 * Manage all pets in the system regardless of owner
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isAdmin } from '@/app/lib/permissions';
import { PawPrint, Trash2, Search, RefreshCw, AlertTriangle } from 'lucide-react';

export default function AdminPetsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/admin/pets');
    } else if (status === 'authenticated' && !isAdmin(session)) {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (status === 'authenticated' && isAdmin(session)) {
      fetchPets();
    }
  }, [status, session]);

  const fetchPets = async () => {
    setLoading(true);
    setError(null);
    setSelectedIds(new Set());

    try {
      const res = await fetch('/api/admin/pets');
      if (!res.ok) throw new Error('Failed to fetch pets');
      const data = await res.json();
      setPets(data.pets || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredPets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPets.map(p => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/pets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });

      if (!res.ok) throw new Error('Failed to delete pets');

      setShowDeleteConfirm(false);
      fetchPets();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const filteredPets = pets.filter(pet => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      pet.name?.toLowerCase().includes(query) ||
      pet.species?.toLowerCase().includes(query) ||
      pet.breed?.toLowerCase().includes(query) ||
      pet.owner?.firstName?.toLowerCase().includes(query) ||
      pet.owner?.email?.toLowerCase().includes(query)
    );
  });

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-midnight-50 flex items-center justify-center">
        <div className="text-center">
          <PawPrint className="w-12 h-12 text-midnight-400 mx-auto mb-4 animate-pulse" />
          <div className="text-midnight-600">Loading pets...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-midnight-50 p-6">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-midnight-900">Delete {selectedIds.size} Pet(s)?</h3>
                <p className="text-sm text-midnight-500">This will also close any active cases.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-midnight-100 text-midnight-700 rounded-lg font-medium hover:bg-midnight-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-midnight-900 flex items-center gap-2">
              <PawPrint className="w-7 h-7" />
              All Pets
              <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded font-semibold">
                ADMIN
              </span>
            </h1>
            <p className="text-midnight-600 mt-1">Manage all pet profiles in the system</p>
          </div>
          <button
            onClick={fetchPets}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-midnight-200 rounded-lg text-midnight-700 hover:bg-midnight-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Search & Actions Bar */}
        <div className="bg-white rounded-xl border border-midnight-200 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-midnight-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, species, breed, or owner..."
                className="w-full pl-10 pr-4 py-2 border border-midnight-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-flash-400"
              />
            </div>

            {selectedIds.size > 0 && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected ({selectedIds.size})
              </button>
            )}
          </div>
        </div>

        {/* Pets Table */}
        <div className="bg-white rounded-xl border border-midnight-200 overflow-hidden">
          {filteredPets.length === 0 ? (
            <div className="p-12 text-center">
              <PawPrint className="w-16 h-16 text-midnight-300 mx-auto mb-4" />
              <div className="text-lg font-medium text-midnight-900 mb-1">No pets found</div>
              <div className="text-midnight-500">
                {searchQuery ? 'Try adjusting your search' : 'No pets in the system yet'}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-midnight-50 border-b border-midnight-200">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filteredPets.length && filteredPets.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-midnight-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-midnight-500 uppercase">Pet</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-midnight-500 uppercase">Species</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-midnight-500 uppercase">Owner</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-midnight-500 uppercase">Case Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-midnight-500 uppercase">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-midnight-100">
                  {filteredPets.map((pet) => {
                    const isSelected = selectedIds.has(pet.id);
                    const latestCase = pet.cases?.[0];

                    return (
                      <tr
                        key={pet.id}
                        className={`hover:bg-midnight-50 transition ${isSelected ? 'bg-flash-50' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(pet.id)}
                            className="w-4 h-4 rounded border-midnight-300"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {pet.primaryPhotoUrl ? (
                              <img
                                src={pet.primaryPhotoUrl}
                                alt={pet.name}
                                className="w-10 h-10 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-midnight-100 flex items-center justify-center">
                                <PawPrint className="w-5 h-5 text-midnight-400" />
                              </div>
                            )}
                            <div>
                              <Link href={`/admin/pets/${pet.id}`} className="font-medium text-midnight-900 hover:text-blue-600 hover:underline">
                                {pet.name}
                              </Link>
                              <div className="text-xs text-midnight-500">{pet.breed || '-'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-midnight-600">{pet.species}</td>
                        <td className="px-4 py-3">
                          {pet.owner ? (
                            <div>
                              <div className="text-sm font-medium text-midnight-900">
                                {pet.owner.firstName} {pet.owner.lastName}
                              </div>
                              <div className="text-xs text-midnight-500">{pet.owner.email}</div>
                            </div>
                          ) : (
                            <span className="text-midnight-400">No owner</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {latestCase ? (
                            <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                              latestCase.status === 'ACTIVE' ? 'bg-blue-100 text-blue-700' :
                              latestCase.status === 'REUNITED' ? 'bg-green-100 text-green-700' :
                              latestCase.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-midnight-100 text-midnight-600'
                            }`}>
                              {latestCase.status}
                            </span>
                          ) : (
                            <span className="text-midnight-400 text-sm">No cases</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-midnight-500">
                          {new Date(pet.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="mt-4 text-sm text-midnight-500">
          Showing {filteredPets.length} of {pets.length} pets
        </div>
      </div>
    </div>
  );
}
