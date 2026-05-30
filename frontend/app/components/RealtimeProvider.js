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

  const addNotification = useCallback((notification) => {
    setNotifications((prev) => [notification, ...prev].slice(0, 50));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
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
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtimeContext() {
  return useContext(RealtimeContext);
}

export default RealtimeProvider;
