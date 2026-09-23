/**
 * Shown when the game is not set up on this server. Says exactly which
 * variables are missing and where they come from; nothing else on the
 * page can work until they exist.
 *
 * It used to have a Google branch with five steps about Cloud projects
 * and quota caps. There is one imagery now, and it needs one thing.
 */

import Link from 'next/link';

export default function SetupNotice({ provider = 'apple', missing = [], compact = false, tone = 'dark' }) {
  const list = missing.length ? missing : ['GEO_TOKEN_SECRET'];
  const light = tone === 'light';
  const body = 'text-pe-muted';
  const code = light ? 'text-pe-fg' : 'text-pe-warm';
  const faint = 'text-pe-subtle';
  return (
    <div
      className={`rounded-2xl border border-pe-warm/40 bg-pe-warm/10 text-pe-fg ${compact ? 'p-4' : 'p-5 sm:p-6'}`}
    >
      <h2 className="text-lg font-bold">This server is not set up to run the game</h2>
      <p className={`mt-2 text-sm ${body}`}>Missing environment variables:</p>
      <ul className={`mt-1 space-y-1 font-mono text-sm ${code}`}>
        {list.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
      <p className={`mt-3 text-sm ${body}`}>
        A round&apos;s answer is sealed with that secret, so nothing can start without one. Look Around also needs a MapKit
        JS token covering this site&apos;s origin, and a MapKit build that ships the look-around library.
      </p>
      <p className={`mt-3 text-xs ${faint}`}>Full steps: docs/GEO.md in the repository.</p>
      {!compact ? (
        <Link href="/geo" className="ui-btn ui-btn--secondary mt-4">
          Back to the start
        </Link>
      ) : null}
    </div>
  );
}
