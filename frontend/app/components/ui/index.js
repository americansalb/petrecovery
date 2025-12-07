/**
 * UI Components Index
 *
 * Central export for all Phase 7 UI polish components.
 */

// Toast notifications
export { ToastProvider, useToast } from './Toast';

// Skeleton loaders
export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonTask,
  SkeletonTaskList,
  SkeletonStats,
  SkeletonMap,
  SkeletonTabContent,
  SkeletonPage,
} from './Skeleton';

// Error handling
export { default as ErrorBoundary } from './ErrorBoundary';

// Offline support
export { default as OfflineIndicator } from './OfflineIndicator';

// User feedback
export { default as FeedbackWidget, useFeedback, QuickFeedbackButton } from './FeedbackWidget';
