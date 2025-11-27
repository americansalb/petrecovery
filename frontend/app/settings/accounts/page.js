'use client';

/**
 * Phase 7: Connected Accounts Settings Page
 *
 * Manage linked social accounts (Google, Facebook, Apple).
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { LinkSocialAccountButton } from '@/app/components/SocialLoginButtons';

const AVAILABLE_PROVIDERS = [
  { id: 'google', name: 'Google' },
  { id: 'facebook', name: 'Facebook' },
  { id: 'apple', name: 'Apple' },
];

export default function AccountsSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasPassword, setHasPassword] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/settings/accounts');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetchLinkedAccounts();
      checkPasswordStatus();
    }
  }, [session]);

  const fetchLinkedAccounts = async () => {
    try {
      const response = await fetch('/api/user/linked-accounts');
      const data = await response.json();

      if (response.ok) {
        setLinkedAccounts(data.accounts || []);
      }
    } catch (err) {
      console.error('Error fetching accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkPasswordStatus = async () => {
    try {
      const response = await fetch('/api/user/profile');
      const data = await response.json();

      if (response.ok) {
        setHasPassword(data.user?.hasPassword || false);
      }
    } catch (err) {
      console.error('Error checking password:', err);
    }
  };

  const handleUnlink = async (provider) => {
    setError('');

    try {
      const response = await fetch(`/api/user/linked-accounts?provider=${provider}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to unlink account');
      }

      // Refresh the list
      await fetchLinkedAccounts();
    } catch (err) {
      setError(err.message);
    }
  };

  const isLinked = (providerId) => {
    return linkedAccounts.some((acc) => acc.provider === providerId);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-200 rounded w-2/3" />
            <div className="space-y-3 mt-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-200 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Connected Accounts</h1>
          <p className="mt-2 text-gray-600">
            Manage your social login connections. You can use any connected account to sign in.
          </p>
        </div>

        {/* Current login method info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-blue-600 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-sm text-blue-800">
                <strong>Current account:</strong> {session?.user?.email}
              </p>
              <p className="text-sm text-blue-700 mt-1">
                {hasPassword
                  ? 'You have a password set. You can sign in with email/password or any connected account.'
                  : 'You don\'t have a password set. You must keep at least one connected account.'}
              </p>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Connected accounts */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Social Accounts
            </h2>

            <div className="space-y-4">
              {AVAILABLE_PROVIDERS.map((provider) => (
                <LinkSocialAccountButton
                  key={provider.id}
                  provider={provider}
                  linked={isLinked(provider.id)}
                  onUnlink={handleUnlink}
                />
              ))}
            </div>
          </div>

          {/* Set password section */}
          {!hasPassword && (
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                Add a Password
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Set a password to enable email/password login as a backup.
              </p>
              <a
                href="/settings/security"
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Set Password
              </a>
            </div>
          )}
        </div>

        {/* Help section */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Need help?{' '}
            <a href="/help/accounts" className="text-blue-600 hover:underline">
              Learn more about connected accounts
            </a>
          </p>
        </div>

        {/* Back link */}
        <div className="mt-6">
          <a
            href="/settings"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Settings
          </a>
        </div>
      </div>
    </div>
  );
}
