'use client';

/**
 * Toast Notification System
 *
 * Provides user feedback via toast notifications.
 * Per Actions_Guide.md Phase 7 specification.
 */

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

// Toast types with colors
const TOAST_TYPES = {
  success: {
    icon: '\u2713',
    bg: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    border: '#34D399',
  },
  error: {
    icon: '\u2717',
    bg: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
    border: '#F87171',
  },
  warning: {
    icon: '\u26A0',
    bg: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    border: '#FBBF24',
  },
  info: {
    icon: '\u2139',
    bg: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
    border: '#60A5FA',
  },
  offline: {
    icon: '\u{1F4F4}',
    bg: 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)',
    border: '#9CA3AF',
  },
  points: {
    icon: '\u2B50',
    bg: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
    border: '#A78BFA',
  },
};

// Toast Context
const ToastContext = createContext(null);

/**
 * Toast Provider - Wraps app to provide toast functionality
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  const addToast = useCallback((message, options = {}) => {
    const id = ++toastIdRef.current;
    const toast = {
      id,
      message,
      type: options.type || 'info',
      duration: options.duration ?? 4000,
      action: options.action,
      actionLabel: options.actionLabel,
      dismissible: options.dismissible ?? true,
    };

    setToasts((prev) => [...prev, toast]);

    // Auto-dismiss
    if (toast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Convenience methods
  const success = useCallback((message, options = {}) => {
    return addToast(message, { ...options, type: 'success' });
  }, [addToast]);

  const error = useCallback((message, options = {}) => {
    return addToast(message, { ...options, type: 'error', duration: options.duration ?? 6000 });
  }, [addToast]);

  const warning = useCallback((message, options = {}) => {
    return addToast(message, { ...options, type: 'warning' });
  }, [addToast]);

  const info = useCallback((message, options = {}) => {
    return addToast(message, { ...options, type: 'info' });
  }, [addToast]);

  const offline = useCallback((message, options = {}) => {
    return addToast(message || "You're offline. Actions will sync when you reconnect.", {
      ...options,
      type: 'offline',
      duration: 0, // Persistent until online
      dismissible: false,
    });
  }, [addToast]);

  const points = useCallback((amount, action, options = {}) => {
    return addToast(`+${amount} points for ${action}!`, { ...options, type: 'points' });
  }, [addToast]);

  const value = {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
    offline,
    points,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

/**
 * useToast - Hook to access toast functionality
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

/**
 * ToastContainer - Renders the toast stack
 */
function ToastContainer({ toasts, onDismiss }) {
  return (
    <div style={styles.container} role="region" aria-label="Notifications">
      {toasts.map((toast, index) => (
        <Toast
          key={toast.id}
          toast={toast}
          index={index}
          onDismiss={() => onDismiss(toast.id)}
        />
      ))}
    </div>
  );
}

/**
 * Toast - Individual toast notification
 */
function Toast({ toast, index, onDismiss }) {
  const [isExiting, setIsExiting] = useState(false);
  const typeConfig = TOAST_TYPES[toast.type] || TOAST_TYPES.info;

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(onDismiss, 200);
  }, [onDismiss]);

  const handleAction = useCallback(() => {
    if (toast.action) {
      toast.action();
    }
    handleDismiss();
  }, [toast.action, handleDismiss]);

  return (
    <div
      style={{
        ...styles.toast,
        background: typeConfig.bg,
        borderColor: typeConfig.border,
        transform: isExiting ? 'translateX(120%)' : 'translateX(0)',
        opacity: isExiting ? 0 : 1,
        animationDelay: `${index * 50}ms`,
      }}
      role="alert"
    >
      <span style={styles.icon}>{typeConfig.icon}</span>
      <span style={styles.message}>{toast.message}</span>

      {toast.actionLabel && toast.action && (
        <button onClick={handleAction} style={styles.actionButton}>
          {toast.actionLabel}
        </button>
      )}

      {toast.dismissible && (
        <button onClick={handleDismiss} style={styles.closeButton} aria-label="Dismiss">
          &times;
        </button>
      )}
    </div>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = {
  container: {
    position: 'fixed',
    top: '1rem',
    right: '1rem',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    maxWidth: '400px',
    width: '100%',
    pointerEvents: 'none',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.875rem 1rem',
    borderRadius: '12px',
    border: '1px solid',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
    color: 'white',
    fontSize: '0.9rem',
    fontWeight: '500',
    pointerEvents: 'auto',
    animation: 'slideIn 0.3s ease-out',
    transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
  },
  icon: {
    fontSize: '1.1rem',
    flexShrink: 0,
  },
  message: {
    flex: 1,
    lineHeight: 1.4,
  },
  actionButton: {
    background: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    borderRadius: '6px',
    padding: '0.375rem 0.75rem',
    color: 'white',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background 0.2s',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '1.25rem',
    cursor: 'pointer',
    padding: '0 0.25rem',
    lineHeight: 1,
    flexShrink: 0,
  },
};

// Add keyframes via style tag
if (typeof document !== 'undefined') {
  const styleId = 'toast-animations';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(120%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

export default ToastProvider;
