'use client';

/**
 * Configuration Check Page
 *
 * Visit this page to check if Bunny.net and other services are configured correctly
 * Route: /admin/check-config
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function CheckConfigPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/check-config');
      const data = await response.json();

      if (response.ok) {
        setConfig(data);
      } else {
        setError(data.error || 'Failed to load configuration');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) return;
    loadConfig();
  }, [session, status]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mb-4"></div>
          <p className="text-slate-400">Loading configuration...</p>
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
          <p className="text-slate-300 mb-6">You must be logged in to check configuration.</p>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">
              Configuration Check
            </h1>
            <button
              onClick={loadConfig}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700 text-cyan-400 hover:bg-slate-700 transition-all flex items-center gap-2"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
          <p className="text-slate-400">Check if all services are configured correctly on the deployed server</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border-2 border-red-500/50 rounded-xl">
            <p className="text-red-400 font-medium">{error}</p>
          </div>
        )}

        {config && (
          <>
            {/* Overall Status */}
            <div className={`mb-6 p-6 rounded-2xl border-2 ${
              config.ready
                ? 'bg-green-500/10 border-green-500/50'
                : 'bg-red-500/10 border-red-500/50'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                {config.ready ? (
                  <CheckCircle className="text-green-400" size={24} />
                ) : (
                  <XCircle className="text-red-400" size={24} />
                )}
                <h2 className="text-2xl font-bold text-white">
                  {config.ready ? 'All Systems Ready' : 'Configuration Issues Detected'}
                </h2>
              </div>
              <p className="text-slate-300">
                {config.ready
                  ? 'All services are configured correctly and working.'
                  : 'Some services need attention. Check details below.'}
              </p>
            </div>

            {/* Bunny.net Configuration */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 mb-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                🐰 Bunny.net Configuration
              </h3>

              <div className="space-y-4">
                <ConfigItem
                  label="Storage Zone"
                  configured={config.config.bunnynet.storageZone.configured}
                  value={config.config.bunnynet.storageZone.value}
                  isPlaceholder={config.config.bunnynet.storageZone.isPlaceholder}
                />
                <ConfigItem
                  label="API Key"
                  configured={config.config.bunnynet.apiKey.configured}
                  value={config.config.bunnynet.apiKey.value}
                  isPlaceholder={config.config.bunnynet.apiKey.isPlaceholder}
                />
                <ConfigItem
                  label="CDN URL"
                  configured={config.config.bunnynet.cdnUrl.configured}
                  value={config.config.bunnynet.cdnUrl.value}
                />
                <ConfigItem
                  label="Storage URL"
                  configured={config.config.bunnynet.storageUrl.configured}
                  value={config.config.bunnynet.storageUrl.value}
                />
              </div>
            </div>

            {/* Upload Test Results */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                📤 Upload Test
              </h3>

              {config.uploadTest.status === 'success' && (
                <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/50 rounded-xl">
                  <CheckCircle className="text-green-400 flex-shrink-0 mt-1" size={20} />
                  <div>
                    <p className="text-green-400 font-medium">{config.uploadTest.message}</p>
                    <p className="text-sm text-slate-400 mt-1">Status Code: {config.uploadTest.statusCode}</p>
                  </div>
                </div>
              )}

              {config.uploadTest.status === 'failed' && (
                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/50 rounded-xl">
                  <XCircle className="text-red-400 flex-shrink-0 mt-1" size={20} />
                  <div>
                    <p className="text-red-400 font-medium">{config.uploadTest.message}</p>
                    <p className="text-sm text-slate-300 mt-1">Status Code: {config.uploadTest.statusCode}</p>
                    {config.uploadTest.error && (
                      <pre className="text-xs text-slate-400 mt-2 p-2 bg-slate-900/50 rounded overflow-x-auto">
{config.uploadTest.error}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {config.uploadTest.status === 'error' && (
                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/50 rounded-xl">
                  <AlertCircle className="text-red-400 flex-shrink-0 mt-1" size={20} />
                  <div>
                    <p className="text-red-400 font-medium">{config.uploadTest.message}</p>
                    <p className="text-sm text-slate-300 mt-1">{config.uploadTest.error}</p>
                  </div>
                </div>
              )}

              {config.uploadTest.status === 'skipped' && (
                <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-xl">
                  <AlertCircle className="text-yellow-400 flex-shrink-0 mt-1" size={20} />
                  <div>
                    <p className="text-yellow-400 font-medium">Upload test skipped</p>
                    <p className="text-sm text-slate-300 mt-1">{config.uploadTest.reason}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Help Section */}
            {!config.ready && (
              <div className="mt-6 bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-3">How to Fix</h3>
                <div className="space-y-2 text-slate-300 text-sm">
                  <p>1. Go to your Render dashboard → Environment Variables</p>
                  <p>2. Set these variables with your actual Bunny.net credentials:</p>
                  <pre className="bg-slate-900/50 p-3 rounded mt-2 text-xs overflow-x-auto">
BUNNY_STORAGE_ZONE=your-storage-zone-name
BUNNY_API_KEY=your-api-key-here
BUNNY_CDN_URL=https://your-pull-zone.b-cdn.net
                  </pre>
                  <p className="mt-3">3. Click "Save" and wait for automatic redeploy to complete</p>
                  <p>4. Refresh this page to verify the fix</p>
                </div>
              </div>
            )}

            {/* Environment Info */}
            <div className="mt-6 text-center text-sm text-slate-500">
              <p>Environment: {config.config.environment}</p>
              <p>Checked at: {new Date(config.config.timestamp).toLocaleString()}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ConfigItem({ label, configured, value, isPlaceholder }) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded-lg">
      <span className="text-slate-300 font-medium">{label}</span>
      <div className="flex items-center gap-2">
        {configured && !isPlaceholder ? (
          <>
            <CheckCircle className="text-green-400" size={18} />
            <span className="text-slate-400 text-sm font-mono">{value}</span>
          </>
        ) : isPlaceholder ? (
          <>
            <AlertCircle className="text-yellow-400" size={18} />
            <span className="text-yellow-400 text-sm">Placeholder value!</span>
          </>
        ) : (
          <>
            <XCircle className="text-red-400" size={18} />
            <span className="text-red-400 text-sm">Not set</span>
          </>
        )}
      </div>
    </div>
  );
}
