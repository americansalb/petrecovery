'use client';

/**
 * StickyMobileCTA - Fixed bottom bar for mobile
 *
 * Keeps the primary action (Report Sighting) always accessible.
 * Appears after scrolling past the hero section.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Share2, Phone } from 'lucide-react';

export default function StickyMobileCTA({
  petName = 'This Pet',
  onReportSighting,
  onShare,
  ownerPhone
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show after scrolling 300px (past hero)
      const shouldShow = window.scrollY > 300;
      setIsVisible(shouldShow);

      if (window.scrollY > 50) {
        setHasScrolled(true);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
        >
          {/* Gradient fade for smooth transition */}
          <div className="h-6 bg-gradient-to-t from-white to-transparent" />

          {/* CTA Bar */}
          <div className="bg-white border-t border-midnight-100 shadow-lg px-4 py-3 safe-area-inset-bottom">
            <div className="flex items-center gap-3">
              {/* Primary CTA - Report Sighting */}
              <button
                onClick={onReportSighting}
                className="flex-1 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-rose-200 flex items-center justify-center gap-2 transition active:scale-[0.98]"
              >
                <Eye className="w-5 h-5" />
                <span>I've Seen {petName}</span>
              </button>

              {/* Secondary Actions */}
              <div className="flex gap-2">
                <button
                  onClick={onShare}
                  className="w-12 h-12 bg-midnight-100 hover:bg-midnight-200 rounded-xl flex items-center justify-center transition active:scale-95"
                  aria-label="Share"
                >
                  <Share2 className="w-5 h-5 text-midnight-600" />
                </button>

                {ownerPhone && (
                  <a
                    href={`tel:${ownerPhone}`}
                    className="w-12 h-12 bg-emerald-100 hover:bg-emerald-200 rounded-xl flex items-center justify-center transition active:scale-95"
                    aria-label="Call Owner"
                  >
                    <Phone className="w-5 h-5 text-emerald-600" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
