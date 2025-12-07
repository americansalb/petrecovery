'use client';

/**
 * ManageTab - Case Management (Owner/Admin only)
 *
 * Features:
 * - Close Case with detailed outcome recording (Phase 6)
 * - Case metrics and analytics display
 * - Edit Case Details button
 * - Generate Flyer button
 * - Add Photos button
 */

import { useState, useEffect, useCallback } from 'react';
import { Settings, Heart, Edit, Share2, Camera, X, BarChart2 } from 'lucide-react';
import useCaseOutcome from '@/app/mission-control/hooks/useCaseOutcome';
import CaseOutcomeModal from '@/app/components/missionControl/CaseOutcomeModal';
import AnalyticsDashboard from '@/app/components/missionControl/AnalyticsDashboard';

export default function ManageTab({ mission, onUpdate, onMarkReunited, onEditCase, onGenerateFlyer, onAddPhotos }) {
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const {
    metrics,
    outcome,
    loading,
    closing,
    fetchMetrics,
    closeCase,
    isClosed,
  } = useCaseOutcome(mission?.id);

  // Fetch metrics on mount
  useEffect(() => {
    if (mission?.id) {
      fetchMetrics();
    }
  }, [mission?.id, fetchMetrics]);

  const handleCloseCase = useCallback(async (outcomeData) => {
    const result = await closeCase(outcomeData);
    if (result.success) {
      setShowOutcomeModal(false);
      // Notify parent to refresh
      if (onUpdate) onUpdate();
      // If reunited, also call the legacy handler
      if (outcomeData.outcome === 'REUNITED' && onMarkReunited) {
        onMarkReunited();
      }
    } else {
      alert(result.error || 'Failed to close case');
    }
  }, [closeCase, onUpdate, onMarkReunited]);

  if (!mission) return null;

  return (
    <div className="space-y-4 pb-20">
      {/* Case Outcome Modal */}
      <CaseOutcomeModal
        isOpen={showOutcomeModal}
        onClose={() => setShowOutcomeModal(false)}
        onSubmit={handleCloseCase}
        petName={mission.petName}
        caseMetrics={metrics}
        submitting={closing}
      />

      {/* Analytics Panel */}
      {showAnalytics && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Platform Analytics</h2>
              <button onClick={() => setShowAnalytics(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <AnalyticsDashboard />
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-4">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          <Settings size={18} className="text-purple-400" />
          Case Management
        </h3>
        <div className="space-y-3">
          {/* Close Case - Primary action (replaces Mark as Reunited) */}
          {!isClosed ? (
            <button
              onClick={() => setShowOutcomeModal(true)}
              className="w-full py-3 px-4 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-bold rounded-xl hover:bg-emerald-500/30 transition flex items-center justify-center gap-2"
            >
              <Heart size={18} />
              Close Case / Mark Reunited
            </button>
          ) : (
            <div className="w-full py-3 px-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold rounded-xl text-center">
              {outcome?.outcome === 'REUNITED' ? '🎉 Case Reunited!' : '📋 Case Closed'}
              {outcome?.timeToReunionHours && (
                <span className="block text-sm text-emerald-400/70 mt-1">
                  Resolved in {Math.round(outcome.timeToReunionHours)} hours
                </span>
              )}
            </div>
          )}

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

      {/* Case Metrics (from Phase 6 analytics) */}
      {metrics && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <BarChart2 size={16} className="text-flash-400" />
            Case Progress
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-flash-400">{metrics.totalFlyersPosted || 0}</p>
              <p className="text-slate-500 text-xs">Flyers Posted</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-flash-400">{metrics.totalSheltersContacted || 0}</p>
              <p className="text-slate-500 text-xs">Shelters Contacted</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-flash-400">{Math.round(metrics.totalSearchHours || 0)}</p>
              <p className="text-slate-500 text-xs">Search Hours</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-flash-400">{metrics.sightingsCount || 0}</p>
              <p className="text-slate-500 text-xs">Sightings</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-flash-400">{metrics.verifiedActionsCount || 0}</p>
              <p className="text-slate-500 text-xs">Verified Actions</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-flash-400">{metrics.teamMembersCount || 0}</p>
              <p className="text-slate-500 text-xs">Team Members</p>
            </div>
          </div>
        </div>
      )}

      {/* Legacy Case Stats (if available) */}
      {mission.stats && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <h3 className="text-white font-bold mb-3">Visibility</h3>
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

      {/* Platform Analytics Button */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
        <button
          onClick={() => setShowAnalytics(true)}
          className="w-full py-3 px-4 bg-indigo-500/20 border border-indigo-500/50 text-indigo-400 font-semibold rounded-xl hover:bg-indigo-500/30 transition flex items-center justify-center gap-2"
        >
          <BarChart2 size={18} />
          View Platform Analytics
        </button>
        <p className="text-center text-slate-500 text-xs mt-2">
          See what actions help pets get home faster
        </p>
      </div>
    </div>
  );
}
