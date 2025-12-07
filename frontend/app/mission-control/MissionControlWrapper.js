'use client';

/**
 * MissionControlWrapper
 *
 * Wraps Mission Control with Phase 7 polish features:
 * - Toast notifications
 * - Error boundary
 * - Offline indicator
 * - Loading states
 *
 * Per Actions_Guide.md Phase 7 specification.
 */

import { Suspense } from 'react';
import { ToastProvider } from '@/app/components/ui/Toast';
import ErrorBoundary from '@/app/components/ui/ErrorBoundary';
import OfflineIndicator from '@/app/components/ui/OfflineIndicator';
import { SkeletonPage } from '@/app/components/ui/Skeleton';
import MissionControlV3 from './MissionControlV3';

// Import animations CSS
import '@/app/styles/animations.css';

/**
 * Full Mission Control with all polish features
 */
export default function MissionControlWrapper(props) {
  return (
    <ErrorBoundary variant="full">
      <ToastProvider>
        <Suspense fallback={<SkeletonPage />}>
          <MissionControlContent {...props} />
        </Suspense>
      </ToastProvider>
    </ErrorBoundary>
  );
}

/**
 * Mission Control with offline indicator
 */
function MissionControlContent(props) {
  return (
    <div className="mission-control-wrapper">
      {/* Offline Indicator - floating variant */}
      <OfflineIndicator variant="floating" />

      {/* Main Mission Control */}
      <MissionControlV3 {...props} />
    </div>
  );
}

/**
 * MissionControlSection - Error boundary for individual sections
 */
export function MissionControlSection({ children, fallback }) {
  return (
    <ErrorBoundary variant="card" fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
}
