'use client';

/**
 * Forgot Password Page - Phase 0.1
 * Allows users to request a password reset email.
 */

import { useState } from 'react';
import Link from 'next/link';

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
    <div style={{
      minHeight: '100vh',
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
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#1e40af',
            marginBottom: '0.5rem',
          }}>
            Forgot Password?
          </h1>
          <p style={{ color: '#6b7280' }}>
            Enter your email and we'll send you a reset link
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
            fontSize: '0.875rem',
          }}>
            <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
              Check your email!
            </div>
            <p style={{ margin: 0 }}>{message}</p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#047857' }}>
              Don't see it? Check your spam folder.
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

        {/* Form - Hidden after success */}
        {status !== 'success' && (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#1f2937',
              }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
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

            <button
              type="submit"
              disabled={status === 'loading'}
              style={{
                width: '100%',
                padding: '1rem',
                backgroundColor: status === 'loading' ? '#9ca3af' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1.125rem',
                fontWeight: '600',
                cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                marginBottom: '1rem',
              }}
            >
              {status === 'loading' ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        {/* Back to Login - Always visible */}
        <div style={{
          textAlign: 'center',
          paddingTop: status === 'success' ? '0' : '1.5rem',
          borderTop: status === 'success' ? 'none' : '1px solid #e5e7eb',
        }}>
          <Link
            href="/login"
            style={{
              color: '#2563eb',
              fontWeight: '600',
              textDecoration: 'none',
            }}
          >
            ← Back to Sign In
          </Link>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <Link
            href="/"
            style={{
              color: '#6b7280',
              fontSize: '0.875rem',
              textDecoration: 'none',
            }}
          >
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
