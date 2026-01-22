'use client';

/**
 * Push Notifications Hook
 *
 * Manages push notification subscription and permissions
 * for Mission Control real-time alerts.
 */

import { useState, useEffect, useCallback } from 'react';

// VAPID public key (should match server)
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export default function usePushNotifications() {
  const [permission, setPermission] = useState('default');
  const [subscription, setSubscription] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkSupport();
  }, []);

  const checkSupport = async () => {
    try {
      const supported =
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;

      setIsSupported(supported);

      if (supported) {
        setPermission(Notification.permission);

        // Check for existing subscription
        const registration = await navigator.serviceWorker.ready;
        const existingSub = await registration.pushManager.getSubscription();
        setSubscription(existingSub);
      }
    } catch (err) {
      console.error('Error checking push support:', err);
      setError('Failed to check notification support');
    } finally {
      setIsLoading(false);
    }
  };

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      setError('Push notifications not supported');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (err) {
      console.error('Error requesting permission:', err);
      setError('Failed to request notification permission');
      return false;
    }
  }, [isSupported]);

  const subscribe = useCallback(async (options = {}) => {
    if (!isSupported) {
      setError('Push notifications not supported');
      return null;
    }

    if (permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) {
        setError('Notification permission denied');
        return null;
      }
    }

    try {
      setIsLoading(true);

      // Register service worker if not already registered
      let registration = await navigator.serviceWorker.getRegistration('/sw-push.js');
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw-push.js');
        await navigator.serviceWorker.ready;
      }

      // Subscribe to push
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Get device ID from localStorage or generate new one
      let deviceId = localStorage.getItem('reunitepets_device_id');
      if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('reunitepets_device_id', deviceId);
      }

      // Send subscription to server
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          deviceId,
          deviceName: getDeviceName(),
          preferences: options.preferences,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save subscription on server');
      }

      setSubscription(sub);
      setError(null);
      return sub;
    } catch (err) {
      console.error('Error subscribing to push:', err);
      setError('Failed to subscribe to notifications');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, permission, requestPermission]);

  const unsubscribe = useCallback(async () => {
    if (!subscription) return true;

    try {
      setIsLoading(true);

      // Unsubscribe from push manager
      await subscription.unsubscribe();

      // Remove from server
      const deviceId = localStorage.getItem('reunitepets_device_id');
      await fetch('/api/notifications/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          deviceId,
        }),
      });

      setSubscription(null);
      setError(null);
      return true;
    } catch (err) {
      console.error('Error unsubscribing:', err);
      setError('Failed to unsubscribe from notifications');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [subscription]);

  return {
    permission,
    subscription,
    isSupported,
    isLoading,
    error,
    isSubscribed: !!subscription,
    requestPermission,
    subscribe,
    unsubscribe,
  };
}

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  if (!base64String) return new Uint8Array();

  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Helper to get device name
function getDeviceName() {
  const ua = navigator.userAgent;

  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) {
    const match = ua.match(/Android.*?;\s*([^;)]+)/);
    return match ? match[1].trim() : 'Android Device';
  }
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Linux/.test(ua)) return 'Linux';

  return 'Unknown Device';
}
