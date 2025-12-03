'use client';

/**
 * PageLayout Component
 *
 * Provides consistent page structure with:
 * - Max-width container
 * - Consistent padding
 * - Optional page header with title/description
 * - Background color options
 */

import { cn } from './utils';

const backgrounds = {
  default: 'bg-midnight-50',
  white: 'bg-white',
  dark: 'bg-midnight-900 dark',
};

export function PageLayout({
  background = 'default',
  className,
  children,
}) {
  return (
    <div className={cn('min-h-screen', backgrounds[background], className)}>
      {children}
    </div>
  );
}

/**
 * PageHeader - Hero section for pages
 */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  variant = 'default',
  className,
  children,
}) {
  const variants = {
    default: 'bg-midnight-900 text-white',
    light: 'bg-white border-b border-midnight-100',
    gradient: 'bg-gradient-to-br from-midnight-900 via-midnight-800 to-midnight-900 text-white',
  };

  const textColors = {
    default: { title: 'text-white', description: 'text-midnight-300' },
    light: { title: 'text-midnight-900', description: 'text-midnight-500' },
    gradient: { title: 'text-white', description: 'text-midnight-300' },
  };

  const colors = textColors[variant];

  return (
    <div className={cn(variants[variant], className)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Breadcrumbs */}
        {breadcrumbs && (
          <div className="mb-4">
            {breadcrumbs}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className={cn('text-2xl sm:text-3xl font-bold', colors.title)}>
              {title}
            </h1>
            {description && (
              <p className={cn('mt-1 text-sm sm:text-base', colors.description)}>
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}

/**
 * PageContent - Main content area with consistent max-width and padding
 */
export function PageContent({
  className,
  narrow = false,
  children,
}) {
  return (
    <div className={cn(
      'mx-auto px-4 sm:px-6 py-6 sm:py-8',
      narrow ? 'max-w-3xl' : 'max-w-7xl',
      className
    )}>
      {children}
    </div>
  );
}

/**
 * PageSection - Section within a page with optional title
 */
export function PageSection({
  title,
  description,
  actions,
  className,
  children,
}) {
  return (
    <section className={cn('mb-8', className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            {title && (
              <h2 className="text-lg font-semibold text-midnight-900">{title}</h2>
            )}
            {description && (
              <p className="text-sm text-midnight-500 mt-1">{description}</p>
            )}
          </div>
          {actions && <div>{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Breadcrumbs - Navigation breadcrumbs
 */
export function Breadcrumbs({ items, className }) {
  return (
    <nav className={cn('flex items-center gap-2 text-sm', className)}>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {index > 0 && (
            <span className="text-midnight-400">/</span>
          )}
          {item.href ? (
            <a
              href={item.href}
              className="text-midnight-400 hover:text-midnight-600 transition"
            >
              {item.label}
            </a>
          ) : (
            <span className="text-midnight-900 font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}

export default PageLayout;
