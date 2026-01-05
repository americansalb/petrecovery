'use client';

/**
 * Monte Carlo Simulation Page
 * Based on BEHAVIORAL_PROFILES.md research
 */

import { useState } from 'react';
import { DOG_TEMPERAMENTS, CAT_TEMPERAMENTS } from '@/app/lib/behavioral-simulation';

interface SimResult {
  type: 'single' | 'batch';
  profile: {
    species: string;
    temperament: string;
    temperamentName: string;
  };
  result: any;
  path?: any[];
  sampleSimulations?: any[];
}

export default function SimulatePage() {
  const [species, setSpecies] = useState<'dog' | 'cat'>('dog');
  const [temperament, setTemperament] = useState('C');
  const [latitude, setLatitude] = useState(37.7749);
  const [longitude, setLongitude] = useState(-122.4194);
  const [maxHours, setMaxHours] = useState(72);
  const [numSearchers, setNumSearchers] = useState(3);
  const [batchSize, setBatchSize] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const temperaments = species === 'dog' ? DOG_TEMPERAMENTS : CAT_TEMPERAMENTS;

  const runSimulation = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          species,
          temperament,
          latitude,
          longitude,
          maxHours,
          numSearchers,
          batchSize: batchSize > 1 ? batchSize : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Simulation failed');
      }

      setResult(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Lost Pet Monte Carlo Simulation
        </h1>
        <p className="text-gray-600 mb-8">
          Based on research-backed behavioral profiles (Huang 2018, Kremer 2021, Weiss 2012)
        </p>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Configuration</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Species */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Species
              </label>
              <select
                value={species}
                onChange={(e) => {
                  setSpecies(e.target.value as 'dog' | 'cat');
                  setTemperament(e.target.value === 'dog' ? 'C' : 'CAU');
                }}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="dog">Dog</option>
                <option value="cat">Cat</option>
              </select>
            </div>

            {/* Temperament */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Temperament
              </label>
              <select
                value={temperament}
                onChange={(e) => setTemperament(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              >
                {Object.entries(temperaments).map(([code, params]) => (
                  <option key={code} value={code}>
                    {code} - {params.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {temperaments[temperament as keyof typeof temperaments]?.description}
              </p>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Latitude
              </label>
              <input
                type="number"
                step="0.0001"
                value={latitude}
                onChange={(e) => setLatitude(parseFloat(e.target.value))}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Longitude
              </label>
              <input
                type="number"
                step="0.0001"
                value={longitude}
                onChange={(e) => setLongitude(parseFloat(e.target.value))}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>

            {/* Simulation params */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Hours
              </label>
              <input
                type="number"
                value={maxHours}
                onChange={(e) => setMaxHours(parseInt(e.target.value))}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Searchers
              </label>
              <input
                type="number"
                value={numSearchers}
                onChange={(e) => setNumSearchers(parseInt(e.target.value))}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>

            {/* Batch size */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Batch Size (1 = single simulation, 100+ = Monte Carlo)
              </label>
              <input
                type="number"
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value))}
                min={1}
                max={1000}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
          </div>

          <button
            onClick={runSimulation}
            disabled={loading}
            className="mt-6 w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Running Simulation...' : 'Run Simulation'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">
              Results - {result.profile.temperamentName} {result.profile.species}
            </h2>

            {result.type === 'batch' ? (
              <div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-green-700">
                      {result.result.successRate}%
                    </div>
                    <div className="text-sm text-green-600">Recovery Rate</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-blue-700">
                      {result.result.medianTimeToFindHours || 'N/A'}h
                    </div>
                    <div className="text-sm text-blue-600">Median Time</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-purple-700">
                      {result.result.avgDistanceM}m
                    </div>
                    <div className="text-sm text-purple-600">Avg Distance</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-gray-700">
                      {result.result.totalRuns}
                    </div>
                    <div className="text-sm text-gray-600">Total Runs</div>
                  </div>
                </div>

                <h3 className="font-medium mb-2">Outcome Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                  <div className="bg-gray-100 rounded p-2 text-center">
                    <div className="font-bold">{result.result.outcomes.captured}</div>
                    <div className="text-xs">Captured</div>
                  </div>
                  <div className="bg-gray-100 rounded p-2 text-center">
                    <div className="font-bold">{result.result.outcomes.selfReturn}</div>
                    <div className="text-xs">Self Return</div>
                  </div>
                  <div className="bg-gray-100 rounded p-2 text-center">
                    <div className="font-bold">{result.result.outcomes.timeout}</div>
                    <div className="text-xs">Timeout</div>
                  </div>
                  <div className="bg-gray-100 rounded p-2 text-center">
                    <div className="font-bold">{result.result.outcomes.deceased}</div>
                    <div className="text-xs">Deceased</div>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className={`rounded-lg p-4 ${
                    result.result.outcome === 'captured' || result.result.outcome === 'self_return'
                      ? 'bg-green-50'
                      : 'bg-red-50'
                  }`}>
                    <div className="text-lg font-bold">
                      {result.result.outcomeDescription}
                    </div>
                    <div className="text-sm text-gray-600">Outcome</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-lg font-bold">
                      {result.result.timeToOutcomeHours
                        ? `${result.result.timeToOutcomeHours.toFixed(1)}h`
                        : 'N/A'}
                    </div>
                    <div className="text-sm text-gray-600">Time to Outcome</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="font-bold">{result.result.maxDistanceFromHomeM}m</div>
                    <div className="text-xs text-gray-500">Max Distance</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold">{result.result.petDistanceM}m</div>
                    <div className="text-xs text-gray-500">Total Distance</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold">{result.result.stats.avgFear.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">Avg Fear</div>
                  </div>
                </div>

                {result.path && (
                  <div className="mt-4">
                    <h3 className="font-medium mb-2">Path Preview (first 10 points)</h3>
                    <div className="text-xs font-mono bg-gray-100 rounded p-2 overflow-x-auto">
                      {result.path.slice(0, 10).map((p: any, i: number) => (
                        <div key={i}>
                          {p.hour.toFixed(1)}h: ({p.lat.toFixed(4)}, {p.lng.toFixed(4)}) - {p.state}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Research info */}
        <div className="mt-8 text-sm text-gray-500">
          <p className="mb-2">
            <strong>Research Foundation:</strong>
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Huang et al. (2018) - Cat displacement distributions</li>
            <li>Kremer et al. (2021) - Dog displacement patterns</li>
            <li>Weiss et al. (2012) - Recovery outcome rates</li>
            <li>Albrecht - Threshold phenomenon, temperament profiles</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
