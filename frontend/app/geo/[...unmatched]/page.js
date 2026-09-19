import { notFound } from 'next/navigation';

/**
 * Anything under /geo that matches no route.
 *
 * app/geo/not-found.js alone was not enough, which is the trap: a
 * segment's not-found.js only renders when a route inside that segment
 * calls notFound(). A URL that matches no route at all never enters the
 * segment, so Next falls back to the root handler and
 * probablyearth.com/geo/nowhere answered with the pet site's 404 - paw
 * print, ReunitePets navigation and a Report Pet link, on a geography
 * game. Verified against a production server, not reasoned about: the
 * first version of this fix shipped only the not-found.js and the pet
 * page still came back.
 *
 * This catch-all is the piece that hands those URLs to the segment.
 * Next matches it only after every real route, so it shadows nothing.
 *
 * One honest limit: the response is 200 rather than 404. app/loading.js
 * at the root puts a Suspense boundary above every route, so the shell
 * is flushed - and the status committed - before this throws. Removing
 * that boundary would change the loading behaviour of the entire pet
 * site to fix the status code of a mistyped game URL, which is the
 * wrong trade. A player gets the right page either way; a crawler sees
 * a soft 404 on a URL that was never linked.
 */
export default function GeoUnmatched() {
  notFound();
}
