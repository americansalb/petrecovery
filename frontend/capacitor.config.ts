import { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Configuration for ReunitePets Native App
 *
 * This enables the web app to run as a native iOS/Android app with:
 * - Background GPS tracking (continues when app is backgrounded)
 * - Foreground service notification on Android
 * - "Always allow" location permission on iOS
 * - Native splash screen
 *
 * Build modes:
 * 1. Development: Uses live reload from local dev server
 * 2. Production: Loads from hosted web app URL
 *
 * To switch modes, modify the 'server.url' below.
 */

// Set to true for development with live reload
const isDevelopment = process.env.CAPACITOR_DEV === 'true';

// Your production web app URL (where your Next.js app is hosted)
const PRODUCTION_URL = process.env.CAPACITOR_SERVER_URL || 'https://your-app-domain.com';

const config: CapacitorConfig = {
  appId: 'com.reunitepets.app',
  appName: 'ReunitePets',
  webDir: 'out',
  server: isDevelopment
    ? {
        // Development: Live reload from local dev server
        // Get your local IP: ipconfig getifaddr en0 (Mac) or hostname -I (Linux)
        url: process.env.CAPACITOR_DEV_URL || 'http://localhost:3000',
        cleartext: true, // Allow HTTP for local dev
      }
    : {
        // Production: Load from hosted web app
        url: PRODUCTION_URL,
        // Note: In production, your server must use HTTPS
      },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    BackgroundGeolocation: {
      // iOS: Request "Always allow" location permission
      locationAuthorizationRequest: 'Always',
    },
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#ffffff',
    // Handle safe areas for notched devices
    preferredContentMode: 'mobile',
  },
  android: {
    backgroundColor: '#ffffff',
    allowMixedContent: isDevelopment, // Only allow HTTP in dev mode
    // Use immersive mode for full-screen experience
    captureInput: true,
  },
};

export default config;
