'use client';

/**
 * Reset Password Page - Phase 0.1
 * Allows users to set a new password using a reset token.
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [message, setMessage] = useState('');

  // Check for token on mount
  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid reset link. Please request a new password reset.');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate passwords match
    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords do not match.');
      return;
    }

    // Validate password length
    if (password.length < 8) {
      setStatus('error');
      setMessage('Password must be at least 8 characters long.');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage(data.message);

        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong. Please try again.');
      }
    } catch (error) {
      console.error('[RESET-PASSWORD-PAGE] Fetch error:', error);
      setStatus('error');
      setMessage('Unable to connect. Please check your internet and try again.');
    }
  };

  // No token - show error state
  if (!token && status !== 'error') {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #e5e7eb',
          borderTop: '3px solid #0f172a',
          borderRadius: '50%',
          margin: '0 auto',
          animation: 'spin 1s linear infinite',
        }} />
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          color: '#0f172a',
          marginBottom: '0.5rem',
        }}>
          {status === 'success' ? 'Password Reset!' : 'Reset Your Password'}
        </h1>
        <p style={{ color: '#6b7280' }}>
          {status === 'success'
            ? 'Your password has been updated'
            : 'Enter your new password below'
          }
        </p>
      </div>

      {/* Success Message */}
      {status === 'success' && (
        <div style={{
          backgroundColor: '#d1fae5',
          border: '1px solid #a7f3d0',
          color: '#065f46',
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '1.5rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
            &#10004;
          </div>
          <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
            Password Updated Successfully!
          </div>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            Redirecting to login page...
          </p>
        </div>
      )}

      {/* Error Message */}
      {status === 'error' && (
        <div style={{
          backgroundColor: '#fee2e2',
          border: '1px solid #fecaca',
          color: '#991b1b',
          padding: '0.75rem',
          borderRadius: '0.5rem',
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
        }}>
          {message}
        </div>
      )}

      {/* Form - Hidden after success or when no token */}
      {status !== 'success' && token && (
        <form method="post" onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '600',
              color: '#1f2937',
            }}>
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              disabled={status === 'loading'}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e5e7eb',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box',
                opacity: status === 'loading' ? 0.6 : 1,
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '600',
              color: '#1f2937',
            }}>
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              minLength={8}
              disabled={status === 'loading'}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e5e7eb',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box',
                opacity: status === 'loading' ? 0.6 : 1,
              }}
            />
          </div>

          {/* Password requirements hint */}
          <div style={{
            backgroundColor: '#f3f4f6',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem',
            fontSize: '0.8rem',
            color: '#4b5563',
          }}>
            <strong>Password requirements:</strong>
            <ul style={{ margin: '0.5rem 0 0 1.25rem', padding: 0 }}>
              <li>At least 8 characters long</li>
              <li>Both passwords must match</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={status === 'loading'}
            style={{
              width: '100%',
              padding: '1rem',
              backgroundColor: status === 'loading' ? '#9ca3af' : '#facc15',
              color: '#0f172a',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1.125rem',
              fontWeight: '600',
              cursor: status === 'loading' ? 'not-allowed' : 'pointer',
              marginBottom: '1rem',
            }}
          >
            {status === 'loading' ? 'Resetting Password...' : 'Reset Password'}
          </button>
        </form>
      )}

      {/* Request new link button when token is invalid */}
      {status === 'error' && !token && (
        <div style={{ marginBottom: '1rem' }}>
          <Link
            href="/forgot-password"
            style={{
              display: 'block',
              width: '100%',
              padding: '1rem',
              backgroundColor: '#facc15',
              color: '#0f172a',
              textAlign: 'center',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              textDecoration: 'none',
            }}
          >
            Request New Reset Link
          </Link>
        </div>
      )}

      {/* Back to Login */}
      <div style={{
        textAlign: 'center',
        paddingTop: '1.5rem',
        borderTop: '1px solid #e5e7eb',
      }}>
        <Link
          href="/login"
          style={{
            color: '#0f172a',
            fontWeight: '600',
            textDecoration: 'none',
          }}
        >
          ← Back to Sign In
        </Link>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[calc(100dvh-8rem)] lg:min-h-[calc(100dvh-4rem)]" style={{
      background: 'linear-gradient(to bottom, #dbeafe, #bfdbfe)',
      padding: '1rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        maxWidth: '450px',
        width: '100%',
        backgroundColor: 'white',
        borderRadius: '1rem',
        padding: '2rem',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
      }}>
        <Suspense fallback={
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ color: '#6b7280' }}>Loading...</div>
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
