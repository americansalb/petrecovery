'use client';

/**
 * Notification Prompt Component
 *
 * Shows a prompt to enable push notifications
 * Designed to be non-intrusive and dismissable.
 */

import { useState, useEffect } from 'react';
import usePushNotifications from '@/app/lib/missionControl/usePushNotifications';

export default function NotificationPrompt({
  show = true,
  petName = null,
  isLive = false,
  onSubscribe = null,
  onDismiss = null,
}) {
  const {
    permission,
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
  } = usePushNotifications();

  const [dismissed, setDismissed] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    // Check if previously dismissed
    const dismissedTime = localStorage.getItem('notification_prompt_dismissed');
    if (dismissedTime) {
      const hoursSinceDismissed = (Date.now() - parseInt(dismissedTime)) / 3600000;
      // Don't show for 24 hours after dismissal (unless live search)
      if (hoursSinceDismissed < 24 && !isLive) {
        setDismissed(true);
      }
    }
  }, [isLive]);

  // Don't show if not supported, already subscribed, or dismissed
  if (!isSupported || isSubscribed || dismissed || !show) {
    return null;
  }

  // Don't show if permission was denied
  if (permission === 'denied') {
    return null;
  }

  const handleSubscribe = async () => {
    const sub = await subscribe({
      preferences: {
        sightings: true,
        missionAlerts: true,
        squadUpdates: true,
        broadcasts: true,
      }
    });

    if (sub) {
      setSubscribed(true);
      onSubscribe?.();
      setTimeout(() => setDismissed(true), 2000);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('notification_prompt_dismissed', Date.now().toString());
    setDismissed(true);
    onDismiss?.();
  };

  if (subscribed) {
    return (
      <div style={styles.container}>
        <div style={styles.successCard}>
          <span style={styles.successIcon}>✓</span>
          <span style={styles.successText}>Notifications enabled!</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={isLive ? styles.urgentCard : styles.card}>
        <button onClick={handleDismiss} style={styles.closeButton}>×</button>

        <div style={styles.content}>
          <span style={styles.icon}>{isLive ? '🚨' : '🔔'}</span>
          <div style={styles.text}>
            <h4 style={styles.title}>
              {isLive
                ? `Get instant alerts for ${petName || 'this search'}!`
                : 'Enable notifications'}
            </h4>
            <p style={styles.description}>
              {isLive
                ? 'Be notified immediately when someone spots the pet or the search area changes.'
                : 'Get notified about sightings, search updates, and team messages.'}
            </p>
          </div>
        </div>

        <button
          onClick={handleSubscribe}
          disabled={isLoading}
          style={isLive ? styles.urgentButton : styles.button}
        >
          {isLoading ? 'Enabling...' : 'Enable Notifications'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '12px 16px',
  },

  card: {
    position: 'relative',
    padding: '16px',
    backgroundColor: '#1E1E1E',
    borderRadius: '12px',
    border: '1px solid #333',
  },

  urgentCard: {
    position: 'relative',
    padding: '16px',
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    borderRadius: '12px',
    border: '1px solid #FF9800',
  },

  closeButton: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px',
    lineHeight: 1,
  },

  content: {
    display: 'flex',
    gap: '12px',
    marginBottom: '12px',
  },

  icon: {
    fontSize: '28px',
    flexShrink: 0,
  },

  text: {
    flex: 1,
  },

  title: {
    margin: '0 0 4px 0',
    fontSize: '15px',
    fontWeight: 600,
    color: '#fff',
  },

  description: {
    margin: 0,
    fontSize: '13px',
    color: '#888',
    lineHeight: 1.4,
  },

  button: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#2196F3',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  urgentButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#FF9800',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  successCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: '8px',
    border: '1px solid #4CAF50',
  },

  successIcon: {
    color: '#4CAF50',
    fontSize: '18px',
    fontWeight: 700,
  },

  successText: {
    color: '#4CAF50',
    fontSize: '14px',
    fontWeight: 600,
  },
};
