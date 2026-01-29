import { NextResponse } from 'next/server';

/**
 * GET /api/mobile/config
 * Configuration endpoint for React Native mobile app
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform') || 'ios'; // ios, android
  const version = searchParams.get('version') || '1.0.0';

  // App configuration
  const config = {
    // API configuration
    api: {
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'https://petrecovery.org',
      version: 'v1',
      timeout: 30000,
    },

    // Feature flags
    features: {
      pushNotifications: true,
      offlineMode: true,
      biometricAuth: true,
      darkMode: true,
      locationTracking: true,
      cameraCapture: true,
      backgroundSync: true,
      voiceSearch: false, // Coming soon
    },

    // Platform-specific settings
    platform: {
      ios: {
        minVersion: '14.0',
        appStoreUrl: 'https://apps.apple.com/app/petrecovery',
        bundleId: 'org.petrecovery.app',
      },
      android: {
        minSdk: 26,
        playStoreUrl: 'https://play.google.com/store/apps/details?id=org.petrecovery.app',
        packageName: 'org.petrecovery.app',
      },
    },

    // Update requirements
    updates: {
      currentVersion: '1.0.0',
      minSupportedVersion: '1.0.0',
      forceUpdate: false,
      updateUrl: platform === 'ios'
        ? 'https://apps.apple.com/app/petrecovery'
        : 'https://play.google.com/store/apps/details?id=org.petrecovery.app',
    },

    // Map configuration
    maps: {
      provider: 'mapbox', // or 'google'
      defaultCenter: { lat: 39.8283, lng: -98.5795 }, // US center
      defaultZoom: 10,
      maxSearchRadius: 50, // miles
    },

    // Notification channels (Android)
    notificationChannels: [
      {
        id: 'urgent_alerts',
        name: 'Urgent Alerts',
        description: 'High priority pet alerts near you',
        importance: 'high',
        sound: true,
        vibrate: true,
      },
      {
        id: 'case_updates',
        name: 'Case Updates',
        description: 'Updates on cases you follow',
        importance: 'default',
        sound: true,
        vibrate: false,
      },
      {
        id: 'squad_messages',
        name: 'Squad Messages',
        description: 'Messages from your rescue forces',
        importance: 'default',
        sound: true,
        vibrate: false,
      },
      {
        id: 'general',
        name: 'General',
        description: 'General notifications',
        importance: 'low',
        sound: false,
        vibrate: false,
      },
    ],

    // Deep linking configuration
    deepLinks: {
      scheme: 'petrecovery',
      prefixes: ['https://petrecovery.org', 'petrecovery://'],
      routes: {
        case: '/missions/:id',
        squad: '/squads/:id',
        profile: '/users/:id',
        sighting: '/sighting/:missionId',
        search: '/search',
        report: '/report',
      },
    },

    // Offline data configuration
    offline: {
      maxCacheSize: 100 * 1024 * 1024, // 100MB
      syncInterval: 300000, // 5 minutes
      cacheImages: true,
      maxCachedCases: 100,
    },

    // Analytics
    analytics: {
      enabled: process.env.NODE_ENV === 'production',
      providers: ['firebase', 'amplitude'],
    },

    // Support
    support: {
      email: 'support@petrecovery.org',
      helpUrl: 'https://petrecovery.org/help',
      feedbackUrl: 'https://petrecovery.org/feedback',
    },
  };

  // Check if app version needs update
  const needsUpdate = compareVersions(version, config.updates.minSupportedVersion) < 0;
  config.updates.needsUpdate = needsUpdate;

  return NextResponse.json(config);
}

function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }

  return 0;
}
