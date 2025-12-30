'use client';

/**
 * Forgot Password Page - Updated with PetRecovery Design System
 * Uses: Midnight Blue + Flashlight Yellow color palette
 */

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle, Send } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { LOGO_ICON } from '@/lib/brandAssets';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [message, setMessage] = useState('');

  console.log('[FORGOT-PASSWORD-PAGE] Component rendered, status:', status);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('[FORGOT-PASSWORD-PAGE] Form submitted');
    console.log(`[FORGOT-PASSWORD-PAGE] Email: ${email.substring(0, 3)}***`);

    setStatus('loading');
    setMessage('');

    try {
      console.log('[FORGOT-PASSWORD-PAGE] Sending request to API...');
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      console.log(`[FORGOT-PASSWORD-PAGE] Response status: ${response.status}`);
      const data = await response.json();
      console.log('[FORGOT-PASSWORD-PAGE] Response data:', data);

      if (response.ok) {
        console.log('[FORGOT-PASSWORD-PAGE] Success!');
        setStatus('success');
        setMessage(data.message);
      } else {
        console.log('[FORGOT-PASSWORD-PAGE] Error:', data.error);
        setStatus('error');
        setMessage(data.error || 'Something went wrong. Please try again.');
      }
    } catch (error) {
      console.error('[FORGOT-PASSWORD-PAGE] Fetch error:', error);
      setStatus('error');
      setMessage('Unable to connect. Please check your internet and try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-midnight-100 to-midnight-200 flex items-center justify-center p-4">
      <main role="main" aria-labelledby="forgot-password-heading" className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-midnight-900 font-bold text-2xl">
            <img src={LOGO_ICON} alt="ReunitePets" className="h-14 w-auto" />
            ReunitePets
          </Link>
        </div>

        <Card className="shadow-xl">
          <div className="text-center mb-6">
            <h1 id="forgot-password-heading" className="text-2xl font-bold text-midnight-900 mb-2">
              Forgot Password?
            </h1>
            <p className="text-midnight-500">
              Enter your email and we'll send you a reset link
            </p>
          </div>

          {/* Success Message */}
          {status === 'success' && (
            <div
              role="alert"
              aria-live="polite"
              className="bg-green-50 border border-green-200 text-green-700 px-4 py-4 rounded-xl mb-6"
            >
              <div className="flex items-center gap-2 font-semibold mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Check your email!
              </div>
              <p className="text-sm">{message}</p>
              <p className="text-xs text-green-600 mt-2">
                Don't see it? Check your spam folder.
              </p>
            </div>
          )}

          {/* Error Message */}
          {status === 'error' && (
            <div
              role="alert"
              aria-live="polite"
              id="forgot-password-error"
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm"
            >
              {message}
            </div>
          )}

          {/* Form - Hidden after success */}
          {status !== 'success' && (
            <form onSubmit={handleSubmit} aria-describedby={status === 'error' ? 'forgot-password-error' : undefined}>
              <div className="mb-6">
                <label htmlFor="email" className="block mb-2 font-semibold text-midnight-700 text-sm">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400" />
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    disabled={status === 'loading'}
                    autoComplete="email"
                    aria-required="true"
                    className="w-full pl-11 pr-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900 placeholder-midnight-400 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <Button
                type="submit"
                fullWidth
                loading={status === 'loading'}
                leftIcon={Send}
                size="lg"
              >
                {status === 'loading' ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>
          )}

          {/* Back to Login */}
          <div className={`text-center ${status === 'success' ? '' : 'pt-6 mt-6 border-t border-midnight-100'}`}>
            <Link href="/login" className="inline-flex items-center gap-2 text-midnight-900 font-semibold hover:text-flash-600 transition">
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Link>
          </div>
        </Card>

        <nav aria-label="Home navigation" className="text-center mt-6">
          <Link href="/" className="inline-flex items-center gap-2 text-midnight-500 hover:text-midnight-700 text-sm transition">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </nav>
      </main>
    </div>
  );
}
