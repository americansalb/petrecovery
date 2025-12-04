'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';

/**
 * MapLayout - The core layout for both Mission Control and Squad Hub
 * 
 * Features:
 * - Always-visible map background
 * - Slide-up panels for content
 * - Responsive design (Desktop: Side panels, Mobile: Bottom sheet style)
 * - Smooth transitions using Framer Motion
 */
export default function MapLayout({ 
  children, 
  mapComponent, 
  headerComponent,
  railComponent,
  activePanel,
  onPanelClose,
  className = ''
}) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  
  // Animation variants
  const panelVariants = {
    hidden: { y: '100%', opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { 
        type: 'spring',
        damping: 25,
        stiffness: 300
      }
    },
    exit: { 
      y: '100%', 
      opacity: 0,
      transition: { duration: 0.2 }
    }
  };

  return (
    <div className={`relative h-screen w-full overflow-hidden bg-slate-900 flex flex-col ${className}`}>
      {/* Header - Always on top */}
      <div className="z-50 relative">
        {headerComponent}
      </div>

      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Rail (Desktop only) */}
        {isDesktop && railComponent && (
          <div className="w-64 flex-shrink-0 z-40 h-full relative">
            {railComponent}
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 relative flex flex-col">
          
          {/* Map Layer - Always visible at the back */}
          <div className="absolute inset-0 z-0">
            {mapComponent}
          </div>

          {/* Content Layer - Overlays the map */}
          <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-end md:justify-start md:p-4">
            {/* 
              Children usually contains the "collapsed" state of panels 
              or floating action buttons 
            */}
            <div className="pointer-events-auto">
              {children}
            </div>
          </div>

          {/* Expanded Panel Layer - Slides up/in */}
          <AnimatePresence>
            {activePanel && (
              <motion.div
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={panelVariants}
                className="absolute inset-x-0 bottom-0 top-20 md:top-auto md:bottom-4 md:right-4 md:left-auto md:w-[400px] md:h-[calc(100%-2rem)] z-30 bg-slate-900/95 backdrop-blur-md border-t md:border border-slate-700/50 md:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              >
                {/* Panel Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
                  <h3 className="font-bold text-white text-lg">
                    {activePanel.title}
                  </h3>
                  <button 
                    onClick={onPanelClose}
                    className="p-2 hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>

                {/* Panel Content */}
                <div className="flex-1 overflow-y-auto p-4">
                  {activePanel.content}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
