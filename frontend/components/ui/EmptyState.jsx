'use client';

/**
 * EmptyState Component
 *
 * Consistent empty states throughout the app.
 * Shows when lists are empty or no data is available.
 */

import { cn } from './utils';
import { Button } from './Button';
import Link from 'next/link';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-midnight-100 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-midnight-400" />
        </div>
      )}

      <h3 className="font-semibold text-midnight-900 text-lg mb-2">
        {title}
      </h3>

      {description && (
        <p className="text-midnight-500 text-sm max-w-sm mb-6">
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {action && (
            action.href ? (
              <Link href={action.href}>
                <Button
                  variant={action.variant || 'primary'}
                  leftIcon={action.icon}
                >
                  {action.label}
                </Button>
              </Link>
            ) : (
              <Button
                variant={action.variant || 'primary'}
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
                  leftIcon={secondaryAction.icon}
                >
                  {secondaryAction.label}
                </Button>
              </Link>
            ) : (
              <Button
                variant={secondaryAction.variant || 'outline'}
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

export default EmptyState;
