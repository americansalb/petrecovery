'use client';

import { ChevronLeft, Share2, MoreVertical } from 'lucide-react';

export default function CaseHeader({
  caseData,
  onBack,
  showBackButton = true
}) {
  if (!caseData) return null;

  const hours = caseData.hoursMissing || 0;
  const isUrgent = hours < 4;
  const urgencyColor = isUrgent ? 'text-red-400' : hours < 24 ? 'text-amber-400' : 'text-green-400';
  const urgencyBg = isUrgent ? 'bg-red-500/10 border-red-500/20' : hours < 24 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-green-500/10 border-green-500/20';

  return (
    <div className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 p-4 z-40">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {showBackButton && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white">
                {caseData.petName}
              </h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${urgencyBg} ${urgencyColor}`}>
                Missing {caseData.timeMissing}
              </span>
            </div>
            <p className="text-sm text-slate-400 flex items-center gap-2">
              <span>{caseData.petBreed}</span>
              <span>•</span>
              <span>{caseData.lastSeenAddress}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
            <Share2 size={20} />
          </button>
          <button className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Urgent Banner */}
      {isUrgent && (
        <div className="mt-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 animate-pulse">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <p className="text-xs font-bold text-red-400">
            CRITICAL: First 4 hours are most important. Active search required.
          </p>
        </div>
      )}
    </div>
  );
}
