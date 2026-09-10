#!/usr/bin/env node
/**
 * A stand-in for the Street View metadata endpoint, for playing and
 * testing the geo game with no Google key.
 *
 *   node scripts/geo-e2e/mock-metadata.js          # listens on 3999
 *   GEO_STREET_VIEW_METADATA_URL=http://localhost:3999/metadata npm run dev
 *
 * Every point has official imagery 200 m away, except south of 45 S,
 * which has none, so the "no imagery" and water counters get exercised.
 * A request without a key answers REQUEST_DENIED like the real thing.
 */

const http = require('node:http');

const PORT = Number(process.env.PORT || 3999);

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const [lat, lng] = (url.searchParams.get('location') || '0,0').split(',').map(Number);
    res.setHeader('Content-Type', 'application/json');
    if (!url.searchParams.get('key')) {
      res.end(JSON.stringify({ status: 'REQUEST_DENIED', error_message: 'The request is missing a valid API key.' }));
      return;
    }
    if (lat < -45) {
      res.end(JSON.stringify({ status: 'ZERO_RESULTS' }));
      return;
    }
    res.end(
      JSON.stringify({
        status: 'OK',
        pano_id: `mock-${lat.toFixed(4)}-${lng.toFixed(4)}`,
        location: { lat: lat + 0.0018, lng: lng + 0.0012 },
        date: '2024-05',
        // Always official here. The Everywhere mode's photo-sphere path
        // needs country polygons to fake convincingly, and rough boxes
        // would change what the other scenarios see, so it is covered by
        // __tests__/geo/off-coverage.test.js instead.
        copyright: '© Google',
      })
    );
  })
  .listen(PORT, () => console.log(`mock Street View metadata on http://localhost:${PORT}/metadata`));
