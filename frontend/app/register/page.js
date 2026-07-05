'use client';

// Dynamic render (no static prerender) so useSearchParams is valid without a
// Suspense boundary; otherwise next build fails the prerender. Auth/personalized
// pages are dynamic anyway.
export const dynamic = 'force-dynamic';

/**
 * Register Wizard — one clean decision per screen.
 *
 * Name → Email → Phone (skippable) → Password → Terms, then a "check your
 * inbox" finale (accounts need email verification before sign-in, so the old
 * auto-login-after-register always failed — we don't pretend otherwise).
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  UserPlus, Mail, Lock, Phone, User, ArrowLeft, ArrowRight, Check,
  Eye, EyeOff, ShieldCheck, MailCheck, X,
} from 'lucide-react';
import { Button, cn } from '@/components/ui';
import { LOGO_ICON } from '@/lib/brandAssets';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s\-\(\)\+\.]{7,20}$/;

const STEPS = ['name', 'email', 'phone', 'password', 'terms'];

const inputClass =
  'w-full rounded-2xl border-2 border-midnight-200 bg-white px-4 py-3.5 text-lg text-midnight-900 ' +
  'placeholder:text-midnight-300 focus:outline-none focus:border-flash-400 focus:ring-4 focus:ring-flash-100 transition';

function StepShell({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="animate-slide-up" key={title}>
      <div className="w-12 h-12 rounded-2xl bg-flash-100 text-flash-700 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h1 className="text-2xl md:text-3xl font-bold text-midnight-900 mb-1.5">{title}</h1>
      {subtitle && <p className="text-midnight-500 mb-6">{subtitle}</p>}
      {children}
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ firstName: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState('/dashboard');
  const inputRef = useRef(null);

  useEffect(() => {
    const callback = searchParams.get('callbackUrl');
    if (callback) setCallbackUrl(callback);
    // Invite emails link here with the address prefilled. Keep it editable.
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setForm((prev) => (prev.email ? prev : { ...prev, email: emailParam }));
    }
  }, [searchParams]);

  // Each new screen: focus its input so typing + Enter just works.
  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const set = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
    if (error) setError('');
  };

  // Per-step validation — the gate for Continue/Enter.
  const validateStep = () => {
    switch (STEPS[step]) {
      case 'name':
        if (!form.firstName.trim()) return 'Tell us your first name';
        return null;
      case 'email':
        if (!EMAIL_REGEX.test(form.email.trim())) return 'That email doesn\'t look right';
        return null;
      case 'phone':
        if (form.phone.trim() && !PHONE_REGEX.test(form.phone.trim())) return 'That phone number doesn\'t look right';
        return null;
      case 'password':
        if (form.password.length < 8) return 'Use at least 8 characters';
        if (form.password !== form.confirmPassword) return 'Passwords don\'t match';
        return null;
      case 'terms':
        if (!acceptedTerms) return 'Please agree to the terms to continue';
        return null;
      default:
        return null;
    }
  };

  const stepReady = (() => {
    switch (STEPS[step]) {
      case 'name': return form.firstName.trim().length > 0;
      case 'email': return EMAIL_REGEX.test(form.email.trim());
      case 'phone': return true;
      case 'password': return form.password.length >= 8 && form.password === form.confirmPassword;
      case 'terms': return acceptedTerms;
      default: return false;
    }
  })();

  const next = () => {
    const problem = validateStep();
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      submit();
    }
  };

  const back = () => {
    setError('');
    if (step > 0) setStep(step - 1);
  };

  const onEnter = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      next();
    }
  };

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          firstName: form.firstName.trim(),
          phone: form.phone.trim() || undefined,
          acceptedTerms: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }
      // Accounts must verify email before sign-in, so the honest next step is
      // the inbox — not a doomed auto-login.
      setDone(true);
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const passwordChecklist = [
    { ok: form.password.length >= 8, label: 'At least 8 characters' },
    { ok: form.confirmPassword.length > 0 && form.password === form.confirmPassword, label: 'Passwords match' },
  ];

  return (
    <div className="min-h-[calc(100dvh-8rem)] lg:min-h-[calc(100dvh-4rem)] bg-gradient-to-b from-midnight-100 to-midnight-200 flex items-center justify-center p-4 py-8">
      <main role="main" aria-labelledby="register-heading" className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <img src={LOGO_ICON} alt="" className="w-9 h-9" />
          <span className="text-xl font-bold text-midnight-900">Reunite<span className="text-flash-600">Pets</span></span>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8">
          {done ? (
            /* ----------------------------- Finale ----------------------------- */
            <div className="text-center animate-slide-up py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-5">
                <MailCheck className="w-8 h-8" />
              </div>
              <h1 id="register-heading" className="text-2xl font-bold text-midnight-900 mb-2">
                Check your inbox, {form.firstName.trim()}!
              </h1>
              <p className="text-midnight-500 mb-1">
                We sent a verification link to
              </p>
              <p className="font-semibold text-midnight-900 mb-6">{form.email.trim()}</p>
              <p className="text-sm text-midnight-400 mb-8">
                Click it to activate your account, then sign in.
              </p>
              <Button variant="primary" fullWidth size="lg" href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
                Go to Sign In
              </Button>
            </div>
          ) : (
            <>
              {/* Progress */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wide text-midnight-400">
                  Step {step + 1} of {STEPS.length}
                </span>
                <Link href="/login" className="text-xs font-semibold text-midnight-400 hover:text-midnight-700 transition-colors">
                  Have an account? Sign in
                </Link>
              </div>
              <div className="h-1.5 bg-midnight-100 rounded-full mb-8 overflow-hidden" role="progressbar"
                aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS.length} aria-label="Sign-up progress">
                <div
                  className="h-full bg-flash-400 rounded-full transition-all duration-500"
                  style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                />
              </div>

              {/* ------------------------------ Steps ------------------------------ */}
              {STEPS[step] === 'name' && (
                <StepShell icon={User} title="What should we call you?" subtitle="Just your first name is fine.">
                  <input
                    ref={inputRef}
                    name="firstName"
                    autoComplete="given-name"
                    value={form.firstName}
                    onChange={(e) => set({ firstName: e.target.value })}
                    onKeyDown={onEnter}
                    placeholder="Jane"
                    aria-label="First name"
                    className={inputClass}
                  />
                </StepShell>
              )}

              {STEPS[step] === 'email' && (
                <StepShell icon={Mail} title={`Nice to meet you, ${form.firstName.trim() || 'friend'}!`} subtitle="What's your email address?">
                  <input
                    ref={inputRef}
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => set({ email: e.target.value })}
                    onKeyDown={onEnter}
                    placeholder="you@example.com"
                    aria-label="Email address"
                    className={inputClass}
                  />
                  <p className="text-xs text-midnight-400 mt-2.5">We&apos;ll send a verification link here. No spam, ever.</p>
                </StepShell>
              )}

              {STEPS[step] === 'phone' && (
                <StepShell icon={Phone} title="Add a phone number?" subtitle="Optional. It helps finders and rescuers reach you faster if a pet goes missing.">
                  <input
                    ref={inputRef}
                    type="tel"
                    name="phone"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) => set({ phone: e.target.value })}
                    onKeyDown={onEnter}
                    placeholder="555-0100"
                    aria-label="Phone number (optional)"
                    className={inputClass}
                  />
                </StepShell>
              )}

              {STEPS[step] === 'password' && (
                <StepShell icon={Lock} title="Create your password" subtitle="This is the one decision worth a few extra keystrokes.">
                  <div className="relative mb-3">
                    <input
                      ref={inputRef}
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(e) => set({ password: e.target.value })}
                      onKeyDown={onEnter}
                      placeholder="Password"
                      aria-label="Password"
                      className={cn(inputClass, 'pr-12')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-midnight-400 hover:text-midnight-700 transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={(e) => set({ confirmPassword: e.target.value })}
                    onKeyDown={onEnter}
                    placeholder="Type it once more"
                    aria-label="Confirm password"
                    className={inputClass}
                  />
                  <ul className="mt-4 space-y-1.5">
                    {passwordChecklist.map(({ ok, label }) => (
                      <li key={label} className={cn('flex items-center gap-2 text-sm transition-colors', ok ? 'text-emerald-600' : 'text-midnight-400')}>
                        <span className={cn('w-5 h-5 rounded-full flex items-center justify-center', ok ? 'bg-emerald-100' : 'bg-midnight-100')}>
                          <Check size={12} strokeWidth={3} />
                        </span>
                        {label}
                      </li>
                    ))}
                  </ul>
                </StepShell>
              )}

              {STEPS[step] === 'terms' && (
                <StepShell icon={ShieldCheck} title="One last thing" subtitle="The legal bit. Short and important.">
                  <button
                    type="button"
                    onClick={() => { setAcceptedTerms((v) => !v); setError(''); }}
                    aria-pressed={acceptedTerms}
                    className={cn(
                      'w-full text-left rounded-2xl border-2 p-4 transition-colors flex items-start gap-3',
                      acceptedTerms ? 'border-flash-400 bg-flash-50' : 'border-midnight-200 bg-white hover:border-midnight-300'
                    )}
                  >
                    <span className={cn(
                      'w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
                      acceptedTerms ? 'bg-flash-400 border-flash-400 text-midnight-900' : 'border-midnight-300 text-transparent'
                    )}>
                      <Check size={14} strokeWidth={3} />
                    </span>
                    <span className="text-sm text-midnight-700 leading-relaxed">
                      I agree to the{' '}
                      <Link href="/legal/terms" target="_blank" className="font-semibold text-midnight-900 underline underline-offset-2 hover:text-flash-600" onClick={(e) => e.stopPropagation()}>Terms of Service</Link>
                      {' '}and{' '}
                      <Link href="/legal/consent" target="_blank" className="font-semibold text-midnight-900 underline underline-offset-2 hover:text-flash-600" onClick={(e) => e.stopPropagation()}>Liability Waiver</Link>.
                      I understand that participation in rescue activities involves physical risks.
                    </span>
                  </button>
                </StepShell>
              )}

              {/* Error */}
              {error && (
                <div role="alert" className="mt-4 bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3 rounded-xl flex items-center justify-between">
                  <span>{error}</span>
                  <button onClick={() => setError('')} className="text-red-400 hover:text-red-700" aria-label="Dismiss error"><X size={16} /></button>
                </div>
              )}

              {/* Nav */}
              <div className="flex items-center justify-between gap-3 mt-8">
                {step > 0 ? (
                  <Button variant="ghost" onClick={back} leftIcon={ArrowLeft}>Back</Button>
                ) : <span />}

                <div className="flex items-center gap-2">
                  {STEPS[step] === 'phone' && !form.phone.trim() && (
                    <Button variant="ghost" onClick={() => { setError(''); setStep(step + 1); }}>
                      Skip
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={next}
                    disabled={!stepReady || loading}
                    loading={loading}
                    rightIcon={step < STEPS.length - 1 ? ArrowRight : undefined}
                    leftIcon={step === STEPS.length - 1 ? UserPlus : undefined}
                  >
                    {step === STEPS.length - 1 ? 'Create my account' : 'Continue'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-midnight-500 hover:text-midnight-800 transition-colors">
            <ArrowLeft size={15} /> Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
}
