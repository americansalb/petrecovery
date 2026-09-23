'use client';

import { useEffect } from 'react';

export default function GameError({ error, reset }) {
  const needsReload = /ChunkLoadError|Loading (?:CSS )?chunk|Failed to fetch dynamically imported module/i.test(`${error?.name || ''} ${error?.message || ''}`);
  useEffect(() => {
    // Keep the game independent of the pet site's telemetry and do not log
    // a URL/query or promise that an alert was delivered to an operator.
    console.error('[geo] screen failed', error?.digest || error?.name || 'Error');
  }, [error]);

  return <main className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-ocean-950 px-6 py-12 text-sand-50">
    <section className="w-full max-w-md" aria-labelledby="game-error-title">
      <p className="mb-4 text-sm font-semibold text-sand-300">Probably Earth</p>
      <h1 id="game-error-title" className="text-3xl font-bold tracking-tight">{needsReload ? 'The game couldn’t finish loading.' : 'The game hit a problem.'}</h1>
      <p className="mt-4 leading-relaxed text-sand-200">{needsReload ? 'Reload to download the missing game files and rejoin.' : 'Try again to return to this screen.'} A multiplayer match keeps running while you reconnect.</p>
      <div className="mt-7 flex flex-wrap gap-3">
        {needsReload ?
          // A full navigation retries a rejected dynamic import; resetting the
          // React boundary alone can immediately throw the same cached error.
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a href="" className="ui-btn ui-btn--primary pe-button pe-button--primary">Reload game</a>
          : <button type="button" onClick={reset} className="ui-btn ui-btn--primary pe-button pe-button--primary">Try again</button>}
        {/* Full navigation also works if the client router is the failing part. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/geo" className="pe-button pe-button--secondary">Back to games</a>
      </div>
    </section>
  </main>;
}
