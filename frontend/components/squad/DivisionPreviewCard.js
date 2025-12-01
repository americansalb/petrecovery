'use client';

/**
 * DivisionPreviewCard - Beautiful preview card for division peek
 *
 * Appears when user clicks a division chip on squad page
 * Shows division stats and recent activity
 * Centered overlay with backdrop blur
 */

import { X, ArrowRight, Users, AlertCircle, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';

export default function DivisionPreviewCard({
  division,
  cases = [],
  squadId,
  onClose,
}) {
  const router = useRouter();

  if (!division) return null;

  // Calculate stats for this division
  const divisionCases = cases.filter(c => c.divisionId === division.id);
  const activeCases = divisionCases.filter(
    c => c.status === 'IN_PROGRESS' || c.status === 'ACTIVE'
  ).length;
  const reunitedCases = divisionCases.filter(c => c.status === 'REUNITED').length;

  // Get recent cases (last 3)
  const recentCases = divisionCases
    .sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt))
    .slice(0, 3);

  const handleViewFullPage = () => {
    router.push(`/rescue-squads/${squadId}/divisions/${division.id}`);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleBackdropClick}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
        style={{
          animation: 'fadeIn 200ms ease-out',
        }}
      />

      {/* Preview Card */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        onClick={handleBackdropClick}
      >
        <div
          className="
            pointer-events-auto
            w-full max-w-lg
            bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900
            border-2 border-orange-500/30
            rounded-2xl
            shadow-[0_0_60px_rgba(249,115,22,0.3)]
            overflow-hidden
            animate-slide-up
          "
          style={{
            animation: 'slideUp 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="
              absolute top-4 right-4 z-10
              p-2 rounded-lg
              bg-slate-800/50 hover:bg-slate-700
              text-slate-400 hover:text-white
              transition-all duration-200
              hover:scale-110
            "
          >
            <X size={20} />
          </button>

          {/* Header */}
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                <Users className="text-orange-400" size={24} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">
                  {division.name}
                </h3>
                <p className="text-slate-400 text-sm">
                  Division · Part of squad coverage area
                </p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="p-6 grid grid-cols-3 gap-4">
            <StatBox
              icon={AlertCircle}
              value={activeCases}
              label="Active"
              color="red"
            />
            <StatBox
              icon={Users}
              value={division.totalMembers || 0}
              label="Members"
              color="cyan"
            />
            <StatBox
              icon={CheckCircle}
              value={reunitedCases}
              label="Reunited"
              color="green"
            />
          </div>

          {/* Recent Activity */}
          <div className="px-6 pb-6">
            <h4 className="text-sm font-semibold text-slate-300 mb-3">
              Recent Cases
            </h4>
            {recentCases.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                <div className="text-4xl mb-2">🎉</div>
                No active cases right now
              </div>
            ) : (
              <div className="space-y-2">
                {recentCases.map(c => {
                  const speciesEmoji = {
                    DOG: '🐕',
                    CAT: '🐈',
                    BIRD: '🐦',
                    RABBIT: '🐰',
                    OTHER: '🐾',
                  }[c.species] || '🐾';

                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition-colors"
                    >
                      <span className="text-2xl">{speciesEmoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">
                          {c.petName} · {c.species?.toLowerCase()}
                        </p>
                        <p className="text-xs text-slate-400">
                          {c.lastSeenAt ? formatDistanceToNow(new Date(c.lastSeenAt), { addSuffix: true }) : 'Unknown'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* View Full Page Button */}
          <div className="p-6 pt-0">
            <button
              onClick={handleViewFullPage}
              className="
                w-full flex items-center justify-center gap-2
                px-6 py-4 rounded-xl
                bg-gradient-to-r from-orange-500 to-blue-500
                text-white font-bold text-lg
                shadow-[0_0_30px_rgba(249,115,22,0.4)]
                hover:shadow-[0_0_40px_rgba(249,115,22,0.6)]
                hover:scale-[1.02]
                transition-all duration-200
              "
            >
              View Full {division.name} Page
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  );
}

function StatBox({ icon: Icon, value, label, color }) {
  const colorClasses = {
    red: 'text-red-400 bg-red-500/10 border-red-500/30',
    cyan: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    green: 'text-green-400 bg-green-500/10 border-green-500/30',
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <Icon size={20} className="mb-2" />
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}
