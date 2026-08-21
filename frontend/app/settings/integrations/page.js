'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/components/ui/Toast';
import {
  Slack,
  MessageSquare,
  Plus,
  Trash2,
  TestTube,
  Check,
  X,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

export default function IntegrationsSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [testingId, setTestingId] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchIntegrations();
    }
  }, [status, router]);

  const fetchIntegrations = async () => {
    try {
      const res = await fetch('/api/integrations');
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.integrations || []);
      }
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (integrationId) => {
    setTestingId(integrationId);
    try {
      const res = await fetch(`/api/integrations/${integrationId}/test`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Test message sent!');
      } else {
        toast.error('Test failed: ' + data.error);
      }
    } catch (error) {
      toast.error('Failed to test integration.');
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (integrationId) => {
    if (!confirm('Are you sure you want to delete this integration?')) return;

    try {
      const res = await fetch(`/api/integrations/${integrationId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setIntegrations(integrations.filter((i) => i.id !== integrationId));
      }
    } catch (error) {
      toast.error('Failed to delete integration.');
    }
  };

  const handleToggle = async (integrationId, isActive) => {
    try {
      const res = await fetch(`/api/integrations/${integrationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (res.ok) {
        setIntegrations(
          integrations.map((i) =>
            i.id === integrationId ? { ...i, isActive: !isActive } : i
          )
        );
      }
    } catch (error) {
      toast.error('Failed to update integration.');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
              <p className="text-gray-600 mt-1">
                Connect Slack and Discord to receive pet alerts
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add Integration
            </button>
          </div>

          {/* Integration Types Info */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-purple-100 p-2 rounded-lg">
                  <Slack className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Slack</h3>
                  <p className="text-sm text-gray-600">
                    Send alerts to Slack channels
                  </p>
                </div>
              </div>
              <a
                href="https://api.slack.com/messaging/webhooks"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                Get Webhook URL <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-indigo-100 p-2 rounded-lg">
                  <MessageSquare className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Discord</h3>
                  <p className="text-sm text-gray-600">
                    Send alerts to Discord channels
                  </p>
                </div>
              </div>
              <a
                href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                Get Webhook URL <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Existing Integrations */}
          <h2 className="text-lg font-semibold mb-4">Your Integrations</h2>

          {integrations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No integrations configured yet</p>
              <p className="text-sm">Add a Slack or Discord webhook to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {integrations.map((integration) => (
                <div
                  key={integration.id}
                  className={`border rounded-lg p-4 ${
                    integration.isActive ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {integration.type === 'SLACK' ? (
                        <div className="bg-purple-100 p-2 rounded-lg">
                          <Slack className="w-5 h-5 text-purple-600" />
                        </div>
                      ) : (
                        <div className="bg-indigo-100 p-2 rounded-lg">
                          <MessageSquare className="w-5 h-5 text-indigo-600" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-medium">
                          {integration.name || integration.type}
                        </h3>
                        <div className="text-sm text-gray-600 flex items-center gap-2">
                          {integration.case && (
                            <span>Case: {integration.case.petName}</span>
                          )}
                          {integration.rescueSquad && (
                            <span>Squad: {integration.rescueSquad.name}</span>
                          )}
                          {!integration.case && !integration.rescueSquad && (
                            <span>All notifications</span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              integration.isActive
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {integration.isActive ? 'Active' : 'Paused'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTest(integration.id)}
                        disabled={testingId === integration.id}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                        title="Send test message"
                      >
                        {testingId === integration.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <TestTube className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() =>
                          handleToggle(integration.id, integration.isActive)
                        }
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                        title={integration.isActive ? 'Pause' : 'Activate'}
                      >
                        {integration.isActive ? (
                          <X className="w-4 h-4" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(integration.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Integration Modal */}
      {showAddModal && (
        <AddIntegrationModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchIntegrations();
          }}
        />
      )}
    </div>
  );
}

function AddIntegrationModal({ onClose, onSuccess }) {
  const [type, setType] = useState('SLACK');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          webhookUrl,
          name: name || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create integration');
      }

      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Add Integration</h2>

          <form method="post" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Type</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value="SLACK"
                    checked={type === 'SLACK'}
                    onChange={(e) => setType(e.target.value)}
                  />
                  <Slack className="w-4 h-4 text-purple-600" />
                  Slack
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value="DISCORD"
                    checked={type === 'DISCORD'}
                    onChange={(e) => setType(e.target.value)}
                  />
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  Discord
                </label>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Webhook URL
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                placeholder={
                  type === 'SLACK'
                    ? 'https://hooks.slack.com/services/...'
                    : 'https://discord.com/api/webhooks/...'
                }
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {type === 'SLACK'
                  ? 'Get this from Slack App settings > Incoming Webhooks'
                  : 'Get this from Discord channel settings > Integrations > Webhooks'}
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Name (optional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="e.g., Lost Pets Channel"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !webhookUrl}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Add Integration'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
