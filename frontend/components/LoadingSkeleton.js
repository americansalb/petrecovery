'use client';

/**
 * Loading Skeleton Components
 * Reusable skeleton loaders for various UI elements
 */

/**
 * Base skeleton component
 */
export function Skeleton({ className = '', ...props }) {
  return (
    <div
      className={`animate-pulse bg-slate-700/50 rounded ${className}`}
      {...props}
    />
  );
}

/**
 * Case Card Skeleton - matches CasesModeV2 card layout
 */
export function CaseCardSkeleton() {
  return (
    <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
      <div className="flex gap-5">
        {/* Pet Photo Skeleton */}
        <Skeleton className="flex-shrink-0 w-28 h-28 rounded-xl" />

        {/* Case Info Skeleton */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Pet Name & Species */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-5 w-16" />
          </div>

          {/* Case Number */}
          <Skeleton className="h-4 w-40" />

          {/* Location & Time */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-32" />
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Case List Skeleton - shows multiple case cards
 */
export function CaseListSkeleton({ count = 3 }) {
  return (
    <div className="grid gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <CaseCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Team Member Skeleton - for volunteer/team lists
 */
export function TeamMemberSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700/20">
      {/* Avatar */}
      <Skeleton className="flex-shrink-0 w-10 h-10 rounded-full" />

      {/* Name & Role */}
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>

      {/* Status indicator */}
      <Skeleton className="w-2 h-2 rounded-full" />
    </div>
  );
}

/**
 * Task Item Skeleton
 */
export function TaskItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl border border-slate-700/30">
      <Skeleton className="w-5 h-5 rounded" />
      <Skeleton className="flex-1 h-4" />
      <Skeleton className="w-16 h-6 rounded-full" />
    </div>
  );
}

/**
 * Map Loading Skeleton
 */
export function MapSkeleton() {
  return (
    <div className="relative w-full h-full bg-slate-900 rounded-2xl overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <Skeleton className="w-16 h-16 rounded-full mx-auto mb-4" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    </div>
  );
}

/**
 * Button Loading Spinner
 */
export function ButtonSpinner({ size = 16, className = '' }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/**
 * Full Page Loading
 */
export function PageLoading({ message = 'Loading...' }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 border-4 border-slate-700 rounded-full" />
          <div className="absolute inset-0 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-slate-300 text-lg font-semibold">{message}</p>
      </div>
    </div>
  );
}

/**
 * Inline Loading Spinner
 */
export function InlineSpinner({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <div className="relative w-full h-full">
        <div className="absolute inset-0 border-2 border-slate-600 rounded-full" />
        <div className="absolute inset-0 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
}
