'use client';

/**
 * Auto-Migration Page
 *
 * Visit this page once to automatically apply database migrations
 * Route: /admin/auto-migrate
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function AutoMigratePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [migrationStatus, setMigrationStatus] = useState('checking');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      setMigrationStatus('unauthenticated');
      return;
    }

    // Auto-run migration
    runMigration();
  }, [session, status]);

  const runMigration = async () => {
    setMigrationStatus('running');
    setError(null);

    try {
      console.log('🔄 Running database migration...');

      const response = await fetch('/api/admin/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Migration successful:', data);
        setMigrationStatus('success');
        setResult(data);
      } else {
        console.error('❌ Migration failed:', data);
        setMigrationStatus('error');
        setError(data.error || 'Migration failed');
      }
    } catch (err) {
      console.error('❌ Migration error:', err);
      setMigrationStatus('error');
      setError(err.message);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-sm border-2 border-red-500/50 rounded-2xl p-8 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-white mb-4">Authentication Required</h1>
          <p className="text-slate-300 mb-6">You must be logged in to run database migrations.</p>
          <button
            onClick={() => router.push('/api/auth/signin')}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 text-white font-bold hover:shadow-lg transition-all"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {migrationStatus === 'checking' && (
          <div className="bg-slate-800/50 backdrop-blur-sm border-2 border-cyan-500/50 rounded-2xl p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mb-4"></div>
            <h1 className="text-2xl font-bold text-white mb-2">Checking...</h1>
            <p className="text-slate-400">Preparing to run migration</p>
          </div>
        )}

        {migrationStatus === 'running' && (
          <div className="bg-slate-800/50 backdrop-blur-sm border-2 border-cyan-500/50 rounded-2xl p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-cyan-400 mb-6"></div>
            <h1 className="text-3xl font-bold text-white mb-3">Running Migration...</h1>
            <p className="text-slate-400 text-lg">Creating database tables for community posts</p>
            <div className="mt-6 space-y-2 text-left bg-slate-900/50 rounded-xl p-4">
              <p className="text-sm text-slate-500">⏳ Creating ForcePost table...</p>
              <p className="text-sm text-slate-500">⏳ Creating ForcePostComment table...</p>
              <p className="text-sm text-slate-500">⏳ Creating ForcePostVote table...</p>
              <p className="text-sm text-slate-500">⏳ Creating ForceCommentVote table...</p>
            </div>
          </div>
        )}

        {migrationStatus === 'success' && (
          <div className="bg-slate-800/50 backdrop-blur-sm border-2 border-green-500/50 rounded-2xl p-8 text-center">
            <div className="text-8xl mb-6">✅</div>
            <h1 className="text-4xl font-bold text-white mb-4">Migration Successful!</h1>
            <p className="text-green-400 text-xl mb-6">Database tables created successfully</p>

            <div className="bg-slate-900/50 rounded-xl p-6 mb-6 text-left">
              <h2 className="text-lg font-bold text-white mb-3">Created Tables:</h2>
              <div className="space-y-2">
                {result?.tables?.map(table => (
                  <div key={table} className="flex items-center gap-3">
                    <span className="text-green-400">✓</span>
                    <span className="text-slate-300">{table}</span>
                  </div>
                ))}
              </div>
              {result?.message && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <p className="text-sm text-slate-400">{result.message}</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={() => router.push('/')}
                className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 text-white font-bold text-lg hover:shadow-xl transition-all"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => router.back()}
                className="w-full px-6 py-3 rounded-xl bg-slate-700 text-white font-semibold hover:bg-slate-600 transition-all"
              >
                Go Back
              </button>
            </div>
          </div>
        )}

        {migrationStatus === 'error' && (
          <div className="bg-slate-800/50 backdrop-blur-sm border-2 border-red-500/50 rounded-2xl p-8 text-center">
            <div className="text-8xl mb-6">❌</div>
            <h1 className="text-4xl font-bold text-white mb-4">Migration Failed</h1>
            <p className="text-red-400 text-xl mb-6">{error || 'Unknown error occurred'}</p>

            <div className="bg-slate-900/50 rounded-xl p-6 mb-6 text-left">
              <h2 className="text-lg font-bold text-white mb-3">Possible Solutions:</h2>
              <ul className="space-y-2 text-slate-300">
                <li>• Check database connection is working</li>
                <li>• Verify DATABASE_URL environment variable is set</li>
                <li>• Migration may have already been applied</li>
              </ul>
            </div>

            <button
              onClick={runMigration}
              className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 text-white font-bold text-lg hover:shadow-xl transition-all"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
