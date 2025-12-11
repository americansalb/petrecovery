'use client';

/**
 * EmptyState Component
 *
 * Enhanced empty states with engaging visuals, tips, and animations.
 * Shows when lists are empty or no data is available.
 */

import { cn } from './utils';
import { Button } from './Button';
import Link from 'next/link';
import { Lightbulb } from 'lucide-react';

// Icon background colors for visual variety
const iconColors = {
  default: 'bg-gradient-to-br from-midnight-100 to-midnight-200',
  red: 'bg-gradient-to-br from-red-100 to-red-200',
  blue: 'bg-gradient-to-br from-blue-100 to-blue-200',
  green: 'bg-gradient-to-br from-green-100 to-green-200',
  amber: 'bg-gradient-to-br from-amber-100 to-amber-200',
  purple: 'bg-gradient-to-br from-purple-100 to-purple-200',
};

const iconTextColors = {
  default: 'text-midnight-500',
  red: 'text-red-500',
  blue: 'text-blue-500',
  green: 'text-green-500',
  amber: 'text-amber-500',
  purple: 'text-purple-500',
};

export function EmptyState({
  icon: Icon,
  iconColor = 'default',
  title,
  description,
  tip,
  action,
  secondaryAction,
  compact = false,
  className,
}) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center px-4 text-center animate-fade-in',
      compact ? 'py-8' : 'py-12',
      className
    )}>
      {Icon && (
        <div className={cn(
          'rounded-2xl flex items-center justify-center mb-4 shadow-sm',
          compact ? 'w-14 h-14' : 'w-16 h-16',
          iconColors[iconColor]
        )}>
          <Icon className={cn(
            compact ? 'w-7 h-7' : 'w-8 h-8',
            iconTextColors[iconColor]
          )} />
        </div>
      )}

      <h3 className={cn(
        'font-bold text-midnight-900 mb-2',
        compact ? 'text-base' : 'text-lg'
      )}>
        {title}
      </h3>

      {description && (
        <p className={cn(
          'text-midnight-500 max-w-sm',
          compact ? 'text-xs mb-4' : 'text-sm mb-5'
        )}>
          {description}
        </p>
      )}

      {/* Helpful tip section */}
      {tip && (
        <div className={cn(
          'flex items-start gap-2 bg-flash-50 border border-flash-200 rounded-lg p-3 mb-5 max-w-sm text-left',
          compact && 'p-2'
        )}>
          <Lightbulb className="w-4 h-4 text-flash-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-flash-800">{tip}</p>
        </div>
      )}

      {(action || secondaryAction) && (
        <div className={cn(
          'flex items-center gap-3',
          compact && 'flex-col gap-2'
        )}>
          {action && (
            action.href ? (
              <Link href={action.href}>
                <Button
                  variant={action.variant || 'primary'}
                  size={compact ? 'sm' : 'md'}
                  leftIcon={action.icon}
                >
                  {action.label}
                </Button>
              </Link>
            ) : (
              <Button
                variant={action.variant || 'primary'}
                size={compact ? 'sm' : 'md'}
                leftIcon={action.icon}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            )
          )}

          {secondaryAction && (
            secondaryAction.href ? (
              <Link href={secondaryAction.href}>
                <Button
                  variant={secondaryAction.variant || 'outline'}
                  size={compact ? 'sm' : 'md'}
                  leftIcon={secondaryAction.icon}
                >
                  {secondaryAction.label}
                </Button>
              </Link>
            ) : (
              <Button
                variant={secondaryAction.variant || 'outline'}
                size={compact ? 'sm' : 'md'}
                leftIcon={secondaryAction.icon}
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.label}
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );
}

/**
 * CardSkeleton - Loading placeholder for cards
 */
export function CardSkeleton({ rows = 3, className }) {
  return (
    <div className={cn('animate-pulse', className)}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-midnight-200 rounded-xl" />
        <div className="flex-1">
          <div className="h-4 bg-midnight-200 rounded w-1/3 mb-2" />
          <div className="h-3 bg-midnight-100 rounded w-1/2" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-midnight-50 rounded-xl">
            <div className="w-12 h-12 bg-midnight-200 rounded-xl" />
            <div className="flex-1">
              <div className="h-4 bg-midnight-200 rounded w-2/3 mb-2" />
              <div className="h-3 bg-midnight-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ListItemSkeleton - Loading placeholder for list items
 */
export function ListItemSkeleton({ className }) {
  return (
    <div className={cn('flex items-center gap-3 p-4 animate-pulse', className)}>
      <div className="w-12 h-12 bg-midnight-200 rounded-xl" />
      <div className="flex-1">
        <div className="h-4 bg-midnight-200 rounded w-1/3 mb-2" />
        <div className="h-3 bg-midnight-100 rounded w-1/2" />
      </div>
      <div className="w-5 h-5 bg-midnight-100 rounded" />
    </div>
  );
}

export default EmptyState;
