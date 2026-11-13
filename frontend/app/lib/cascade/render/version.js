/**
 * The version of the flyer and share-image renderers.
 *
 * Every flyer and share image a case stores carries this in CaseAsset.meta
 * (`rendererVersion`). A case is only ever drawn once at report time, so
 * when the design changes, every case reported before the change would keep
 * the old artwork forever. Instead, the server redraws any unresolved case
 * whose stored assets carry an older version (app/lib/cascade/refresh.js):
 * once after each boot, and on demand through
 * POST /api/cascade/regenerate?stale=1.
 *
 * Bump this whenever the output of render/flyers or render/social changes
 * in a way a person would notice. Nothing else reads it.
 */
export const RENDERER_VERSION = '2026-11-06.8';
