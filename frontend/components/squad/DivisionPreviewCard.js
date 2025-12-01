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
            border-2 border-cyan-500/30
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
              absolute top-6 right-6 z-10
              p-3 rounded-xl
              bg-slate-800/50 backdrop-blur-sm border border-slate-700/50
              text-slate-400 hover:text-white
              hover:bg-slate-700 hover:border-cyan-500/50
              transition-all duration-200
              hover:scale-110
            "
          >
            <X size={22} />
          </button>

          {/* Header */}
          <div className="p-8 border-b border-slate-700/50">
            <div className="flex items-start gap-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-400/20 border-2 border-cyan-500/40 shadow-lg shadow-cyan-500/20">
                <Users className="text-cyan-300" size={28} />
              </div>
              <div>
                <h3 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-200 mb-2">
                  {division.name}
                </h3>
                <p className="text-slate-400 text-base font-medium">
                  Division · Part of squad coverage area
                </p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="p-8 grid grid-cols-3 gap-5">
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
          <div className="px-8 pb-8">
            <h4 className="text-sm font-bold text-white mb-4 tracking-wide uppercase">
              Recent Cases
            </h4>
            {recentCases.length === 0 ? (
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm border border-slate-700/50 rounded-xl p-10 text-center">
                <div className="absolute inset-0 bg-cyan-500/5 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="text-5xl mb-3">🎉</div>
                  <p className="text-slate-400 text-base font-medium">No active cases right now</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
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
                      className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-200"
                    >
                      <div className="text-3xl">{speciesEmoji}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white truncate text-base mb-1">
                          {c.petName} · {c.species?.toLowerCase()}
                        </p>
                        <p className="text-xs text-slate-500 font-medium">
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
          <div className="p-8 pt-0">
            <button
              onClick={handleViewFullPage}
              className="
                w-full flex items-center justify-center gap-3
                px-8 py-5 rounded-xl
                bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500
                text-white font-bold text-lg
                shadow-[0_0_40px_rgba(249,115,22,0.6)]
                hover:shadow-[0_0_50px_rgba(249,115,22,0.8)]
                hover:scale-105
                transition-all duration-300
              "
            >
              View Full {division.name} Page
              <ArrowRight size={22} strokeWidth={2.5} />
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
    red: 'text-red-300 bg-gradient-to-br from-red-500/15 to-red-500/5 border-red-500/40 shadow-red-500/10',
    cyan: 'text-cyan-300 bg-gradient-to-br from-cyan-500/15 to-cyan-400/5 border-cyan-500/40 shadow-cyan-500/10',
    green: 'text-green-300 bg-gradient-to-br from-green-500/15 to-green-500/5 border-green-500/40 shadow-green-500/10',
  };

  return (
    <div className={`p-5 rounded-xl border backdrop-blur-sm shadow-lg ${colorClasses[color]} hover:scale-105 transition-transform duration-200`}>
      <Icon size={22} className="mb-3" />
      <div className="text-3xl font-bold text-white mb-2">{value}</div>
      <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{label}</div>
    </div>
  );
}
