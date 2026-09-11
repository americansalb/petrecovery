# Splitting WanderGuesser out of ReunitePets

The guessing game at `/geo` is finished enough to stand on its own, and
it should. This is the plan to make it a separate product: its own
repository, its own database, its own accounts, its own deployment,
with no code path in either direction between it and the pet site.

Written 2026-09-10 against `pet_main` at 60db297. Read `docs/GEO.md`
first for what the game actually does; this document is only about the
separation.

## 1. Where it stands today

The game is already isolated by convention. It lives in three
directories, no pet page imports it, and no geo table has a foreign key
into a pet table. That is why the split is a move rather than a rewrite.

| Area | Lines | What it holds |
|---|---|---|
| `frontend/app/geo` | 5,445 | Pages, the play and room clients, the HUD, maps |
| `frontend/app/lib/geo` | 5,142 | Game rules, sampler, stores, meter, ratings, points |
| `frontend/__tests__/geo` | 2,485 | Unit tests |
| `frontend/app/api/geo` | 616 | Ten route handlers |
| `frontend/scripts/geo-e2e` | 514 | Browser harness with a fake Google SDK |
| Total | 14,202 | |

It is not standalone in five ways: it imports seven modules from the pet
app, the pet app names it in three places, its sixteen tables live in
the pet schema and the pet database, its identity is a ReunitePets
account, and every page says ReunitePets.

## 2. Decisions needed before any code moves

These five change the work. My recommendation is on each. Nothing in
phase 1 depends on decisions 2 to 5, so that phase can start on decision
1 alone, and decision 1 only gates the last pull request in it.

### D1. What is an account on the standalone site

Today a player is an anonymous row keyed by a hashed browser token,
optionally bound to a ReunitePets account through `GeoProfile.userId`.
That binding cannot survive the split.

| Option | What it means | Cost |
|---|---|---|
| A. Anonymous only | Browser token, no sign-in ever | None. Loses cross-device play and any way to recover a profile |
| B. Own email sign-in | NextAuth email provider, magic link | Small. Resend is already a dependency |
| C. Own OAuth plus email | Google and Discord buttons, magic link as a fallback | Medium. One more provider to register |

**Recommended: C.** Competitive guessing players live on Discord, the
leaderboard is worth signing in for, and NextAuth links providers to one
account later without a data change. B is a valid smaller first step;
going B then C costs nothing extra.

**Answered 2026-09-10 (founder): a standalone account means one not
connected to ReunitePets.** Built as B, which is C without the OAuth
buttons: the game issues its own emailed sign-in links and its own
sealed session, and `GeoProfile.accountId` replaces the old
`GeoProfile.userId` binding to a pet user. Adding Google and Discord
later is two provider registrations and no data change, so the choice
between B and C stays open. See docs/GEO.md, "Signing in".

### D2. Do existing players carry over

| Option | What it means |
|---|---|
| A. Clean start | The new database begins empty. Ratings, points and badges reset |
| B. Copy everything | Profiles, ratings, seasons, points, badges, ledger, challenge entries, match results, room history |
| C. Copy identity and economy | The same as B without room and round history, which nobody reads after the game ends |

**Recommended: run the row counts on production first, then almost
certainly A.** If there are under a few hundred profiles, a clean start
with a note on the lobby is cheaper and safer than a migration. If the
counts say otherwise, take C. The query to run is in section 7.

### D3. Repository and hosting shape

| Option | What it means |
|---|---|
| A. New repository | `wanderguesser`, its own host project, its own Postgres, its own CI |
| B. Monorepo | Two apps in `petrecovery` sharing packages through npm workspaces |

**Recommended: A.** B keeps exactly the coupling this split exists to
remove, and it means every pet deploy risks the game.

### D4. Does `/geo` keep working on reunitepets.org

**Recommended: no, after a permanent redirect.** Share links already
posted (`/geo/share?s=...`) must not break, so the pet app keeps a
permanent redirect for `/geo/*` forever. Everything else about the game
leaves the pet deployment.

### D5. Google and Apple keys

Today both sites draw on one Google Cloud project and one MapKit token.

**Recommended: a separate Google Cloud project and MapKit key for the
game**, so the game's spend and quota cannot touch the pet site's, and
so the browser key can be restricted to the game's domain only. The play
meter already caps usage, but one billing line per product is the point
of a split.

## 3. The wire inventory

Everything that has to be cut, found by reading every import in the geo
tree and every reference to geo outside it.

### 3.1 Outward: the game importing the pet app

| Wire | Imports | What the game actually uses | Replacement |
|---|---|---|---|
| `@/app/lib/rateLimit` (651 lines) | 6 | `RateLimitPresets`, `rateLimitResponse`, `withRateLimitAsync`, `checkRateLimitForKeyAsync`, `getClientIP` | Own limiter, roughly 120 lines, same in-memory and Redis shape |
| `@/app/lib/shareMetadata` (216) | 5 | `shareMetadataBase`, `buildShareMetadata`, `genericShareMetadata`, `FALLBACK_SHARE_IMAGE` | Own, roughly 80 lines. `SITE_NAME` becomes the game's |
| `@/app/lib/auth` (439) | 3 | `authOptions`, and only ever reads `session.user.id` | Own NextAuth config (D1) |
| `@/app/lib/prisma` (TypeScript) | 2 | The client singleton | Own, 12 lines, written in JavaScript |
| `@/app/lib/navChrome` (68) | 2 | `isGameSite()` | Deleted. The standalone site is always the game |
| `@/app/lib/maps/appleMapKit` (539) | 1 | `initializeMapKit` | Own loader. The game needs the loader, not the pet map wrappers |
| `@/app/lib/cascade/render/fonts` | 1, dynamic, in the OpenGraph route | `SATORI_FONTS`, `RESVG_FONT` | Own font bundle |

The important fact in that table is the third column. The game uses a
narrow slice of every one of these. Nothing needs porting wholesale.

### 3.2 Inward: the pet app naming the game

| Site | What is there |
|---|---|
| `frontend/middleware.js` | Ten geo rate-limit entries, a Content Security Policy allowance for the Maps hosts, and the whole `gameSite` host-routing branch, roughly 40 lines |
| `frontend/app/lib/navChrome.js` | `/geo/play` and `/geo/room` inside the frozen `IMMERSIVE_ROUTES` array, plus the `SITE` and `isGameSite` flag |
| `frontend/__tests__/global-chrome.test.js` | Geo assertions and the frozen-array check |
| `frontend/__tests__/link-previews.test.js` | `geo` in the route list |

### 3.3 Data

Sixteen tables, 284 lines inside a 6,076-line schema, in the same
Postgres, applied by the same `prisma db push` in `scripts/boot.js`.

`GeoRoom`, `GeoRoomPlayer`, `GeoRoomRound`, `GeoRoomGuess`,
`GeoRoundCache`, `GeoUsage`, `GeoProfile`, `GeoLedger`, `GeoUnlock`,
`GeoBadge`, `GeoChallengeRound`, `GeoChallengeEntry`,
`GeoChallengeFinal`, `GeoRating`, `GeoSeasonRating`, `GeoMatchResult`.

The one piece of good news that makes phase 3 tractable:
`GeoProfile.userId` is a plain `String? @unique`, not a foreign key, and
the `User` model has no geo relation at all. The link between a player
and a ReunitePets account is soft. Cutting it is a column change, not a
schema surgery.

### 3.4 Brand

| Where | What |
|---|---|
| `app/geo/layout.js`, `share/page.js`, `room/[code]/page.js` | Page titles ending in `| ReunitePets` |
| `app/geo/components/GeoFooter.js` | "Made by ReunitePets" and the link home |
| `app/geo/components/GeoHeader.js` | The ReunitePets link as the way out |
| `app/lib/geo/server/siteBase.js` | Defaults to reunitepets.org |
| `app/lib/geo/server/tokens.js` | The answer-token key is salted `reunitepets-geo:` |
| `app/geo/lib/googleMaps.js` | Two `window.__reunitepets*` callback names |

### 3.5 Dependencies

Only `world-atlas` and `topojson-client` are the game's alone. `satori`
and `@resvg/resvg-js` are shared with the pet site's social cards and
the rasuwa scripts, so the new repository installs its own copies rather
than taking them away.

## 4. Target architecture

```
wanderguesser/                       (new repository)
  app/
    (game)/            was app/geo,        served at /
    api/               was app/api/geo,    served at /api
    lib/               was app/lib/geo, plus the seven replaced modules
  prisma/schema.prisma  the sixteen tables and the new account tables
  scripts/e2e/          was scripts/geo-e2e
  __tests__/
  middleware.js         own rate limits, own CSP, no host routing

petrecovery/                         (unchanged except for removals)
  frontend/app/geo          deleted
  frontend/app/api/geo      deleted
  frontend/app/lib/geo      deleted
  frontend/middleware.js    geo entries deleted, one permanent redirect kept
  frontend/prisma           sixteen tables dropped after the retention window
```

## 5. The phases

Every phase before 4 happens inside the current repository and ships
through the existing CI as ordinary pull requests. That is deliberate.
By the time anything moves, the game has no wire left to cut, so the
extraction is a file move with history rather than a rewrite under time
pressure.

### Phase 1. Sever the outward wires. Done.

Each one adds a module the game owns, switches the game's imports to it,
and leaves the pet app's copy untouched. Nothing the pet site uses
changes, so each is independently safe and independently revertable.

Shipped as one pull request with a commit per wire rather than seven
pull requests: they are all the same mechanical change inside one
isolated tree, they share a verification run, and `git revert` on a
commit undoes one wire exactly as reverting a pull request would.

| | New module | Replaces | Notes | State |
|---|---|---|---|---|
| 1.1 | `app/lib/geo/server/db.js` | `@/app/lib/prisma` | Own singleton, JavaScript, reads `GEO_DATABASE_URL` and falls back to `DATABASE_URL`. `GEO_DB_POOL` caps the game's pool | done |
| 1.2 | `app/lib/geo/server/limiter.js` | `@/app/lib/rateLimit` | The five functions the game used, same result shape, same preset numbers. Redis then memory; no database tier, see below | done |
| 1.3 | `app/lib/geo/meta.js` | `@/app/lib/shareMetadata` | Same card shape without the pet photo helper. Name and fallback image are env-driven and default to today's values | done |
| 1.4 | `app/geo/lib/appleMapKit.js` | `@/app/lib/maps/appleMapKit` | The loader only. Authorization is guarded by a window flag so a remount cannot authorize twice | done |
| 1.5 | `app/lib/geo/server/fonts/` | `@/app/lib/cascade/render/fonts` | The three Inter weights the card actually uses, vendored with their licence | done |
| 1.6 | `app/lib/geo/site.js` | `@/app/lib/navChrome` | `isGameSite()` moves in, plus the route constants phase 2.2 has the pet app read back | done |
| 1.7 | `app/lib/geo/server/identity.js` | `@/app/lib/auth` | D1 answered 2026-09-10: a standalone account is not connected to ReunitePets, so the standalone answer went in now rather than at phase 4. The game issues its own sealed session and owns its own accounts (docs/GEO.md, "Signing in") | done |

Two things changed on purpose rather than being copied across.

**The limiter has no database tier.** The pet limiter falls back Redis,
then a database table, then memory. The game's goes Redis, then memory.
What these limits protect is pace, not spend: the thing that stops the
game costing money is the play meter, which counts every round in
Postgres and survives a restart. Losing a burst cap on deploy is an
inconvenience; losing the meter would be a bill. Set `REDIS_URL` and the
burst cap is durable too.

**The game opens its own connection pool.** Until phase 3 that pool
points at the same Postgres as the pet app, so the server carries two
pools instead of one. `GEO_DB_POOL` caps the game's side where the
server's connection limit is tight. Phase 3 removes the overlap.

**Exit criteria, met.** The guard test `__tests__/geo/isolation.test.js`
walks every file under the game's five directories, reads its static
imports, dynamic imports and requires, and fails on any path that leaves
the game except an npm package or a Node builtin. Its allowlist is now
empty, and a further test asserts that it stays empty so it cannot
quietly grow. A fifth test covers the wire that an import walk would
miss: `useSession()` and `getServerSession(authOptions)` are the same
tangle wearing a different hat, since next-auth is an npm package, so
reading the pet site's session in any form fails the build. This is the same
enforcement the repository already uses for link previews and the
navigation bar, so it will outlast the split.

**Verification.** `npm test`, the browser harness across all eight
scenarios, and a production build, on each pull request.

**Rollback.** Revert the single pull request. No data or infrastructure
has changed at this point.

### Phase 2. Sever the inward wires. Two pull requests.

| PR | Change |
|---|---|
| 2.1 | The ten geo rate-limit entries and the Maps CSP hosts move into `app/lib/geo/site.js` as exported constants; `middleware.js` imports and spreads them. One named wire instead of fourteen scattered lines, and deleting it later is one line |
| 2.2 | `navChrome.js` takes the immersive route list from the geo constant instead of hard-coding `/geo/play` and `/geo/room`; `global-chrome.test.js` and `link-previews.test.js` assert through the same constant |

**Exit criteria.** `grep -rn "geo" frontend/middleware.js frontend/app/lib/navChrome.js` returns only the two import lines.

### Phase 3. Split the data. Three pull requests.

This is the phase with real risk, so it is split fine.

| PR | Change |
|---|---|
| 3.1 | A second Prisma schema, `prisma/geo.schema.prisma`, holding only the sixteen tables, with its own generator output and its own `GEO_DATABASE_URL`. Both schemas can still point at the same database, so nothing moves yet |
| 3.2 | `app/lib/geo/server/db.js` uses the new generated client. The pet schema keeps the geo tables for now, unused by the game. Deploy and confirm the game runs entirely through its own client |
| 3.3 | The account change from D1. `GeoProfile.userId` becomes a relation to the game's own account table. Behind a flag until phase 5 |

**Exit criteria.** The game reads and writes only through its own client,
the schemas are independent files, and pointing `GEO_DATABASE_URL` at an
empty database gives a working game with no players.

**Verification.** Point `GEO_DATABASE_URL` at a fresh local database,
run the browser harness end to end, and confirm no query touches a pet
table. Then point it back.

**Rollback.** 3.1 and 3.2 are revertable. After 3.3, rolling back means
restoring the column, which is why it stays behind a flag.

### Phase 4. Extract the repository. One move, then a skeleton.

1. `git filter-repo` over the five geo paths into a new repository so
   every commit and every blame line survives. Do not copy files by
   hand; the history is the record of why the code is shaped this way.
2. A Next 14 app skeleton around it: own `package.json` with only the
   dependencies the game imports, own `tailwind.config.js` carrying the
   `midnight` and `flash` palettes, own `middleware.js`, own root
   layout, own `jest.config.js` with the same `@/` alias.
3. Routes move up: `app/geo/*` becomes `app/*`, `app/api/geo/*` becomes
   `app/api/*`. The `/geo` prefix disappears from every internal link.
4. Brand: titles, footer, header, `siteBase.js`, and the token salt.
5. The harness moves to `scripts/e2e` and its documentation moves with
   it.
6. CI: the same four checks the pet repository runs.

**Deliberately not done here:** renaming the internal `geo` namespace to
`wanderguesser`. Renaming 14,000 lines of imports during an extraction
buys nothing a user can see and destroys the diff. If it is wanted, it
is a separate cosmetic pull request afterwards.

**Exit criteria.** The new repository builds, its tests pass, and the
harness plays a full game against a local database with mocked Street
View, with the pet repository untouched.

### Phase 5. Cut over.

1. Deploy the standalone app to a staging domain and play it, including
   a two-browser room and a paid round.
2. If D2 says copy, run the copy into the new database and check row
   counts table by table.
3. Point the game's domain at the new deployment.
4. The pet app answers `/geo/*` with a permanent redirect to the game
   domain, keeping the path so share links survive.
5. Delete `app/geo`, `app/api/geo`, `app/lib/geo`, `scripts/geo-e2e`,
   `__tests__/geo`, the middleware entries, the navChrome entries and
   the geo environment variables from the pet repository.

**Freeze window.** Between steps 2 and 3, the game is read-only. It is
short, and the daily challenge boundary at midnight UTC is the natural
moment.

**Rollback.** Until step 5, pointing the domain back at the pet
deployment restores the old game exactly. Step 5 is the point of no
return, so it lands as its own pull request a few days later.

### Phase 6. Decommission.

After a retention window of at least thirty days, and after confirming
the new database holds everything: drop the sixteen tables from the pet
database, remove `world-atlas` and `topojson-client` from the pet
`package.json`, and update `docs/APP_MAP.md`, `docs/GEO.md` and
`CLAUDE.md` to say the game lives elsewhere.

## 6. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Public share links break | Certain without action | High. Every posted result becomes a dead link | The permanent redirect in 5.4 is not optional and is never removed |
| Player data lost at cutover | Low | High if anyone has a rating they care about | D2 decided from real row counts, copy verified table by table, freeze window |
| In-flight answer tokens break | Certain at cutover | Low. A round is minutes long | Carry `GEO_TOKEN_SECRET` to the new deployment, or accept that rounds in progress during the switch end |
| The game's sixteen tables get dropped from the pet database before the copy is verified | Low | Total | Phase 6 is a separate pull request gated on a written row-count comparison, at least thirty days after phase 5 |
| Two Google projects double the setup work | Certain | Low | It is the point of D5, and the meter's caps carry over as environment variables |
| The pet app's CI slows the split | Low | Low | Phases 1 to 3 are ordinary pull requests that pass the same four checks |
| Scope creep during extraction | Medium | Medium | Phase 4 forbids the namespace rename and any feature work. The extraction changes no behaviour |

## 7. What to gather before starting

Run against production, read-only:

```sql
SELECT
  (SELECT count(*) FROM "GeoProfile")        AS profiles,
  (SELECT count(*) FROM "GeoProfile" WHERE "userId" IS NOT NULL) AS linked_accounts,
  (SELECT count(*) FROM "GeoRating")         AS ratings,
  (SELECT count(*) FROM "GeoMatchResult")    AS rated_games,
  (SELECT count(*) FROM "GeoChallengeEntry") AS challenge_entries,
  (SELECT count(*) FROM "GeoLedger")         AS ledger_rows,
  (SELECT count(*) FROM "GeoBadge")          AS badges,
  (SELECT count(*) FROM "GeoRoom")           AS rooms;
```

`profiles` and `linked_accounts` decide D1 and D2 between them. If
`linked_accounts` is near zero, option A on both is the honest answer.

## 8. Sequencing summary

| Phase | Pull requests | Repository | Reversible |
|---|---|---|---|
| 0. Decisions | 0 | none | yes |
| 1. Outward wires | 7 | petrecovery | yes, per pull request |
| 2. Inward wires | 2 | petrecovery | yes |
| 3. Data split | 3 | petrecovery | yes until 3.3 |
| 4. Extraction | 1 plus skeleton | wanderguesser | yes, nothing deleted |
| 5. Cutover | 2 | both | yes until 5.5 |
| 6. Decommission | 1 | petrecovery | no |

Phases 1 and 2 are worth doing whatever is decided about the rest. They
make the game a clean module inside the pet repository, which is the
state it should have been in anyway, and they cost nothing if the split
is later postponed.
