/**
 * /rasuwa: the letter wizard for families of people missing in the
 * August 26, 2026 Rasuwa (Nepal) flood. Immersive route: no pet-site
 * chrome (registered in app/lib/navChrome.js); the wizard shell ships
 * its own way out (the close X links home, and drafts persist so
 * leaving loses nothing).
 *
 * Server wrapper only; the whole wizard is client-side on purpose. What
 * a family types stays in the browser; the network calls (district
 * lookup, MP lookup, signer count) are documented in their routes under
 * api/rasuwa/.
 */

import RasuwaWizard from './RasuwaWizard';

export default function RasuwaPage() {
  return (
    <div className="h-screen supports-[height:100dvh]:h-[100dvh]">
      <RasuwaWizard />
    </div>
  );
}
