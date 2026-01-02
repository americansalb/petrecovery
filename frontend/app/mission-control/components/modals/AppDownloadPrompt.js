'use client';

/**
 * AppDownloadPrompt - Modal prompting users to download the native app
 *
 * Shows when users try to start GPS search on the web, explaining that
 * background GPS tracking only works reliably in the native app.
 */

import { X, Smartphone, MapPin, Battery, Clock } from 'lucide-react';

// App Store URLs - update these when you publish the apps
const APP_STORE_URL = 'https://apps.apple.com/app/reunitepets/id000000000'; // TODO: Update with real App Store ID
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.reunitepets.app'; // TODO: Update with real package name

/**
 * Detect if user is on iOS or Android
 */
function getDeviceType() {
  if (typeof navigator === 'undefined') return 'unknown';

  const userAgent = navigator.userAgent || navigator.vendor || window.opera;

  // iOS detection
  if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
    return 'ios';
  }

  // Android detection
  if (/android/i.test(userAgent)) {
    return 'android';
  }

  return 'desktop';
}

/**
 * Open the appropriate app store
 */
function openAppStore() {
  const deviceType = getDeviceType();

  if (deviceType === 'ios') {
    window.location.href = APP_STORE_URL;
  } else if (deviceType === 'android') {
    window.location.href = PLAY_STORE_URL;
  } else {
    // Desktop - show both options or default to a landing page
    window.open(APP_STORE_URL, '_blank');
  }
}

export default function AppDownloadPrompt({ isOpen, onClose, onContinueAnyway }) {
  if (!isOpen) return null;

  const deviceType = getDeviceType();
  const isDesktop = deviceType === 'desktop';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-5 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Get the App for GPS Search</h2>
              <p className="text-white/80 text-sm">Track your search even in your pocket</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-gray-600">
            For reliable GPS tracking while you search, download the ReunitePets app.
            The web version can't track your location in the background.
          </p>

          {/* Benefits */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-green-100 rounded-lg">
                <MapPin className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Background GPS</p>
                <p className="text-sm text-gray-500">Tracks your path even when phone is locked</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-blue-100 rounded-lg">
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Uninterrupted Searching</p>
                <p className="text-sm text-gray-500">Take calls, check texts - GPS keeps running</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-purple-100 rounded-lg">
                <Battery className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Battery Optimized</p>
                <p className="text-sm text-gray-500">Efficient tracking designed for long searches</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 space-y-3">
          <button
            onClick={openAppStore}
            className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-red-600 transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2"
          >
            <Smartphone className="w-5 h-5" />
            {deviceType === 'ios' ? 'Download on App Store' :
             deviceType === 'android' ? 'Get it on Google Play' :
             'Download the App'}
          </button>

          {isDesktop && (
            <div className="flex gap-2">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors text-center"
              >
                App Store
              </a>
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors text-center"
              >
                Google Play
              </a>
            </div>
          )}

          {onContinueAnyway && (
            <button
              onClick={onContinueAnyway}
              className="w-full py-2.5 px-4 text-gray-500 text-sm hover:text-gray-700 transition-colors"
            >
              Continue with limited tracking anyway
            </button>
          )}
        </div>

        {/* Note */}
        <div className="px-6 pb-4">
          <p className="text-xs text-gray-400 text-center">
            Web GPS only works while the app is visible on screen
          </p>
        </div>
      </div>
    </div>
  );
}
