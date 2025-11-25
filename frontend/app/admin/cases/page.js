// /admin/cases/page.js
// Admin case management page

import { getSession } from '@/app/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/app/lib/prisma';
import Link from 'next/link';

export default async function AdminCasesPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect('/login?callbackUrl=/admin/cases');
  }

  if (!['ADMIN', 'MODERATOR'].includes(session.user.role)) {
    redirect('/dashboard?error=unauthorized');
  }

  const cases = await prisma.case.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      coordinator: {
        select: { firstName: true, lastName: true },
      },
      primarySquad: {
        select: { name: true },
      },
    },
  });

  const statusColors = {
    ACTIVE: 'bg-red-100 text-red-800',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    SIGHTING_REPORTED: 'bg-blue-100 text-blue-800',
    REUNITED: 'bg-green-100 text-green-800',
    CLOSED_OTHER: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Case Management</h1>
          <p className="text-gray-600">
            Manage lost pet cases, assignments, and status
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin"
            className="text-gray-600 hover:text-gray-900"
          >
            &larr; Admin Home
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-gray-500 text-sm">Total</p>
          <p className="text-2xl font-bold">{cases.length}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg shadow">
          <p className="text-red-600 text-sm">Active</p>
          <p className="text-2xl font-bold text-red-700">
            {cases.filter(c => c.status === 'ACTIVE').length}
          </p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg shadow">
          <p className="text-yellow-600 text-sm">In Progress</p>
          <p className="text-2xl font-bold text-yellow-700">
            {cases.filter(c => c.status === 'IN_PROGRESS').length}
          </p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg shadow">
          <p className="text-blue-600 text-sm">Sighting</p>
          <p className="text-2xl font-bold text-blue-700">
            {cases.filter(c => c.status === 'SIGHTING_REPORTED').length}
          </p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg shadow">
          <p className="text-green-600 text-sm">Reunited</p>
          <p className="text-2xl font-bold text-green-700">
            {cases.filter(c => c.status === 'REUNITED').length}
          </p>
        </div>
      </div>

      {/* Cases Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Case #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pet
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Coordinator
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Primary Squad
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {cases.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="font-mono text-sm">{c.caseNumber}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <img
                      src={c.petPhotoUrl}
                      alt={c.petName}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div>
                      <p className="font-medium">{c.petName}</p>
                      <p className="text-xs text-gray-500">{c.petSpecies}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[c.status]}`}>
                    {c.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {c.coordinator ? (
                    <span className="text-sm">
                      {c.coordinator.firstName} {c.coordinator.lastName?.charAt(0)}.
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm">Unassigned</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {c.primarySquad ? (
                    <span className="text-sm">{c.primarySquad.name}</span>
                  ) : (
                    <span className="text-gray-400 text-sm">None</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link
                    href={`/admin/cases/${c.id}`}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {cases.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No cases found
          </div>
        )}
      </div>
    </div>
  );
}
