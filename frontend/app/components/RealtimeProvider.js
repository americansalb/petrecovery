'use client';

import { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRealtime } from '@/app/hooks/useRealtime';

const RealtimeContext = createContext({
  connected: false,
  notifications: [],
  addNotification: () => {},
  clearNotifications: () => {},
});

export function RealtimeProvider({ children }) {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);

  const addNotification = useCallback((notification) => {
    setNotifications((prev) => [notification, ...prev].slice(0, 50));

    // Show toast for new notifications
    const toastId = Date.now();
    setToasts((prev) => [...prev, { ...notification, id: toastId }]);

    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 5000);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const dismissToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  const { connected, reconnect } = useRealtime({
    onNotification: addNotification,
    onCaseUpdate: (payload) => {
      addNotification({
        type: 'CASE_UPDATE',
        title: 'Case Update',
        message: payload.message || 'A case has been updated',
        data: payload,
      });
    },
    onSighting: (payload) => {
      addNotification({
        type: 'SIGHTING',
        title: 'New Sighting!',
        message: payload.message || 'A new pet sighting has been reported',
        data: payload,
      });
    },
    enabled: !!session?.user?.id,
  });

  return (
    <RealtimeContext.Provider
      value={{
        connected,
        reconnect,
        notifications,
        addNotification,
        clearNotifications,
        toasts,
        dismissToast,
      }}
    >
      {children}

      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '1rem',
          right: '1rem',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}>
          {toasts.map((toast) => (
            <div
              key={toast.id}
              style={{
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                padding: '1rem',
                maxWidth: '360px',
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'flex-start',
                animation: 'slideIn 0.3s ease-out',
                borderLeft: `4px solid ${getToastColor(toast.type)}`,
              }}
            >
              <div style={{ flex: 1 }}>
                <h4 style={{
                  margin: 0,
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: '#1e293b',
                }}>
                  {toast.title}
                </h4>
                <p style={{
                  margin: '0.25rem 0 0 0',
                  fontSize: '0.8rem',
                  color: '#64748b',
                }}>
                  {toast.message}
                </p>
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '0.25rem',
                  fontSize: '1.2rem',
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      <style jsx global>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </RealtimeContext.Provider>
  );
}

function getToastColor(type) {
  switch (type) {
    case 'SIGHTING':
      return '#10b981';
    case 'CASE_UPDATE':
      return '#f59e0b';
    case 'FORCE_MESSAGE':
      return '#4f46e5';
    case 'SYSTEM':
      return '#6b7280';
    default:
      return '#64748b';
  }
}

export function useRealtimeContext() {
  return useContext(RealtimeContext);
}

export default RealtimeProvider;
