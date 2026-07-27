'use client';

/**
 * Button Component
 *
 * A unified button component with consistent styling.
 * Supports multiple variants, sizes, and states.
 */

import Link from 'next/link';
import { cn } from './utils';
import { Loader2 } from 'lucide-react';

const variants = {
  // Primary - Flashlight Yellow for main CTAs
  primary: 'bg-flash-400 text-midnight-900 hover:bg-flash-500 active:bg-flash-600 shadow-sm hover:shadow-md',

  // Secondary - Midnight Blue for secondary actions
  secondary: 'bg-midnight-900 text-white hover:bg-midnight-800 active:bg-midnight-700 shadow-sm hover:shadow-md',

  // Outline - for less prominent actions
  outline: 'bg-transparent border-2 border-midnight-300 text-midnight-700 hover:bg-midnight-50 hover:border-midnight-400',

  // Ghost - minimal styling
  ghost: 'bg-transparent text-midnight-600 hover:bg-midnight-100 hover:text-midnight-900',

  // Danger - for destructive actions
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm',

  // Success - for positive actions
  success: 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 shadow-sm',

  // Warning - for cautionary actions
  warning: 'bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700 shadow-sm',

  // Link style
  link: 'bg-transparent text-midnight-900 hover:text-flash-600 underline-offset-4 hover:underline',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2',
  xl: 'px-8 py-4 text-lg gap-3',
  icon: 'p-2',
  'icon-sm': 'p-1.5',
  'icon-lg': 'p-3',
};

const roundedness = {
  default: 'rounded-xl',
  full: 'rounded-full',
  none: 'rounded-none',
};

export function Button({
  variant = 'primary',
  size = 'md',
  rounded = 'default',
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  href,
  children,
  className,
  ...props
}) {
  const isDisabled = disabled || loading;

  const classes = cn(
    'inline-flex items-center justify-center font-semibold transition-all duration-200',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none',
    variants[variant],
    sizes[size],
    roundedness[rounded],
    fullWidth && 'w-full',
    className
  );

  const inner = (
    <>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : LeftIcon ? (
        <LeftIcon className="w-4 h-4" />
      ) : null}

      {children && <span className="inline-flex items-center gap-2">{children}</span>}

      {RightIcon && !loading && <RightIcon className="w-4 h-4" />}
    </>
  );

  // A plain <button href> doesn't navigate - render links as real <Link>s so
  // pages can write <Button href="..."> and get working navigation + a11y.
  if (href && !isDisabled) {
    return (
      <Link href={href} className={classes} {...props}>
        {inner}
      </Link>
    );
  }

  return (
    <button className={classes} disabled={isDisabled} {...props}>
      {inner}
    </button>
  );
}

/**
 * IconButton - Button optimized for icon-only use
 */
export function IconButton({
  variant = 'ghost',
  size = 'icon',
  rounded = 'default',
  icon: Icon,
  label,
  className,
  ...props
}) {
  return (
    <Button
      variant={variant}
      size={size}
      rounded={rounded}
      aria-label={label}
      className={className}
      {...props}
    >
      {Icon && <Icon className="w-5 h-5" />}
    </Button>
  );
}

/**
 * ButtonGroup - Group multiple buttons together
 */
export function ButtonGroup({ children, className }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {children}
    </div>
  );
}

export default Button;
