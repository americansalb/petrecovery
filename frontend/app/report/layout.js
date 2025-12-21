'use client';

/**
 * Report Layout - Full screen wizard without navigation
 * This layout removes the main navigation to give the wizard full viewport height
 */

import { useEffect } from 'react';

export default function ReportLayout({ children }) {
  // Hide the main navigation when this layout is active
  useEffect(() => {
    const nav = document.querySelector('nav');
    if (nav) {
      nav.style.display = 'none';
    }

    return () => {
      if (nav) {
        nav.style.display = '';
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-white">
      {children}
    </div>
  );
}
