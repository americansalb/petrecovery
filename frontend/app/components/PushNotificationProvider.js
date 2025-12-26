'use client';

/**
 * Push Notification Provider
 *
 * Automatically registers service worker and prompts users
 * to enable push notifications after they log in.
 */

import { useEffect, useState, createContext, useContext } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { usePushNotifications, registerServiceWorker } from './PushNotifications';
import { Bell, X } from 'lucide-react';

const PushContext = createContext(null);

export function usePush() {
  return useContext(PushContext);
}

export default function PushNotificationProvider({ children }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const push = usePushNotifications();
  const [showPrompt, setShowPrompt] = useState(false);
  const [hasPrompted, setHasPrompted] = useState(false);

  // Register service worker on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      registerServiceWorker();
    }
  }, []);

  // Show prompt after login (with delay)
  useEffect(() => {
    // Don't show on auth pages
    if (pathname?.startsWith('/login') || pathname?.startsWith('/register')) {
      return;
    }

    // Only show for authenticated users
    if (status !== 'authenticated' || !session?.user) {
      return;
    }

    // Already subscribed or prompted this session
    if (push.isSubscribed || hasPrompted) {
      return;
    }

    // Permission already denied
    if (push.permission === 'denied') {
      return;
    }

    // Check if we've shown the prompt recently (stored in localStorage)
    const lastPrompt = localStorage.getItem('push_prompt_dismissed');
    if (lastPrompt) {
      const daysSincePrompt = (Date.now() - parseInt(lastPrompt)) / (1000 * 60 * 60 * 24);
      if (daysSincePrompt < 7) {
        return; // Don't show more than once per week
      }
    }

    // Wait a bit after page load before showing
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [session, status, pathname, push.isSubscribed, push.permission, hasPrompted]);

  const handleEnable = async () => {
    setHasPrompted(true);
    setShowPrompt(false);
    await push.subscribe();
  };

  const handleDismiss = () => {
    setHasPrompted(true);
    setShowPrompt(false);
    localStorage.setItem('push_prompt_dismissed', Date.now().toString());
  };

  return (
    <PushContext.Provider value={push}>
      {children}

      {/* Push Notification Prompt Banner */}
      {showPrompt && push.isSupported && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Bell size={20} className="text-white" />
              </div>
              <div className="flex-1 text-white">
                <p className="font-semibold">Stay Connected</p>
                <p className="text-sm text-white/80">Get instant pet match alerts</p>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1 hover:bg-white/20 rounded-full transition-colors"
              >
                <X size={18} className="text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              <p className="text-gray-600 text-sm mb-4">
                Enable push notifications to receive instant alerts when:
              </p>
              <ul className="text-sm text-gray-600 space-y-2 mb-4">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  Someone finds a pet matching yours
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  You receive a new message
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  There's a sighting of your pet
                </li>
              </ul>

              <div className="flex gap-2">
                <button
                  onClick={handleEnable}
                  disabled={push.loading}
                  className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {push.loading ? 'Enabling...' : 'Enable Notifications'}
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2.5 text-gray-500 hover:text-gray-700 font-medium text-sm"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </PushContext.Provider>
  );
}
