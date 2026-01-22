'use client';

/**
 * Mission Info Panel - Left side of Command Center
 *
 * Shows:
 * - Pet details with photo
 * - Owner/contact info
 * - Status controls
 * - Reward info
 * - Assigned force/participants
 */

import { useState } from 'react';

export default function MissionInfoPanel({ missionData, userRole, onUpdate }) {
  const [showStatusChange, setShowStatusChange] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const isOwnerOrAdmin = userRole === 'OWNER' || userRole === 'ADMIN';

  // Handle status change
  const handleStatusChange = async (newStatus, resolution = null) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/missions/${missionData.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, resolution }),
      });

      if (res.ok) {
        onUpdate?.();
        setShowStatusChange(false);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Pet Details Card */}
      <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
        <div className="flex items-start gap-4">
          {missionData.petPhotoUrl && missionData.petPhotoUrl.length > 10 ? (
            <img
              src={missionData.petPhotoUrl}
              alt={missionData.petName || 'Pet photo'}
              className="w-20 h-20 rounded-xl object-cover ring-2 ring-cyan-500/30"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-slate-700/50 flex items-center justify-center">
              <span className="text-4xl">
                {missionData.petSpecies === 'DOG' ? '🐕' : missionData.petSpecies === 'CAT' ? '🐈' : '🐾'}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg truncate">{missionData.petName || 'Unknown'}</h3>
            <div className="text-sm text-slate-400 space-y-0.5">
              <p>{missionData.petSpecies} {missionData.petBreed && `• ${missionData.petBreed}`}</p>
              <p>{missionData.petColor} {missionData.petSize && `• ${missionData.petSize}`}</p>
            </div>
          </div>
        </div>

        {missionData.petDescription && (
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">
            {missionData.petDescription}
          </p>
        )}
      </div>

      {/* Last Seen */}
      <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Last Seen
        </h4>
        <p className="text-sm text-white font-medium">
          {missionData.lastSeenAddress || 'Unknown location'}
        </p>
        {missionData.lastSeenAt && (
          <p className="text-xs text-slate-400 mt-1">
            {new Date(missionData.lastSeenAt).toLocaleString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>

      {/* Owner/Contact */}
      <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Contact
        </h4>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-lg">
            👤
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">
              {missionData.ownerName || missionData.reporter?.firstName || 'Anonymous'}
            </p>
            {missionData.ownerPhone && (
              <a
                href={`tel:${missionData.ownerPhone}`}
                className="text-sm text-cyan-400 hover:text-cyan-300"
              >
                {missionData.ownerPhone}
              </a>
            )}
          </div>
        </div>

        <div className="mt-3 p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
          <p className="text-xs text-yellow-400/80">
            ⚠️ Meet in public places when arranging meetings
          </p>
        </div>
      </div>

      {/* Reward */}
      {missionData.rewardAmount > 0 && (
        <div className="bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 rounded-2xl p-4 border border-emerald-500/30">
          <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            Reward Offered
          </h4>
          <p className="text-2xl font-bold text-emerald-400">
            ${missionData.rewardAmount.toLocaleString()}
          </p>
        </div>
      )}

      {/* Assigned Force */}
      {missionData.assignments?.[0]?.rescueForce && (
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Assigned Force
          </h4>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              🛡️
            </div>
            <div>
              <p className="font-medium text-cyan-400">
                {missionData.assignments[0].rescueForce.name}
              </p>
              <p className="text-xs text-slate-400">
                {missionData.assignments[0].rescueForce.city}, {missionData.assignments[0].rescueForce.state}
              </p>
            </div>
          </div>

          {/* Participants count */}
          {missionData.assignments[0].participants?.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
              <span className="text-cyan-400 font-semibold">
                {missionData.assignments[0].participants.length}
              </span>
              <span>helpers joined</span>
            </div>
          )}
        </div>
      )}

      {/* Status Controls (for owner/admin) */}
      {isOwnerOrAdmin && missionData.status !== 'REUNITED' && missionData.status !== 'CLOSED_OTHER' && (
        <div className="space-y-2">
          <button
            onClick={() => setShowStatusChange(!showStatusChange)}
            className="w-full py-3 px-4 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm font-medium hover:bg-slate-700/50 transition"
          >
            Update Mission Status
          </button>

          {showStatusChange && (
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-600 space-y-3">
              <p className="text-xs text-slate-400 mb-3">Change case status:</p>

              <button
                onClick={() => handleStatusChange('IN_PROGRESS')}
                disabled={updatingStatus}
                className="w-full py-2.5 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition text-sm font-medium disabled:opacity-50"
              >
                🔍 Mark as Actively Searching
              </button>

              <button
                onClick={() => handleStatusChange('SIGHTING_REPORTED')}
                disabled={updatingStatus}
                className="w-full py-2.5 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition text-sm font-medium disabled:opacity-50"
              >
                👁️ Sighting Reported
              </button>

              <button
                onClick={() => handleStatusChange('REUNITED', 'REUNITED')}
                disabled={updatingStatus}
                className="w-full py-2.5 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition text-sm font-medium disabled:opacity-50"
              >
                🎉 Mark as Reunited!
              </button>

              <button
                onClick={() => handleStatusChange('CLOSED_OTHER', 'SEARCH_CEASED')}
                disabled={updatingStatus}
                className="w-full py-2 text-slate-400 rounded-lg hover:bg-slate-700/50 transition text-xs disabled:opacity-50"
              >
                Close case (other reason)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Resolved banner */}
      {(missionData.status === 'REUNITED' || missionData.status === 'CLOSED_OTHER') && (
        <div className={`
          rounded-2xl p-4 text-center
          ${missionData.status === 'REUNITED'
            ? 'bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/30'
            : 'bg-slate-800/50 border border-slate-700/50'}
        `}>
          <p className="text-3xl mb-2">
            {missionData.status === 'REUNITED' ? '🎉' : '📋'}
          </p>
          <p className={`font-bold ${missionData.status === 'REUNITED' ? 'text-emerald-400' : 'text-slate-400'}`}>
            {missionData.status === 'REUNITED' ? 'Reunited!' : 'Mission Closed'}
          </p>
          {missionData.resolvedAt && (
            <p className="text-xs text-slate-400 mt-1">
              {new Date(missionData.resolvedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
