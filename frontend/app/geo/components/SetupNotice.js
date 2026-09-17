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
  const body = light ? 'text-white/70' : 'text-white/80';
  const code = light ? 'text-white' : 'text-clay-200';
  const faint = light ? 'text-white/60' : 'text-white/60';
  return (
    <div
      className={`rounded-2xl border ${light ? 'border-clay-600/60 bg-clay-500/10 text-white' : 'border-clay-500/40 bg-clay-500/10 text-white'} ${compact ? 'p-4' : 'p-5 sm:p-6'}`}
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
        <Link href="/geo" className={`mt-4 inline-block rounded-xl border px-4 py-2 text-sm font-semibold ${light ? 'border-white/15 hover:bg-ocean-900/60' : 'border-white/20 hover:bg-white/10'}`}>
          Back to the lobby
        </Link>
      ) : null}
    </div>
  );
}
