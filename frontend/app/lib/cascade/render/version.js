/**
 * The version of the flyer and share-image renderers.
 *
 * Every flyer and share image a case stores carries this in CaseAsset.meta
 * (`rendererVersion`). A case is only ever drawn once at report time, so
 * when the design changes, every case reported before the change would keep
 * the old artwork forever. Instead, a search whose stored assets carry an
 * older version is drawn again when the person running it opens it, one
 * search at a time (app/lib/cascade/redrawOnOpen.js), or by hand through
 * POST /api/cascade/regenerate?stale=1. It is NOT redrawn at boot: every
 * open case back to back ran the instance out of memory and took the site
 * down on 2026-11-05 and 2026-11-13.
 *
 * Bump this whenever the output of render/flyers or render/social changes
 * in a way a person would notice. Nothing else reads it.
 */
export const RENDERER_VERSION = '2026-11-14.1';
