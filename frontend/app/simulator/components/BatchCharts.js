'use client';

/**
 * BatchCharts - Visualization charts for batch simulation results
 *
 * For research and calibration, showing:
 * - Outcome distribution (pie chart)
 * - Time to find distribution (histogram)
 * - Distance traveled distribution
 * - Pet state when found
 */

import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from 'recharts';

const OUTCOME_COLORS = {
  FOUND_BY_SEARCHER: '#10b981',
  RETURNED_HOME: '#3b82f6',
  FOUND_VIA_SHELTER: '#8b5cf6',
  FOUND_VIA_SOCIAL: '#ec4899',
  FOUND_VIA_PLATFORM: '#6366f1',
  TIMEOUT_SEARCHING: '#f59e0b',
  TIMEOUT_SHELTERED: '#6b7280',
};

const OUTCOME_LABELS = {
  FOUND_BY_SEARCHER: 'Searcher',
  RETURNED_HOME: 'Home',
  FOUND_VIA_SHELTER: 'Shelter',
  FOUND_VIA_SOCIAL: 'Social',
  FOUND_VIA_PLATFORM: 'Platform',
  TIMEOUT_SEARCHING: 'Timeout',
  TIMEOUT_SHELTERED: 'T/O Sheltered',
};

const STATE_COLORS = {
  FLEEING: '#ef4444',
  HIDING: '#8b5cf6',
  FORAGING: '#f59e0b',
  WANDERING: '#10b981',
  TERRITORIAL: '#3b82f6',
  SHELTERED: '#6b7280',
};

export default function BatchCharts({ batch }) {
  if (!batch || !batch.simulations || batch.simulations.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-600">No simulation data available for charts</p>
        <p className="text-xs text-gray-400 mt-1">Run a batch simulation to see visualizations</p>
      </div>
    );
  }

  const simulations = batch.simulations;

  // Prepare outcome data for pie chart
  const outcomeCounts = {};
  simulations.forEach(sim => {
    const outcome = sim.outcome || 'UNKNOWN';
    outcomeCounts[outcome] = (outcomeCounts[outcome] || 0) + 1;
  });

  const outcomeData = Object.entries(outcomeCounts)
    .map(([outcome, count]) => ({
      name: OUTCOME_LABELS[outcome] || outcome,
      value: count,
      color: OUTCOME_COLORS[outcome] || '#9ca3af',
      fullName: outcome,
    }))
    .sort((a, b) => b.value - a.value);

  // Prepare time to find histogram data
  const foundSims = simulations.filter(sim =>
    sim.foundAtMinute && !sim.outcome?.startsWith('TIMEOUT')
  );

  const timeBuckets = [
    { range: '0-1h', min: 0, max: 60, count: 0 },
    { range: '1-3h', min: 60, max: 180, count: 0 },
    { range: '3-6h', min: 180, max: 360, count: 0 },
    { range: '6-12h', min: 360, max: 720, count: 0 },
    { range: '12-24h', min: 720, max: 1440, count: 0 },
    { range: '24-48h', min: 1440, max: 2880, count: 0 },
    { range: '48-72h', min: 2880, max: 4320, count: 0 },
    { range: '72h+', min: 4320, max: Infinity, count: 0 },
  ];

  foundSims.forEach(sim => {
    const bucket = timeBuckets.find(b => sim.foundAtMinute >= b.min && sim.foundAtMinute < b.max);
    if (bucket) bucket.count++;
  });

  const timeData = timeBuckets.map(b => ({
    name: b.range,
    count: b.count,
    percent: foundSims.length > 0 ? ((b.count / foundSims.length) * 100).toFixed(1) : 0,
  }));

  // Prepare distance distribution
  const distanceBuckets = [
    { range: '<0.25mi', min: 0, max: 0.25, count: 0 },
    { range: '0.25-0.5', min: 0.25, max: 0.5, count: 0 },
    { range: '0.5-1mi', min: 0.5, max: 1, count: 0 },
    { range: '1-2mi', min: 1, max: 2, count: 0 },
    { range: '2-3mi', min: 2, max: 3, count: 0 },
    { range: '3-5mi', min: 3, max: 5, count: 0 },
    { range: '5mi+', min: 5, max: Infinity, count: 0 },
  ];

  simulations.forEach(sim => {
    const dist = sim.petDistanceMiles || 0;
    const bucket = distanceBuckets.find(b => dist >= b.min && dist < b.max);
    if (bucket) bucket.count++;
  });

  const distanceData = distanceBuckets.map(b => ({
    name: b.range,
    count: b.count,
    percent: simulations.length > 0 ? ((b.count / simulations.length) * 100).toFixed(1) : 0,
  }));

  // Prepare state when found data
  const stateCounts = {};
  foundSims.forEach(sim => {
    const state = sim.finalPetState || 'UNKNOWN';
    stateCounts[state] = (stateCounts[state] || 0) + 1;
  });

  const stateData = Object.entries(stateCounts)
    .map(([state, count]) => ({
      name: state,
      count,
      color: STATE_COLORS[state] || '#9ca3af',
      percent: foundSims.length > 0 ? ((count / foundSims.length) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Calculate cumulative success over time
  const sortedByTime = [...foundSims].sort((a, b) => a.foundAtMinute - b.foundAtMinute);
  const cumulativeData = [];
  const totalSims = simulations.length;

  // Sample at regular intervals
  const maxTime = batch.maxSimulationHours ? batch.maxSimulationHours * 60 : 4320;
  for (let t = 0; t <= maxTime; t += 60) { // Every hour
    const foundByTime = sortedByTime.filter(s => s.foundAtMinute <= t).length;
    cumulativeData.push({
      hour: t / 60,
      found: foundByTime,
      percent: ((foundByTime / totalSims) * 100).toFixed(1),
    });
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2 text-xs">
          <p className="font-medium text-gray-900">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Outcome Distribution */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Outcome Distribution</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={outcomeData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={true}
              >
                {outcomeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {outcomeData.map((entry, index) => (
            <div key={index} className="flex items-center gap-1 text-xs">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: entry.color }}></div>
              <span>{entry.name}: {entry.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cumulative Success Over Time */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Cumulative Recovery Rate Over Time</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cumulativeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 10 }}
                label={{ value: 'Hours', position: 'insideBottom', offset: -5, fontSize: 10 }}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                label={{ value: '% Found', angle: -90, position: 'insideLeft', fontSize: 10 }}
                domain={[0, 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="percent"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                name="Found %"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-gray-500 text-center mt-2">
          Shows percentage of pets recovered over simulation time
        </p>
      </div>

      {/* Time to Find Histogram */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Time to Find Distribution</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#3b82f6" name="Count" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-gray-500 text-center mt-2">
          {foundSims.length} of {simulations.length} simulations resulted in a find
        </p>
      </div>

      {/* Distance Distribution */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Pet Travel Distance Distribution</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#8b5cf6" name="Count" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-gray-500 text-center mt-2">
          Avg distance: {batch.avgPetDistanceMiles?.toFixed(2) || 'N/A'} miles
        </p>
      </div>

      {/* State When Found */}
      {stateData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Pet State When Found</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stateData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]}>
                  {stateData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-500 text-center mt-2">
            Pet behavior state at time of recovery
          </p>
        </div>
      )}

      {/* Research Summary */}
      <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-4">
        <h3 className="text-sm font-semibold text-indigo-900 mb-3">📊 Research Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-indigo-700 font-medium">Sample Size</div>
            <div className="text-2xl font-bold text-indigo-900">{simulations.length}</div>
          </div>
          <div>
            <div className="text-indigo-700 font-medium">Success Rate</div>
            <div className="text-2xl font-bold text-indigo-900">
              {((foundSims.length / simulations.length) * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-indigo-700 font-medium">Median Time</div>
            <div className="text-2xl font-bold text-indigo-900">
              {batch.medianTimeToFindMins ? `${(batch.medianTimeToFindMins / 60).toFixed(1)}h` : 'N/A'}
            </div>
          </div>
          <div>
            <div className="text-indigo-700 font-medium">Avg Distance</div>
            <div className="text-2xl font-bold text-indigo-900">
              {batch.avgPetDistanceMiles?.toFixed(2) || 'N/A'} mi
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-indigo-200">
          <div className="text-xs text-indigo-800">
            <strong>Statistical Note:</strong> For research publication, recommend minimum 200 simulations
            for confidence interval ±5%. Current confidence: {simulations.length < 50 ? 'LOW' : simulations.length < 200 ? 'MEDIUM' : 'HIGH'}
          </div>
        </div>
      </div>
    </div>
  );
}
