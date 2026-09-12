# WanderGuesser: what launch needs

Written 2026-09-11 against `pet_main`. `docs/GEO.md` is what the game
does, `docs/WANDERGUESSER_SPLIT.md` is how it becomes its own product.
This is only the question "can it go live", answered honestly.

## Try it first, decide later

```
cd frontend && npm run geo:demo
```

Nothing configured: no Google project, no database, no mail account, no
domain. **Script mode is fully playable**, because its map is drawn from
the country polygons in the game's own bundle rather than MapKit or a
tile server. Rooms, ratings, points, the shop and
sign-in all work on an in-memory store; sign-in links are printed to the
log. Street View needs a browser key no mock can replace, because
Google's own SDK draws the panorama. Details in `docs/GEO.md`, "Playing
it with nothing configured".

## The short answer

**The game is ready. The deployment is not, and most of what is left is
yours rather than mine.**

Everything below marked "you" needs an account, a card, a domain or a
decision that is not mine to make. Everything marked "code" is done.

## What is actually finished

| | State |
|---|---|
| The game itself: ten modes, rooms, ratings, seasons, the weekly cup, points, cosmetics, the daily challenge | code, live on `pet_main` |
| Script mode: 76 languages, 25 writing systems, region scoring | code, live on `pet_main` |
| Its own accounts, its own session, its own mailer | code, live on `pet_main` |
| No import in either direction between the game and the pet site | code, enforced by `__tests__/geo/isolation.test.js` |
| Cost control: the play meter, per-day and per-address caps, a site budget | code |
| 1,074 tests, a nine-scenario browser harness that passes against a production build | code |

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

### 1. An Apple MapKit token for the game's domain. Blocking.

The game is Apple-first (docs/GEO.md, "Apple first"): the lobby opens on
Look Around and the daily and the cup are played on it. The MapKit token
in the repository is locked to the reunitepets.org origin, so on the
game's own domain every Apple round fails until there is one for that
origin. An Apple Developer account, a MapKit JS key, a token minted for
the domain, into `NEXT_PUBLIC_APPLE_MAPKIT_TOKEN`. Nothing else in the
game needs Apple's account.

### 1b. Google keys with quota caps. Optional, and blocking for the Google modes.

Without them the Google option is off: no countryside, no Everywhere, no
Kidnapped, and the other hundred-odd countries. With them, **caps**
matter, because without caps the game cannot be allowed to serve them.

- In a Google Cloud project, enable **Maps JavaScript API** and **Street
  View Static API**.
- A browser key restricted to your domain's referrers and to the Maps
  JavaScript API, into `GOOGLE_MAPS_BROWSER_KEY`.
- A server key with the Street View Static API, into
  `GOOGLE_STREET_VIEW_API_KEY`.
- **Set daily quota caps on both** so usage stops rather than bills. The
  play meter is the first line; the console cap is the one that cannot
  be bypassed by a bug in my code.

A launch without Google keys is the Apple-first game as designed: city
streets in 23 countries in every mode but Everywhere and Kidnapped, plus
Script mode, which needs neither.

### 2. Where it lives. Blocking.

Decisions D3 and D4 in the split document, both unanswered:

- **A domain.** `GEO_DOMAINS` already routes a host on the shared
  deployment to the game, and `NEXT_PUBLIC_SITE=geo` builds it as its
  own site with no pet chrome. Either works today; the name has not been
  bought.
- **Does `/geo` keep working on reunitepets.org** once the game has its
  own home, or does it redirect? Both are one line; nobody has picked.

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

Nothing in the code is holding this up. What is holding it up is a
Google project with caps on it, a domain, a mail sender, and two
decisions. The first three are an afternoon of account admin between
them.
