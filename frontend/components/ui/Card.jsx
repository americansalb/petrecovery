'use client';

/**
 * Card Component
 *
 * A unified card component for consistent styling throughout the app.
 * Supports multiple variants for different use cases.
 */

import { cn } from './utils';

const variants = {
  default: 'bg-white border border-midnight-200 shadow-card',
  elevated: 'bg-white shadow-lg',
  outline: 'bg-white border-2 border-midnight-200',
  ghost: 'bg-midnight-50',
  dark: 'bg-midnight-800 border border-midnight-700 text-midnight-50',
  danger: 'bg-white border-2 border-red-500 shadow-glow-danger',
  success: 'bg-white border-2 border-green-500',
  warning: 'bg-white border-2 border-amber-500',
};

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
  xl: 'p-8',
};

export function Card({
  variant = 'default',
  padding = 'md',
  hover = false,
  className,
  children,
  ...props
}) {
  return (
    <div
      className={cn(
        'rounded-2xl transition-all duration-200',
        variants[variant],
        paddings[padding],
        hover && 'hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * CardHeader - Optional header section with title and description
 */
export function CardHeader({ icon: Icon, iconColor, title, description, action, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-4', className)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={cn(
            'p-2 rounded-xl',
            iconColor || 'bg-midnight-100 text-midnight-600'
          )}>
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div>
          <h3 className="font-semibold text-midnight-900 text-base">{title}</h3>
          {description && (
            <p className="text-sm text-midnight-500 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

/**
 * CardContent - Main content area
 */
export function CardContent({ className, children }) {
  return (
    <div className={cn('', className)}>
      {children}
    </div>
  );
}

/**
 * CardFooter - Footer section for actions
 */
export function CardFooter({ className, children }) {
  return (
    <div className={cn('flex items-center gap-3 mt-4 pt-4 border-t border-midnight-100', className)}>
      {children}
    </div>
  );
}

export default Card;
