# WanderGuesser: what launch needs

Written 2026-09-11 against `pet_main`. `docs/GEO.md` is what the game
does, `docs/WANDERGUESSER_SPLIT.md` is how it becomes its own product.
This is only the question "can it go live", answered honestly.

## Try it first, decide later

```
cd frontend && npm run geo:demo
```

Nothing configured: no Google project, no database, no mail account, no
domain. **Script mode is fully playable**, because its map is Leaflet on
keyless tiles rather than MapKit. Rooms, ratings, points, the shop and
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

- **`next start` does not work.** `next.config.js` sets
  `output: 'standalone'`, so Next serves pages but 404s the API routes
  and prints one warning about it. The supported command is
  `node .next/standalone/server.js`, with `.next/static` and `public`
  copied in beside it.
- **The standalone server does not read `.env` files.** Everything has
  to be in the process environment. A deployment that puts secrets in a
  `.env` and starts the standalone server gets a game that renders and
  then answers 503 to every round.

The whole browser harness passes against a server started that way, which
is how that is now known rather than assumed.

## What launch needs from you

### 1. Google keys with quota caps. Blocking.

The game cannot serve a Street View round without them, and without
**caps** it cannot be allowed to.

- In a Google Cloud project, enable **Maps JavaScript API** and **Street
  View Static API**.
- A browser key restricted to your domain's referrers and to the Maps
  JavaScript API, into `GOOGLE_MAPS_BROWSER_KEY`.
- A server key with the Street View Static API, into
  `GOOGLE_STREET_VIEW_API_KEY`.
- **Set daily quota caps on both** so usage stops rather than bills. The
  play meter is the first line; the console cap is the one that cannot
  be bypassed by a bug in my code.

Apple Look Around needs no key to be playable and is the free tier, so a
launch without Google keys is possible and would be a smaller game: no
Street View, no Everywhere, no Kidnapped. Script mode needs neither.

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
