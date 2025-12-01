'use client';

/**
 * CasesModeV2 - Cases list mode
 *
 * Simple vertical list of case cards with status filter
 * - Status selector: Incoming | Active | Reunited
 * - Clean case cards
 * - Click to open case detail page
 */

import { Clock, MapPin, DollarSign } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

export default function CasesModeV2({
  cases,
  selectedStatus,
  onStatusChange,
  cityName,
}) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Status Filter */}
      <div className="flex items-center gap-3">
        <StatusButton
          active={selectedStatus === 'INCOMING'}
          onClick={() => onStatusChange('INCOMING')}
          label="Incoming"
          count={cases.filter(c => c.status === 'PENDING').length}
        />
        <StatusButton
          active={selectedStatus === 'ACTIVE'}
          onClick={() => onStatusChange('ACTIVE')}
          label="Active"
          count={cases.filter(c =>
            c.status === 'IN_PROGRESS' || c.status === 'ACTIVE'
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
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🐾</div>
          <h3 className="text-xl font-semibold text-slate-300 mb-2">
            No {selectedStatus.toLowerCase()} cases
          </h3>
          <p className="text-slate-400">
            Great work! There are no {selectedStatus.toLowerCase()} cases in this area right now.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {cases.map(caseData => (
            <CaseCard
              key={caseData.id}
              caseData={caseData}
              onClick={() => router.push(`/cases/${caseData.caseNumber}`)}
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
        px-5 py-2.5 rounded-lg text-sm font-semibold
        transition-all duration-200
        ${active
          ? 'bg-orange-500/20 text-orange-400 border-2 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.3)]'
          : 'bg-slate-800/50 text-slate-400 border-2 border-slate-700/50 hover:border-slate-600 hover:text-slate-300'
        }
      `}
    >
      {label} {count > 0 && <span className="ml-1">({count})</span>}
    </button>
  );
}

function CaseCard({ caseData, onClick }) {
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
  } = caseData;

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
    PENDING: { label: 'Incoming', bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
    IN_PROGRESS: { label: 'Active', bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
    ACTIVE: { label: 'Active', bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
    REUNITED: { label: 'Reunited', bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  };

  const statusStyle = statusConfig[status] || statusConfig.ACTIVE;

  return (
    <div
      onClick={onClick}
      className="
        group cursor-pointer
        bg-gradient-to-br from-slate-800/50 to-slate-900/50
        border border-slate-700/50
        rounded-xl p-5
        hover:border-orange-500/50
        hover:shadow-[0_0_30px_rgba(249,115,22,0.2)]
        transition-all duration-300
      "
    >
      <div className="flex gap-4">
        {/* Pet Photo */}
        {photoUrl ? (
          <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-slate-700">
            <img
              src={photoUrl}
              alt={petName}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            />
          </div>
        ) : (
          <div className="flex-shrink-0 w-24 h-24 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-5xl">
            {speciesEmoji}
          </div>
        )}

        {/* Case Info */}
        <div className="flex-1 min-w-0">
          {/* Pet Name & Species */}
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-xl font-bold text-white group-hover:text-orange-400 transition-colors">
              {petName}
            </h3>
            <span className="text-slate-400">·</span>
            <span className="text-slate-300 capitalize">{species?.toLowerCase()}</span>
          </div>

          {/* Case Number */}
          <div className="text-sm text-slate-400 mb-3">
            Case #{caseNumber}
          </div>

          {/* Location & Time */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm mb-3">
            <div className="flex items-center gap-1.5 text-slate-300">
              <MapPin size={14} className="text-orange-400" />
              <span className="truncate max-w-xs">{lastSeenAddress || 'Location unknown'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock size={14} />
              <span>Updated {timeAgo}</span>
            </div>
          </div>

          {/* Status & Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Pill */}
            <span className={`
              px-3 py-1 rounded-full text-xs font-bold
              ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border}
            `}>
              {statusStyle.label}
            </span>

            {/* Urgency Badge */}
            {urgency === 'HIGH' && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                URGENT
              </span>
            )}

            {/* Helper Count */}
            {helperCount > 0 && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {helperCount} {helperCount === 1 ? 'helper' : 'helpers'}
              </span>
            )}

            {/* Reward */}
            {rewardAmount > 0 && (
              <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <DollarSign size={12} />
                {rewardAmount} reward
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
