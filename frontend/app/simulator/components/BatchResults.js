'use client';

/**
 * BatchResults - Analytics dashboard for batch simulation results
 */

import {
  Search, Home, Building2, Share2, Smartphone,
  Clock, AlertTriangle, TrendingUp, BarChart3, PieChart
} from 'lucide-react';

const OUTCOME_LABELS = {
  foundBySearcherCount: { label: 'Found by Searcher', color: '#10b981', icon: Search },
  returnedHomeCount: { label: 'Returned Home', color: '#3b82f6', icon: Home },
  foundViaShelterCount: { label: 'Found via Shelter', color: '#8b5cf6', icon: Building2 },
  foundViaSocialCount: { label: 'Found via Social', color: '#ec4899', icon: Share2 },
  foundViaPlatformCount: { label: 'Found via Platform', color: '#6366f1', icon: Smartphone },
  timeoutSearchingCount: { label: 'Timeout (Searching)', color: '#f59e0b', icon: Clock },
  timeoutShelteredCount: { label: 'Timeout (Sheltered)', color: '#6b7280', icon: AlertTriangle },
};

function formatDuration(minutes) {
  if (!minutes) return 'N/A';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

export default function BatchResults({ batch }) {
  if (!batch) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="text-gray-400 mb-2">
          <BarChart3 className="w-8 h-8 mx-auto" />
        </div>
        <p className="text-sm text-gray-600">No batch results yet</p>
        <p className="text-xs text-gray-400 mt-1">
          Run a batch simulation to see aggregate statistics
        </p>
      </div>
    );
  }

  const total = batch.totalRuns;
  const successCount = (batch.foundBySearcherCount || 0) +
    (batch.returnedHomeCount || 0) +
    (batch.foundViaShelterCount || 0) +
    (batch.foundViaSocialCount || 0) +
    (batch.foundViaPlatformCount || 0);
  const successRate = total > 0 ? ((successCount / total) * 100).toFixed(1) : 0;

  // Calculate confidence interval (simplified)
  const sampleSize = total;
  const intervalWidth = sampleSize < 10 ? 20 : sampleSize < 50 ? 10 : sampleSize < 200 ? 5 : 3;
  const lowerBound = Math.max(0, parseFloat(successRate) - intervalWidth);
  const upperBound = Math.min(100, parseFloat(successRate) + intervalWidth);

  const confidenceLabel = sampleSize < 10 ? 'LOW' : sampleSize < 50 ? 'MEDIUM' : sampleSize < 200 ? 'HIGH' : 'VERY HIGH';

  return (
    <div className="space-y-4">
      {/* Success Rate Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-gray-700">Success Rate</h3>
        </div>

        <div className="text-center py-4">
          <div className="text-4xl font-bold text-gray-900">
            {lowerBound.toFixed(0)}-{upperBound.toFixed(0)}%
          </div>
          <div className="text-sm text-gray-500 mt-1">
            Based on {total} simulations
          </div>
          <div className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${
            confidenceLabel === 'LOW' ? 'bg-red-100 text-red-700' :
            confidenceLabel === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
            'bg-green-100 text-green-700'
          }`}>
            {confidenceLabel} confidence
          </div>
        </div>

        {/* Success bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Found</span>
            <span>Not Found</span>
          </div>
          <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${successRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Time Statistics */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-gray-700">Time to Find</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-semibold text-gray-900">
              {formatDuration(batch.avgTimeToFindMins)}
            </div>
            <div className="text-xs text-gray-500">Average</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-semibold text-gray-900">
              {formatDuration(batch.medianTimeToFindMins)}
            </div>
            <div className="text-xs text-gray-500">Median</div>
          </div>
        </div>

        {batch.avgPetDistanceMiles && (
          <div className="mt-3 text-center p-3 bg-indigo-50 rounded-lg">
            <div className="text-lg font-semibold text-indigo-900">
              {batch.avgPetDistanceMiles.toFixed(2)} mi
            </div>
            <div className="text-xs text-indigo-600">Avg pet displacement</div>
          </div>
        )}
      </div>

      {/* Outcome Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <PieChart className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-gray-700">Outcome Breakdown</h3>
        </div>

        <div className="space-y-2">
          {Object.entries(OUTCOME_LABELS).map(([key, { label, color, icon: Icon }]) => {
            const count = batch[key] || 0;
            const percent = total > 0 ? ((count / total) * 100).toFixed(1) : 0;

            if (count === 0) return null;

            return (
              <div key={key} className="flex items-center gap-3">
                <Icon className="w-4 h-4" style={{ color }} />
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-medium">{count} ({percent}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key Insights */}
      <div className="bg-indigo-50 rounded-lg border border-indigo-100 p-4">
        <h3 className="text-sm font-semibold text-indigo-900 mb-2">Key Insights</h3>
        <ul className="text-xs text-indigo-800 space-y-1">
          {batch.foundBySearcherCount > batch.returnedHomeCount && (
            <li>• Active searching was more effective than waiting for pet to return</li>
          )}
          {batch.returnedHomeCount > batch.foundBySearcherCount && (
            <li>• Many pets returned home on their own - consider posting signs near home</li>
          )}
          {(batch.foundViaShelterCount || 0) > total * 0.1 && (
            <li>• Significant shelter finds - check local shelters daily</li>
          )}
          {(batch.timeoutShelteredCount || 0) > total * 0.05 && (
            <li>• Some pets were picked up but not matched - improve platform visibility</li>
          )}
          {batch.avgTimeToFindMins && batch.avgTimeToFindMins < 360 && (
            <li>• Average find time is under 6 hours - early searching is critical</li>
          )}
          {batch.avgPetDistanceMiles && batch.avgPetDistanceMiles < 0.5 && (
            <li>• Pets stayed close - focus intensive search near last seen location</li>
          )}
        </ul>
      </div>
    </div>
  );
}
