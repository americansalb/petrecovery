'use client';

/**
 * ContactFields — passwordless, minimal contact capture for guests.
 *
 * No confirm-field duplication, no password: the backend auto-creates an
 * account with a temp password and emails a manage link.
 *
 * modes:
 *  - 'either'      one reach method, user picks email or text (lost flow)
 *  - 'email-first' email required, phone optional (found flow — matches are
 *                  emailed, the copy says exactly that)
 */

import { User, Mail, Phone, Check } from 'lucide-react';
import { WIZARD_THEMES, isValidEmail, isValidPhone } from './wizardTheme';

export function contactIsValid(value, mode) {
  if (!value.firstName?.trim()) return false;
  if (mode === 'email-first') {
    return isValidEmail(value.email) && (!value.phone?.trim() || isValidPhone(value.phone));
  }
  if (value.method === 'phone') return isValidPhone(value.phone);
  return isValidEmail(value.email);
}

export default function ContactFields({
  value, // { firstName, method: 'email'|'phone', email, phone }
  onChange,
  mode = 'either',
  variant = 'lost',
  emailHint,
  phoneHint,
}) {
  const theme = WIZARD_THEMES[variant];
  const set = (patch) => onChange({ ...value, ...patch });
  const method = value.method || 'email';

  const emailOk = isValidEmail(value.email);
  const phoneOk = isValidPhone(value.phone);

  const emailField = (required) => (
    <div>
      <label htmlFor="contact-email" className="block text-sm font-semibold text-midnight-700 mb-1.5">
        Email{required ? '' : ' (optional)'}
      </label>
      <div className="relative">
        <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-midnight-300" />
        <input
          id="contact-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={value.email || ''}
          onChange={(e) => set({ email: e.target.value })}
          placeholder="you@example.com"
          className={`w-full pl-10 pr-10 py-3.5 bg-white border-2 rounded-2xl outline-none transition-colors ${
            value.email && !emailOk ? 'border-red-300' : `border-midnight-100 ${theme.focusRing}`
          }`}
        />
        {emailOk && <Check size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500" />}
      </div>
      {emailHint && <p className="text-xs text-midnight-400 mt-1.5">{emailHint}</p>}
    </div>
  );

  const phoneField = (required) => (
    <div>
      <label htmlFor="contact-phone" className="block text-sm font-semibold text-midnight-700 mb-1.5">
        Phone{required ? '' : ' (optional)'}
      </label>
      <div className="relative">
        <Phone size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-midnight-300" />
        <input
          id="contact-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={value.phone || ''}
          onChange={(e) => set({ phone: e.target.value })}
          placeholder="(555) 123-4567"
          className={`w-full pl-10 pr-10 py-3.5 bg-white border-2 rounded-2xl outline-none transition-colors ${
            value.phone && !phoneOk ? 'border-red-300' : `border-midnight-100 ${theme.focusRing}`
          }`}
        />
        {phoneOk && <Check size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500" />}
      </div>
      {phoneHint && <p className="text-xs text-midnight-400 mt-1.5">{phoneHint}</p>}
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="contact-name" className="block text-sm font-semibold text-midnight-700 mb-1.5">
          Your first name
        </label>
        <div className="relative">
          <User size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-midnight-300" />
          <input
            id="contact-name"
            type="text"
            autoComplete="given-name"
            value={value.firstName || ''}
            onChange={(e) => set({ firstName: e.target.value })}
            placeholder="Jane"
            autoFocus
            className={`w-full pl-10 pr-4 py-3.5 bg-white border-2 border-midnight-100 rounded-2xl outline-none transition-colors ${theme.focusRing}`}
          />
        </div>
      </div>

      {mode === 'either' ? (
        <div>
          <div className="flex gap-2 p-1 rounded-2xl bg-midnight-100 mb-4" role="tablist" aria-label="How should we reach you?">
            {[
              { key: 'email', label: 'Email me', icon: Mail },
              { key: 'phone', label: 'Text me', icon: Phone },
            ].map((opt) => {
              const OptIcon = opt.icon;
              const active = method === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => set({ method: opt.key })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    active ? 'bg-white text-midnight-900 shadow-card' : 'text-midnight-500 hover:text-midnight-700'
                  }`}
                >
                  <OptIcon size={15} />
                  {opt.label}
                </button>
              );
            })}
          </div>
          {method === 'phone' ? phoneField(true) : emailField(true)}
        </div>
      ) : (
        <>
          {emailField(true)}
          {phoneField(false)}
        </>
      )}

      <p className="text-sm text-midnight-400 leading-relaxed">
        No password needed — we&apos;ll send you a link to manage your report.
      </p>
    </div>
  );
}
