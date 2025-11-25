'use client';

// /admin/cases/[id]/page.js
// Admin case detail page with assignment controls

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function AdminCaseDetailPage() {
  const params = useParams();
  const { id } = params;

  const [caseData, setCaseData] = useState(null);
  const [coordinators, setCoordinators] = useState([]);
  const [squads, setSquads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch case, coordinators, and squads in parallel
      const [caseRes, usersRes, squadsRes] = await Promise.all([
        fetch(`/api/admin/cases/${id}`),
        fetch('/api/admin/users?role=PATROL'),
        fetch('/api/admin/rescue-squads'),
      ]);

      if (caseRes.ok) {
        const data = await caseRes.json();
        setCaseData(data);
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        setCoordinators(data.users || []);
      }

      if (squadsRes.ok) {
        const data = await squadsRes.json();
        setSquads(data.squads || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
    setLoading(false);
  }

  async function assignCoordinator(coordinatorId) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/cases/${id}/assign-coordinator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinatorId: coordinatorId || null }),
      });

      if (res.ok) {
        const data = await res.json();
        setCaseData({ ...caseData, ...data.case });
        setMessage({ type: 'success', text: 'Coordinator updated' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to update' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update coordinator' });
    }
    setSaving(false);
  }

  async function assignSquad(squadId) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/cases/${id}/assign-squad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ squadId: squadId || null }),
      });

      if (res.ok) {
        const data = await res.json();
        setCaseData({ ...caseData, ...data.case });
        setMessage({ type: 'success', text: 'Squad updated' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to update' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update squad' });
    }
    setSaving(false);
  }

  async function updateStatus(status) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/cases/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        const data = await res.json();
        setCaseData({ ...caseData, status: data.case.status });
        setMessage({ type: 'success', text: 'Status updated' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to update' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update status' });
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <p className="text-red-600">Case not found</p>
        <Link href="/admin/cases" className="text-blue-600 hover:underline">
          &larr; Back to Cases
        </Link>
      </div>
    );
  }

  const statusColors = {
    ACTIVE: 'bg-red-100 text-red-800',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    SIGHTING_REPORTED: 'bg-blue-100 text-blue-800',
    REUNITED: 'bg-green-100 text-green-800',
    CLOSED_OTHER: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <Link href="/admin/cases" className="text-blue-600 hover:underline text-sm">
            &larr; Back to Cases
          </Link>
          <h1 className="text-2xl font-bold mt-2">
            Case #{caseData.caseNumber}
          </h1>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[caseData.status]}`}>
          {caseData.status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Pet Info */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex gap-6">
          <img
            src={caseData.petPhotoUrl}
            alt={caseData.petName}
            className="w-32 h-32 rounded-lg object-cover"
          />
          <div>
            <h2 className="text-xl font-bold">{caseData.petName}</h2>
            <p className="text-gray-600">
              {caseData.petBreed || caseData.petSpecies} &bull; {caseData.petColor} &bull; {caseData.petSize}
            </p>
            <p className="text-gray-500 mt-2">
              Last seen: {caseData.lastSeenAddress}
            </p>
            <p className="text-gray-500 text-sm">
              {new Date(caseData.lastSeenAt).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Status Update */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="font-bold text-lg mb-4">Case Status</h3>
        <div className="flex flex-wrap gap-2">
          {['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED', 'REUNITED', 'CLOSED_OTHER'].map((status) => (
            <button
              key={status}
              onClick={() => updateStatus(status)}
              disabled={saving || caseData.status === status}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                caseData.status === status
                  ? statusColors[status] + ' ring-2 ring-offset-2 ring-gray-400'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              } disabled:opacity-50`}
            >
              {status.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Assignment Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="font-bold text-lg mb-4">Case Assignment</h3>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Coordinator */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Coordinator
            </label>
            <select
              value={caseData.coordinatorId || ''}
              onChange={(e) => assignCoordinator(e.target.value)}
              disabled={saving}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:opacity-50"
            >
              <option value="">-- Unassigned --</option>
              {coordinators.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} ({user.role})
                </option>
              ))}
            </select>
            {caseData.coordinator && (
              <p className="text-sm text-gray-500 mt-1">
                {caseData.coordinator.email}
              </p>
            )}
          </div>

          {/* Primary Squad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary Squad
            </label>
            <select
              value={caseData.primarySquadId || ''}
              onChange={(e) => assignSquad(e.target.value)}
              disabled={saving}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:opacity-50"
            >
              <option value="">-- No Squad --</option>
              {squads.map((squad) => (
                <option key={squad.id} value={squad.id}>
                  {squad.name} {squad.city && `(${squad.city}, ${squad.state})`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Owner Info */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="font-bold text-lg mb-4">Owner Information</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Name:</span>{' '}
            <span className="font-medium">{caseData.ownerName}</span>
          </div>
          <div>
            <span className="text-gray-500">Email:</span>{' '}
            <a href={`mailto:${caseData.ownerEmail}`} className="text-blue-600 hover:underline">
              {caseData.ownerEmail}
            </a>
          </div>
          <div>
            <span className="text-gray-500">Phone:</span>{' '}
            <span className="font-medium">{caseData.ownerPhone || 'Not provided'}</span>
          </div>
          <div>
            <span className="text-gray-500">Created:</span>{' '}
            <span className="font-medium">{new Date(caseData.createdAt).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Privacy Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-bold text-lg mb-4">Privacy Settings</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${caseData.isPublic ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span>Public visibility: {caseData.isPublic ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${caseData.publicContactOk ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span>Contact allowed: {caseData.publicContactOk ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${caseData.publicPhoneVisible ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span>Phone visible: {caseData.publicPhoneVisible ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${caseData.publicEmailVisible ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span>Email visible: {caseData.publicEmailVisible ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
