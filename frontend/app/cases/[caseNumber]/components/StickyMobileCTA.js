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
  const [bannerOnScreen, setBannerOnScreen] = useState(false);

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

  // The page body already carries a full-width I've Seen button. While that
  // one is on screen, this bar yields - two identical yellow CTAs stacked on
  // a phone read as a glitch.
  useEffect(() => {
    const banner = document.getElementById('inline-sighting-cta');
    if (!banner || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setBannerOnScreen(entry.isIntersecting),
      { threshold: 0.3 }
    );
    observer.observe(banner);
    return () => observer.disconnect();
  }, []);

  return (
    <AnimatePresence>
      {isVisible && !bannerOnScreen && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          /* bottom-16 sits this bar exactly on top of GlobalBottomNav, whose
             row is h-16. Both are lg:hidden and the tab bar only disappears
             inside an immersive route, which a case page never is, so they
             appear and disappear together.

             This was bottom-0 z-40 against the tab bar's bottom-0 z-50 opaque
             white: the tab bar covered 65px of this bar's 101px and a tap at
             this bar's centre landed on the tab bar underneath. The one control
             that files a sighting was unreachable on a phone. If you change the
             tab bar height, change this with it. */
          className="fixed bottom-16 left-0 right-0 z-40 lg:hidden"
        >
          {/* Gradient fade for smooth transition */}
          <div className="h-6 bg-gradient-to-t from-white to-transparent" />

          {/* CTA Bar - no safe-area padding here; the tab bar below owns it */}
          <div className="bg-white border-t border-midnight-100 shadow-lg px-4 py-3">
            <div className="flex items-center gap-3">
              {/* Primary CTA - Report Sighting */}
              <button
                onClick={onReportSighting}
                className="flex-1 bg-flash-400 hover:bg-flash-500 text-midnight-900 font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-flash-400/30 flex items-center justify-center gap-2 transition active:scale-[0.98]"
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
