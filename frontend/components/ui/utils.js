/**
 * Utility functions for UI components
 */

/**
 * Merge class names, filtering out falsy values
 * Simple alternative to clsx/classnames libraries
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
