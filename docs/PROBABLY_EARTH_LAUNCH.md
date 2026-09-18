# Probably Earth: what launch needs

## Current launch gate (2026-09-17)

### Ongoing-goal acceptance ledger

Owner requested an ongoing launch-readiness goal. The PR remains draft and
must not merge until the release is verified. Code, local verification and
production verification are distinct; the historical section is not proof.

| Required journey | Current evidence | Remaining launch gate |
| --- | --- | --- |
| Free guest solo, Street and Script | Script full solo game and replay tested; production Street pin scored | Repeat every mode on final branch, desktop and mobile |
| Fast signup with username and email OR phone | Inline email return and guest-profile binding tested locally; phone provider/unit code exists | Real email and SMS delivery, recovery, failure states, provider setup |
| Stay signed in for at least a week | 90-day cookie, signed-session expiry tests | Persistent production database and restart verification |
| Seamless save/resume, including another device | Account checkpoint and guest local save; new revision conflict guard and account isolation | Final browser save QA plus persistent database, second-device and restart tests |
| Automatic matchmaking | New per-profile durable queue; same-mode pairing, FIFO, 20-second heartbeat lease, atomic pair allocation | Real Postgres concurrency; final desktop/mobile match and reconnect verification |
| Complete Duel multiplayer, Street/Script only | Script three-round match/rematch previously tested; new queue auto-start reached a mobile Script match | Final full match, intentional disconnect/rejoin, Street imagery and rematch QA |
| Intuitive, polished UI | Plain copy, real country flags, clay/ocean/green palette; queue mobile layout inspected | Full-screen visual/accessibility sweep including errors and empty states |
| Security and privacy | Account gates, sealed tokens, rate limits, safe redirect origins, no account mixing | Review final changed endpoints and privacy/schema changes |
| Safe release | Previous pushed commit a371c29 passed CI run 35299171576 | Push final changes; green build/lint/tests; verify deployment before readiness claim |

New work in progress: automatic matchmaking with transactional PostgreSQL
advisory locking, private two-player rosters, server-controlled round advancement,
cancel/expiry/retry behavior, and refreshed account identity. Eleven queue/service
route tests pass. Mobile browser reached an automatically started Script Duel
after contextual signup, and cancel/retry worked. Its timeout flow exposed a
Leaflet NaN animation error caused by padding larger than the small reveal map;
responsive padding is fixed and needs browser re-verification.
The fix was subsequently rechecked in a second mobile matched game: a real
host pin and API-driven peer guess scored, health changed, the reveal map fit
the small viewport, and no Leaflet NaN errors appeared. The chosen signup name
also persisted into the match. The local MapKit origin rejection remains an
expected environment limitation, not a verified Street experience.

Saves now require the account identity and an expected revision. Concurrent
stale writes return a conflict rather than overwriting newer progress. Local
checkpoints have an owner; signed-out visitors and other accounts cannot resume
them. `GeoAccount.savedGameRevision` and `GeoMatchmakingTicket` are additional
additive schema requirements. New changes require final full-suite verification.
Latest full run: 143 suites, 1,510 tests passed, 10 existing todos; the known
worker teardown warning remains. One earlier run hit a SIGSEGV in the unrelated
analyze-pet worker; the subsequent complete run passed including that suite.
Prisma validation passed, and changed-file lint has no warnings or errors.
Browser save QA scored a Script guess at 5,000 points, opened signup without
leaving the result, synced the account checkpoint, and restored the same result
after reload. A signup-return read/write race found during that test now has a
retry and regression test; repeat the complete first-return flow in final QA.

Current external blockers: the authorized Render workspace has 21 services,
none connected to americansalb/petrecovery (rechecked during this goal). The
production service/dashboard link or correct hosting account remains required
for mail diagnosis and deployment. Real SMS provider setup/billing has not been
authorized or activated. These blockers do not stop local implementation/QA.

**Not approved for launch.** The historical assessment below is not a
current end-to-end verification. In particular, a successful email API
response did not produce an email in the owner's inbox.

Work in PR #291 includes contextual email and phone-code signup, 90-day sessions,
guest-profile binding, internal return links, Duel-only setup with Street
and Script choices, Script multiplayer scoring, and account-backed game
checkpoints. These changes are not live until the PR is merged and the
deployment succeeds. The checkpoint adds the nullable `GeoAccount.savedGame`
JSON column; deployment must apply that additive schema change. Phone accounts
also add nullable unique `GeoAccount.phone` and make `GeoAccount.email` nullable.

Evidence from the current local working tree:

- Full-suite baseline after phone signup: 138 Jest suites passed, 1,476 tests
  passed, 10 existing todos. Jest reported an open-handle teardown warning;
  the CI-style two-worker run exited successfully. Later reconnect changes
  have additional targeted tests and require a final full run.
- Full lint passed the repository's 360-warning ceiling.
- Script solo: placed guesses, received scores, returned home, reopened
  the same saved result, continued, finished all five rounds, and reloaded
  the final score unchanged. Mobile replay testing found and fixed stale
  game state when the query string changed.
- Script Duel: server tests cover shared clues, hidden answers, scoring,
  finishing, and rematching. Local browser testing found and fixed blank
  maps after resizing and crashes when timeout guesses have no coordinates.
  A three-round browser match then completed with real host/peer guesses,
  damage, a mobile map drawer, timeout handling, and final standings.
- Production Street: Apple imagery rendered, a pin submitted, the correct
  location was revealed, and score/points were returned.
- A private temporary test inbox also received no sign-in email after
  production reported success. Delivery remains a launch blocker.
- Local existing-account magic-link verification returned to Script room
  setup, retained the player name and rules, and automatically closed the
  signup gate in the original tab. A callback-identity polling race found
  during this test is fixed. Sign-out now refreshes profile labels too.
- Classic is removed from the active rankings and profile choices without
  deleting historical ratings.
- Authentication origins are now allowlisted, so forged forwarded-host
  headers cannot place sign-in tokens in links to an attacker's domain.
  Additional deployments can set `GEO_AUTH_ORIGIN` explicitly.

Do not merge until the entire launch checklist is complete (owner instruction).
In particular, the multiplayer account gate would block new players while
production mail is broken. The owner confirmed Kevin's Render workspace;
its service listing contains neither Probably Earth nor PetRecovery. Access
to the actual production service is still needed. The private test inbox
remained empty on a later check; no additional email was sent to the owner.
- Mail provider error responses are now failures, rather than false success.
- Phone signup uses Twilio Verify, stays in the current game, binds the guest
  profile, and issues the same 90-day session. Eighteen unit/route tests cover
  verification, wrong/expired/reused codes, account isolation, rate limits,
  cookie issuance and provider failure. No real SMS has been sent or billing
  enabled. Phone-only accounts are supported in admin and privacy copy.
- Browser refresh during a Script duel retained the player, clue, health and
  round. A subsequent real guess was scored. Account-based seat recovery also
  preserves health/guesses instead of refusing returning players mid-duel.
- Browser QA found and fixed overlapping Script reaction buttons and a generic
  cup imagery timeout covering the actual MapKit authorization error. The
  single correct authorization error was rechecked in the browser.

Still required before calling the game launch-ready:

- Inspect production mail configuration and provider delivery evidence;
  receive a real sign-in email and complete recovery/return-to-game.
- Confirm the production schema and deploy the changes; test persistent
  saves from a second session/device and session survival across restart.
- Finish desktop/mobile real-browser coverage of Street imagery, Script
  duels, disconnect/rejoin, errors, all challenge/result/profile screens.
- Configure and verify phone signup with a real code. Required variables:
  `GEO_PHONE_SIGNIN_ENABLED=true`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  `GEO_TWILIO_VERIFY_SERVICE_SID`, `GEO_TOKEN_SECRET` and production `REDIS_URL`.
  Use a dedicated Verify service with fraud protection. Production sends fail
  closed without the shared limiter (3 per number and 30 site-wide per ten
  minutes). Do not enable billable SMS without confirming the provider setup.
- Automatic matchmaking is now implemented on the working branch. Finish
  its browser, persistent-database and deployment verification before launch.
- CI and production checks for the final commit must pass.

## Historical assessment (superseded)

Written 2026-09-11 against `pet_main`. `docs/GEO.md` is what the game
does, `docs/PROBABLY_EARTH_SPLIT.md` is how it becomes its own product.
This is only the question "can it go live", answered honestly.

## Try it first, decide later

```
cd frontend && npm run geo:demo
```

Nothing configured: no Google project, no database, no mail account, no
domain. **Script mode is fully playable**: the MapKit token does not
authorize here, so the round falls back to a map drawn from the country
polygons in the game's own bundle. Rooms, ratings, points, the shop and
sign-in all work on an in-memory store; sign-in links are printed to the
log. Street View needs a browser key no mock can replace, because
Google's own SDK draws the panorama. Details in `docs/GEO.md`, "Playing
it with nothing configured".

## The short answer

The original assessment attributed the launch blocker to database schema
drift. Production profile creation subsequently succeeded, so that claim
is not a current diagnosis. Use the current launch gate above.

## What is actually finished

| | State |
|---|---|
| The game itself: seven modes, rooms, ratings, seasons, the weekly cup, points, cosmetics, the daily challenge, ranked solo | code, live on `pet_main` |
| Not Earth: one casual round in two hundred is a NASA panorama from Mars or the Moon, with a button to call it | code |
| Script mode: 159 languages, 34 writing systems, region scoring | code, live on `pet_main` |
| Its own accounts, its own session, its own mailer | code, live on `pet_main` |
| No import in either direction between the game and the pet site | code, enforced by `__tests__/geo/isolation.test.js` |
| Abuse control: the play meter's per-day and per-address ceilings, a speed limit, and a site budget under Apple's account quota | code |
| 1,341 tests, a sixteen-scenario browser harness driven against a real browser and a real database | code |

Driven on a production build, desktop and phone, every route: no page
errors, no horizontal overflow, chrome present, no missing link
previews.

## How it is actually run in production

Two things the audit found by running it rather than reading it, both of
which would have cost an afternoon on deployment day:

- **`npm start` works, and prints a warning saying it does not.**
  `next.config.js` sets `output: 'standalone'`, so `next start` warns
  that it "does not work" with that setting. Checked 2026-09-12 on a
  production build: the lobby, `/api/health`, `/api/geo/config` and a
  `POST /api/geo/round` all answer 200 under `next start`, so Render's
  native start (`npm start`, which is `scripts/boot.js`) is fine as it
  is. The standalone server, `node .next/standalone/server.js` with
  `.next/static` and `public` copied in beside it, is the alternative
  the warning points at, not a requirement. An earlier note here said
  the API routes 404 under `next start`; that did not reproduce.
- **The standalone server does not read `.env` files.** Everything has
  to be in the process environment. A deployment that puts secrets in a
  `.env` and starts the standalone server gets a game that renders and
  then answers 503 to every round. Render's environment variables are
  process environment, so this only bites a hand-rolled deployment.

The whole browser harness passes against the standalone server, and the
route check above was run against `next start`.

## What launch needs from you

### 1. An Apple MapKit token per host. Was blocking. Closed.

Look Around is the imagery (docs/GEO.md, "Apple only"), and Apple
matches a token's origin exactly, so every host that serves a page needs
its own token. A refused token does not throw: MapKit loads, the pane is
built, and nothing is ever drawn in it, which is why this was invisible
until somebody checked.

It was genuinely broken on 2026-09-14: the shipped token was minted for
the apex, the apex 301s to `www` at Cloudflare, and Apple answered `401`
to `www`, so every Apple surface on the live site was blank.

The server now mints a token per host at request time
(`/api/geo/mapkit-token`). Asked of Apple directly on 2026-09-16, with
the token each host actually serves:

```
www.reunitepets.org       200 authorized
probablyearth.com         200 authorized
reunitepets.org           301 to www, serves no page
www.probablyearth.com     301 to the apex, serves no page
```

Both hosts that serve the game are authorized, and the two that are pure
redirects never need a token. Nothing to do here.

Re-run `npm run geo:check-mapkit` after any change to a domain, a
redirect or the token. It is the only check that can answer this
question, because the failure is silent.

### 1b. Google keys. No longer needed.

Founder direction, 2026-09-16: the game is **Apple only**. Google Street
View is gone, and with it the play meter's allowance, the bought rounds,
the site's Google budget and the three modes only its imagery could do
(City streets, Everywhere, Kidnapped).

The reason is cost, and it is not close. Apple Look Around is not billed
per view: it runs under Apple's daily account quota, so a round costs
nothing to serve. Google's Dynamic Street View is 5,000 free panorama
loads a month and then $14.00 per thousand, which at three hundred daily
players is about $560 a month, forever, growing with success. Apple at
the same size is $0.

What Apple's cars never reached is covered by Script mode, which needs no
imagery, no key and no quota at all.


### 2. Where it lives. Answered.

**probablyearth.com** (founder, 2026-09-16: "this is not a nonprofit, I
already transferred it to probablyearth.com"). Checked live on the same
day: `probablyearth.com/` redirects to `/geo`, the short paths redirect
into the game, and the host has a MapKit token Apple authorizes.

`/geo` still works on `www.reunitepets.org` and serves the same game off
the same rows, which is the only part of D3 that was ever a real choice.
Nobody has said whether that should eventually redirect to the game's own
domain; nothing depends on the answer, and it is one line whenever it is
wanted.

### 3. A mail sender. Blocking for accounts, not for play.

`RESEND_API_KEY` and `GEO_MAIL_FROM`. Without them sign-in links are
written to the server log instead of sent, which is right for
development and wrong for a launch: nobody can sign in. Anonymous play
is unaffected.

The sender address needs a domain you control and its DNS records, or
the mail lands in spam.

### 4. Two decisions that cost nothing to make and block work later

- **D2, do existing players carry over.** There are rows in the pet
  database now. Clean start or copy? Copying is a day's work and has to
  happen before the game's database is split, not after.
- **Whether ranked integrity is wanted at all.** Bet 1 in the strategy
  document. If yes, the cheap reversible step is recording behavioural
  signals on rounds now, changing nothing, so there is data to design
  against later. If no, say so and I will stop proposing it.

## What I would do before launch, given the keys

In order, and each is useful even if the next never happens.

1. **Measure photo-sphere density with a live key.** Half an hour. It
   decides whether Everywhere is a mode or a footnote, and I have never
   been able to run it: this environment has no key and the proxy blocks
   the endpoint.
2. **A phone pass on the play screen.** The audit above says the lobby
   and the other pages are clean at 390px. The round itself is the one
   screen I would want a real device on, because a map and a panorama
   fighting for a small viewport is where this genre's competitors are
   worst and where the largest audience is.
3. **Watch the meter for a week** with real traffic before widening any
   limit.

## What is deliberately not done

- **Phases 3 to 6 of the split**: separate database, separate
  repository, cutover, decommission. None of it blocks a launch at
  `/geo` or on a domain pointed at this deployment. All of it blocks
  calling the game a separate product.
- **Ranked script rounds.** Unranked while the corpus is a starting pool
  rather than a curated one; rating people on content still being
  written puts noise in the ladder.
- **The audio language game.** Needs recordings, which needs AALB
  capacity nobody has confirmed.
- **The strategy bets**: verified ladder, satellite mode, the India
  pack. All are after a launch, not before one.

## The honest summary

The domain is bought and live, the MapKit tokens are authorized on every
host that serves a page, and Google is gone along with the project, the
caps and the bill. What is left is a mail sender, without which nobody
can sign in, and two decisions that block later work rather than launch.

One thing in the code's way, and it is not the code: **the production
database is behind this schema**, so creating a play profile 500s for
every visitor. Reads work, which is why it looks like one broken
feature. The deploy that carries this branch will name the column in the
error and print the missing SQL in the `[db-sync]` banner; until then
ranked, the daily and the cup cannot be played live, because all three
are scored as somebody.
