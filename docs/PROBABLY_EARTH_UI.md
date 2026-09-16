# Probably Earth: the interface, rebuilt

Written 2026-09-16, after the founder saw the live lobby and said the UI
needs to be trashed and restarted. It does. This is the plan, the
decisions already made, and the order.

`docs/GEO.md` is what the game does. This is only what the player sees.

## Why it is being thrown out rather than fixed

The lobby was not designed. It accreted: a card at a time, over weeks,
each one reasonable on the day. What it became, seen cold:

- **It is a settings form.** A stranger arriving from a search result is
  asked to choose imagery, then a mode from seven dense cards, then
  rounds, then a timer, then a format, then a search radius. Only then
  is there a Play button. The competitor this is measured against drops
  you onto a street.
- **Eight buttons start a game.** Play, Play world, Play Script, Rooms,
  Rankings, Play this hour's five, Play today's five, Play this week's
  ten. Nothing says which one is the game.
- **The right column is eight stacked boxes.** Script, Play with
  friends, Your rating, Today, Ranked, Daily challenge, Weekly cup, Your
  games. This is the interchangeable-card furniture CLAUDE.md forbids in
  as many words, built anyway.
- **There is no picture of the game on it.** A site about photographs,
  made entirely of text. The same rule says show the actual product, a
  real screen rather than icons.
- **The footer carries an essay** on how the sampler picks a point.
- **The colours are the pet site's.** Slate and a yellow highlight,
  inherited rather than chosen, on a geography game.

None of that is repairable by moving boxes. The screens get rebuilt.

## Decisions already made

Recorded here because they are the founder's, not invented while
writing, and everything below depends on them.

- **Palette: ocean blue, forest green, clay brown.** Earth colours, for
  a game about the earth. The ramps are in `tailwind.config.js` under
  `ocean`, `forest`, `clay` and the warm neutral `sand`. `midnight` and
  `flash` stay the pet site's and are not used by the game.
- **Cold open: one big button, then a round.** A full-bleed screen with
  the game behind it and a single Play. One click to a street. Nothing
  to configure, no account, no form.
- **Accounts, all three layers**: guest, signed in, and a paid tier;
  plus host and admin roles.
- **An admin account that manages everything**, with the full backend
  behind it.

Still the founder's to decide, and not blocking any of the phases below:
the mode names. In this design nobody reads a mode name until they go
looking for one, so the work does not wait on them.

## The order, and why it is this order

**1. The design system.** Colour tokens, type scale, spacing, and the
small set of components every screen is built from. First, because
anything built before it gets built twice.

**2. The cold open.** Land, press one button, be in a round. The single
highest-value screen, and it needs nothing from anybody.

**3. The round.** The actual product, and it should be the best looking
thing on the site.

**4. The end of a game.** Score, reveal, share, and then, at the one
moment a player cares, the offer to keep it. The account ask lives here
and nowhere earlier.

**5. Accounts.** Guest to signed in to paid, plus host and admin, on the
play-first model step 4 sets up.

**6. The admin backend.**

**7. Everything else** rebuilt on step 1: rooms, rankings, profile.

## What is not changing

The game underneath. Sampling, scoring, rounds, rooms, ratings, seasons,
the meter and the Script corpus are all working and tested, and none of
them are what the founder is reacting to. This is the interface only.

## Progress

- **1. The design system.** Done. `ocean`, `forest`, `clay` and `sand`
  are in `tailwind.config.js`, guarded by
  `__tests__/geo/palette.test.js`, and every one of the game's 28
  screens is off `midnight`/`flash`.
- **2. The cold open.** Done. `/geo` is one button on the world; the
  settings moved to `/geo/setup`. The backdrop is the Natural Earth
  polygon set already in the bundle, so the front page needs no key and
  cannot be blank while a third party decides whether to answer. If no
  imagery is configured at all the button starts Script, which needs
  nothing, rather than leading to a dead end. Harness scenario:
  `coldOpen`, which asserts the page has exactly one button and asks
  for nothing.
- **5. Accounts.** Done, ahead of 3 and 4 because the founder asked for
  the account layers directly. Guest, signed in, role and tier: see
  `docs/GEO.md`, "Accounts".
- **6. The admin backend.** Done. `/geo/admin`.

Still to do, in order: **3, the round screen**, and **4, the end of a
game**, where the account ask belongs. Then **7**, the remaining
screens, which are repainted but not yet redesigned: rooms, rankings
and the profile still have the old shapes under the new colours.

## What this replaces

`app/geo/components/GeoLobby.js` is the main casualty. The lobby's job
splits: the cold open takes the front door, a settings surface takes the
configuration nobody should meet first, and the eight sidebar cards
either move behind navigation or stop existing.
