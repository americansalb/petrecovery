# Probably Earth (the geo game)

The game was called "Where on Earth" until 2026-09-11. The route is still
`/geo` and the code is still `app/geo`; renaming those is part of phase 4
of the split, when the game moves to its own repository.

A street-level guessing game at `/geo`, in the style of GeoGuessr: you are
dropped at a random spot with imagery, you place a pin, and points depend
on how close you are. Built as a side project inside the ReunitePets app;
it shares the app's chrome rules, share-card rules and API conventions
but no data models.

## Apple only

Founder direction, 2026-09-12: the game is Apple-first. Hardened on
2026-09-16: Apple only. Look Around is the imagery, and there is no
other. Google Street View was the option for what Apple does not have,
the countryside and the hundred or so other countries, and it is gone
along with the three modes only its imagery could do, the two keys, the
billing account and the per-view bill.

The trade is real and was made with open eyes: a Look Around view costs
nothing per view, and the price is 23 countries of city streets instead
of most of the world. Script mode, which needs no imagery at all, is
what covers the rest.

What that buys and what it costs, plainly:

- **Cost.** A Look Around view is not billed per view; MapKit JS runs
  under Apple's daily quota (250,000 map views a day per developer
  account), which the play meter keeps the whole site under. There is no
  per-player allowance and none is needed.
- **Coverage.** City streets in 23 countries (`APPLE_COVERAGE` in
  `app/lib/geo/coverage.js`): the US, Canada, the UK, Ireland, Japan,
  Australia, New Zealand, Singapore, Hong Kong, Israel and thirteen in
  Europe. No countryside anywhere, no Africa, no South America, no Asia
  beyond Japan, Singapore and Hong Kong. Apple keeps adding countries; the
  list is maintained by hand and should be checked against Apple's
  coverage page when it grows.
- **Coverage is a secret.** Players are never shown which countries are
  covered, or how many (founder decision, 2026-09-23: players should not
  know what could come up). There is no country or continent to choose;
  `continent` and `country` are retired to World (`RETIRED_MODES` in
  `app/lib/geo/modes.js`), and rooms play World only. `coverage.js` is
  server only, the Country streak list is every country in alphabetical
  order with nothing marking the covered ones, and the profile counts a
  player's country badges without a total.
  `__tests__/geo/coverage-secret.test.js` fails if a client screen
  reaches `coverage.js` by any path, if the config API's country rows
  carry a coverage flag, or if the copy states a count.
- **What plays on Apple.** World, Daily, Ranked, Cup and Country streak,
  all as draws of city streets (see "How a round is built").
  The Apple world is the city list: adding a covered city to
  `CITY_ROWS` is how it grows.
- **The token, and the host it is for.** MapKit JS needs a token from an
  Apple Developer account, and a token carries **one** origin that Apple
  matches **exactly**. A token for `reunitepets.org` is refused on
  `www.reunitepets.org`. `NEXT_PUBLIC_APPLE_MAPKIT_TOKEN` therefore takes
  a **list**, separated by commas or whitespace, and the token whose
  origin matches the host the page is served from is the one used: mint
  one per host the site answers on. The token in the repository covers
  the apex and nothing else.

  **A refused token is silent.** MapKit does not throw, does not log and
  does not fail to load: it loads, the pane is built, and no tile ever
  arrives. That is how every Apple surface on the live site went blank
  on 2026-09-14 while every test passed, because the apex redirects to
  `www` and the token was minted for the apex. The game now names it
  instead: the Apple rounds show which host was refused and which origin
  the token covers, and `npm run geo:check-mapkit` asks Apple directly
  and exits non-zero if any host the site serves is refused. Run it
  after any change to the domain, the redirects or the token.
- **The primary imagery is one value for a deployment**,
  `NEXT_PUBLIC_GEO_PRIMARY_PROVIDER` (`apple`, the only value there is),
  inlined at build. Everyone on a daily or cup board has to be on the
  same places, so this is never a per-player choice; changing it mid-day
  splits that day's board into two sets of places.

## Routes

| Route | What | Chrome |
|---|---|---|
| `/geo` | The front door: a turning globe you can spin, one Play button, and four text links (Play with friends, Daily, Rankings, Script). Nothing to decide on the way in | universal bar + game subtabs |
| `/geo/play?...` | The game. Every setting is in the query string, so a link is a whole game | full screen; the X in the HUD returns to `/geo` |
| `/geo/script` | The script game's lobby: read a sentence, pin where the language is spoken ("Script" below) | universal bar + game subtabs |
| `/geo/script/play?...` | A script game. Settings are in the query string, so a link is a whole game | full screen; the X returns to `/geo/script` |
| `/geo/share?s=<code>` | A finished game as a page with its own link preview (server page, `generateMetadata`) | universal bar + game subtabs |
| `/geo/rooms` | Multiplayer: open a room, join by code, return to a room you were in, or pick a public room | universal bar + game subtabs |
| `/geo/room/<code>` | A room: join, lobby, rounds on a shared clock, reveal with everyone's pins, standings, rematch. Link unfurls with the room's name and players | full screen; X leads to `/geo/rooms` |
| `/geo/leaderboard` | The ladders (classic, duel, ranked solo) for the season and your own rating, plus every mode that is not the default: Ranked, the daily and the weekly cup with their boards, then country streak | universal bar + game subtabs |
| `/geo/me` | Your profile: name, rating, points, country badges, today's meter, recent points, the cosmetics shop, and signing in ("Signing in" below) | universal bar + game subtabs |

Chrome follows the house rule in `app/lib/navChrome.js`: the room
browser, the rankings, the profile and the share page are ordinary pages under
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
| `config` | GET | Whether the game is set up, today's daily seed, the day's limits, the country list. Never a secret. |
| `round` | POST `{ config, roundIndex, attempt }` | A round and its sealed answer token: a short list of coordinates to try. |
| `guess` | POST `{ token, guess }` | Scores the guess against the token and reveals the answer. `guess` is `{lat,lng}`, `{countryCode}` for streaks, or `null` when the timer ran out. |
| `og` | GET `?s=<code>` | The 1200x630 link-preview PNG for a share code (satori + resvg, same pipeline as the lost-pet social cards). |
| `rooms` | GET / POST `{ name, hostName, settings }` | Public rooms active in the last 20 minutes / open a room (returns the host's player token). |
| `rooms/:code` | GET / POST `{ action, ... }` | The room as you see it (`x-geo-player` header) / `join`, `start`, `guess`, `next`, `react`, `leave`, `rematch`. Every call moves the room's clock first. |
| `profile` | POST `{ name }` | Who you are across rooms, for ratings; mints an anonymous token on first call (`x-geo-profile`), binds to the account when signed in. |
| `leaderboard` | GET `?ladder=classic\|duel` | The ladder plus your own row. |

Rate limits are in `frontend/middleware.js` next to the other API entries.

## How a round is made

1. **A candidate point.** `app/lib/geo/server/sampler.js` draws from a
   seeded generator (`app/lib/geo/random.js`). Every mode is a draw from
   the curated city list (`app/lib/geo/coverage.js`), because that is
   the whole of what Apple covers: *World*, *Daily*, *Ranked*, *Cup* and
   *Streak* pick a covered country first, weighted by the square root of
   its area so small countries still come up, then one of its cities.
   *Continent* and *Country* drew from one part of the list and are
   retired (see "Coverage is a secret"); a room created with one before
   then plays World.

   The square root is the lever. Weighting by raw area makes Russia,
   Canada and the United States almost the whole game; weighting every
   country equally makes Monaco as likely as Brazil, and the meta
   becomes learning a list. The square root sits between the two and is
   the setting the founder signed off on.
2. **The imagery probe.** MapKit JS has no availability call, so the
   round goes out as twelve candidate coordinates and the browser
   creates a Look Around view for each in turn, listening for `load` or
   `error` (`app/geo/lib/lookAround.js`). The first that opens is the
   round, and it reports which one back.
3. **The sealed token.** The answer (coordinates, country and scoring
   scale) is AES-256-GCM encrypted under a key derived from
   `NEXTAUTH_SECRET` (`app/lib/geo/server/tokens.js`) and handed to the
   browser opaque.
   The guess endpoint opens it. No table, no cleanup, works across
   instances. An Apple round issues twelve of them, one per candidate,
   all carrying the same round id so the points ledger pays for one
   round rather than twelve.
4. **The country.** Named from Natural Earth 1:110m polygons
   (`world-atlas`) with metadata from `world-countries`, joined on the ISO
   numeric code (`app/lib/geo/server/countries.js`). No geocoder call.
   Regenerate the metadata with `node scripts/build-geo-countries.js`.

Scoring (`app/lib/geo/distance.js`): `5000 * e^(-10 d / size)`, where
`size` is 14,916 km, the world, for every mode. Within 25 m is 5,000.

The search radius has no control any more - the lobby that carried it
was deleted - so it is a query-string setting on a shared link, at
`standard` for everything the game starts itself:
2 km (pure), 10 km (standard), 50 km (fast). A small radius is closer to
uniform over covered land but needs more candidates; a large one drifts
toward the edges of covered areas.

Seeds: every game gets one (the front door and the Rankings buttons
generate it), the daily challenge
uses `daily-YYYY-MM-DD` (UTC), and the summary offers a "Challenge a
friend" link that replays the same places. A retry after "no imagery"
skips ahead in the seeded sequence rather than repeating it.

## Formats

Move, pan and zoom are one choice in the room form and in a game's query
string, the
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

Kidnapped and Everywhere were two more ways to play, and both needed
Google: Kidnapped drove the Street View car for you, and Everywhere drew
from the countries Google never entered, on user photo spheres. Apple
has neither road links nor photo spheres, so both went when Google did
(2026-09-16). A link to either opens World.

## Not Earth

Not Earth, a rare round on a NASA panorama from Mars or the Moon, was retired on 2026-09-23.

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
it is actually spoken, and a guess is measured to the nearest one. Tamil
pinned in Tamil Nadu scores full marks. Tamil pinned in Punjab does not.
Punjabi is spoken on both sides of a border, and pinning either is
right.

**The corpus is 264 languages across 34 writing systems**, and it grows
by adding the language next to one already in it rather than the next
biggest in the world: Macedonian beside Bulgarian, Slovak beside Czech,
Latvian beside Lithuanian, Galician between Spanish and Portuguese,
Scottish Gaelic beside Irish, Faroese beside Icelandic, Dari and Tajik
beside Persian in two other alphabets, Cantonese beside Mandarin in the
same one. A round is worth playing when it is a decision between two
things you can tell apart, and worth nothing when the answer is
"somewhere in Europe".

**105 of them arrived on 2026-09-25**, all in scripts the game already
had: 23 from central, eastern and southern Africa, 22 from West Africa, 21
from South-East Asia, north-east India and the Pacific, 24 regional
languages of Europe and the Americas, 14 from Russia and the Caucasus, and
Kirundi. Their sentences are copied from the UN's Universal Declaration of
Human Rights (the Unicode UDHR corpus, which NLTK distributes as public
domain) or, where a language has no declaration, picked from Tatoeba. Every
hint compares the language with a neighbour a player would confuse it with,
using the word that neighbour's own translation uses. Each language's area
was checked against the point Glottolog gives for it. That check also found
three live languages drawn too small or in the wrong place (Luganda, Pular,
Awadhi) and a builder bug: Natural Earth gives some cities the code of the
province around them, and the builder kept whichever shape it read last,
so Pampanga had shrunk to the city of Angeles and Cebu to Cebu City.

**Nine of the alphabets are written for a handful of languages each**,
and every one of them settles a round on sight: Thaana for Dhivehi,
Tibetan for Tibetan and Dzongkha, Ol Chiki for Santali, Meetei Mayek for
Manipuri, Cherokee, Canadian syllabics for Inuktitut, N'Ko for Manding,
Adlam for Pular, Tifinagh for Tamazight. Two of them are younger than
the people using them: Adlam was invented in the 1980s by two teenage
brothers in Guinea, Ol Chiki in 1925 by a Santal schoolteacher.

**Nothing in the code caps this.** Every Noto face the remaining scripts
would need is on Google Fonts, Natural Earth has the boundaries, and the
builder and the tests scale. The limit is that a sentence has to be
right: these are hand-written, and the long tail of the corpus deserves
a native speaker's eye before anyone rates a player on it. Correcting
one is a single array in `app/lib/geo/server/samples.js` and its markers
beside it.

**Every language is drawn as real places.** A region is a whole country
(`{ countries: ['IS'] }`), a set of subdivisions (`{ units: ['IN-TN'] }`,
ISO 3166-2), or either of those clipped to a box where the line runs
through a unit rather than round it. Source is Natural Earth's 10m
admin-0 and admin-1 sets (public domain), built into
`app/lib/geo/data/language-regions.json` by
`scripts/build-language-regions.js` and resolved by
`app/lib/geo/server/regions.js`. The file carries only what the corpus
names: 160 countries and 271 subdivisions, not Natural Earth's four
thousand.

**Audited on 2026-09-25** against two independent sources: the point
Glottolog and WALS each give for a language, and Unicode CLDR's figures for
which countries use it and whether it is official there. It found places a
language is official or spoken by most people but was missing from: French
in Luxembourg, Monaco, Haiti, the Maghreb and the French Pacific; German in
Luxembourg and South Tyrol; Dutch in Aruba, Curacao and Sint Maarten;
Swedish in Aland and Ostrobothnia; Russian in Kyrgyzstan; Arabic in
Djibouti, Somalia, the Comoros, northern Chad, Western Sahara and Israel;
Tamil in Singapore; Cantonese in Macau; Samoan in American Samoa; Swahili
in the eastern Congo; Chichewa (Nyanja) in eastern Zambia and Lusaka. Those
were added. A second pass on 2026-09-26 applied the script rule to the
map: a region is where you would find the sentence, and the sentence is in
one alphabet, so Gurmukhi Punjabi lost Pakistani Punjab (Shahmukhi, Western
Punjabi's row), Latin Azerbaijani lost Iranian Azerbaijan (Arabic script)
and Cyrillic Mongolian lost Inner Mongolia (the traditional script). It also
added Mandarin in Singapore, French in Wallis and Futuna, Saint-Barthelemy,
Saint-Martin and Saint-Pierre-et-Miquelon, German in Belgium's East Cantons
and Papiamento on Bonaire. Taiwan stays out of Mandarin for the same reason:
it writes traditional characters and the rounds are simplified. What the
audit cannot fix is the boxes: 59 languages still draw
at least one region as a province clipped to a rectangle, 32 of them
entirely, which is right to within the box and no better. District
boundaries would do better than boxes.

They were discs until 2026-09-12, and the discs were wrong in ways the
map showed: the Maithili circle covered the hills of eastern Nepal, the
Marathi one reached into Karnataka, and every coastal language had half
its area out at sea. Anywhere in Kerala is Malayalam now, because
"Kerala" is how someone who knows Malayalam knows where it is spoken.

Four things follow, and they are the mode:

- **Regions overlap, because languages do.** Hindi and Urdu share the
  Doab, Nepali and Bengali share Darjeeling, French and Dutch share
  Brussels, Kurdish and Arabic share Erbil, Pashto and Dari share Kabul.
  Nothing is exclusive; the reveal names what else is spoken where the
  pin landed.
- **Not every language is state-shaped.** A `clip` box cuts a unit down:
  Bhojpuri is western Bihar, eastern Uttar Pradesh and a strip of the
  Nepal Terai; Basque is the western third of the Pyrenees-Atlantiques;
  Hausa is southern Niger and the north of Nigeria. The coast, the
  state line and the border stay real; the one straight edge is the
  inland isogloss, which is fuzzy on the ground and contested on paper,
  so a straight line is the honest way to draw it.
- **The map does not take sides.** A region says where a language is
  spoken, never who a place belongs to. Kurdish is drawn across four
  states and Kirkuk is left out of it, because saying either way would
  be the game answering a question nobody asked it. Where Natural Earth
  draws a border the game draws it too, and where a language crosses
  one, the language crosses it.
- **Where it is used, not only where it is the mother tongue.** The
  round shows a sentence and asks where you would find it, so the region
  is the ground the language is written across: Irish is the whole of
  Ireland, Tamazight the whole of Morocco, Mandarin the whole of China
  including Shanghai and Guangzhou, where the mother tongue is Wu and
  Cantonese and the signage is not. Those overlap, and overlapping is
  the honest answer.
- **Three kilometres of grace.** The polygons are simplified to about
  two kilometres, so a coastline is known to about two kilometres, and
  Reykjavik, Montreal and Copenhagen each fell outside their own
  country. A pin within three kilometres of a region counts as inside
  it: that is the error bar on the map, and the score at 3 km is 4,990
  out of 5,000 anyway.

**Every region is pinned to a place, and the places are the test**
(`__tests__/geo/region-places.test.js`). A wrong subdivision code still
resolves, a clip box drawn in the wrong place still produces a polygon,
and both score a round against somewhere the language is not: nothing in
the corpus notices. So each language names a place a person would really
encounter it, and a language with no place fails the suite, which means
the corpus cannot grow without someone saying where the new row belongs.
A second list names places a language must NOT cover, because no
positive check finds a region that is too big.

The 2026-09-15 audit is what that test is made of. It found:

- **A subdivision code that meant the wrong province.** Balochi named
  `IR-11`, which is Zanjan in the north west. Sistan and Baluchestan is
  `IR-13`. It resolved, drew a polygon, and scored Zahedan as 25 km
  outside Balochi.
- **Thirty-three regions that were rectangles**, not places. A clip box
  over a country is a guess at its corners: Tatarstan was five points,
  Chuvashia five, Chechnya five, Buganda eight. They are the real
  boundaries now, from Natural Earth's admin-1 set, and thirteen more
  countries had to be added to the builder's subdivided list to get
  them.
- **Sorani Kurdish drawn over Kurmanji's ground.** Sorani carried
  south-eastern Anatolia and the Syrian northeast, which was defensible
  while it was the only Kurdish row in the corpus. It is not now: what
  is written in Turkey and Syria is Kurmanji, in Latin letters, and
  Kurmanji has its own row.
- **Somali stopping at a line Natural Earth draws and does not name.**
  Hargeisa scored 51 km from anywhere Somali is used, because the
  polygon north of that line has no ISO code and the builder dropped it.
  It is in now, under a code from the user-assigned range and a name
  that is geography rather than politics.
- **Mandarin excluding the cities it is most written in.** It listed the
  provinces where it is the mother tongue, which left Shanghai, Guangzhou
  and Kashgar outside the language every sign in them is written in.

**The polygons never reach the browser except on a reveal**, and then
only the answer's own, thinned to the region's own scale: Spanish is 186
KB at scoring precision and 65 KB drawn, which looks identical at the
zoom the reveal flies to. The round payload must never carry anything
the answer can be read from.



**The screen.** A script round is the one screen in the game with no
imagery on it, so it is the one screen that is light: warm paper, a pale
sea, dark type. The sentence has the top of the screen and the map has
the rest, rather than floating over it. The pin drops, the answer's
regions fade in, the map flies to fit both, and the score counts up; all
of it is off under `prefers-reduced-motion`.

**The map is Apple's**
(`app/geo/components/script/AppleScriptMap.js`): Muted Standard, the
answer drawn as polygon overlays and the miss as a dashed line to the
border it was measured to. Apple's tiles are Apple's, and their terms do
not allow storing or re-serving them, so there is no cache to build:
every view is a view against the 250,000 a day the token covers.

**Apple writes nothing on it.** `map.labels = false` stops the tiles
carrying any text at all, and points of interest are off separately.
This is not a preference, it is what makes Apple's map usable for this
round: half the South Asian languages are named after the state they
are spoken in, so a map that writes "Tamil Nadu", "Punjab", "Gujarat", "Karnataka"
or "West Bengal" on itself has answered the round before the player has.
The names on the map are the game's own instead, the same 10 KB of
Natural Earth label anchors the keyless map uses
(`app/lib/geo/data/country-labels.json`), at the zooms its cartographers
set: countries, and nothing smaller, on either map. The harness asserts
it, by reading every name drawn on the map and checking it against that
file.

**When MapKit says no, the game draws the world itself**
(`app/geo/components/script/LeafletScriptMap.js`): Leaflet over the same
Natural Earth polygons the server scores with, and the same country
names over the top. No key, no quota, no account, and no bill. That last
one is the reason there is no third map: a fallback billed per load
would charge for exactly the days Apple is not drawing, which is a worse
problem than the one it solves.

**"Says no" means an error, not a silence.** This used to give MapKit
three seconds to confirm the token after the script landed and treat the
silence as a refusal. Any page where the `Initialized` event had already
fired before the screen mounted, and any connection slow enough to miss
the window, drew the keyless map on a site where Apple works perfectly
well, which is how it came to be in front of real players on
reunitepets.org. There is one clock now, for MapKit never arriving at
all, and it only fires while no map has been chosen yet. Apple gets the
benefit of the doubt, because Apple is what the rest of the game runs
on.

A refusal is still latched for the rest of the game, so a token that
recovers mid-round does not swap the map out from under a pin.

`npm run geo:check-mapkit` says which hosts the tokens on hand actually
cover, which is the thing to check first if the keyless map is showing
up where it should not.

**Country names are all of them or none of them**
(`app/geo/lib/countryLabels.js`). Natural Earth gives every country an
anchor and the zoom its cartographers set; drawing all of them at that
zoom writes UNITED KINGDOM through GERMANY through FRANCE, with ITALY
and SPAIN underneath. Dropping only the losers was worse: the player
cannot see the boxes, so a world where France is named and Germany is
not looks like the map choosing at random, and the set changes on every
pan.

So every name that belongs on screen at this zoom is measured, and if
they all fit they are all drawn; if even one would land on another, none
are. A zoomed out world is therefore unlabelled, and the names arrive
together once there is room, which on a laptop is around zoom 5.
Nothing is hard coded to that number: a phone reaches it later and a
wide monitor sooner, because what fits is a question about the screen.
Both maps that draw their own names use it, and
`__tests__/geo/country-labels.test.js` holds the rule.

**One pool, and it is never shown.** Every game draws from every
language, weighted by how many people speak it, and nothing tells the
player what the languages are (founder decision, 2026-09-23: players
should not know what could come up). There used to be seven pools to
choose from, World, Alphabets, South Asia, Devanagari, Arabic script,
Cyrillic and Latin script, each shown with its size; a link that still
carries `ladder=` plays the one pool. The corpus is server only:
`app/lib/geo/script.js`, which the browser shares with the server, does
not import `languages.js`. `__tests__/geo/coverage-secret.test.js` fails
if a client screen reaches the corpus by any path, if the game's copy
states a count, or if a hint describes the rest of the pool ("no other
language here does this"); a hint compares with named languages or says
what is true anywhere.

**A round is a passage, not a sentence** (2026-09-25). Half the corpus
was under forty characters, and "Dit was baie mooi." is not enough to
place Afrikaans from. A round takes that language's sentences in a seeded
order until there are ninety characters (thirty in Han and Japanese), at
most six, so a declaration sentence usually stands alone and a Tatoeba
line takes two or three (`passageFor` in `app/lib/geo/server/scriptGame.js`).
The cap was four for the first few hours, which left languages made of
short lines (Limburgish, Kashubian) under ninety characters. Fifteen
languages, Thai, Amharic, Croatian and Tamil among them, had only two
sentences, so every round of them was the same short text; each got six
or seven more from the Declaration or Tatoeba, with markers written for
them, and `script.test.js` now checks that every language fills a round
whatever order its sentences come in.
The same day added 727 longer sentences from the Universal Declaration to
141 languages, chosen by script so that each one carries its language's
existing markers and none of a rival's: the hints stay true without a
word of them being rewritten.

**One scale.** The scoring size is the diagonal of the box every answer
lives in, so a pin on the right continent is worth real points and the
right state is worth all of them.

**Script rounds never touch the play meter.** No imagery and no key.
That is arithmetic rather than generosity: a text round has no marginal
cost to meter, and the mode works on a server with nothing configured at
all. Its map is a MapKit view like any other round's, and the keyless
fallback above needs not even that.

**The corpus is 2,207 sentences** across the 264 languages, and where
they come from matters. The first two or three in each language were
written for the game, all saying the same few things so the content
could not leak the answer, which also meant anybody who played twice had
read the lot. The rest come from Tatoeba (CC-BY 2.0 FR, credited in the
footer), fetched and filtered by `scripts/build-script-corpus.js`.

The filtering is most of that script, because a crowdsourced corpus is
not a curated one. Every character has to be in the language's own
script; no digits in any script, no currency, no URLs; every word has to
be among the commonest few hundred that language has, which is what
strips names where there are no capital letters to spot them by;
Tatoeba's stock cast of Tom and Mary is named and refused, because they
are the commonest words in the corpus rather than rare ones; nothing may
name a place, a language or a number; and every sentence has to carry
one of its language's markers and none of a rival's, so the reveal still
teaches and no feature is handed to the wrong language.

461 sentences survived that, for 75 languages. The other 84 keep what
they had: Tatoeba is thin in Wolof and Tetum, and a filter loose enough
to find something there would be loose enough to let a place name
through somewhere else. `__tests__/geo/corpus-size.test.js` keeps the
pool from shrinking back.

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

**What gave it away.** The reveal names the answer and then shows why:
the features in the sentence you just read that separate that language
from the one you would have confused it with, marked in the sentence
itself. Marathi's ळ, which Hindi does not have. Assamese ৰ against
Bengali র, one stroke apart. Azerbaijani ə against Turkish, which has
no schwa. Indonesian *dingin* against Malay *sejuk*. That is the
difference between a quiz you pass or fail and a game you get better at:
being told the name teaches nothing, being shown the letter teaches the
next round.

The table is `app/lib/geo/server/markers.js`, 1,247 features across the
corpus, and it is **server only for the same reason the sentences are**:
a marker is a string chosen because it identifies one language, so
shipping the table to the browser would hand over every round before the
guess. It reaches a browser once, in the guess response, after the
answer is already out, and `__tests__/geo/script.test.js` checks the
round payload carries none of it.

Two rules make a marker a marker, and
`__tests__/geo/markers.test.js` enforces both rather than trusting them:

- **Every sample carries at least one**, so no round reveals with
  nothing to teach.
- **No marker appears in another language written in the same script.**
  A feature shared with exactly the language you would have confused it
  with is not a marker, it is a red herring. Across scripts there is
  nothing to check, because the alphabet already answered the round, and
  where a script belongs to one language in the pool the reveal says so
  on its own.

That second rule is not decoration. Writing this table, it rejected nine
markers I had been confident about: Uyghur ھ is also Urdu's, Russian э
is also Mongolian's, Portuguese ã is also Vietnamese's, Polish ą is also
Lithuanian's, and Azerbaijani *idi* is inside Turkish *gidiyor* and
Swahili *baridi*.

**Players can say an answer is wrong** (2026-09-25). Under the hints,
"Something wrong?" opens four choices (where it is spoken, a hint, it is
not this language, something else) and a line to write in. The report
goes to `POST /api/geo/script/report` with the round's sealed token, so
the language and the text stored in `GeoScriptReport` are the ones the
server dealt, never ones a browser named. The same person reporting the
same thing about the same language twice in a day is stored once; that
is all the hashed address is for, and the sweep clears it after two
days. `/geo/admin` shows the open reports as piles, by language and by
kind, the biggest first, with the latest notes, and Done closes a pile
once the fix ships. The founder asked for it after questioning French on
Haiti's map: one person disagreeing is an opinion, the same complaint
from many people is a bug (`app/lib/geo/server/reports.js`).

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
Noto face for all twenty-eight non-Latin scripts in the corpus, scoped to
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
game's own. A Probably Earth player is not a ReunitePets user and does
not become one: that was the founder's answer on 2026-09-10 to what a
standalone account means, and it is what phase 1.7 of the split
implements (`docs/PROBABLY_EARTH_SPLIT.md`, D1).

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
  exists so the front door can tell whether to ask the server for a profile
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
  toward each player's day and the site's, and nothing else.

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

## Ranked solo

A rating needs an opponent, and solo play had none: one person on their
own earned points and a place on the day's board and had nothing to
climb. Ranked solo gives them the field.

**A new set every hour.** `ranked-2026-09-15T21` is the seed, and
everyone who plays in that hour gets the same five places under the same
rules: five rounds, 60 seconds each, No Move, on the primary imagery. A
rating compares people, so it can only compare them on the same places
under the same rules.

An hour rather than a day because a rating wants games and a day would
cap a player at one rated result; an hour rather than a minute because
the set has to be shared for the comparison to mean anything.

**The seed is the hour's, never the player's.** A supplied seed is
accepted only if it belongs to the current hour or the one before it,
which is enough to finish a set that started before the clock turned
over and not enough to hand back a set you have already seen.

**Finishing rates you.** The opponent is everyone else who finished that
same hour, taken together as one player: their average rating, their
average deviation, their average total. Beat the field and you gain,
lose to it and you drop, and the margin is graded as it is in a room, so
squeaking past the average is worth less than doubling it. The first
person to finish an hour has no field, so they play a newcomer sitting
on 1500 with the widest deviation, scoring 60% of a perfect set; a wide
deviation barely moves anybody, which is the honest outcome when nothing
is known about that hour yet.

**Five games to be placed.** Until then the screens say how many are
left rather than showing a rank, because a rating built on four games is
mostly noise.

It is its own ladder, `solo`, next to `classic` and `duel` on the
leaderboard, and it runs on the same seasons. Rated once and only once
per set: the round that completes an entry is the one that rates it, and
a round already on the board is never recorded again.

None of it needed a new table. The board is `GeoChallengeRound` and
`GeoChallengeEntry`, the same two the daily and the cup use, and the
rating is a `GeoSeasonRating` row with `ladder = 'solo'`.

## The daily challenge

The daily is the front door: five balanced rounds, the same for
everyone. Same places for all is what makes a score worth sharing and a
board worth reading, so
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
  3, and clears the hashed address on Script reports after 2 days.
  `/api/geo/round` and `/api/geo/script/round` run it at most once an
  hour per process (Script rounds too, since Script became the default
  game), and
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

The cup is the daily's big sibling: ten balanced rounds on a 60 second
clock, the same for everyone in an ISO week (Monday to Sunday, UTC),
seeded `cup-2026-W37`. Rounds are recorded like the daily's
(`GeoChallengeRound`,
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
never buy imagery, and there is none to buy: that rule outlived the
Google rounds it was written for, and is kept because a currency that
turns into anything the site pays for is a currency worth farming.
Points earn on the first 50 rounds of the day only, so a script running
all night gains nothing.

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

Look Around costs nothing per view, so there is no invoice to bound and
the meter is not a billing guard any more. What is left is what was
never about money (`app/lib/geo/meter.js` has the rules,
`app/lib/geo/server/meter.js` applies them on the store, `GeoUsage`
holds the counts per subject per UTC day):

| | |
|---|---|
| Per player per day | 600 anonymous, 2,000 signed in. An abuse limit shaped like a person: a heavy evening is about a hundred rounds |
| Per address per day | 5,000, as a backstop for anonymous players who clear the browser |
| Per player per minute | 15, by profile or, with no profile, by address. This is the one that actually stops a script |
| Whole site per day | 200,000 views, under Apple's 250,000 |

The site's day is the only one that is not about abuse. Apple's quota is
250,000 views **per developer account**, and the same account serves
ReunitePets' shelter maps, so burning the day here would blank the maps
there. The game stops first.

**Rooms are not rationed.** A room holds twelve, so metering rooms taxes
the one thing that brings players in. A seat costs nothing and goes
through the same door as a solo round: the ceiling and the site's day,
and nothing else.

What went with Google (2026-09-16): the free daily rounds, the prepaid
rounds on the profile, the free room game, the challenge allowance and
a site budget counted in panorama loads. All five existed to bound a
bill that no longer arrives.

Imagery goes to players only. A spectator on `/geo/room/CODE` gets the
room, the players and the reveal, but no Look Around coordinate.

Anonymous players are tracked by profile and by hashed IP, so clearing
the browser does not reset the count. Signed-in players are tracked by
profile with the address only as a ceiling, so a household or an office
is not one player. The play page registers a profile on the first game
(`/api/geo/profile`), so nearly everyone has one.

Where it bites: `/api/geo/round` refuses with a 429 and a code
(`ceiling`, `budget`, `speed`), and the play page shows the refusal in
our words. There is no other imagery to offer as a way on any more, so a
refusal is the end of the round rather than a fork.
## probablyearth.com

The game's own address, built into `middleware.js` rather than read from
an environment variable: a domain that needs a variable set before it
works is a domain that is broken on the day it is pointed, and whoever
pointed it has no way to tell. `GEO_DOMAINS` still adds more.

Point the domain at the existing deployment and the short paths work
immediately: `/` is the front door, and `/play`, `/rooms`, `/script`,
`/leaderboard`, `/daily` and `/room/<code>` all land in the right place.
What that does **not** change is the chrome, because the chrome is a
build-time decision (`NEXT_PUBLIC_SITE`) so that the server and the
browser agree on the first paint. On the shared deployment the pages
carry the pet site's bar.

For the game's own bar and footer and nothing pet-shaped anywhere, it
needs a build of its own, which is the section below. On Vercel or
Render that is a second service from the same repo and branch with
`NEXT_PUBLIC_SITE=geo` set, sharing the database, with the domain
pointed at it instead.

Apple needs nothing: `/api/geo/mapkit-token` mints per host and
probablyearth.com is on its allowlist, so MapKit draws there from the
first request.


## Accounts: guest, signed in, role, tier

Three layers, decided by the founder on 2026-09-16, deliberately
independent of each other (`app/lib/geo/server/roles.js`).

**Guest or signed in.** A browser plays with no account at all. Signing
in binds that browser's play profile to an email so the history, the
rating and the badges survive a new device. Nothing about the game is
withheld from a guest: the account is for keeping, not for unlocking.

**Role**: `player`, `host`, `admin`. What the account may DO. A host can
run rooms for a group; an admin reaches `/geo/admin`.

**Tier**: `free`, `supporter`. What the account has PAID for, which is
nothing: the founder settled it on 2026-09-16, "100% free, no paid
option". The columns and `TIER_BENEFITS` stay because taking them out
means a migration on the database the pet site shares, and the profile
no longer draws a plan card at anybody. Everything the tier used to buy
was a Google limit, and those left with Google.

Role and tier are separate because collapsing them is how "paid for it"
quietly becomes "allowed to moderate". A teacher running a class is a
host on the free tier; somebody who plays daily and pays for it is a
supporter who is still an ordinary player.

Neither is ever sealed into the session cookie. A role inside a token is
a role somebody keeps after it is revoked, and a tier inside one
outlives the month it was paid for, so both are read from the row on
every request. A `tierUntil` in the past is `free` at the moment it
passes, with no job having to sweep anything.

`suspendedAt` is moderation. A suspended account cannot sign in (the
link is still burned, so an old one cannot be clicked twice) and can do
nothing signed in. The browser can still play as a guest, because this
suspends an account rather than banning a person.

### The backend

`/geo/admin`, served by `/api/geo/admin/*` and guarded by
`app/lib/geo/server/admin.js`. Site figures, accounts with role, tier
and suspension, and the rooms being played.

Every route calls `requireAdmin` before it reads anything. The guard
asks the database rather than the cookie, refuses a suspended account
before it considers the role at all, and an admin cannot suspend
themselves out of their own backend. The reads name their columns:
nothing there returns a token hash, a sealed session or a sign-in link.

**The first admin comes from `GEO_ADMIN_EMAILS`**, because only an admin
can promote an admin. It is checked live rather than copied into the
row, so removing an address removes the access.

Covered by `__tests__/geo/roles.test.js` and the harness's `admin`
scenario, which signs in by following a real link and checks that a
player who types the URL is refused and shown why.

## Hosting on another domain

The game is self-contained under `/geo` and `/api/geo` with its own tables,
so it can be a site of its own. The clean way is a second deployment of
this repo (on Render: a second web service from the same repo and branch)
that shares the database, built as the game site:

1. Create the service and point the domain at it.
2. Copy the environment from the pet site (`DATABASE_URL`,
   `GEO_TOKEN_SECRET` or `NEXTAUTH_SECRET`, and the Apple token if one
   is set) and add:

   ```
   NEXT_PUBLIC_SITE=geo
   NEXT_PUBLIC_GEO_SITE_NAME=Probably Earth        # optional, the header's name
   NEXT_PUBLIC_GEO_HOME_URL=https://www.reunitepets.org   # optional, where its ReunitePets link goes
   ```

   `NEXT_PUBLIC_SITE=geo` is read at build time: that build has no pet
   chrome anywhere, the game's header stands in its place, and the
   middleware redirects `/` to `/geo`, the short paths (`/play`, `/rooms`,
   `/room/<code>`, `/share`, `/leaderboard`, `/daily`) into `/geo`, and
   anything that is not the game to the pet site. Rooms, ratings and
   profiles are the same rows on both sites because the database is
   shared.
3. Make a MapKit token for the new origin and add it
   to `NEXT_PUBLIC_APPLE_MAPKIT_TOKEN`, which takes a list; the built-in
   token is locked to reunitepets.org. **One per host**, including the
   `www` form, because Apple matches the origin exactly. Then
   `npm run geo:check-mapkit whereonearth.example www.whereonearth.example`
   to hear it from Apple rather than from us.

Without a second deployment, the pet site can still answer on the game
domain: point the domain at it and set
`GEO_DOMAINS=whereonearth.example,www.whereonearth.example`. Those hosts
get the same redirects as above, but the pages carry the pet site's bar,
because one deployment is one site; the chrome is decided per build, not
per host.

Share cards and room links resolve against the host that served them
(`app/lib/geo/server/siteBase.js`), so previews on the game domain point
back to the game domain.

## The schema reaches the database on its own

The build used to run `prisma generate` and nothing else, which builds a
client that knows the schema and leaves a database that does not have
it. Tables created by the last hand-run of `db push` worked; anything
added since answered with Prisma's P2021, "the table does not exist".
That is how sign-in came to return a 500 on the live site while working
perfectly in development: `GeoLoginToken` had never been created, and
the endpoint said only "internal", so there was nothing to go on.

`frontend/scripts/db-sync.js` runs between `prisma generate` and
`next build`, and three rules keep it safe:

- **Only on a host that deploys this**, or with `FORCE_DB_PUSH=1`. A
  local build and CI both have a `DATABASE_URL` aimed at something that
  is not production, CI's deliberately at a dummy, and neither should
  have a schema pushed at it. The host is recognised by the variable it
  sets for itself: `VERCEL` on Vercel, `RENDER` on Render. Adding a
  third host means adding it to that list in `db-sync.js`, and
  `__tests__/geo/deploy-hosts.test.js` is what stops the list going
  back to naming one.
- **Never `--accept-data-loss`.** Adding tables and columns goes
  through; a change that would destroy something is refused.
- **A failure does not fail the build.** The site still deploys, the
  log carries a banner, and the routes whose tables are missing answer
  `schema_missing` and name the fix rather than saying "internal".

Pointed at a brand new database this creates all 183 tables on the
first deploy, which is what makes a fresh managed Postgres work with
nothing typed into a terminal. Verified by dropping a database,
creating an empty one, and running the whole thirteen-scenario harness
against it.

## Going live

`docs/PROBABLY_EARTH_LAUNCH.md` is the launch checklist: what is
finished, what needs a domain and a mail sender, and the decisions that
block later work. The setup below is how to run it; that document is
whether it can go out.

## Playing it with nothing configured

```
npm run geo:demo
```

No account with anybody, no database, no mail sender, no domain. It starts
the mock metadata server and the dev server, mints a throwaway token
secret, and prints what does and does not work.

**Script mode is the one that plays through to the end with nothing
configured**, and that is deliberate. It normally runs on Apple's map
like the rest of the game, but the MapKit token this repository ships is
locked to the reunitepets.org origin, so here it does not authorize.
When it does not, the round falls back to the world drawn from polygons
the game already ships
(Natural Earth 1:110m, the `world-atlas` package, the same file the
server scores with), one 108 KB chunk of the bundle, cached by the
browser like any other: no key, no quota, nothing fetched from anyone
during a round. That fallback was CARTO's raster tiles until September
2026, when those started coming back stamped "API KEY REQUIRED"; a world
outline with no labels never needed a tile server.

Rooms, ratings, points, the shop and sign-in all work too, on an
in-memory store that forgets everything when the process stops **or when
the dev server reloads a file**. Sign-in links are printed to the log
instead of emailed.

**What cannot work without keys, and why no mock fixes it:**

- **Look Around**, on any origin the MapKit token does not cover. The
  imagery is streamed by MapKit itself, so there is no server response
  to stand in for it. Script mode needs none of this and is the way to
  exercise the round flow without imagery; the browser harness fakes
  MapKit outright and is the way to exercise the rest.

Two things are deliberately weakened in development and nowhere else. A
missing token secret is generated per process rather than refused, and a
missing `DATABASE_URL` falls back to memory. Both say so loudly in the
log, both are `NODE_ENV === 'development'` only, and production still
refuses a missing secret.

## Setup

Two variables, and one of them is optional.

```
GEO_TOKEN_SECRET=...               # seals a round's answer; NEXTAUTH_SECRET is used if this is unset
NEXT_PUBLIC_APPLE_MAPKIT_TOKEN=... # optional: a token for a host the built-in one does not cover
```

A round's answer is encrypted under a key derived from the token secret
(`app/lib/geo/server/tokens.js`), so nothing starts without one.
`/api/geo/config` names it when it is missing, and the setup screen
prints that list verbatim.

Apple: the app loads MapKit JS itself. Look Around arrived in MapKit JS
5.79 and is NOT in the full `mapkit.js` bundle, whatever the version:
that bundle has no Look Around implementation in it at all. The loader
(`app/geo/lib/appleMapKit.js`) asks for `mapkit.core.js` and then
`mapkit.load(['map', 'annotations', 'overlays', 'look-around'])`, which
is the only combination that works. Loading `mapkit.js` and waiting for
`mapkit.LookAround` is how this looked broken three times in one day:
the getter throws rather than returning undefined, so the symptom is a
pane that loads and never draws.

The token has to cover the host the page is served from. MapKit does
not reject a refused token; it loads, the pane is built, and nothing is
ever drawn in it, which is how Apple Maps went dark on `www` while the
apex worked. `/api/geo/mapkit-token` mints one per host at runtime, and
`npm run geo:check-mapkit` asks Apple whether a token authorizes a host
before a deploy has to find out.

There is no Google errand any more. Street View was the other imagery
and is gone (2026-09-16), along with its two keys, its billing account
and its quota caps.

## Local development

Nothing here needs an account with anybody.

```bash
cd frontend
GEO_TOKEN_SECRET=anything-long-enough npm run dev
```

That is a playable game. Rooms, profiles, ratings and points fall back
to an in-memory store when `DATABASE_URL` is unset, and are forgotten
when the process stops; set `DATABASE_URL` to keep them. Look Around
itself needs a token that covers `localhost`, which the built-in one
does not, so without `NEXT_PUBLIC_APPLE_MAPKIT_TOKEN` the panorama will
refuse and say so. Script mode needs no imagery at all and is the way to
exercise the round flow without one.

For a full run of every screen, the browser harness replaces MapKit JS
with a fake, so the imagery is not a dependency:

```bash
npm i --no-save playwright-core                  # not a project dependency
DATABASE_URL=postgresql://... GEO_TOKEN_SECRET=anything-long-enough npm run dev &
node scripts/geo-e2e/run.js                      # BASE_URL, CHROME_PATH, GEO_E2E_OUT optional
GEO_E2E_ONLY=pinGame node scripts/geo-e2e/run.js    # one scenario
```

Fifteen scenarios: the cold open, the admin backend, a pin game with
keyboard shortcuts, a country streak, a timed NMPZ round that runs out,
the mobile map sheet, a two-browser room played to standings and a
rematch, a solo game on Look Around, a room on it, a refused token, the
first-run screen, the daily board, the ranked board, the profile and its
shop, and a script game with and without a map key. The ones that
write to the database need `DATABASE_URL`.

## Terms that shape the design

- Apple's logo and copyright are drawn by Look Around itself and must
  stay visible. The HUD keeps clear of the bottom edge; the corner map
  sits above it.
- Look Around covers city streets in 23 countries and nothing outside
  them, so every mode is a draw from the city list. The line that once
  said the guess map and the panorama had to come from the same company
  went with the other company.

## Files

```
frontend/app/lib/geo/            shared pure modules: random, distance, modes, coverage, share
frontend/app/lib/geo/server/     server only: countries, sampler, streetview, tokens, game, config, ShareCard,
                                 rooms + roomStore/memoryRoomStore, profiles, roundCache, siteBase
frontend/app/lib/geo/rooms.js    room rules (codes, names, duel maths, standings)
frontend/app/lib/geo/rating.js   Glicko ratings
frontend/app/lib/geo/languages.js  the script game's languages, scripts and regions
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
