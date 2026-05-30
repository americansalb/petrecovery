'use client';


// Dynamic render (no static prerender) so useSearchParams is valid without a
// Suspense boundary; otherwise next build fails the prerender. Auth/personalized
// pages are dynamic anyway.
export const dynamic = "force-dynamic";

/**
 * Settings Page
 * Main settings hub with tabs for different settings sections
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/app/components/ui/Toast';

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'account';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/settings');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">Settings</div>
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const tabs = [
    { id: 'account', label: 'Account', href: '/settings?tab=account', icon: '👤' },
    { id: 'notifications', label: 'Notifications', href: '/settings/notifications', icon: '🔔' },
    { id: 'accounts', label: 'Connected Accounts', href: '/settings/accounts', icon: '🔗' },
    { id: 'integrations', label: 'Integrations', href: '/settings/integrations', icon: '🔌' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-gray-200 pb-4">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={t.href}
              className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                tab === t.id
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </Link>
          ))}
        </div>

        {/* Account Settings (default tab) */}
        {tab === 'account' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Account Settings</h2>

            {/* Profile Info */}
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                  {session.user.firstName?.[0] || session.user.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <div className="font-bold text-gray-900">
                    {session.user.firstName} {session.user.lastName}
                  </div>
                  <div className="text-gray-500">{session.user.email}</div>
                </div>
              </div>

              {/* Quick Links */}
              <div className="grid gap-4">
                <Link
                  href="/profile"
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">👤</span>
                    <div>
                      <div className="font-semibold text-gray-900">Edit Profile</div>
                      <div className="text-sm text-gray-500">Update your name, photo, and bio</div>
                    </div>
                  </div>
                  <span className="text-gray-400">→</span>
                </Link>

                <Link
                  href="/settings/notifications"
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🔔</span>
                    <div>
                      <div className="font-semibold text-gray-900">Notification Preferences</div>
                      <div className="text-sm text-gray-500">Manage email and push notifications</div>
                    </div>
                  </div>
                  <span className="text-gray-400">→</span>
                </Link>

                <Link
                  href="/settings/accounts"
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🔗</span>
                    <div>
                      <div className="font-semibold text-gray-900">Connected Accounts</div>
                      <div className="text-sm text-gray-500">Link Google, Facebook, or Apple</div>
                    </div>
                  </div>
                  <span className="text-gray-400">→</span>
                </Link>

                <Link
                  href="/legal/consent"
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📋</span>
                    <div>
                      <div className="font-semibold text-gray-900">Legal & Privacy</div>
                      <div className="text-sm text-gray-500">Review consent and liability waiver</div>
                    </div>
                  </div>
                  <span className="text-gray-400">→</span>
                </Link>
              </div>

              {/* Danger Zone */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-red-600 mb-4">Danger Zone</h3>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                      // TODO: Implement account deletion
                      toast.warning('Account deletion is not yet implemented. Please contact support.');
                    }
                  }}
                  className="px-4 py-2 border-2 border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition font-medium"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
