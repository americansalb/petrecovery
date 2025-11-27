'use client';

/**
 * Phase 8: Push Notifications Client Component
 *
 * Manages push notification subscriptions from the browser.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Convert URL-safe base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Get browser info for subscription
 */
function getBrowserInfo() {
  const ua = navigator.userAgent;
  let browser = 'Unknown';

  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';

  const isMobile = /Mobile|Android|iPhone|iPad/.test(ua);
  const platform = isMobile ? 'Mobile' : 'Desktop';

  return `${browser} on ${platform}`;
}

/**
 * Custom hook for push notification management
 */
export function usePushNotifications() {
  const { data: session } = useSession();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [permission, setPermission] = useState('default');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if push is supported
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  // Check existing subscription
  useEffect(() => {
    if (!isSupported || !session?.user) {
      setLoading(false);
      return;
    }

    checkSubscription();
  }, [isSupported, session]);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();

      setIsSubscribed(!!sub);
      setSubscription(sub);
    } catch (err) {
      console.error('Error checking subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  const subscribe = useCallback(async () => {
    if (!isSupported || !session?.user) {
      setError('Push notifications not available');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // Request permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        setError('Notification permission denied');
        return false;
      }

      // Get VAPID key
      const keyResponse = await fetch('/api/push/subscribe');
      const { vapidPublicKey } = await keyResponse.json();

      if (!vapidPublicKey) {
        setError('Push notifications not configured on server');
        return false;
      }

      // Register service worker if needed
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
      }

      // Subscribe to push
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // Save subscription to server
      const saveResponse = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          deviceName: getBrowserInfo(),
          browserInfo: navigator.userAgent,
        }),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save subscription');
      }

      setIsSubscribed(true);
      setSubscription(sub);
      return true;
    } catch (err) {
      console.error('Subscribe error:', err);
      setError(err.message || 'Failed to subscribe');
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported, session]);

  const unsubscribe = useCallback(async () => {
    if (!subscription) return false;

    setLoading(true);
    setError(null);

    try {
      // Unsubscribe from push
      await subscription.unsubscribe();

      // Remove from server
      await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
        method: 'DELETE',
      });

      setIsSubscribed(false);
      setSubscription(null);
      return true;
    } catch (err) {
      console.error('Unsubscribe error:', err);
      setError(err.message || 'Failed to unsubscribe');
      return false;
    } finally {
      setLoading(false);
    }
  }, [subscription]);

  return {
    isSupported,
    isSubscribed,
    subscription,
    permission,
    loading,
    error,
    subscribe,
    unsubscribe,
  };
}

/**
 * Push notification toggle component
 */
export default function PushNotificationToggle({ className = '' }) {
  const {
    isSupported,
    isSubscribed,
    permission,
    loading,
    error,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  if (!isSupported) {
    return (
      <div className={`text-gray-500 text-sm ${className}`}>
        Push notifications are not supported in this browser
      </div>
    );
  }

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-900">Push Notifications</p>
          <p className="text-sm text-gray-500">
            {isSubscribed
              ? 'Receive instant alerts on this device'
              : 'Enable to receive instant alerts'}
          </p>
        </div>

        <button
          onClick={handleToggle}
          disabled={loading || permission === 'denied'}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full
            transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed
            ${isSubscribed ? 'bg-blue-600' : 'bg-gray-200'}
          `}
          role="switch"
          aria-checked={isSubscribed}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform
              ${isSubscribed ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </button>
      </div>

      {permission === 'denied' && (
        <p className="text-sm text-red-600">
          Notifications are blocked. Please enable them in your browser settings.
        </p>
      )}

      {error && permission !== 'denied' && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {loading && (
        <p className="text-sm text-gray-500">
          {isSubscribed ? 'Disabling...' : 'Enabling...'}
        </p>
      )}
    </div>
  );
}

/**
 * Push notification permission request component
 */
export function PushPermissionRequest({ onComplete }) {
  const { isSupported, permission, subscribe, loading } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if not supported, already granted, or dismissed
  if (!isSupported || permission === 'granted' || permission === 'denied' || dismissed) {
    return null;
  }

  const handleEnable = async () => {
    const result = await subscribe();
    onComplete?.(result);
  };

  const handleDismiss = () => {
    setDismissed(true);
    onComplete?.(false);
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <svg
            className="w-6 h-6 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-blue-900">Enable Push Notifications?</h3>
          <p className="mt-1 text-sm text-blue-700">
            Get instant alerts when there's a sighting of your lost pet or updates on cases in your area.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleEnable}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Enabling...' : 'Enable Notifications'}
            </button>
            <button
              onClick={handleDismiss}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              Not Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Service worker registration helper
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('Service worker registered:', registration.scope);

    // Check for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            console.log('New service worker available');
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return null;
  }
}
