'use client';

/**
 * Onboarding — landing page after a user's first sign-in (currently
 * configured as `pages.newUser` in lib/auth.js). The previous config
 * pointed here but the route did not exist, so OAuth users 404'd.
 *
 * This is intentionally minimal: collect anything the OAuth profile
 * couldn't give us (last name, phone), then send the user to the
 * dashboard. Skippable — nothing here is required to use the app.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowRight, User, Phone } from 'lucide-react';
import { Button, Card } from '@/components/ui';

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const firstName = session?.user?.firstName || session?.user?.name || 'there';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/profile/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastName: lastName.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not save your profile');
      }
      // Refresh the session token so subsequent pages see the new fields.
      if (lastName.trim()) await update({ lastName: lastName.trim() });
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-midnight-100 to-midnight-200 flex items-center justify-center p-4">
      <main className="w-full max-w-md">
        <Card className="shadow-xl">
          <div className="p-8">
            <h1 className="text-2xl font-bold text-midnight-900 mb-2">
              Welcome, {firstName}!
            </h1>
            <p className="text-midnight-600 mb-6">
              A couple of quick details so squad leaders and pet owners can
              reach you. You can skip this and add it later from your profile.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium text-midnight-700 mb-1"
                >
                  Last name
                </label>
                <div className="relative">
                  <User
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-midnight-400"
                    size={18}
                  />
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                    className="w-full pl-10 pr-3 py-2 border border-midnight-200 rounded-lg focus:ring-2 focus:ring-flashlight-500 focus:border-transparent"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-midnight-700 mb-1"
                >
                  Phone
                </label>
                <div className="relative">
                  <Phone
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-midnight-400"
                    size={18}
                  />
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    className="w-full pl-10 pr-3 py-2 border border-midnight-200 rounded-lg focus:ring-2 focus:ring-flashlight-500 focus:border-transparent"
                    placeholder="Optional — for case coordination"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? 'Saving...' : 'Continue'}
                <ArrowRight size={18} className="ml-1" />
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link
                href="/dashboard"
                className="text-sm text-midnight-500 hover:text-midnight-700"
              >
                Skip for now
              </Link>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
