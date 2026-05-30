'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';
import { Card, Button } from '@/components/ui';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('No verification token provided.');
      return;
    }

    async function verifyEmail() {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        const data = await res.json();
        if (res.ok) {
          setStatus('success');
          // Redirect to login after 3 seconds
          setTimeout(() => {
            router.push('/login?verified=true');
          }, 3000);
        } else {
          setStatus('error');
          setError(data.error || 'Verification failed.');
        }
      } catch (err) {
        console.error('[VERIFY-EMAIL] Verification error:', err);
        setStatus('error');
        setError('An error occurred. Please try again.');
      }
    }

    verifyEmail();
  }, [token, router]);

  return (
    <div className="min-h-screen bg-midnight-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="p-8 text-center">
          {/* Logo/Icon at top */}
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto bg-flash-100 rounded-2xl flex items-center justify-center">
              <Mail className="w-8 h-8 text-flash-500" />
            </div>
          </div>

          {status === 'verifying' && (
            <>
              <div className="flex justify-center mb-6">
                <Loader2 className="w-12 h-12 text-flash-500 animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-midnight-900 mb-2">
                Verifying Your Email
              </h2>
              <p className="text-midnight-600">
                Please wait while we verify your email address...
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-green-600 mb-2">
                Email Verified!
              </h2>
              <p className="text-midnight-600 mb-4">
                Your email has been verified successfully. You can now log in to your account.
              </p>
              <p className="text-sm text-midnight-500 mb-6">
                Redirecting to login in 3 seconds...
              </p>
              <Button
                variant="success"
                href="/login"
                className="w-full"
              >
                Go to Login
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="w-10 h-10 text-red-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-red-600 mb-2">
                Verification Failed
              </h2>
              <p className="text-midnight-600 mb-6">
                {error}
              </p>
              <div className="space-y-3">
                <Button
                  variant="primary"
                  href="/login"
                  className="w-full"
                >
                  Go to Login
                </Button>
                <Button
                  variant="outline"
                  href="/register"
                  className="w-full"
                >
                  Create New Account
                </Button>
              </div>
            </>
          )}
        </Card>

        {/* Help text */}
        <p className="text-center text-sm text-midnight-600 mt-6">
          Need help?{' '}
          <Link href="/contact" className="text-flash-500 hover:text-flash-600 font-medium">
            Contact Support
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-midnight-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-flash-500 animate-spin" />
          <span className="text-midnight-700 font-medium">Loading...</span>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
