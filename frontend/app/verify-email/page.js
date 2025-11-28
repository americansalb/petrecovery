'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

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
        setStatus('error');
        setError('An error occurred. Please try again.');
      }
    }

    verifyEmail();
  }, [token, router]);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f3f4f6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '1rem',
    }}>
      <div style={{
        maxWidth: '500px',
        backgroundColor: 'white',
        borderRadius: '1rem',
        padding: '2rem',
        textAlign: 'center',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
      }}>
        {status === 'verifying' && (
          <>
            <div style={{
              width: '60px',
              height: '60px',
              border: '4px solid #e5e7eb',
              borderTopColor: '#10b981',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1.5rem',
            }} />
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#1f2937',
              marginBottom: '0.5rem',
            }}>
              Verifying Your Email
            </h2>
            <p style={{ color: '#6b7280' }}>
              Please wait while we verify your email address...
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>
              <span role="img" aria-label="success">✅</span>
            </div>
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: 'bold',
              color: '#10b981',
              marginBottom: '0.5rem',
            }}>
              Email Verified!
            </h2>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
              Your email has been verified successfully. You can now log in to your account.
            </p>
            <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '1rem' }}>
              Redirecting to login...
            </p>
            <Link
              href="/login"
              style={{
                display: 'inline-block',
                backgroundColor: '#10b981',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                fontWeight: '600',
              }}
            >
              Go to Login
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>
              <span role="img" aria-label="error">❌</span>
            </div>
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: 'bold',
              color: '#dc2626',
              marginBottom: '0.5rem',
            }}>
              Verification Failed
            </h2>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
              {error}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Link
                href="/login"
                style={{
                  display: 'inline-block',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  fontWeight: '600',
                }}
              >
                Go to Login
              </Link>
              <Link
                href="/register"
                style={{
                  display: 'inline-block',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  fontWeight: '600',
                }}
              >
                Create New Account
              </Link>
            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6',
      }}>
        <div>Loading...</div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
