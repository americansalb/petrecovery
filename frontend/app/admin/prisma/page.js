'use client';

import { useState } from 'react';

export default function PrismaAdminPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const regeneratePrismaClient = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/prisma-generate', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data);
      }
    } catch (err) {
      setError({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">
          Prisma Client Management
        </h1>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-xl font-semibold text-white mb-4">
            Regenerate Prisma Client
          </h2>
          <p className="text-slate-300 mb-6">
            If you've run database migrations via raw SQL (like the ForcePost tables),
            you need to regenerate the Prisma client so it knows about the new tables.
          </p>

          <button
            onClick={regeneratePrismaClient}
            disabled={loading}
            className="px-6 py-3 bg-cyan-500 text-white rounded-lg font-semibold hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Regenerating...' : 'Regenerate Prisma Client'}
          </button>

          {/* Result */}
          {result && (
            <div className="mt-6 p-4 bg-green-500/10 border border-green-500/50 rounded-lg">
              <h3 className="text-green-400 font-semibold mb-2">✅ Success</h3>
              <p className="text-green-300 text-sm mb-3">{result.message}</p>
              {result.output && (
                <pre className="text-xs text-green-200 bg-slate-900/50 p-3 rounded overflow-x-auto">
                  {result.output}
                </pre>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
              <h3 className="text-red-400 font-semibold mb-2">❌ Error</h3>
              <p className="text-red-300 text-sm mb-3">
                {error.error || 'Unknown error'}
              </p>
              {error.details && (
                <p className="text-red-200 text-xs mb-2">
                  <strong>Details:</strong> {error.details}
                </p>
              )}
              {error.stdout && (
                <div className="mb-2">
                  <p className="text-red-200 text-xs font-semibold mb-1">stdout:</p>
                  <pre className="text-xs text-red-200 bg-slate-900/50 p-3 rounded overflow-x-auto">
                    {error.stdout}
                  </pre>
                </div>
              )}
              {error.stderr && (
                <div>
                  <p className="text-red-200 text-xs font-semibold mb-1">stderr:</p>
                  <pre className="text-xs text-red-200 bg-slate-900/50 p-3 rounded overflow-x-auto">
                    {error.stderr}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-xl font-semibold text-white mb-4">
            When to Use This
          </h2>
          <ul className="text-slate-300 space-y-2 text-sm">
            <li className="flex gap-2">
              <span className="text-cyan-400">•</span>
              <span>After running <code className="bg-slate-900 px-2 py-0.5 rounded">/api/admin/migrate</code> which creates tables via raw SQL</span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400">•</span>
              <span>When you get errors like "Unknown field" or "Model not found" in the API</span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400">•</span>
              <span>After updating the Prisma schema file</span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400">•</span>
              <span>When the posts API returns 500 errors about missing ForcePost model</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
