# PetRecovery / ReunitePets

Next.js 14 app-router app in `frontend/` (JavaScript, Prisma + PostgreSQL,
NextAuth, Tailwind, Leaflet). Naming history: Case = Mission = lost-pet report;
RescueSquad → RescueForce; the forum is "the Hub" (`ForumThread` etc.);
`/communities/*` is legacy and redirected in `frontend/next.config.js`.

Orientation: `docs/APP_MAP.md` maps every route, API domain, data model,
auth layer, and open gap; `screenshots/README.md` indexes full-page captures
of every route (regenerate with `frontend/scripts/gallery-sweep.js`).

## Rules

### Link previews are mandatory on shareable routes

Any route a user might paste into a chat must serve entity-specific
OpenGraph tags (the pet's photo, not the site logo). Preview bots don't run
JS, so `'use client'` pages can't do this — shareable routes need a server
`page.js` with `generateMetadata` (entity pages) or a server `layout.js`
with `metadata` (static segments), built on the helpers in
`frontend/app/lib/shareMetadata.js`.

Full recipe and house rules: `docs/LINK_PREVIEWS.md`.
Enforced by `frontend/__tests__/link-previews.test.js` — it fails CI on any
new dynamic route that lacks metadata and isn't explicitly listed as private.

### The universal navbar never changes between pages

The global chrome (top bar + mobile tab bar) is identical for EVERY
PERSON on EVERY ROUTE: same height, same CTA, same links, rendered from
the frozen `CENTER_LINKS` array. It never varies by route, by sign-in
state, by shelter membership, or by anything else; the only
session-dependent slot is Sign in/Join vs the account menu, and
anything person-specific belongs in that menu. A bar that rearranges
itself as the user moves around reads as broken (founder rule,
2026-07-27: the Owner/Searcher "hat" chrome was deleted for exactly
this reason - do not reintroduce it in any form).

Two permitted variations: pages may add SUBTABS below the bar
(`sticky top-16`, never their own `sticky top-0` bar), and the whole
bar may be removed inside an immersive takeover - but every immersive
route must ship a visible way back out. That list lives in ONE place:
`frontend/app/lib/navChrome.js`. Full policy: `docs/APP_MAP.md` §8.2.
Enforced by `frontend/__tests__/global-chrome.test.js`.

Related trap: `overflow-x` on `html`/`body` must stay `clip` — `hidden`
silently breaks `position: sticky` site-wide, including the navbar.

### Site copy is written plain, never "AI slop"

Founder rule. Headlines name the thing ("Medical records"); bodies say
concretely what it does, in ordinary sentences. Banned: comma-quip titles
("Stray holds, tracked"), metaphors that need decoding ("a desk that
catches things"), anthropomorphized product ("the portal tells you"),
adverb varnish ("quietly", "seamlessly"), fragment-chain rhythm, and any
claim we can't back ("it ranks on Google"). No em dashes in frontend
source. When in doubt, write it the way a shelter director would say it
to a coworker.

Copy states facts, never constraints on the business. Say what the
product does and what it costs today. NEVER volunteer what the company
will never do: no "always/forever free", no "no ads", no "we don't sell
your data", no "there is no paid tier", no promise about what future
charges may look like. Those bind the founder from a marketing page,
and he has not asked for a single one of them (rule hardened
2026-07-27, after invented no-ads and free-forever promises shipped
live and were then cited back as policy in `MONETIZATION.md`).
Pricing claims are present tense: "free, no card", "what shelters pay:
$0". This binds the Terms of Service too, where such a promise would
actually be enforceable, and it binds `MONETIZATION.md`: record what
the founder decided, never a guardrail invented while writing.
Commitments the company genuinely makes live in `/privacy` and
`/legal/terms`, deliberately, not scattered through marketing copy.

The same law governs form and volume: nobody reads feature prose. Show
the actual product (a real screen, not icons), keep lists scannable (a
few words per line), and spend full sentences only where trust demands
them. Grids of interchangeable icon-badge cards are slop furniture; do
not build them.

### A search is ground in areas, never a list of streets

Founder rule, 2026-11-12, on the street board: "Shouldn't it be a RADIUS
not streets? pets don't tend to follow infrastructure seems like a
fundemental misunderstanding". A lost pet can be in a yard, under a deck,
in a shed or on a creek bank, so the search is a circle of ground around
where the pet was lost, cut into areas (`frontend/app/lib/searchCircle.js`,
`frontend/app/lib/searchZones.js`). Streets are landmarks for finding an
area and for naming a sighting's corner. Do not hand out streets to walk,
count streets walked as progress, or call ground "done": an area is
searched once, twice, and so on, by whoever was on it. Several people can
search one area; the one exception is the circle round a sighting, which
one person goes to. Full description: `docs/APP_MAP.md`, the
`/mission-control` row and the board route.

### "Searched" is a record, and it fades

Founder, 2026-11-13: "You can mark an area as searched but never know when
it was searched etc? does it not fade over time?" and "A real search and
rescue team would find this superficial and comical ... You are not trying
hard enough to put yourselves in the shoes of the complex S&R team". Think
as the person running the search: for every search of every area they need
when, who, how long, how much of it was covered and what could not be
reached, and ground a pet can walk back onto does not stay searched. So
every search is kept (`SearchZoneVisit`, outcome SEARCHED or MARKED), the
helper is asked for a debrief on the card that says thank you, the area's
card lists its searches, and the green everywhere is drawn from
`searchStrength` in `frontend/app/mission-control/lib/ground.js`: it falls
to nothing over 24 hours and is less for a short or partial search. Never
show a bare "searched" without its age, never draw a search as permanent,
and never show the estimate as a number or a probability. Before adding a
feature to Mission Control, ask what a search manager would need to decide
the next move, not what looks complete. Enforced by
`frontend/__tests__/lib/searchRecord.test.js`.

### The plan follows the animal

Founder, 2026-11-13: "put yourselves in the shoes of the complex S&R team".
A team does not run the same search for every subject. The report asks the
species and how the pet is with people, and the search uses the answer:
`frontend/app/lib/brief.js` tells a helper not to call a dog unless the
owner called it friendly, and `frontend/app/lib/searchPlan.js` puts the
tasks that suit the animal first (a wary dog: sightings, a feeding station,
a camera, a trap, few people on foot; a cat: the nearest yards). Tasks are
`SearchTask` rows of the search itself, shown on the desk's Tasks tab.
Where a station or a trap is goes only to whoever runs the search and a
force looking for the pet. New advice for a search is added to those two
files with its source, never written into a screen, and no tactic is said
to work. A task comes with what the site already made for the pet
(founder, 2026-11-13: "Door to door people need to give the flyer, no? Why
are we acting as though all these assets cannot assist in the mission
control"): `gearFor` in `searchPlan.js` puts the kit's flyers, share
pictures, post words, shelters and local groups (`frontend/app/lib/searchKit.js`)
on the task that uses them, and the place is asked in the task's own words
("Which streets", never "Where it is" for door to door). Before adding a
task or a step to Mission Control, look for what the site already has for
it and put it on the task. Flyers, posts and door to door are shown to the
people helping, with the same files, once they are on the list. Enforced by `frontend/__tests__/lib/searchPlan.test.js` and
`frontend/__tests__/lib/jobs.test.js`.

### Sarama guides, and helping is a game

Founder, 2026-11-13: "one of the things we are missing is our mascot
Sarama, beautifully guiding everyone. This has to feel like a fun game and
drive engagement, not feel like a chore." Sarama, the search dog, is on
every card a helper sees and is the one voice on the search screen that
speaks as "I" (the rule against a talking product does not cover her). Her
lines are all in `frontend/app/mission-control/lib/sarama.js`: short, warm
and plain, no puns, no promise that a search works, nobody hurried. What
she says must be useful (founder, 2026-11-13: "seems like you designed her
to get in the way ... make the text actually useful and teaches people
where to look"): to a newcomer their own home first and what to do on
seeing the pet, to a helper on an area where to look and whether to call,
all of it the brief's own words. To whoever runs the search she says the
next step from the plan, and never "nothing is waiting for you": their pet
is still missing. She does not greet a desk. How to search stays the
brief's and the training's. The game is
`frontend/app/lib/trail.js`: paw prints for an area searched and for its
debrief, ranks, and one goal the whole team sees, keeping the map green.
It pays only for what helps a search: nothing for speed, for the answer
given in a debrief, or for going near the animal, and there is no board of
who has the most. To the person running the search she is calm and nothing
cheers, because their pet is missing. She is drawn in poses, one for each thing she does
(`frontend/app/mission-control/lib/saramaArt.js`; founder, 2026-11-13: "You
can redraw her using claude design and make dynamic images"): sitting when
she talks, head tilted when she asks, a paw lifted when she sends someone
somewhere, nose down when she says where to look, paws up when something is
done. A new pose is added there and to the canvas "Sarama, redrawn", with
the same vest and headlamp. The brand picture on the rest of the site is
still `frontend/public/brand/sarama-480.png`. Enforced by
`frontend/__tests__/lib/trail.test.js`.

### The search never sends anyone into danger without saying so

Founder rule, 2026-11-12: "Are we inadvertantly telling people to search in
ponds, or dangerous neighborhoods, near the highway, distracting them from
traffic? We need to be careful about that". An area is cut by distance and
direction, so it can hold a highway, a rail line or a creek. The site reads
main roads, rail lines and water from the map
(`frontend/app/lib/searchHazards.js`) and the card that gives someone an
area names them with what to do. That is the only caution a card carries,
and only where the map shows something (founder, 2026-11-13: "If you put
too many warnings you are putting the idea in people's heads. That is part
of the reason you put it kinda tucked away in waiver no one reads"). Do not
add a standing caution or a disclaimer to a card: how to search is said
once in the training, and what the site is not is said in the waiver.
Words that say where to look send people to public ground: the
sidewalk, a path, and a yard, shed or garage only after asking at the door.
Never write copy that sends a stranger onto private property, into water,
onto a road or a rail line, or that asks them to look at the phone while
moving. Never say or imply that ground is safe, and never say the map shows
nothing in an area: the map can be wrong, and the waiver is where that is
said (founder, 2026-11-13: "Now we are liable for having accurate info?").
Do not rate neighbourhoods. Enforced by
`frontend/__tests__/lib/searchHazards.test.js`.

### The waiver is asked for the text as it reads today, and the training is never called optional

Founder, 2026-11-12: "We need to find a stronger way to remove any
liability. I know the waiver and maybe a bit of optional training on
rescue? but not say its optional". The waiver is
`frontend/prisma/legal/liability-waiver.js`; change its text only with a
version bump, which asks everyone again (`frontend/app/lib/waiverVersion.js`).
Every agreement writes a `WaiverAcceptance` row and that table is proof:
never edit or delete rows. The join card carries the tick, the text one
tap away and the button; it does not print the release on the card
(founder, 2026-11-13, the words above). "Before you go out" follows the tick as a step everyone passes
through: no "optional", "skip" or "later" on it, and nothing on the server
refuses a search for want of it. No wording here has been reviewed by a
lawyer; do not tell anyone it removes liability. Enforced by
`frontend/__tests__/lib/waiver-strength.test.js`.

### On a flyer, a line that has to be read whole always fits its box

Founder, 2026-11-13, holding a flyer whose email ran across the QR code:
"do I need to individually inspect every PDF this should not even be
possible". Nobody inspects each PDF, so the layout has to make it
impossible. A phone number, an email or a link is one word: it cannot wrap
and must not be cut, so its size has no floor (`wholeInter`,
`wholeUnbounded`, `wholeLine` and `planContact` in
`frontend/app/lib/cascade/render/flyers/plan.js`, used by the sheets and
the share pictures alike). Never give such a line a minimum size, and never
size one from a guessed letter width: the widths come from the font files.
Bump `RENDERER_VERSION` when the drawing changes, so open searches are
redrawn. Enforced by `frontend/__tests__/lib/flyer-fit.test.js`, which
measures the real fonts.

### The site's address is built in, never configured

Every absolute URL the pet site produces (email and SMS links, flyer QR
codes, canonical and OpenGraph tags, the sitemap, NextAuth's redirects and
cookies) comes from `getBaseUrl()` in `frontend/app/lib/config.js`: `SITE_URL`
from `frontend/app/lib/brand.js` everywhere except `next dev`. Never read it
from `NEXTAUTH_URL`, `NEXT_PUBLIC_BASE_URL`, `RENDER_EXTERNAL_URL` or any other
setting, and never fall back to localhost. Before launch, `NEXTAUTH_URL`
named the Render hostname (every reset link and QR code went to
petrecovery.onrender.com) and an unset `NEXT_PUBLIC_BASE_URL` put localhost
in every canonical tag. `auth.js` hands the address to NextAuth; the game has
its own built-in domain in `app/lib/geo/meta.js`. Enforced by
`frontend/__tests__/site-address.test.js`.

### Other conventions

- Tests: `cd frontend && npm test` (Jest, node env). CI runs on `pet_main`.
- Merge policy (founder instruction, 2026-08-31: "always merge"): when a
  branch's work is complete and CI is green, merge its pull request into
  `pet_main` without waiting for a second go-ahead.
- Dev DB: local Postgres via `DATABASE_URL` in `frontend/.env` /
  `.env.local`; `frontend/prisma/seed-sample-data.js` creates a local admin
  (`admin@localdev.test`) and demo entities for every page.
- Seeded prod admins are auth-blocked (SEC-18) in `frontend/app/lib/auth.js`;
  don't "fix" that, and never seed literal credentials.
