# Where on Earth (the geo game)

A street-level guessing game at `/geo`, in the style of GeoGuessr: you are
dropped at a random spot with imagery, you place a pin, and points depend
on how close you are. Built as a side project inside the ReunitePets app;
it shares the app's chrome rules, share-card rules and API conventions
but no data models.

## Routes

| Route | What | Chrome |
|---|---|---|
| `/geo` | Lobby: provider, mode, rules, daily challenge, local stats, how it works | universal |
| `/geo/play?...` | The game. Every setting is in the query string, so a link is a whole game | immersive (`app/lib/navChrome.js`); the X in the HUD returns to `/geo` |
| `/geo/share?s=<code>` | A finished game as a page with its own link preview (server page, `generateMetadata`) | universal |

API, all under `frontend/app/api/geo/`:

| Endpoint | Method | Does |
|---|---|---|
| `config` | GET | Which providers are set up, the Google browser key, today's daily seed, the country list. Never a server key. |
| `round` | POST `{ config, roundIndex, attempt }` | Finds imagery for a round and returns it with a sealed answer token. Google: a panorama id. Apple: a short list of coordinates to try. |
| `guess` | POST `{ token, guess }` | Scores the guess against the token and reveals the answer. `guess` is `{lat,lng}`, `{countryCode}` for streaks, or `null` when the timer ran out. |
| `og` | GET `?s=<code>` | The 1200x630 link-preview PNG for a share code (satori + resvg, same pipeline as the lost-pet social cards). |

Rate limits are in `frontend/middleware.js` next to the other API entries.

## How a round is made

1. **A candidate point.** `app/lib/geo/server/sampler.js` draws from a
   seeded generator (`app/lib/geo/random.js`) according to the mode:
   - *World, pure random*: a point uniformly distributed over the sphere
     (uniform in the sine of the latitude, so the poles are not
     over-represented), thrown away if it is not on land. Antarctica is
     excluded.
   - *Balanced, daily, streak*: a random country from the Google coverage
     list, weighted by the square root of its area so small countries
     still come up, then a random point inside its polygon.
   - *Continent / country*: the same, restricted.
   - *City streets*: a random spot within one of about 150 large cities
     (`app/lib/geo/coverage.js`).
2. **The imagery probe (Google).** `app/lib/geo/server/streetview.js`
   calls the Street View Static API *metadata* endpoint for each
   candidate, in parallel batches of 12, up to 96 per attempt. Metadata
   requests are free and unmetered. A hit must be official Google
   imagery (the copyright line says Google; user photo spheres are
   skipped) and outdoor. The first hit in candidate order wins, so a seed
   reproduces the same round while coverage is unchanged.
3. **The imagery probe (Apple).** MapKit JS has no availability call, so
   the browser creates a Look Around view for each candidate in turn and
   listens for `load` or `error` (`app/geo/lib/lookAround.js`).
4. **The sealed token.** The answer (coordinates, country, panorama id,
   scoring scale) is AES-256-GCM encrypted under a key derived from
   `NEXTAUTH_SECRET` (`app/lib/geo/server/tokens.js`) and handed to the
   browser opaque. The guess endpoint opens it. No table, no cleanup,
   works across instances.
5. **The country.** Named from Natural Earth 1:110m polygons
   (`world-atlas`) with metadata from `world-countries`, joined on the ISO
   numeric code (`app/lib/geo/server/countries.js`). No geocoder call.
   Regenerate the metadata with `node scripts/build-geo-countries.js`.

Scoring (`app/lib/geo/distance.js`): `5000 * e^(-10 d / size)`, where
`size` is 14,916 km for the world and the bounding-box diagonal for a
continent or country (floor 100 km). Within 25 m is 5,000.

Randomness settings ("How random" in the lobby) are the probe radius:
2 km (pure), 10 km (standard), 50 km (fast). A small radius is closer to
uniform over covered land but needs more probes; a large one drifts
toward the edges of covered areas.

Seeds: every game gets one (the lobby generates it), the daily challenge
uses `daily-YYYY-MM-DD` (UTC), and the summary offers a "Challenge a
friend" link that replays the same places. A retry after "no imagery"
skips ahead in the seeded sequence rather than repeating it.

## Setup

Google (the only errand):

1. In the Cloud project that already holds `GOOGLE_PLACES_API_KEY`,
   attach billing if it is not attached. Google Maps Platform serves
   nothing without it, free tier included.
2. Enable the **Maps JavaScript API** and the **Street View Static API**.
3. Create a **browser key** restricted by HTTP referrer to the site's
   domains and localhost, and by API to the Maps JavaScript API.
4. Create or extend a **server key** with the Street View Static API.
5. Under APIs & Services, Quotas, set daily caps on both APIs so usage
   stops instead of billing; add a budget alert under Billing.

Environment:

```
GOOGLE_MAPS_BROWSER_KEY=...        # referrer-restricted, sent to the browser by /api/geo/config
GOOGLE_STREET_VIEW_API_KEY=...     # server only; falls back to GOOGLE_PLACES_API_KEY if that key has the API
GEO_TOKEN_SECRET=...               # optional; NEXTAUTH_SECRET is used otherwise
NEXT_PUBLIC_APPLE_MAPKIT_TOKEN=... # a localhost token for local play; the built-in token only works on reunitepets.org
GEO_STREET_VIEW_METADATA_URL=...   # optional, development only: a local mock of the metadata endpoint
```

Free tier (Google, per month, as of March 2025 pricing): metadata probes
unlimited, 5,000 Dynamic Street View loads, 10,000 Dynamic Maps loads.
One game of five rounds is five panorama loads and one map load.

Apple: the app already loads MapKit JS. Look Around arrived in MapKit JS
5.79 but is not in the full `mapkit.js` bundle; the game asks for the
`look-around` library with `mapkit.load` after the site-wide loader runs.
If that call is missing in the deployed MapKit build, switch the loader
in `app/lib/maps/appleMapKit.js` to `mapkit.core.js` with
`data-libraries="services,full-map,geojson,user-location,look-around"`.

## Local development without keys

The metadata endpoint is overridable and the browser SDK can be faked,
so the whole game runs locally with no Google account:

```bash
cd frontend
node scripts/geo-e2e/mock-metadata.js &          # fake Street View metadata on :3999
GOOGLE_STREET_VIEW_API_KEY=x GOOGLE_MAPS_BROWSER_KEY=x \
GEO_STREET_VIEW_METADATA_URL=http://localhost:3999/metadata npm run dev
```

The page will still try to load the real Maps JavaScript API with the
dummy browser key, so for a full run use the browser harness, which
serves `scripts/geo-e2e/fake-maps.js` in its place:

```bash
npm i --no-save playwright-core                  # not a project dependency
node scripts/geo-e2e/run.js                      # BASE_URL, CHROME_PATH, GEO_E2E_OUT optional
```

It plays a three-round pin game with the keyboard shortcuts, checks the
summary, the share page and a seeded replay, then a country streak, a
timed NMPZ round that runs out, and the mobile map sheet. It fails on
any page error. Unit tests for everything below the browser:
`npx jest __tests__/geo __tests__/api/geo-routes.test.js`.

The Content Security Policy in `middleware.js` allows the Maps
JavaScript API hosts (`maps.googleapis.com`, `maps.gstatic.com`); that
line is what the browser harness caught missing.

## Terms that shape the design

- Google's terms bar showing Street View imagery and a non-Google map on
  the same screen, so the guess map in Google games is a Google map, and
  the Apple mode uses a MapKit map. The two never share a screen.
- Google's logo and copyright line are drawn by the panorama and must stay
  visible. The HUD keeps clear of the bottom edge; the corner map sits
  above it.
- No caching of imagery or panorama ids: every round probes live.
- Apple Look Around covers cities in about two dozen countries, nearly all
  of which Google covers too, so the Apple mode is "City streets" only and
  is labelled beta.

## Files

```
frontend/app/lib/geo/            shared pure modules: random, distance, modes, coverage, share
frontend/app/lib/geo/server/     server only: countries, sampler, streetview, tokens, game, config, ShareCard
frontend/app/lib/geo/data/       countries-meta.json (generated)
frontend/app/api/geo/            config, round, guess, og
frontend/app/geo/                layout, lobby page, play page, share page, components, client libs
frontend/__tests__/geo/          unit tests; __tests__/api/geo-routes.test.js for the routes
frontend/scripts/build-geo-countries.js
frontend/scripts/geo-e2e/            mock metadata server, fake Maps SDK, browser run
```
