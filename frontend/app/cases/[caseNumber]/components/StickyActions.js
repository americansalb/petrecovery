'use client';

/**
 * The page's main buttons, pinned above the phone tab bar whenever the
 * ones at the top of the page are off screen (below the fold on a short
 * phone, or scrolled past). Hidden while those are on screen, so a phone
 * never shows two identical rows at once.
 *
 * bottom-16 sits this bar exactly on GlobalBottomNav, whose row is h-16.
 * Both are lg:hidden, and a pet's page is never an immersive route, so
 * they come and go together. At bottom-0 the tab bar covered most of this
 * bar and swallowed taps meant for it. If the tab bar height changes,
 * change this with it.
 *
 * `compact` is the phone's bar: one row, 56px tall, buttons that never
 * wrap (the caller truncates their words), and out of the way while the
 * site footer is on screen, whose last links it would otherwise cover.
 */

import { useEffect, useState } from 'react';

export default function StickyActions({ watchId, children, compact = false }) {
  const [show, setShow] = useState(false);
  const [atFooter, setAtFooter] = useState(false);

  useEffect(() => {
    const target = document.getElementById(watchId);
    if (!target || typeof IntersectionObserver === 'undefined') return undefined;
    // The bottom 64px of a phone screen is the tab bar, so a button behind
    // it is not "on screen"; half the block showing counts as seen.
    const observer = new IntersectionObserver(
      ([entry]) => setShow(entry.intersectionRatio < 0.5),
      { rootMargin: '0px 0px -64px 0px', threshold: [0, 0.5, 1] }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [watchId]);

  useEffect(() => {
    if (!compact) return undefined;
    const footer = document.querySelector('footer');
    if (!footer || typeof IntersectionObserver === 'undefined') return undefined;
    // Only once the footer is above the tab bar and this bar (64px and 56px): until then it is under them.
    const observer = new IntersectionObserver(([entry]) => setAtFooter(entry.isIntersecting), { rootMargin: '0px 0px -120px 0px' });
    observer.observe(footer);
    return () => observer.disconnect();
  }, [compact]);

  if (!show || (compact && atFooter)) return null;
  if (compact) {
    return (
      <div className="fixed inset-x-0 bottom-16 z-40 flex h-14 items-center border-t border-midnight-200 bg-white/95 px-4 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
        <div className="mx-auto flex w-full max-w-lg items-center gap-2">{children}</div>
      </div>
    );
  }
  return (
    <div className="fixed inset-x-0 bottom-16 z-40 border-t border-midnight-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-lg items-center gap-2">{children}</div>
    </div>
  );
}
