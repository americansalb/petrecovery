/**
 * Sentry Server Configuration
 * This file configures error tracking for server-side code
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // Environment
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Error filtering
  ignoreErrors: [
    // Expected errors
    'ECONNREFUSED',
    'ETIMEDOUT',
  ],

  // Privacy
  beforeSend(event, hint) {
    // Remove sensitive data from server errors
    if (event.request) {
      delete event.request.cookies;
      if (event.request.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
    }

    // Remove sensitive environment variables
    if (event.contexts?.runtime?.env) {
      delete event.contexts.runtime.env.DATABASE_URL;
      delete event.contexts.runtime.env.NEXTAUTH_SECRET;
      delete event.contexts.runtime.env.VAPID_PRIVATE_KEY;
      delete event.contexts.runtime.env.STRIPE_SECRET_KEY;
      delete event.contexts.runtime.env.TWILIO_AUTH_TOKEN;
    }

    // Don't send events in development unless explicitly enabled
    if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEV_MODE) {
      return null;
    }

    return event;
  },
});
