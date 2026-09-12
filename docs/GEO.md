# WanderGuesser (the geo game)

The game was called "Where on Earth" until 2026-09-11. The route is still
`/geo` and the code is still `app/geo`; renaming those is part of phase 4
of the split, when the game moves to its own repository.

A street-level guessing game at `/geo`, in the style of GeoGuessr: you are
dropped at a random spot with imagery, you place a pin, and points depend
on how close you are. Built as a side project inside the ReunitePets app;
it shares the app's chrome rules, share-card rules and API conventions
but no data models.

## Apple first

Founder direction, 2026-09-12: the game is Apple-first. Apple Look Around
is the default imagery, the lobby and the room form open on it, and the
daily challenge and the weekly cup are played on it. Google Street View
is the option for what Apple does not have: the countryside, the hundred
or so other countries, photo spheres (Everywhere) and a car that drives
itself (Kidnapped).

What that buys and what it costs, plainly:

- **Cost.** A Look Around view is not billed per view; MapKit JS runs
  under Apple's daily quota (250,000 map views a day per developer
  account), which the play meter keeps the whole site under. There is no
  per-player allowance on Apple and none is needed. Google rounds stay
  metered as before.
- **Coverage.** City streets in 23 countries (`APPLE_COVERAGE` in
  `app/lib/geo/coverage.js`): the US, Canada, the UK, Ireland, Japan,
  Australia, New Zealand, Singapore, Hong Kong, Israel and thirteen in
  Europe. No countryside anywhere, no Africa, no South America, no Asia
  beyond Japan, Singapore and Hong Kong. Apple keeps adding countries; the
  list is maintained by hand and should be checked against Apple's
  coverage page when it grows.
- **What plays on Apple.** World, Balanced, Daily, Cup, Continent,
  Country and Country streak, all as draws of city streets (see "How a
  round is built"). Everywhere and Kidnapped are Google only by nature.
  The Apple world is the city list: adding a covered city to
  `CITY_ROWS` is how it grows.
- **The token.** MapKit JS needs a token from an Apple Developer account,
  and the one in the repository is locked to the reunitepets.org origin.
  On any other domain, make a token for that origin and set
  `NEXT_PUBLIC_APPLE_MAPKIT_TOKEN`. Without it, every Apple round fails
  in the browser with Look Around's own error, and the game is Script
  mode and whatever Google keys are set.
- **The primary imagery is one value for a deployment**,
  `NEXT_PUBLIC_GEO_PRIMARY_PROVIDER` (`apple` unless set to `google`),
  inlined at build. Everyone on a daily or cup board has to be on the
  same places, so this is never a per-player choice; changing it mid-day
  splits that day's board into two sets of places.

## Routes

| Route | What | Chrome |
|---|---|---|
| `/geo` | Lobby: provider, mode, rules, daily challenge, your rating and recent rated games, rooms you were in, local stats, how it works | universal bar + game subtabs |
| `/geo/play?...` | The game. Every setting is in the query string, so a link is a whole game | full screen; the X in the HUD returns to `/geo` |
| `/geo/script` | The script game's lobby: read a sentence, pin where the language is spoken ("Script" below) | universal bar + game subtabs |
| `/geo/script/play?...` | A script game. Settings are in the query string, so a link is a whole game | full screen; the X returns to `/geo/script` |
| `/geo/share?s=<code>` | A finished game as a page with its own link preview (server page, `generateMetadata`) | universal bar + game subtabs |
| `/geo/rooms` | Multiplayer: open a room, join by code, return to a room you were in, or pick a public room | universal bar + game subtabs |
| `/geo/room/<code>` | A room: join, lobby, rounds on a shared clock, reveal with everyone's pins, standings, rematch. Link unfurls with the room's name and players | full screen; X leads to `/geo/rooms` |
| `/geo/leaderboard` | The ladders (classic, duel) for the season, and your own rating | universal bar + game subtabs |
| `/geo/me` | Your profile: name, rating, points, country badges, today's meter, recent points, the cosmetics shop, and signing in ("Signing in" below) | universal bar + game subtabs |

Chrome follows the house rule in `app/lib/navChrome.js`: the lobby, the
room browser, the rankings and the share page are ordinary pages under
the universal ReunitePets bar (Dashboard, account menu and all), with the
game's own subtabs below it (`app/geo/components/GeoHeader.js`: Play,
Script, Rooms, Rankings, Daily, Profile). Only a round or a room in
progress (`/geo/play`, `/geo/room/<code>`, `/geo/script/play`) covers the
screen, and each carries an X back out. On a build of the game's own site (`NEXT_PUBLIC_SITE=geo`,
see "Hosting on another domain") there is no pet chrome at all and the
same row is the site's header, with a ReunitePets link as the way out.

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
   On Apple Look Around every mode is a draw from the curated city list
   (`app/lib/geo/coverage.js`), because that is the whole of what Apple
   covers: *World* is any covered city, *Balanced*, *Daily*, *Cup* and
   *Streak* pick a covered country first (square root of area, so small
   ones still come up) and then one of its cities, *Continent* and
   *Country* are the covered cities inside them, and a continent or
   country Apple has not reached is refused in plain words. The Google
   draws below are what the Google option does.
   - *World, pure random*: a point uniformly distributed over the sphere
     (uniform in the sine of the latitude, so the poles are not
     over-represented), thrown away if it is not on land. Antarctica is
     excluded.
   - *Balanced, daily, cup, kidnapped, streak*: a random country from the
     Google coverage list, weighted by the square root of its area so
     small countries still come up, then a random point inside its
     polygon.
   - *Continent / country*: the same, restricted.
   - *Everywhere*: a random spot in one of the cities listed in
     `coverage.js` for countries with **no** official Street View at all.
   - *City streets*: a random spot within one of the 185 covered cities
     (`app/lib/geo/coverage.js`).
2. **The imagery probe (Google).** `app/lib/geo/server/streetview.js`
   calls the Street View Static API *metadata* endpoint for each
   candidate, in parallel batches of 12, up to 96 per attempt. Metadata
   requests are free and unmetered. A hit must be official Google
   imagery (the copyright line says Google; user photo spheres are
   skipped) and outdoor. The first hit in candidate order wins, so a seed
   reproduces the same round while coverage is unchanged.
   In every mode but Everywhere a hit must be official Google imagery.
   Everywhere inverts that, below.
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

## Formats

Move, pan and zoom are one choice in the lobby and the room form, the
three formats competitive players know (`FORMATS` in
`app/lib/geo/modes.js`):

- **Moving**: walk, look around and zoom.
- **No Move**: look around and zoom from one spot. The format the pros
  play; the weekly cup is fixed to it.
- **NMPZ**: no move, pan or zoom. One view.

Links and stored games still carry `move`, `pan` and `zoom` separately,
so an old link with an odd mix keeps working; `formatOf` reads the
format back and `movementLabel` spells out a mix that matches none.
Results, room cards, the share text and the OpenGraph card name the
format whenever it is not Moving. Street names are hidden in every
format on both providers.

**Kidnapped** is a mode with its own clock rather than a format: three
minutes a round, Google only, rounds and the probe radius still yours.
The car drives itself (`app/geo/lib/drive.js`, run by
`GoogleStreetViewPane` every 1.1 s): each step takes the Street View
link closest to the direction of travel, never turning back unless the
road ends, and keeps the way you are looking relative to the road. You
can look around, not steer or zoom, and guess whenever you like or when
the clock runs out; the answer is the spot you were dropped at (a few
hundred metres of road do not move the score), and the HUD counts how
far you have been driven.

## Everywhere: the third of the world Street View never drove

Google's coverage stops at a border for reasons of law and business, not
geography. 119 countries are in `GOOGLE_COVERAGE`. The country metadata
holds 249 entries, five of them Antarctic, so against the 244 that are
not, **125 countries are excluded, 34.1% of the world's non-Antarctic
land**: China, Iran, Egypt, Algeria, Sudan, Libya, Saudi Arabia, most of
the Sahara belt and much of Central Asia.

(This said 130 until review caught it. That number subtracted from all
249 while the land figure excluded Antarctica, which is two different
universes in one sentence. Both figures here are measured against the
244; `docs/WANDERGUESSER_STRATEGY.md` carries the same correction.)

That has a consequence for the game beyond missing places. If a third of
the planet can never appear, then memorising the coverage map deletes it
from the answer space before the player has looked at anything. A large
part of what looks like expertise in this genre is knowing where a
company chose to drive.

**Everywhere** is the mode that makes that knowledge worth nothing.

- **Where it draws from.** Cities in countries with no official coverage
  (`citiesOffCoverage()` in `app/lib/geo/coverage.js`). It is a city list
  rather than a country pool because the imagery that exists in those
  countries is user photo spheres, and those cluster in cities.
- **What counts as a hit.** The probe normally rejects anything whose
  copyright line is not Google. Everywhere passes `allowUnofficial` and
  takes the sphere, because there is nothing else there. No other mode
  is affected: the flag is derived from the mode inside
  `probeForImagery`.
- **A wider probe radius.** Spheres are far sparser than a Street View
  car's line, so candidates carry at least a 10 km radius rather than the
  2 km City streets uses. Metadata requests are free and unmetered, so a
  mode that probes harder costs nothing extra; only the round itself
  counts against the play meter.
- **No movement.** A photo sphere is one viewpoint with no links, so
  there is nothing to walk to. The mode fixes `move: false` and leaves
  pan and zoom on. Rounds, timer and probe radius stay the player's.
- **The answer is still named by the polygons.** `countryAt` decides the
  country from Natural Earth, not from the city label, so a sphere in the
  wrong place cannot mislabel a round.

The city coordinates were written by hand, so
`__tests__/geo/off-coverage.test.js` checks every one against the same
polygons that name the answer. A digit in the wrong place fails the
build rather than putting a round in Mongolia and calling it Beijing.
That test caught one on the way in: Tripoli's centre sits just outside
the 1:110m coastline and had to move inland.

**Known limit.** How dense photo spheres actually are in Chad or Sudan is
unmeasured. The mode is built and correct; whether every city in the list
can reliably produce a round needs a live Google key and a real run. If
some cannot, the fix is to trim the list, not to change the mechanism.

## Script: pin the language, not the country

A second game on the same scoring engine. You get a sentence in some
language and place a pin where that language is spoken; points fall off
with distance, exactly as in a street-level round.

**Why a pin instead of a list of language names.** A dropdown makes this
a vocabulary test, and it makes every wrong answer equally wrong:
mistaking Marathi for Hindi would score the same zero as mistaking it
for Finnish. One of those is a neighbouring Indo-Aryan language and the
other is a different family on another continent, and a pin can tell
them apart.

**Why regions instead of borders.** This is the part that matters.
Scoring a guess against a country makes South Asia one tile. Tamil,
Marathi, Bhojpuri and Maithili all collapse into "India" and the round
stops being about language at all. So each language carries the places
it is actually spoken, as heartland discs, and a guess is measured to
the nearest one. Tamil pinned in Tamil Nadu scores full marks. Tamil
pinned in Punjab does not. Punjabi has a heartland on both sides of a
border, and pinning either is right.

A disc is a coarse instrument for a language boundary, deliberately.
Real isoglosses are fuzzy, overlapping and politically contested; a
centre and a radius says "roughly here, and this big" without claiming a
precision no map of languages has.

**The pools**, easiest first (`LADDERS` in `app/lib/geo/script.js`):

| Pool | What it is |
|---|---|
| World | Everything, drawn by how many people speak it |
| Alphabets | One language per writing system: learn to tell Devanagari from Bengali from Tamil |
| South Asia | Seventeen languages, eleven scripts, one subcontinent |
| Devanagari | Hindi, Marathi, Nepali, Bhojpuri, Maithili: same alphabet, five answers |
| Arabic script | Arabic, Persian, Urdu, Pashto, Kurdish, Sindhi, Uyghur: four families, one alphabet |
| Cyrillic | Four Slavic answers and two that are not Slavic at all |
| Latin script | The hardest: the alphabet tells you nothing, every clue is in the words |

**The pool sets the scale.** The scoring size is the diagonal of the box
the pool's answers live in, so a pin on the right continent is worth
real points in World and almost nothing in South Asia, where every
answer was already inside that box.

**Nothing here costs money.** No imagery provider, no metadata probe, no
key, so script rounds never touch the play meter. That is arithmetic
rather than generosity: a text round has no marginal cost to meter. It
also means the mode works on a server with no Google keys at all.

**The corpus** is `app/lib/geo/server/samples.js`, and it is server only
on purpose: if the browser held it, it could match the sentence on
screen against it and read off the answer before the guess, the same way
a panorama round would leak if the client held the coordinate. Rounds go
out as one sentence plus a sealed token.

The sentences were written for the game rather than taken from a corpus.
The two obvious upgrades, both open, are the Universal Declaration of
Human Rights, which exists in more than five hundred translations and is
the canonical parallel text, and Tatoeba, which has millions of
sentences across four hundred languages tagged with ISO 639-3 codes.
Either drops into the same shape.

**One curation rule matters more than the size of the pool: strip proper
nouns.** A sentence containing a city name answers itself, and so does a
digit or a sentence that names its own language. This is checked rather
than trusted, and the check has already caught one: the Lao word for
"he" is also the endonym for Lao.

**Two more checks, both in `__tests__/geo/script.test.js`, both worth
more than the rest put together:**

- Every region coordinate is verified against the same Natural Earth
  polygons that name a geography round, so a typo cannot land Marathi in
  Pakistan.
- Every sample is verified against the Unicode ranges of the script it
  claims, so a sentence pasted into the wrong row fails the build rather
  than shipping a round whose answer is wrong. This caught Azerbaijani
  writing its schwa from IPA Extensions.

**Fonts, which is where this mode would otherwise break.** A language
game that renders empty boxes is not a hard round, it is an unplayable
one, and it fails worst on cheap Android hardware in exactly the places
the mode exists to represent. So `app/geo/script/fonts.js` bundles a
Noto face for all nineteen non-Latin scripts in the corpus, scoped to
these routes. Han, Hangul and Kana are not bundled: those families are
megabytes each and system coverage is close to universal. For the
machines where that bet is wrong, `ScriptSample` measures the text
against U+FFFF, which no font may have a glyph for, and says so rather
than showing boxes with no explanation.

Rounds are unranked while the corpus is a starting pool rather than a
curated one: rating people on content still being written would put
noise in the ladder.

## Signing in

An account here is an email address and nothing else, and it is the
game's own. A WanderGuesser player is not a ReunitePets user and does
not become one: that was the founder's answer on 2026-09-10 to what a
standalone account means, and it is what phase 1.7 of the split
implements (`docs/WANDERGUESSER_SPLIT.md`, D1).

**Playing needs no account.** A browser mints a play token the first
time it joins a room or asks for a profile, keeps it in localStorage,
and sends it as `x-geo-profile`. That is the whole identity for
anonymous play and always has been. The only thing an account buys is
that the profile follows you to a second device and survives a cleared
browser.

**How it works.** Give an address, get a link. No password, so there is
nothing to leak, nothing to reset, and nothing an attacker can reuse
from another site's breach.

| Piece | Where |
|---|---|
| The link, its expiry and its single use | `app/lib/geo/server/accounts.js` |
| The session, sealed rather than stored | `app/lib/geo/server/identity.js` |
| The mail | `app/lib/geo/server/email.js` |
| The endpoints | `/api/geo/auth/{request,verify,signout,me}` |

**What is deliberate, and why:**

- **The link is stored hashed.** Only the SHA-256 goes in
  `GeoLoginToken`, so reading that table is not enough to sign in as
  anyone. It expires in fifteen minutes and is burned on first use, so a
  forwarded mail or a mail client that prefetches links cannot be a
  second sign-in.
- **Asking for a link answers the same way every time**, whether or not
  the address has an account, so the endpoint cannot be used to find out
  who is registered.
- **The session is a sealed cookie, not a table.** Same AES-256-GCM
  envelope as a round answer (`server/tokens.js`), holding an account id
  and an expiry, ninety days. No session table to sweep and it works
  across instances that share the secret. The cost is that signing out
  on one device does not sign out the others; if that ever matters, the
  fix is a token version column on `GeoAccount`. A tampered or expired
  cookie is nobody, never somebody else.
- **A readable companion cookie** (`geo_signed_in=1`, no secret in it)
  exists so the lobby can tell whether to ask the server for a profile
  without a whole extra request. It says "there is a session cookie",
  not "the session is valid"; every endpoint checks the real one.
- **Signing in never merges two profiles.** If the account already has
  one, that profile becomes the player's and the browser's anonymous
  profile is left alone. Merging two rating histories has no right
  answer, and quietly picking one would be the worst of them.

**Mail.** `RESEND_API_KEY` sends it. Without one the link is written to
the server log and the endpoint reports success, which is what makes a
server with no mail account playable: the link is in the log and you can
paste it. Set `GEO_MAIL_FROM` for the sender.

**Deploying this** needs the three schema additions (`GeoAccount`,
`GeoLoginToken`, `GeoProfile.accountId`). The geo tables have always
been applied with `npx prisma db push` rather than a migration folder,
so that is how these go out too.

`GeoProfile.userId`, which used to hold the ReunitePets user id, is dead
as of this change: nothing reads or writes it. It stays in the schema
until phase 3 moves the geo tables to their own database, which is where
dropping a column belongs. Players who had bound a profile to a pet
account keep playing on their browser token and can sign in again with
an email address.

## Multiplayer rooms

A room is a code, a name, fixed settings and a phase:
`lobby -> loading -> guessing -> reveal -> ... -> finished` (an Apple room
goes `lobby -> locating -> guessing -> ...`, below). Everyone plays the
same rounds on the same server clock.

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
- **Apple Look Around rooms** (the default; any mode the room form
  offers on Apple) have no server-side probe, so a round starts in `locating`: the
  server stores the seeded places to try on the round (`candidates`,
  country kept server-side) and sends the browsers the coordinates. Every
  browser tries them in order; the first to get a Look Around `load` posts
  `locate {index}`, the claim wins by version, the round takes that place,
  and the clock starts for everyone. If nobody reports within 25 s the
  room offers the next places for the same round (`retries` climbs). The
  round's coordinate is in the poll during `guessing`, as in solo play,
  because the browser has to open the imagery itself. Apple rooms count in
  the play meter under `apple` and are never refused for the allowance.

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
(hashed in the database), bound to a `GeoAccount` the first time they
sign in, so the rating follows them across devices. That account is the
game's own, never a ReunitePets user (phase 1.7 of the split, D1);
`GeoProfile.userId` is dead and nothing reads it. `/geo/leaderboard` lists
players with at least 3 rated games; ratings stay "provisional" until 5.
Tiers (Bronze to Grandmaster) are labels on the number, nothing more.

## The daily challenge

The daily is the front door: five balanced Google rounds, the same for
everyone, free, and outside the play meter's allowance. Same places for
all is what makes a score worth sharing and a board worth reading, so
the server keeps the score. `/api/geo/guess` records each round of a
daily for the profile behind the request (the seed and the round index
are in the sealed token; the first guess on a round is the one that
counts) as a `GeoChallengeRound`, and keeps a running `GeoChallengeEntry`
per profile per day, keyed `daily:YYYY-MM-DD`. `/api/geo/daily` answers
with the day's board: everyone who finished the five, ranked by total
with the earlier finisher ahead on a tie, how many started, and your own
row with its rank. The lobby's daily card shows the top of the board and
your place; the summary under a finished daily does the same.

Answers leak, as they do for any shared puzzle, so the daily is never
rated, and the result page (`/geo/share`) hides a daily's places until
the reader's own browser has played that day, with a "show them anyway"
for the impatient. The preview image never shows places.

### What holds the board up, and what does not

A round token is bound to the profile that opened it (`sub` in the
sealed payload). The daily and the cup cannot be opened without a
profile at all, and `/api/geo/guess` refuses a challenge token presented
by anyone else with a 403 and no answer. That closes the shape the audit
found: open a round with no identity, read its answer from the guess
route for free and with nothing recorded, then play the same round under
a real profile for a perfect 5,000 that lands as that profile's first
guess. It was a free oracle because a seeded round is deterministic and
cached, so the second draw is the same place.

The board's own window is checked too. The seed comes from the client
and `daily-2031-01-01` is a valid shape, so `challengeFor` requires the
board to be open now (with two hours of grace for a game in flight over
midnight), and `recordChallengeRound` refuses a round index outside the
challenge's length.

What this does NOT stop: a throwaway profile. Profiles are free and
anonymous by design, so somebody can register one, play the daily with
it to learn the five places, and then play it properly on their real
profile. Nothing short of restricting the board to verified accounts
fixes that, and that is a product decision, not a patch. It is worth
weighing for the cup, which pays points.

### What the browser can always work out

Two things are visible to anyone reading the network tab, and neither
can be closed while the game uses these SDKs:

- **Apple rounds send the coordinate.** Look Around is opened by the
  browser at a latitude and longitude; there is no id to hand over
  instead. Every Apple round's answer is in the page before the guess.
- **Google rounds send a panorama id**, and the browser also holds the
  public Maps key, so `StreetViewService.getPanorama({ pano })` returns
  that panorama's exact position. The id is not the coordinate, but it
  is one call away from it.

So the sealed token protects the answer from a casual reader, not from a
determined one, on any imagery round. That is why rated play is rooms
(one clock, everyone on the same place, scores compared with each other)
and why the daily is unrated.

## Housekeeping and the shared database

The game's sixteen-plus tables live on the pet site's Postgres until
phase 3 gives the game its own. Two consequences the deep audit turned
up, both now handled:

- **The pool is capped.** `app/lib/geo/server/db.js` gives the game's
  Prisma client `connection_limit=5` on the shared database whether or
  not `GEO_DB_POOL` is set. The thing on the other side of that database
  is a lost-pet service, and an uncapped second pool turns a launch
  spike into connection starvation for pet reports.
- **Rows are swept.** `app/lib/geo/server/sweep.js` deletes expired
  round-cache rows and sign-in links, play-meter rows older than 120
  days, finished rooms after 14 days and rooms abandoned part way after
  3. `/api/geo/round` runs it at most once an hour per process, and
  `npm run geo:sweep` runs it on demand. Profiles, accounts, ratings,
  the points ledger, badges, challenge boards and `GeoMatchResult` are
  kept: a swept room does not take a player's record of it, because
  `GeoMatchResult` carries no foreign key to `GeoRoom`.

Deleting an account (`POST /api/geo/auth/delete`, the button on
`/geo/me`) removes the email address, the profile and everything that
cascades from it: ratings, points, badges, unlocks, results, room seats
and the rows on the daily and cup boards, so the name and the score
leave the board and the people below move up (the schema cascades
`GeoChallengeRound` and `GeoChallengeEntry` from the profile, and the
memory store does the same so the test proves it). What the game stores
and for how long is written out in
`/privacy`, and `__tests__/geo/privacy-coverage.test.js` enumerates
every personal-data column so a new one cannot ship unmentioned.

## Seasons

Ratings live per season: three months each from 1 September 2026
(`app/lib/geo/season.js`; "s1" is Sep to Nov 2026, "s0" is everything
before). `GeoSeasonRating` is unique on profile, ladder and season (`GeoRating`
itself is the all-time row, unique on profile and ladder), and every
read of ratings goes through `ensureSeasonRows` in
`app/lib/geo/server/profiles.js`: the first time a profile is seen in a
new season on a ladder, last season's row is carried in softly (halfway
back to 1500, the uncertainty widened to at least 200) and last season's
final tier pays points once (Silver 50, Gold 100, Platinum 200, Diamond
350, Master 500, Grandmaster 800; three rated games needed), through the
ledger with ref `season:<key>:<ladder>`. No job runs at the turn of a
season; the carry happens on the next room, board or profile view. The
rankings show the season and the days left.

## The weekly cup

The cup is the daily's big sibling: ten balanced Google rounds on a 60
second clock, the same for everyone in an ISO week (Monday to Sunday,
UTC), seeded `cup-2026-W37`, free and outside the play meter's
allowance. Rounds are recorded like the daily's (`GeoChallengeRound`,
`GeoChallengeEntry`, keyed `cup:2026-W37`, first guess per round counts)
and `/api/geo/cup` serves the week's board, when it ends, the prizes and
your row. Prizes in points go out once per week, by placement among
those who finished the ten: 300, 200 and 100 for the top three, 50 for
the rest of the top ten, 20 for finishing. No job runs on Monday: the
first view of a past week after it ended pays it out (`finalizeCup`,
claimed once through `GeoChallengeFinal`; the ledger refs
`cup:<week>:<profile>` make a repeat harmless), and any view of the
current week pays out the previous one. The lobby's cup card shows the
board and your place; the result page hides a cup's places like a
daily's.

## Points and cosmetics

Points are the earned currency (`app/lib/geo/points.js` has the rules,
`app/lib/geo/server/points.js` applies them). They come from playing and
from skill, and they buy only things that cost nothing to serve. They
never buy Google rounds: the moment earned points turned into imagery,
heavy players would farm them on free Apple play and spend them on rounds
we pay for. Points earn on the first 50 rounds of the day only, so a
script running all night gains nothing.

| Event | Points |
|---|---|
| A solo round | 2, plus up to 8 by accuracy; the daily pays double; a streak pays 3 per country named right |
| A room round | 3, plus up to 8 by accuracy, for a guess that scored |
| Finishing a room | 30, 20, 10 for the top three among those who stayed, 5 otherwise; a duel won adds 40 |
| A country badge | 25, once per country, for a guess within 100 km of the answer inside it |
| The first round of the day | 10 |

Every earn and spend is a `GeoLedger` row whose `ref` names the event
(`solo:<seed>:<i>`, `room:<id>:<round>:<profile>`, `badge:<cc>`,
`buy:<item>`), unique per profile, so a replayed guess or a repeated
reveal never pays twice; `GeoProfile.points` follows the ledger. Badges
are `GeoBadge` rows with the best distance kept.

The catalog is `app/lib/geo/items.js`: pins (the marker you place, drawn
by the guess map), name colours, titles, frames, and reaction packs.
Titles for a rating tier are free once the tier is reached on either
ladder. `/api/geo/shop` lists the catalog with what a profile owns, may
wear and can afford, and takes `buy` and `equip`; buying wears the item.
What is worn is `GeoProfile.equipped` (item ids per slot) and reaches
the screens as a small view: the pin on the guess map in solo play and
in room reveals (the player's colour keeps identifying them there), the
name colour and title in rooms, on the rankings and on the daily board,
the frame around the badge, and the extra reactions in a room's bar
(the server accepts any reaction from any pack).

`/geo/me` is the profile page: name, rating, points, badges, today's
meter, recent points, and the shop.

## The play meter

Every Google Street View round costs money once the month's free calls
are used (see "What it costs" below); Apple Look Around costs nothing
per view but the whole site shares a daily quota. So the server meters
rounds before it fetches imagery (`app/lib/geo/meter.js` has the rules,
`app/lib/geo/server/meter.js` applies them on the store, `GeoUsage`
holds the counts per subject per UTC day per provider):

| | Google | Apple |
|---|---|---|
| Free per player per day | 25 solo rounds, five games of five (`GEO_FREE_GOOGLE_ROUNDS`), and one room game (`GEO_FREE_GOOGLE_ROOM_GAMES`); the daily challenge and the weekly cup add 10 rounds on top (`GEO_FREE_CHALLENGE_ROUNDS`), after which they draw on the solo allowance like anything else | no limit |
| After that | prepaid rounds on the profile (`paidRounds`, quota packs bought once; no subscriptions anywhere), then a refusal | |
| Per player per day, any imagery | 600 anonymous, 2,000 signed in | same |
| Per address per day | 5,000, and as a backstop for anonymous players who clear the browser: 125 free Google rounds and 50 challenge rounds | same |
| Per player per minute | 15, by profile or, with no profile, by address | 15 |
| Whole site per day | 20,000 panorama loads | 200,000, under Apple's 250,000 views |

The site's budget is the one limit counted in panorama loads rather than
rounds, because it is the one that exists to bound the bill. Every mode
shows one panorama a round except Kidnapped, where the car drives itself
and each hop is another billed load: a Kidnapped round is 73 loads
(`KIDNAPPED_LOADS`, one for the drop and `MAX_DRIVE_HOPS` for the
drive). The drive stops when those hops are spent.

Imagery goes to players only. A spectator on `/geo/room/CODE` gets the
room, the players and the reveal, but no panorama id and no Look Around
coordinate: `recordRoomRound` charges the room's players, so a panorama
loaded by anyone else would be money nothing counted.

Anonymous players are tracked by profile and by hashed IP address, so
clearing the browser does not reset the allowance. Signed-in players are
tracked by profile, with the address only as a ceiling, so a household or
an office is not one player. The play page registers a profile on the
first game (`/api/geo/profile`), so nearly everyone has one.

Where it bites: `/api/geo/round` refuses with a 429 and a code
(`allowance`, `ceiling`, `budget`, `speed`), and the play page shows the
refusal in our words with the same game on Apple imagery as the way on
when the mode has one. A round is charged only once imagery was found.

Rooms have their own door. A seat in a Google room is the day's free
room game, or prepaid rounds once that is used; opening, joining and a
rematch refuse (429 `rooms`) only when both are gone, never for the solo
allowance, so a friend who is out of free rounds still gets in. The seat
is charged when the first round starts, not at the door
(`GeoRoomPlayer.entry`: free, paid, apple, over), so a room nobody joins
costs nothing and a late joiner is charged at their first round. A free
seat's rounds are counted toward the ceilings but never drawn from the
solo allowance (`GeoUsage.games` counts the free games); a paid seat draws
one prepaid round per round; a player whose balance runs out mid-game, or
whose free game went to another room in between, is simply counted,
never sent away. A person at the ceiling or a site past its budget cannot
open or join a room, and a room needs two players to start. Apple rooms
are counted under `apple` with no allowance. A store failure while
metering is logged and the round goes on; the caps in the Google console
are the backstop, not this table.

The lobby shows today's numbers from `/api/geo/profile` (`usage`).
Refusal copy stays plain: "You've played a lot today. Back tomorrow."

## Hosting on another domain

The game is self-contained under `/geo` and `/api/geo` with its own tables,
so it can be a site of its own. The clean way is a second deployment of
this repo (on Render: a second web service from the same repo and branch)
that shares the database, built as the game site:

1. Create the service and point the domain at it.
2. Copy the environment from the pet site (`DATABASE_URL`, the Google
   keys, `GEO_TOKEN_SECRET` or `NEXTAUTH_SECRET`, the Apple token if the
   Apple mode is on) and add:

   ```
   NEXT_PUBLIC_SITE=geo
   NEXTAUTH_URL=https://whereonearth.example
   NEXT_PUBLIC_GEO_SITE_NAME=WanderGuesser        # optional, the header's name
   NEXT_PUBLIC_GEO_HOME_URL=https://www.reunitepets.org   # optional, where its ReunitePets link goes
   ```

   `NEXT_PUBLIC_SITE=geo` is read at build time: that build has no pet
   chrome anywhere, the game's header stands in its place, and the
   middleware redirects `/` to `/geo`, the short paths (`/play`, `/rooms`,
   `/room/<code>`, `/share`, `/leaderboard`, `/daily`) into `/geo`, and
   anything that is not the game to the pet site. Rooms, ratings and
   profiles are the same rows on both sites because the database is
   shared.
3. Add the domain to the Google browser key's website restrictions
   (`https://whereonearth.example/*` and the `www` form). Without this the
   map refuses to load on the new domain.
4. For the Apple mode, make a MapKit token for the new origin and set it
   as `NEXT_PUBLIC_APPLE_MAPKIT_TOKEN`; the built-in token is locked to
   reunitepets.org.

Without a second deployment, the pet site can still answer on the game
domain: point the domain at it and set
`GEO_DOMAINS=whereonearth.example,www.whereonearth.example`. Those hosts
get the same redirects as above, but the pages carry the pet site's bar,
because one deployment is one site; the chrome is decided per build, not
per host.

Share cards and room links resolve against the host that served them
(`app/lib/geo/server/siteBase.js`), so previews on the game domain point
back to the game domain.

## Going live

`docs/WANDERGUESSER_LAUNCH.md` is the launch checklist: what is
finished, what needs a Google project with quota caps, a domain and a
mail sender, and the two decisions that block later work. The setup
below is how to run it; that document is whether it can go out.

## Playing it with nothing configured

```
npm run geo:demo
```

No Google project, no database, no mail account, no domain. It starts
the mock metadata server and the dev server, mints a throwaway token
secret, and prints what does and does not work.

**Script mode is the one that needs nobody's permission**, and that is
deliberate. Its map is Leaflet drawing the world from the polygons the
game already ships (Natural Earth 1:110m, the `world-atlas` package,
the same file the server scores with), not MapKit and not a tile server
(`app/geo/components/script/LeafletScriptMap.js`): a script round shows
no provider's imagery, so it owes no provider a map, and the MapKit
token this repository ships is locked to the reunitepets.org origin. On
localhost, on a preview deployment, or on the game's own domain, a
MapKit map does not authorise and the round cannot be answered. The
outline is one 108 KB chunk of the game's own bundle, cached by the
browser like any other, so nothing is fetched from anyone during a
round. It was CARTO's raster tiles until September 2026, when those
started coming back stamped "API KEY REQUIRED"; a world outline with no
labels never needed a tile server.

Rooms, ratings, points, the shop and sign-in all work too, on an
in-memory store that forgets everything when the process stops **or when
the dev server reloads a file**. Sign-in links are printed to the log
instead of emailed.

**What cannot work without keys, and why no mock fixes it:**

- **Street View.** The panorama is drawn by Google's own JavaScript SDK
  in the browser, which needs a Maps browser key. The server side is
  mocked by `scripts/geo-e2e/mock-metadata.js`, so probing and scoring
  run, but the round has nothing to look at.
- **Apple Look Around**, on any origin the MapKit token does not cover.

Two things are deliberately weakened in development and nowhere else. A
missing token secret is generated per process rather than refused, and a
missing `DATABASE_URL` falls back to memory. Both say so loudly in the
log, both are `NODE_ENV === 'development'` only, and production still
refuses a missing secret.

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
One game of five rounds is five panorama loads and one map load. One
game of Kidnapped is up to 365, because the car drives.

Apple: the app already loads MapKit JS. Look Around arrived in MapKit JS
5.79 but is not in the full `mapkit.js` bundle; the game asks for the
`look-around` library with `mapkit.load` through its own loader,
`app/geo/lib/appleMapKit.js` (the game owns it: phase 1.4 of the split).
If that call is missing in the deployed MapKit build, switch the loader
in `app/geo/lib/appleMapKit.js` to `mapkit.core.js` with
`data-libraries="services,full-map,geojson,user-location,look-around"`.

## Local development without keys

The metadata endpoint is overridable and the browser SDK can be faked,
so the whole game runs locally with no Google account:

```bash
cd frontend
node scripts/geo-e2e/mock-metadata.js &          # fake Street View metadata on :3999
GOOGLE_STREET_VIEW_API_KEY=x GOOGLE_MAPS_BROWSER_KEY=x \
GEO_FREE_GOOGLE_ROUNDS=1000 GEO_FREE_GOOGLE_ROUNDS_PER_IP=5000 \
GEO_FREE_GOOGLE_ROOM_GAMES=100 GEO_FREE_GOOGLE_ROOM_GAMES_PER_IP=500 \
GEO_STREET_VIEW_METADATA_URL=http://localhost:3999/metadata npm run dev
```

The meter knobs lift the play meter for one address (otherwise 25 Google
rounds and one room a day, which the harness's rematch would hit). Put
them in `frontend/.env` if you prefer, but note that `next/jest` loads
that file too; the meter tests pin the knobs they depend on.

The page will still try to load the real Maps JavaScript API with the
dummy browser key, so for a full run use the browser harness, which
serves `scripts/geo-e2e/fake-maps.js` in its place:

```bash
npm i --no-save playwright-core                  # not a project dependency
node scripts/geo-e2e/run.js                      # BASE_URL, CHROME_PATH, GEO_E2E_OUT optional
```

It plays a three-round pin game with the keyboard shortcuts, checks the
summary, the share page and a seeded replay, then a Kidnapped round
where the car drives itself and stops at the guess, a country streak, a
timed NMPZ round that runs out, the mobile map sheet, a two-browser
room, the daily board and the profile page. It fails on any page error. Unit tests for everything below the browser:
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
- Apple Look Around covers city streets in 23 countries and nothing
  outside them, so every Apple mode is a draw from the city list; "City
  streets" as a named mode is the Google one.

## Files

```
frontend/app/lib/geo/            shared pure modules: random, distance, modes, coverage, share
frontend/app/lib/geo/server/     server only: countries, sampler, streetview, tokens, game, config, ShareCard,
                                 rooms + roomStore/memoryRoomStore, profiles, roundCache, siteBase
frontend/app/lib/geo/rooms.js    room rules (codes, names, duel maths, standings)
frontend/app/lib/geo/rating.js   Glicko ratings
frontend/app/lib/geo/languages.js  the script game's languages, scripts and heartland regions
frontend/app/lib/geo/script.js     the script game's pools and region scoring
frontend/app/lib/geo/server/samples.js    the sentence corpus, server only so the browser cannot look up the answer
frontend/app/lib/geo/server/scriptGame.js building and scoring a script round
frontend/app/lib/geo/server/identity.js   who a request is: the game's own session cookie, not the pet site's
frontend/app/lib/geo/server/accounts.js   sign-in links: hashed, expiring, single use
frontend/app/lib/geo/server/email.js      the game's own mailer, one message
frontend/app/lib/geo/data/       countries-meta.json (generated)
frontend/app/api/geo/            config, round, guess, og, rooms, rooms/[code], profile, leaderboard, script/round, script/guess, auth/{request,verify,signout,me}
frontend/app/geo/                layout (game subtabs, or the game site's header/footer), lobby, play, share, rooms, room/[code], leaderboard, components, client libs
frontend/app/geo/script/         the script game: lobby, play, and the bundled Noto faces for every script in the corpus
frontend/__tests__/geo/          unit tests; __tests__/api/geo-routes.test.js for the routes
frontend/scripts/build-geo-countries.js
frontend/scripts/geo-e2e/            mock metadata server, fake Maps SDK, fake MapKit, browser run
```
