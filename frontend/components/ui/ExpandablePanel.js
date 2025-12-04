'use client';

/**
 * ExpandablePanel - Collapsible panel with summary and expanded states
 *
 * Collapsed: Shows icon, title, and summary stats
 * Expanded: Slides up over content, shows full panel content
 *
 * Used in both Squad Hub and Mission Control for consistent UX
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronUp, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ExpandablePanel({
  icon: Icon,
  title,
  summary,
  badge,
  badgeColor = 'flash',
  children,
  isExpanded = false,
  onToggle,
  className = '',
}) {
  const [internalExpanded, setInternalExpanded] = useState(isExpanded);

  // Use controlled or uncontrolled state
  const expanded = onToggle ? isExpanded : internalExpanded;
  const setExpanded = onToggle || setInternalExpanded;

  // Badge color mapping
  const badgeColors = {
    flash: 'bg-flash-500/20 text-flash-400 border-flash-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  return (
    <>
      {/* Collapsed State - Summary Card */}
      <motion.button
        layoutId={`panel-${title}`}
        onClick={() => setExpanded(!expanded)}
        className={`
          w-full text-left p-4 rounded-xl
          bg-slate-800/50 border border-slate-700/50
          hover:bg-slate-800/70 hover:border-flash-500/30
          transition-colors duration-200
          ${expanded ? 'ring-2 ring-flash-500/50' : ''}
          ${className}
        `}
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          {Icon && (
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center">
              <Icon size={20} className="text-flash-400" />
            </div>
          )}

          {/* Title & Summary */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-sm">{title}</h3>
              {badge && (
                <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${badgeColors[badgeColor]}`}>
                  {badge}
                </span>
              )}
            </div>
            {summary && (
              <p className="text-slate-400 text-xs mt-0.5 truncate">{summary}</p>
            )}
          </div>

          {/* Expand indicator */}
          <ChevronUp
            size={18}
            className={`text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </motion.button>

      {/* Expanded State is handled by the parent MapLayout via activePanel prop */}
      {/* This component just acts as the trigger/summary card now */}
    </>
  );
}

/**
 * PanelGrid - Grid container for multiple ExpandablePanel components
 * Handles ensuring only one panel is expanded at a time
 */
export function PanelGrid({ children, className = '' }) {
  const [expandedIndex, setExpandedIndex] = useState(null);

  // Clone children and inject controlled state
  const panelsWithState = Array.isArray(children)
    ? children.map((child, index) => {
      if (!child) return null;
      return {
        ...child,
        props: {
          ...child.props,
          isExpanded: expandedIndex === index,
          onToggle: (expanded) => setExpandedIndex(expanded ? index : null),
        }
      };
    })
    : children;

  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 ${className}`}>
      {panelsWithState}
    </div>
  );
}
