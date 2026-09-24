/**
 * The top of a members-only force page: the force's name (back to its
 * overview) and the page's title, in the same plain style as the public page.
 */

import Link from 'next/link';

export default function MemberPageHeader({ force, title, children, wide = false }) {
  return (
    <header className="border-b border-midnight-200 bg-white">
      <div className={`mx-auto px-4 pb-6 pt-4 ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>
        <Link
          href={`/rescue-forces/${force.id}`}
          className="-ml-1 inline-flex items-center px-1 text-sm font-medium text-midnight-500 hover:text-midnight-900"
        >
          {force.name}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-midnight-900">{title}</h1>
        {children}
      </div>
    </header>
  );
}
