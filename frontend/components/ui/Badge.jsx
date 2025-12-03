'use client';

/**
 * Badge Component
 *
 * Small status indicators and labels.
 * Supports multiple variants and sizes.
 */

import { cn } from './utils';

const variants = {
  // Neutral
  default: 'bg-midnight-100 text-midnight-700',

  // Primary brand
  primary: 'bg-flash-100 text-flash-700',

  // Secondary
  secondary: 'bg-midnight-900 text-white',

  // Status variants
  danger: 'bg-red-100 text-red-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  info: 'bg-sky-100 text-sky-700',

  // Outline variants
  'outline-default': 'bg-transparent border border-midnight-300 text-midnight-600',
  'outline-danger': 'bg-transparent border border-red-300 text-red-600',
  'outline-success': 'bg-transparent border border-green-300 text-green-600',

  // Solid high-contrast variants
  'solid-danger': 'bg-red-600 text-white',
  'solid-success': 'bg-green-600 text-white',
  'solid-warning': 'bg-amber-500 text-white',

  // Special - for urgent/live indicators
  urgent: 'bg-red-600 text-white animate-pulse-soft',
  live: 'bg-red-600 text-white',
};

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

export function Badge({
  variant = 'default',
  size = 'md',
  dot = false,
  icon: Icon,
  children,
  className,
  ...props
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold rounded-full whitespace-nowrap',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn(
          'w-1.5 h-1.5 rounded-full',
          variant.includes('danger') || variant === 'urgent' || variant === 'live'
            ? 'bg-current'
            : 'bg-current opacity-60'
        )} />
      )}
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </span>
  );
}

/**
 * StatusBadge - Pre-configured badges for common statuses
 */
export function StatusBadge({ status, className }) {
  const statusConfig = {
    active: { variant: 'solid-danger', label: 'Active', dot: true },
    lost: { variant: 'solid-danger', label: 'Lost', dot: true },
    found: { variant: 'solid-success', label: 'Found' },
    reunited: { variant: 'success', label: 'Reunited' },
    sighting: { variant: 'warning', label: 'Sighting' },
    pending: { variant: 'warning', label: 'Pending' },
    resolved: { variant: 'success', label: 'Resolved' },
    closed: { variant: 'default', label: 'Closed' },
    live: { variant: 'live', label: 'LIVE', dot: true },
  };

  const config = statusConfig[status?.toLowerCase()] || statusConfig.pending;

  return (
    <Badge variant={config.variant} dot={config.dot} className={className}>
      {config.label}
    </Badge>
  );
}

/**
 * CountBadge - For showing counts (notifications, etc.)
 */
export function CountBadge({ count, max = 99, variant = 'secondary', className }) {
  const displayCount = count > max ? `${max}+` : count;

  if (!count || count <= 0) return null;

  return (
    <Badge variant={variant} size="sm" className={cn('min-w-[1.25rem] justify-center', className)}>
      {displayCount}
    </Badge>
  );
}

export default Badge;
