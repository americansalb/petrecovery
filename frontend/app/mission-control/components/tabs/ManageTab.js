'use client';

/**
 * ManageTab - Case Management (Owner/Admin only)
 *
 * Features preserved from original:
 * - Mark as Reunited button
 * - Edit Case Details button
 * - Generate Flyer button
 * - Add Photos button
 */

import { Settings, Heart, Edit, Share2, Camera } from 'lucide-react';

export default function ManageTab({ mission, onUpdate, onMarkReunited, onEditCase, onGenerateFlyer, onAddPhotos }) {
  if (!mission) return null;

  return (
    <div className="space-y-4 pb-20">
      <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-4">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          <Settings size={18} className="text-purple-400" />
          Case Management
        </h3>
        <div className="space-y-3">
          {/* Mark as Reunited - Primary action */}
          <button
            onClick={onMarkReunited}
            className="w-full py-3 px-4 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-bold rounded-xl hover:bg-emerald-500/30 transition flex items-center justify-center gap-2"
          >
            <Heart size={18} />
            Mark as Reunited
          </button>

          {/* Edit Case Details */}
          <button
            onClick={onEditCase}
            className="w-full py-3 px-4 bg-slate-900 border border-slate-700 text-white font-semibold rounded-xl hover:border-flash-500/50 transition flex items-center justify-center gap-2"
          >
            <Edit size={18} />
            Edit Case Details
          </button>

          {/* Generate Flyer */}
          <button
            onClick={onGenerateFlyer}
            className="w-full py-3 px-4 bg-slate-900 border border-slate-700 text-white font-semibold rounded-xl hover:border-flash-500/50 transition flex items-center justify-center gap-2"
          >
            <Share2 size={18} />
            Generate Flyer
          </button>

          {/* Add Photos */}
          <button
            onClick={onAddPhotos}
            className="w-full py-3 px-4 bg-slate-900 border border-slate-700 text-white font-semibold rounded-xl hover:border-flash-500/50 transition flex items-center justify-center gap-2"
          >
            <Camera size={18} />
            Add Photos
          </button>
        </div>
      </div>

      {/* Case Stats (if available) */}
      {mission.stats && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <h3 className="text-white font-bold mb-3">Case Statistics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-flash-400">{mission.stats?.views || 0}</p>
              <p className="text-slate-500 text-xs">Total Views</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-flash-400">{mission.stats?.shares || 0}</p>
              <p className="text-slate-500 text-xs">Shares</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
