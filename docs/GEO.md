# Where on Earth (the geo game)

A street-level guessing game at `/geo`, in the style of GeoGuessr: you are
dropped at a random spot with imagery, you place a pin, and points depend
on how close you are. Built as a side project inside the ReunitePets app;
it shares the app's chrome rules, share-card rules and API conventions
but no data models.

## Routes

| Route | What | Chrome |
|---|---|---|
| `/geo` | Lobby: provider, mode, rules, daily challenge, local stats, how it works | game header |
| `/geo/play?...` | The game. Every setting is in the query string, so a link is a whole game | full screen; the X in the HUD returns to `/geo` |

The whole `/geo` segment is an immersive takeover in `app/lib/navChrome.js`:
it ships its own header and footer (`app/geo/layout.js`, with a ReunitePets
link as the way back out) instead of the pet site's chrome, so it reads the
same on reunitepets.org and on a domain of its own (see "Hosting on another
domain").
| `/geo/share?s=<code>` | A finished game as a page with its own link preview (server page, `generateMetadata`) | game header |
| `/geo/rooms` | Multiplayer: open a room, join by code, or pick a public room | game header |
| `/geo/room/<code>` | A room: join, lobby, rounds on a shared clock, reveal with everyone's pins, standings, rematch. Link unfurls with the room's name and players | full screen; X leads to `/geo/rooms` |
| `/geo/leaderboard` | The ladders (classic, duel) and your own rating | game header |

API, all under `frontend/app/api/geo/`:

| Endpoint | Method | Does |
|---|---|---|
| `config` | GET | Which providers are set up, the Google browser key, today's daily seed, the country list. Never a server key. |
| `round` | POST `{ config, roundIndex, attempt }` | Finds imagery for a round and returns it with a sealed answer token. Google: a panorama id. Apple: a short list of coordinates to try. |
| `guess` | POST `{ token, guess }` | Scores the guess against the token and reveals the answer. `guess` is `{lat,lng}`, `{countryCode}` for streaks, or `null` when the timer ran out. |
| `og` | GET `?s=<code>` | The 1200x630 link-preview PNG for a share code (satori + resvg, same pipeline as the lost-pet social cards). |
| `rooms` | GET / POST `{ name, hostName, settings }` | Public rooms active in the last 20 minutes / open a room (returns the host's player token). |
| `rooms/:code` | GET / POST `{ action, ... }` | The room as you see it (`x-geo-player` header) / `join`, `start`, `guess`, `next`, `react`, `leave`, `rematch`. Every call moves the room's clock first. |
| `profile` | POST `{ name }` | Who you are across rooms, for ratings; mints an anonymous token on first call (`x-geo-profile`), binds to the account when signed in. |
| `leaderboard` | GET `?ladder=classic\|duel` | The ladder plus your own row. |

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

## Multiplayer rooms

A room is a code, a name, fixed settings and a phase:
`lobby -> loading -> guessing -> reveal -> ... -> finished`. Everyone plays
the same rounds on the same server clock.

- **State lives in Postgres** (`GeoRoom`, `GeoRoomPlayer`, `GeoRoomRound`,
  `GeoRoomGuess`); the browser polls `/api/geo/rooms/:code` every 1.5 s
  during a game and 3 s in the lobby. No background jobs: every request
  ticks the room first (reveal at the deadline or when everyone online has
  guessed, next round 12 s after the reveal, a stalled round build handed
  back after 25 s). Transitions are claimed with a version check
  (`updateMany` on `(id, version)`), so two polls that see the deadline at
  once reveal it once. All of it is in `app/lib/geo/server/rooms.js`, tested
  against `memoryRoomStore.js`.
- **Players are anonymous**: a token per room (stored hashed), a name, a
  colour. The host starts, can cut a round short or skip the reveal, and
  hands the room on if they leave. Up to 12 players; late joiners are fine
  in classic, not in a duel.
- **Variants**: classic totals points; duel starts everyone at 6,000 HP and
  each round the best guess deals the point gap as damage to everyone else,
  times a multiplier that climbs every three rounds. Last one standing wins.
- **The answer stays on the server** until the reveal; the reveal map shows
  every pin in the player's colour. Reactions (six emoji) are broadcast
  through the same poll.
- **Rematch** opens a new room with the same settings and links it from the
  old one; others follow with one click.

## Ratings

Finished rooms with two or more registered players are rated. The system is
Glicko (`app/lib/geo/rating.js`): a rating and a deviation per ladder
(classic, duel). A room is one rating period; every player is compared with
every other player, the pair's result graded by margin (a rout counts more
than a squeaker), and everyone updated from the pre-game numbers. Newcomers
and long-absent players carry a large deviation, so they move fast and barely
dent regulars. Quitting is a loss to everyone who stayed. Unregistered
players are ignored entirely.

Identity is a profile (`GeoProfile`): an anonymous token in the browser
(hashed in the database), bound to a `User` the first time they play signed
in, so the rating follows them across devices. `/geo/leaderboard` lists
players with at least 3 rated games; ratings stay "provisional" until 5.
Tiers (Bronze to Grandmaster) are labels on the number, nothing more.

## Hosting on another domain

The game is self-contained under `/geo` and `/api/geo` with its own tables
and its own header, so the same deployment can serve it on a second domain:

1. Point the domain at the deployment (same host as reunitepets.org).
2. Set `GEO_DOMAINS=whereonearth.example,www.whereonearth.example`. On
   those hosts the middleware redirects `/` to `/geo`, the short paths
   (`/play`, `/rooms`, `/room/<code>`, `/share`, `/leaderboard`, `/daily`)
   into `/geo`, and anything that is not the game to the pet site.
3. Add the domain to the Google browser key's website restrictions
   (`https://whereonearth.example/*` and the `www` form). Without this the
   map refuses to load on the new domain.
4. For the Apple mode, make a MapKit token for the new origin and set it
   as `NEXT_PUBLIC_APPLE_MAPKIT_TOKEN`; the built-in token is locked to
   reunitepets.org.
5. Optional: `NEXT_PUBLIC_GEO_SITE_NAME` renames the header,
   `NEXT_PUBLIC_GEO_HOME_URL` changes where its ReunitePets link goes.

Share cards and room links resolve against the host that served them
(`app/lib/geo/server/siteBase.js`), so previews on the game domain point
back to the game domain. A fully separate deployment of the repo also works:
it needs the same environment plus its own database.

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
frontend/app/lib/geo/server/     server only: countries, sampler, streetview, tokens, game, config, ShareCard,
                                 rooms + roomStore/memoryRoomStore, profiles, roundCache, siteBase
frontend/app/lib/geo/rooms.js    room rules (codes, names, duel maths, standings)
frontend/app/lib/geo/rating.js   Glicko ratings
frontend/app/lib/geo/data/       countries-meta.json (generated)
frontend/app/api/geo/            config, round, guess, og, rooms, rooms/[code], profile, leaderboard
frontend/app/geo/                layout (own header/footer), lobby, play, share, rooms, room/[code], leaderboard, components, client libs
frontend/__tests__/geo/          unit tests; __tests__/api/geo-routes.test.js for the routes
frontend/scripts/build-geo-countries.js
frontend/scripts/geo-e2e/            mock metadata server, fake Maps SDK, browser run
```
