'use client';

/**
 * CasesModeV2 - Cases list mode
 *
 * Simple vertical list of case cards with status filter
 * - Status selector: Incoming | Active | Reunited
 * - Clean case cards
 * - Click to open case detail page
 */

import { useState } from 'react';
import { Clock, MapPin, DollarSign, Radio, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { useSession } from 'next-auth/react';
import { fetchWithRetry } from '@/app/lib/utils';

export default function CasesModeV2({
  cases,
  selectedStatus,
  onStatusChange,
  cityName,
  squadId,
  onCaseUpdate,
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const [joiningCaseId, setJoiningCaseId] = useState(null);

  const handleJoinCase = async (caseData, e) => {
    e.stopPropagation(); // Prevent card click

    if (!squadId) {
      alert('Unable to join: Squad information missing');
      return;
    }

    setJoiningCaseId(caseData.id);

    try {
      const res = await fetchWithRetry(`/api/rescue-squads/${squadId}/cases/${caseData.id}/help`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.error || 'Failed to join mission');
        return;
      }

      // Success!
      onCaseUpdate?.(); // Refresh cases list
      alert(`You've joined the rescue mission for ${caseData.petName}! 🚀`);
    } catch (err) {
      console.error('Error joining case:', err);
      alert('Failed to join mission. Please try again.');
    } finally {
      setJoiningCaseId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <StatusButton
          active={selectedStatus === 'ACTIVE'}
          onClick={() => onStatusChange('ACTIVE')}
          label="Active"
          count={cases.filter(c =>
            c.status === 'IN_PROGRESS' || c.status === 'ACTIVE' || c.status === 'PENDING'
          ).length}
        />
        <StatusButton
          active={selectedStatus === 'REUNITED'}
          onClick={() => onStatusChange('REUNITED')}
          label="Reunited"
          count={cases.filter(c => c.status === 'REUNITED').length}
        />
      </div>

      {/* Cases List */}
      {cases.length === 0 ? (
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-16 text-center">
          {/* Subtle glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-flash-500/5 rounded-full blur-3xl" />

          <div className="relative">
            <div className="text-7xl mb-6">🐾</div>
            <h3 className="text-2xl font-bold text-white mb-3">
              No {selectedStatus.toLowerCase()} cases
            </h3>
            <p className="text-slate-400 text-lg max-w-md mx-auto">
              Great work! There are no {selectedStatus.toLowerCase()} cases in this area right now.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-5">
          {cases.map(caseData => (
            <CaseCard
              key={caseData.id}
              caseData={caseData}
              session={session}
              isJoining={joiningCaseId === caseData.id}
              onJoin={(e) => handleJoinCase(caseData, e)}
              onClick={() => {
                console.log('[CaseClick] Opening in Mission Control:', caseData.caseNumber, caseData);
                router.push(`/mission-control?mission=${caseData.caseNumber}`);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatusButton({ active, onClick, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`
        px-6 py-3 rounded-xl text-sm font-bold
        backdrop-blur-sm transition-all duration-300
        ${active
          ? 'bg-gradient-to-r from-flash-500/30 to-flash-400/30 text-flash-300 border-2 border-flash-500/60 shadow-lg shadow-flash-500/30 scale-105'
          : 'bg-slate-800/40 text-slate-400 border-2 border-slate-700/50 hover:border-flash-500/40 hover:text-slate-300 hover:bg-slate-800/60 hover:scale-102'
        }
      `}
    >
      {label} {count > 0 && <span className={`ml-1.5 ${active ? 'text-flash-400' : 'text-slate-500'}`}>({count})</span>}
    </button>
  );
}

function CaseCard({ caseData, onClick, session, isJoining, onJoin }) {
  const {
    caseNumber,
    petName,
    species,
    breed,
    color,
    photoUrl,
    status,
    urgency,
    lastSeenAt,
    lastSeenAddress,
    rewardAmount,
    helperCount,
    participants,
  } = caseData;

  // Check if user is already deployed
  const isDeployed = session && participants?.some(p => p.userId === session.user.id && p.isActive);
  const isReunited = status === 'REUNITED';

  // Get species emoji
  const speciesEmoji = {
    DOG: '🐕',
    CAT: '🐈',
    BIRD: '🐦',
    RABBIT: '🐰',
    OTHER: '🐾',
  }[species] || '🐾';

  // Format time
  const timeAgo = lastSeenAt
    ? formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true })
    : 'Unknown';

  // Status styling
  const statusConfig = {
    PENDING: { label: 'Incoming', bg: 'bg-flash-400/20', text: 'text-flash-300', border: 'border-flash-400/30' },
    IN_PROGRESS: { label: 'Active', bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
    ACTIVE: { label: 'Active', bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
    REUNITED: { label: 'Reunited', bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  };

  const statusStyle = statusConfig[status] || statusConfig.ACTIVE;

  return (
    <div
      onClick={onClick}
      className="
        group cursor-pointer relative overflow-hidden
        bg-gradient-to-br from-slate-800/40 to-slate-900/40
        backdrop-blur-sm border border-slate-700/50
        rounded-2xl p-6
        hover:border-flash-500/60
        hover:shadow-xl hover:shadow-flash-500/20
        hover:scale-[1.01]
        transition-all duration-300
      "
    >
      {/* Subtle glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-flash-500/0 via-flash-500/5 to-flash-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative flex gap-5">
        {/* Pet Photo */}
        {photoUrl ? (
          <div className="flex-shrink-0 w-28 h-28 rounded-xl overflow-hidden bg-slate-700 border-2 border-slate-600/50 group-hover:border-flash-500/30 transition-colors duration-300">
            <img
              src={photoUrl}
              alt={petName}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
          </div>
        ) : (
          <div className="flex-shrink-0 w-28 h-28 rounded-xl bg-gradient-to-br from-slate-700/80 to-slate-800/80 border-2 border-slate-600/50 group-hover:border-flash-500/30 flex items-center justify-center text-5xl transition-colors duration-300">
            {speciesEmoji}
          </div>
        )}

        {/* Case Info */}
        <div className="flex-1 min-w-0">
          {/* Pet Name & Species */}
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-2xl font-bold text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-flash-400 group-hover:to-flash-300 transition-all duration-300">
              {petName}
            </h3>
            <span className="text-slate-500">·</span>
            <span className="text-slate-300 capitalize font-medium">{species?.toLowerCase()}</span>
          </div>

          {/* Case Number */}
          <div className="text-sm text-slate-500 font-medium mb-4">
            Case #{caseNumber}
          </div>

          {/* Location & Time */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm mb-4">
            <div className="flex items-center gap-2 text-slate-300">
              <MapPin size={16} className="text-flash-400 flex-shrink-0" />
              <span className="truncate max-w-xs font-medium">{lastSeenAddress || 'Location unknown'}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Clock size={16} className="flex-shrink-0" />
              <span className="font-medium">Updated {timeAgo}</span>
            </div>
          </div>

          {/* Status & Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Pill */}
            <span className={`
              px-4 py-1.5 rounded-full text-xs font-bold backdrop-blur-sm
              ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border}
              shadow-sm
            `}>
              {statusStyle.label}
            </span>

            {/* Urgency Badge */}
            {urgency === 'HIGH' && (
              <span className="px-4 py-1.5 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse shadow-sm shadow-red-500/20">
                ⚡ URGENT
              </span>
            )}

            {/* Helper Count */}
            {helperCount > 0 && (
              <span className="px-4 py-1.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 backdrop-blur-sm">
                👥 {helperCount} {helperCount === 1 ? 'helper' : 'helpers'}
              </span>
            )}

            {/* Reward */}
            {rewardAmount > 0 && (
              <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-flash-400/20 to-flash-400/20 text-amber-300 border border-flash-400/40 backdrop-blur-sm shadow-sm shadow-flash-400/10">
                <DollarSign size={12} />
                ${rewardAmount} reward
              </span>
            )}
          </div>

          {/* Join Mission Button */}
          {!isReunited && session && (
            <div className="mt-4 pt-4 border-t border-slate-700/50">
              {isDeployed ? (
                <div className="px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center gap-2">
                  <Shield size={16} className="text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-400">You're deployed on this mission</span>
                </div>
              ) : (
                <button
                  onClick={onJoin}
                  disabled={isJoining}
                  className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-flash-500 to-flash-400 text-midnight-900 text-sm font-bold hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isJoining ? (
                    <>
                      <div className="w-4 h-4 border-2 border-midnight-900 border-t-transparent rounded-full animate-spin" />
                      <span>Joining...</span>
                    </>
                  ) : (
                    <>
                      <Radio size={16} />
                      <span>Join Rescue Mission</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
