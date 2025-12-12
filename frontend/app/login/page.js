'use client';

/**
 * Login Page - Updated with PetRecovery Design System
 * Uses: Midnight Blue + Flashlight Yellow color palette
 */

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LogIn, Mail, Lock, ArrowLeft } from 'lucide-react';
import { Button, Card } from '@/components/ui';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState('/dashboard');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const callback = searchParams.get('callbackUrl');
    if (callback) {
      setCallbackUrl(callback);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });

      if (result.error) {
        setError('Invalid email or password');
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-midnight-100 to-midnight-200 flex items-center justify-center p-4">
      <main role="main" aria-labelledby="login-heading" className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-midnight-900 font-bold text-2xl">
            <img src="https://petrescue.b-cdn.net/Logos.svg" alt="Surumaa" className="h-12 w-auto" />
            PetRecovery
          </Link>
        </div>

        <Card className="shadow-xl">
          <div className="text-center mb-6">
            <h1 id="login-heading" className="text-2xl font-bold text-midnight-900 mb-2">
              Welcome Back
            </h1>
            <p className="text-midnight-500">
              Sign in to track your alerts
            </p>
          </div>

          {error && (
            <div
              role="alert"
              aria-live="polite"
              id="login-error"
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} aria-describedby={error ? 'login-error' : undefined}>
            <div className="mb-5">
              <label htmlFor="email" className="block mb-2 font-semibold text-midnight-700 text-sm">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400 pointer-events-none" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  aria-required="true"
                  className="w-full pl-14 pr-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900 placeholder-midnight-400"
                />
              </div>
            </div>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="password" className="font-semibold text-midnight-700 text-sm">
                  Password
                </label>
                <Link href="/forgot-password" className="text-midnight-600 hover:text-midnight-900 text-sm font-medium transition">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400 pointer-events-none" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  aria-required="true"
                  className="w-full pl-14 pr-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900 placeholder-midnight-400"
                />
              </div>
            </div>

            <Button
              type="submit"
              fullWidth
              loading={loading}
              leftIcon={LogIn}
              size="lg"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="text-center pt-6 mt-6 border-t border-midnight-100">
            <p className="text-midnight-500 mb-2">
              Don't have an account?
            </p>
            <Link href="/register" className="text-midnight-900 font-semibold hover:text-flash-600 transition">
              Create Account
            </Link>
          </div>
        </Card>

        <nav aria-label="Back navigation" className="text-center mt-6">
          <Link href="/" className="inline-flex items-center gap-2 text-midnight-500 hover:text-midnight-700 text-sm transition">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </nav>
      </main>
    </div>
  );
}
