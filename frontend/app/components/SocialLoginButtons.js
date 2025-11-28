'use client';

/**
 * Phase 7: Social Login Buttons Component
 *
 * Renders OAuth login buttons for Google, Facebook, and Apple.
 */

import { signIn } from 'next-auth/react';
import { useState } from 'react';

/**
 * Social provider icons
 */
const ProviderIcons = {
  google: (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  ),
  facebook: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
  apple: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  ),
};

/**
 * Provider colors
 */
const ProviderColors = {
  google: {
    bg: 'bg-white hover:bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-300',
  },
  facebook: {
    bg: 'bg-[#1877F2] hover:bg-[#166FE5]',
    text: 'text-white',
    border: 'border-[#1877F2]',
  },
  apple: {
    bg: 'bg-black hover:bg-gray-900',
    text: 'text-white',
    border: 'border-black',
  },
};

/**
 * Individual social login button
 */
function SocialButton({ provider, callbackUrl, disabled, onClick }) {
  const colors = ProviderColors[provider.id] || ProviderColors.google;

  return (
    <button
      type="button"
      onClick={() => onClick(provider.id)}
      disabled={disabled}
      className={`
        w-full flex items-center justify-center gap-3 px-4 py-3
        border rounded-lg font-medium transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${colors.bg} ${colors.text} ${colors.border}
      `}
    >
      {ProviderIcons[provider.id]}
      <span>Continue with {provider.name}</span>
    </button>
  );
}

/**
 * Social Login Buttons Component
 */
export default function SocialLoginButtons({
  providers = [],
  callbackUrl = '/dashboard',
  className = '',
  showDivider = true,
  dividerText = 'Or continue with',
}) {
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState('');

  // Default providers if not specified
  const defaultProviders = [
    { id: 'google', name: 'Google' },
    { id: 'facebook', name: 'Facebook' },
    { id: 'apple', name: 'Apple' },
  ];

  const availableProviders = providers.length > 0 ? providers : defaultProviders;

  const handleSocialLogin = async (providerId) => {
    setLoading(providerId);
    setError('');

    try {
      await signIn(providerId, { callbackUrl });
    } catch (err) {
      console.error('Social login error:', err);
      setError('Failed to sign in. Please try again.');
      setLoading(null);
    }
  };

  if (availableProviders.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {showDivider && (
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">{dividerText}</span>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {availableProviders.map((provider) => (
          <SocialButton
            key={provider.id}
            provider={provider}
            callbackUrl={callbackUrl}
            disabled={loading !== null}
            onClick={handleSocialLogin}
          />
        ))}
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600 text-center">{error}</p>
      )}

      {loading && (
        <p className="mt-4 text-sm text-gray-500 text-center">
          Redirecting to {loading}...
        </p>
      )}
    </div>
  );
}

/**
 * Compact social login buttons (icon only)
 */
export function SocialLoginButtonsCompact({
  providers = [],
  callbackUrl = '/dashboard',
  className = '',
}) {
  const [loading, setLoading] = useState(null);

  const defaultProviders = [
    { id: 'google', name: 'Google' },
    { id: 'facebook', name: 'Facebook' },
    { id: 'apple', name: 'Apple' },
  ];

  const availableProviders = providers.length > 0 ? providers : defaultProviders;

  const handleSocialLogin = async (providerId) => {
    setLoading(providerId);
    try {
      await signIn(providerId, { callbackUrl });
    } catch (err) {
      console.error('Social login error:', err);
      setLoading(null);
    }
  };

  return (
    <div className={`flex justify-center gap-4 ${className}`}>
      {availableProviders.map((provider) => {
        const colors = ProviderColors[provider.id];
        return (
          <button
            key={provider.id}
            type="button"
            onClick={() => handleSocialLogin(provider.id)}
            disabled={loading !== null}
            className={`
              p-3 rounded-full border transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
              ${colors.bg} ${colors.text} ${colors.border}
            `}
            title={`Sign in with ${provider.name}`}
          >
            {ProviderIcons[provider.id]}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Link social account button (for settings page)
 */
export function LinkSocialAccountButton({
  provider,
  linked = false,
  onUnlink,
  className = '',
}) {
  const [loading, setLoading] = useState(false);
  const colors = ProviderColors[provider.id] || ProviderColors.google;

  const handleLink = async () => {
    setLoading(true);
    try {
      await signIn(provider.id, { callbackUrl: '/settings/accounts' });
    } catch (err) {
      console.error('Link account error:', err);
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    if (!onUnlink) return;
    setLoading(true);
    try {
      await onUnlink(provider.id);
    } catch (err) {
      console.error('Unlink account error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex items-center justify-between p-4 border rounded-lg ${className}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${colors.bg} ${colors.text}`}>
          {ProviderIcons[provider.id]}
        </div>
        <div>
          <p className="font-medium">{provider.name}</p>
          <p className="text-sm text-gray-500">
            {linked ? 'Connected' : 'Not connected'}
          </p>
        </div>
      </div>

      {linked ? (
        <button
          onClick={handleUnlink}
          disabled={loading}
          className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Disconnecting...' : 'Disconnect'}
        </button>
      ) : (
        <button
          onClick={handleLink}
          disabled={loading}
          className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Connecting...' : 'Connect'}
        </button>
      )}
    </div>
  );
}
