/**
 * Shown when a provider is not set up. Says exactly which variables
 * are missing and where they come from; nothing else on the page can
 * work until they exist.
 */

import Link from 'next/link';

export default function SetupNotice({ provider = 'google', missing = [], compact = false, tone = 'dark' }) {
  const list = missing.length ? missing : ['GOOGLE_STREET_VIEW_API_KEY', 'GOOGLE_MAPS_BROWSER_KEY'];
  const light = tone === 'light';
  const body = light ? 'text-midnight-700' : 'text-white/80';
  const code = light ? 'text-midnight-900' : 'text-flash-200';
  const faint = light ? 'text-midnight-500' : 'text-white/60';
  return (
    <div
      className={`rounded-2xl border ${light ? 'border-flash-500/60 bg-flash-50 text-midnight-900' : 'border-flash-400/40 bg-flash-400/10 text-white'} ${compact ? 'p-4' : 'p-5 sm:p-6'}`}
    >
      <h2 className="text-lg font-bold">{provider === 'google' ? 'Google Street View is not set up on this server' : 'Apple Look Around is not available'}</h2>
      {provider === 'google' ? (
        <>
          <p className={`mt-2 text-sm ${body}`}>Missing environment variables:</p>
          <ul className={`mt-1 space-y-1 font-mono text-sm ${code}`}>
            {list.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          {!compact ? (
            <ol className={`mt-3 list-decimal space-y-1 pl-5 text-sm ${body}`}>
              <li>In the Google Cloud project, enable the Maps JavaScript API and the Street View Static API.</li>
              <li>Create a browser key restricted to this site&apos;s referrers and to the Maps JavaScript API.</li>
              <li>Create or extend a server key with the Street View Static API.</li>
              <li>Set daily quota caps on both APIs so usage stops instead of billing.</li>
              <li>Put the two keys in the environment and restart the server.</li>
            </ol>
          ) : null}
          <p className={`mt-3 text-xs ${faint}`}>Full steps: docs/GEO.md in the repository.</p>
        </>
      ) : (
        <p className={`mt-2 text-sm ${body}`}>
          Look Around needs a MapKit JS token that covers this site&apos;s origin and a MapKit build with the look-around library. See docs/GEO.md.
        </p>
      )}
      {!compact ? (
        <Link href="/geo" className={`mt-4 inline-block rounded-xl border px-4 py-2 text-sm font-semibold ${light ? 'border-midnight-300 hover:bg-white' : 'border-white/20 hover:bg-white/10'}`}>
          Back to the lobby
        </Link>
      ) : null}
    </div>
  );
}
