'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { X, AlertTriangle, Shield } from 'lucide-react';

/**
 * Quick Waiver Acceptance Modal
 * Automatically pops up when user hasn't accepted the waiver
 * Streamlined for speed - minimal friction
 */
export default function WaiverModal({ isOpen, onClose, onAccepted }) {
  const { data: session } = useSession();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToWaiver, setAgreedToWaiver] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setAgreedToTerms(false);
      setAgreedToWaiver(false);
      setError(null);
      setAccepting(false);
    }
  }, [isOpen]);

  const handleAccept = async () => {
    if (!agreedToTerms || !agreedToWaiver) {
      setError('Please check both boxes to continue');
      return;
    }

    setAccepting(true);
    setError(null);

    try {
      // Use the simplified waiver acceptance endpoint
      const response = await fetch('/api/legal/accept-waiver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to accept waiver');
      }

      // Success!
      if (onAccepted) {
        onAccepted();
      }
    } catch (err) {
      console.error('Waiver acceptance error:', err);
      setError(err.message);
      setAccepting(false);
    }
  };

  if (!isOpen) return null;

  const canAccept = agreedToTerms && agreedToWaiver && !accepting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && !accepting && onClose?.()}
    >
      <div className="relative w-full max-w-2xl bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-in border-2 border-red-500/30">
        {/* Close button */}
        {!accepting && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition rounded-lg hover:bg-white/10"
          >
            <X size={24} />
          </button>
        )}

        {/* Header */}
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-red-500/20 rounded-full border-2 border-red-500/50">
              <AlertTriangle className="text-red-400" size={28} />
            </div>
            <h2 className="text-2xl font-bold text-white">
              Safety Agreement Required
            </h2>
          </div>
          <p className="text-slate-300 text-sm">
            Quick legal agreements before you can participate in rescue activities
          </p>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start gap-3">
              <AlertTriangle className="text-red-400 flex-shrink-0" size={20} />
              <div className="text-red-300 text-sm">{error}</div>
            </div>
          )}

          {/* Terms of Service */}
          <div className="mb-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="text-blue-400" size={20} />
              <h3 className="font-bold text-white">Terms of Service</h3>
            </div>
            <p className="text-slate-300 text-sm mb-4 leading-relaxed">
              You agree to use ReunitePets responsibly, respect other users, and follow
              all applicable laws. We provide this platform "as is" and you use it at your
              own risk. We're not responsible for pet recovery outcomes.
            </p>
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex-shrink-0">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="peer w-5 h-5 rounded cursor-pointer appearance-none border-2 border-slate-400 bg-slate-700 checked:bg-blue-500 checked:border-blue-500 transition"
                />
                {agreedToTerms && (
                  <svg
                    className="absolute top-0.5 left-0.5 w-4 h-4 text-white pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-slate-300 group-hover:text-white transition">
                I agree to the Terms of Service
              </span>
            </label>
          </div>

          {/* Liability Waiver */}
          <div className="mb-4 p-4 bg-red-900/20 rounded-xl border border-red-500/30">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="text-red-400" size={20} />
              <h3 className="font-bold text-white">Volunteer Liability Waiver</h3>
            </div>
            <p className="text-slate-300 text-sm mb-4 leading-relaxed">
              <strong className="text-white">⚠️ Important:</strong> Pet search and rescue involves risks
              including physical injury, property damage, and animal encounters. By participating, you
              voluntarily assume these risks and release ReunitePets, its users, and partners from
              liability. You're responsible for your own safety and insurance.
            </p>
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex-shrink-0">
                <input
                  type="checkbox"
                  checked={agreedToWaiver}
                  onChange={(e) => setAgreedToWaiver(e.target.checked)}
                  className="peer w-5 h-5 rounded cursor-pointer appearance-none border-2 border-red-400 bg-slate-700 checked:bg-red-500 checked:border-red-500 transition"
                />
                {agreedToWaiver && (
                  <svg
                    className="absolute top-0.5 left-0.5 w-4 h-4 text-white pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-slate-300 group-hover:text-white transition">
                I understand and accept the risks, and agree to the Liability Waiver
              </span>
            </label>
          </div>

          {/* Additional Info */}
          <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
            <p className="text-xs text-blue-300">
              💡 <strong>Full documents available:</strong> You can review the complete Terms of Service
              and Privacy Policy at any time in your account settings.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-700/50 bg-slate-900/50">
          <div className="flex gap-3">
            {onClose && (
              <button
                onClick={onClose}
                disabled={accepting}
                className="flex-1 px-6 py-3 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                I Need More Time
              </button>
            )}
            <button
              onClick={handleAccept}
              disabled={!canAccept}
              className={`flex-1 px-6 py-3 font-bold rounded-xl transition ${
                canAccept
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500 shadow-lg shadow-green-500/30'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
            >
              {accepting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Accepting...
                </span>
              ) : (
                'Agree & Continue'
              )}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-in {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
