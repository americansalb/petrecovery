'use client';

/**
 * Register Page - Updated with PetRecovery Design System
 * Uses: Midnight Blue + Flashlight Yellow color palette
 */

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, Mail, Lock, Phone, User, ArrowLeft, Check } from 'lucide-react';
import { Button, Card } from '@/components/ui';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
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

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!acceptedTerms) {
      setError('You must accept the Terms of Service and Liability Waiver to create an account');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          phone: formData.phone,
          acceptedTerms: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      const result = await signIn('credentials', {
        redirect: false,
        email: formData.email,
        password: formData.password,
      });

      if (result.error) {
        setError('Account created but failed to sign in. Please try logging in.');
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
    <div className="min-h-screen bg-gradient-to-b from-midnight-100 to-midnight-200 flex items-center justify-center p-4 py-8">
      <main role="main" aria-labelledby="register-heading" className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-midnight-900 font-bold text-2xl">
            <img src="https://petrescue.b-cdn.net/Logos.svg" alt="Sarama" className="h-12 w-auto" />
            PetRecovery
          </Link>
        </div>

        <Card className="shadow-xl">
          <div className="text-center mb-6">
            <h1 id="register-heading" className="text-2xl font-bold text-midnight-900 mb-2">
              Create Account
            </h1>
            <p className="text-midnight-500">
              Join the pet recovery community
            </p>
          </div>

          {error && (
            <div
              role="alert"
              aria-live="polite"
              id="register-error"
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} aria-describedby={error ? 'register-error' : undefined}>
            {/* First Name */}
            <div className="mb-4">
              <label htmlFor="firstName" className="block mb-2 font-semibold text-midnight-700 text-sm">
                First Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400" />
                <input
                  id="firstName"
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Jane"
                  required
                  autoComplete="given-name"
                  aria-required="true"
                  className="w-full pl-11 pr-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900 placeholder-midnight-400"
                />
              </div>
            </div>

            {/* Email */}
            <div className="mb-4">
              <label htmlFor="email" className="block mb-2 font-semibold text-midnight-700 text-sm">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400" />
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  aria-required="true"
                  className="w-full pl-11 pr-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900 placeholder-midnight-400"
                />
              </div>
            </div>

            {/* Phone */}
            <div className="mb-4">
              <label htmlFor="phone" className="block mb-2 font-semibold text-midnight-700 text-sm">
                Phone Number <span className="text-midnight-400">(optional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400" />
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="555-0100"
                  autoComplete="tel"
                  className="w-full pl-11 pr-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900 placeholder-midnight-400"
                />
              </div>
            </div>

            {/* Password */}
            <div className="mb-4">
              <label htmlFor="password" className="block mb-2 font-semibold text-midnight-700 text-sm">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400" />
                <input
                  id="password"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  aria-required="true"
                  aria-describedby="password-hint"
                  className="w-full pl-11 pr-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900 placeholder-midnight-400"
                />
              </div>
              <p id="password-hint" className="text-xs text-midnight-500 mt-1">
                Must be at least 8 characters
              </p>
            </div>

            {/* Confirm Password */}
            <div className="mb-5">
              <label htmlFor="confirmPassword" className="block mb-2 font-semibold text-midnight-700 text-sm">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400" />
                <input
                  id="confirmPassword"
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  aria-required="true"
                  className="w-full pl-11 pr-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900 placeholder-midnight-400"
                />
              </div>
            </div>

            {/* Terms Checkbox */}
            <div className="mb-6">
              <label htmlFor="acceptTerms" className="flex items-start gap-3 cursor-pointer">
                <div className="relative mt-0.5">
                  <input
                    id="acceptTerms"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    aria-required="true"
                    className="sr-only peer"
                  />
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                    acceptedTerms
                      ? 'bg-flash-400 border-flash-400'
                      : 'bg-white border-midnight-300 peer-focus:ring-2 peer-focus:ring-flash-400'
                  }`}>
                    {acceptedTerms && <Check className="w-3 h-3 text-midnight-900" strokeWidth={3} />}
                  </div>
                </div>
                <span className="text-sm text-midnight-600 leading-relaxed">
                  I agree to the{' '}
                  <Link href="/legal/terms" className="text-midnight-900 font-medium underline hover:text-flash-600">
                    Terms of Service
                  </Link>
                  {' '}and{' '}
                  <Link href="/legal/consent" className="text-midnight-900 font-medium underline hover:text-flash-600">
                    Liability Waiver
                  </Link>
                  . I understand that participation in rescue squad activities involves physical risks.
                </span>
              </label>
            </div>

            <Button
              type="submit"
              fullWidth
              loading={loading}
              disabled={!acceptedTerms}
              leftIcon={UserPlus}
              size="lg"
              variant="success"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          <div className="text-center pt-6 mt-6 border-t border-midnight-100">
            <p className="text-midnight-500 mb-2">
              Already have an account?
            </p>
            <Link href="/login" className="text-midnight-900 font-semibold hover:text-flash-600 transition">
              Sign In
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
