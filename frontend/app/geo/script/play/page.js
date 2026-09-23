'use client';

/**
 * /geo/script/play: a script game. Settings come from the query string
 * (app/lib/geo/script.js), so a link is a whole game. Registered as an
 * immersive route in app/lib/navChrome.js; the X leads back to
 * /geo/script.
 */

import { Suspense } from 'react';
import ScriptPlayClient from '../../components/script/ScriptPlayClient';

export default function ScriptPlayPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[60] flex items-center justify-center bg-pe-canvas text-pe-muted">Loading</div>}>
      <ScriptPlayClient />
    </Suspense>
  );
}
