'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { isOnline, addNetworkListeners } from '@/app/lib/utils';

/**
 * Offline Banner Component
 * Shows a banner when the user goes offline
 */
export default function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    // Set initial state
    setOnline(isOnline());

    // Add network listeners
    const cleanup = addNetworkListeners(
      () => {
        setOnline(true);
        setShowReconnected(true);
        // Hide "reconnected" message after 3 seconds
        setTimeout(() => setShowReconnected(false), 3000);
      },
      () => {
        setOnline(false);
        setShowReconnected(false);
      }
    );

    return cleanup;
  }, []);

  // Don't render anything if online (and not showing reconnected message)
  if (online && !showReconnected) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-slide-down">
      {!online ? (
        // Offline Banner
        <div className="bg-gradient-to-r from-red-600 to-red-500 text-white px-6 py-3 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
            <WifiOff size={20} className="flex-shrink-0" />
            <span className="font-semibold">
              You're offline. Some features may not be available.
            </span>
          </div>
        </div>
      ) : (
        // Reconnected Banner
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-6 py-3 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
            <Wifi size={20} className="flex-shrink-0" />
            <span className="font-semibold">
              You're back online!
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
