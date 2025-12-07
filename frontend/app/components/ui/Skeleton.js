'use client';

/**
 * Skeleton Loading Components
 *
 * Provides loading placeholders for better perceived performance.
 * Per Actions_Guide.md Phase 7 specification.
 */

import { memo } from 'react';

/**
 * Base Skeleton component
 */
export const Skeleton = memo(function Skeleton({
  width,
  height,
  borderRadius = '8px',
  style = {},
  className = '',
}) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width: width || '100%',
        height: height || '1rem',
        borderRadius,
        background: 'linear-gradient(90deg, #1E293B 0%, #334155 50%, #1E293B 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        ...style,
      }}
    />
  );
});

/**
 * Text skeleton - for paragraph text
 */
export const SkeletonText = memo(function SkeletonText({ lines = 3, lastLineWidth = '60%' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="0.875rem"
          width={i === lines - 1 ? lastLineWidth : '100%'}
          borderRadius="4px"
        />
      ))}
    </div>
  );
});

/**
 * Card skeleton - for content cards
 */
export const SkeletonCard = memo(function SkeletonCard({ hasImage = true, hasActions = true }) {
  return (
    <div style={cardStyles.container}>
      {hasImage && <Skeleton height="120px" borderRadius="8px 8px 0 0" />}
      <div style={cardStyles.content}>
        <Skeleton height="1.25rem" width="70%" borderRadius="4px" />
        <SkeletonText lines={2} />
        {hasActions && (
          <div style={cardStyles.actions}>
            <Skeleton height="2.25rem" width="45%" borderRadius="8px" />
            <Skeleton height="2.25rem" width="45%" borderRadius="8px" />
          </div>
        )}
      </div>
    </div>
  );
});

/**
 * Task skeleton - for task list items
 */
export const SkeletonTask = memo(function SkeletonTask() {
  return (
    <div style={taskStyles.container}>
      <Skeleton width="40px" height="40px" borderRadius="10px" />
      <div style={taskStyles.content}>
        <Skeleton height="1rem" width="60%" borderRadius="4px" />
        <Skeleton height="0.75rem" width="80%" borderRadius="4px" style={{ marginTop: '0.5rem' }} />
      </div>
      <Skeleton width="60px" height="1.5rem" borderRadius="12px" />
    </div>
  );
});

/**
 * Task list skeleton
 */
export const SkeletonTaskList = memo(function SkeletonTaskList({ count = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonTask key={i} />
      ))}
    </div>
  );
});

/**
 * Stats skeleton - for metric cards
 */
export const SkeletonStats = memo(function SkeletonStats({ count = 4 }) {
  return (
    <div style={statsStyles.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={statsStyles.card}>
          <Skeleton height="2rem" width="60%" borderRadius="4px" />
          <Skeleton height="0.75rem" width="80%" borderRadius="4px" style={{ marginTop: '0.5rem' }} />
        </div>
      ))}
    </div>
  );
});

/**
 * Map skeleton - for map loading
 */
export const SkeletonMap = memo(function SkeletonMap() {
  return (
    <div style={mapStyles.container}>
      <Skeleton height="100%" borderRadius="12px" />
      <div style={mapStyles.overlay}>
        <div style={mapStyles.spinner} />
        <span style={mapStyles.text}>Loading map...</span>
      </div>
    </div>
  );
});

/**
 * Tab content skeleton - for tab panels
 */
export const SkeletonTabContent = memo(function SkeletonTabContent({ variant = 'default' }) {
  if (variant === 'overview') {
    return (
      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Photo placeholder */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Skeleton width="160px" height="160px" borderRadius="16px" />
        </div>
        {/* Pet info */}
        <div style={{ textAlign: 'center' }}>
          <Skeleton height="1.5rem" width="40%" borderRadius="4px" style={{ margin: '0 auto' }} />
          <Skeleton height="1rem" width="60%" borderRadius="4px" style={{ margin: '0.5rem auto' }} />
        </div>
        {/* Action buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height="80px" borderRadius="12px" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'tasks') {
    return (
      <div style={{ padding: '1rem' }}>
        <Skeleton height="1.25rem" width="30%" borderRadius="4px" style={{ marginBottom: '1rem' }} />
        <SkeletonTaskList count={5} />
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <SkeletonCard />
      <SkeletonStats count={4} />
    </div>
  );
});

/**
 * Full page loading skeleton
 */
export const SkeletonPage = memo(function SkeletonPage() {
  return (
    <div style={pageStyles.container}>
      {/* Header */}
      <div style={pageStyles.header}>
        <Skeleton width="48px" height="48px" borderRadius="12px" />
        <div style={{ flex: 1 }}>
          <Skeleton height="1.25rem" width="50%" borderRadius="4px" />
          <Skeleton height="0.875rem" width="70%" borderRadius="4px" style={{ marginTop: '0.5rem' }} />
        </div>
      </div>
      {/* Tabs */}
      <div style={pageStyles.tabs}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width="60px" height="2.5rem" borderRadius="8px" />
        ))}
      </div>
      {/* Content */}
      <SkeletonTabContent variant="overview" />
    </div>
  );
});

// =============================================================================
// STYLES
// =============================================================================

const cardStyles = {
  container: {
    background: '#1E293B',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid #334155',
  },
  content: {
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  actions: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '0.5rem',
  },
};

const taskStyles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.875rem',
    background: '#1E293B',
    borderRadius: '10px',
    border: '1px solid #334155',
  },
  content: {
    flex: 1,
  },
};

const statsStyles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.75rem',
  },
  card: {
    padding: '1rem',
    background: '#1E293B',
    borderRadius: '10px',
    border: '1px solid #334155',
    textAlign: 'center',
  },
};

const mapStyles = {
  container: {
    position: 'relative',
    height: '200px',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #334155',
    borderTopColor: '#667EEA',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  text: {
    color: '#94A3B8',
    fontSize: '0.875rem',
  },
};

const pageStyles = {
  container: {
    minHeight: '100vh',
    background: '#0F172A',
    padding: '1rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  tabs: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1rem',
    overflowX: 'auto',
    paddingBottom: '0.5rem',
  },
};

// Add shimmer animation
if (typeof document !== 'undefined') {
  const styleId = 'skeleton-animations';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
}

export default Skeleton;
