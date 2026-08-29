/**
 * /rasuwa: the letter tool for families of people missing in the
 * August 26, 2026 Rasuwa (Nepal) flood. Immersive route: no pet-site
 * chrome (registered in app/lib/navChrome.js); the page ships its own
 * way back to the ReunitePets home page in the footer.
 *
 * Server wrapper only; the whole tool is client-side on purpose. What a
 * family types stays in the browser, this route has no database behind
 * it, and the one network call (the district lookup) is documented in
 * api/rasuwa/district/route.js.
 */

import RasuwaLetterTool from './RasuwaLetterTool';

export default function RasuwaPage() {
  return <RasuwaLetterTool />;
}
