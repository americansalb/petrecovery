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
- **Accounts: guest and signed in.** No paid tier (founder, 2026-09-16:
  "100% free, no paid option"). This replaces an earlier three-layer
  plan that had a paid tier in it; what is recorded here is the
  decision, and only the decision. Host and admin are roles, not tiers.
- **Never force an account, always offer one.** Founder, 2026-09-16:
  "when we say no account needed, that is not the same as not giving
  them the option or not encouraging them to make one", and "it should
  be very easy to sign up". So the ask is one field and one button, it
  appears at the end of a game and nowhere earlier, and it gates
  nothing: a guest and a signed-in player play the same game.
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

Read this section sceptically. On 2026-09-17 phase 1 was marked Done
here with one of its four deliverables finished, a full day of work was
built on top of that line, and every screen built in that day had to be
built again - which is exactly what "first, because anything built
before it gets built twice" was written to prevent. A phase is Done
when all of it is done, and there is a test that says so.

- **1. The design system.** Partly done, and honestly so.
  - Colour: done. `ocean`, `forest`, `clay` and `sand` are in
    `tailwind.config.js`, guarded by `__tests__/geo/palette.test.js`,
    and every one of the game's 28 screens is off `midnight`/`flash`.
  - Contrast: done. `frontend/scripts/geo-contrast.js` composites every
    translucent layer down to the opaque one and exits non-zero on
    anything below WCAG AA. Eight static screens and four in-play ones,
    0 below AA.
  - Components: the four every screen needs are in
    `app/geo/components/ui/` - `Card`, `Button`, `Tabs`, `Stat` - and
    `__tests__/geo/components.test.js` fails on a card written by hand
    outside the five named surfaces that are not cards.
  - Type scale and spacing scale: **not done.** Measured 2026-09-17:
    11 distinct type sizes in `app/geo` (`text-sm` x206, `text-xs` x74,
    `text-lg` x24, `text-2xl` x14, `text-[11px]` x13, `text-3xl` x12,
    `text-[10px]` x11, `text-4xl` x10, `text-xl` x7, `text-base` x5,
    one `clamp()`), and 49 distinct spacing values. The plan is six type
    steps (48/30/20/15/13/11) and five spacing steps (4/8/16/24/40),
    baked into the components above and enforced the way
    `palette.test.js` enforces colour. Nobody has done it.
- **2. The front door.** Done, and then done again. It was one button
  on a spinning globe, which was quick to enter and impossible to
  understand: nothing on it said the game had a second family (Script),
  that you could play with people, or that there were competitions
  running. Those lived on Rankings, which is a standings page. So `/geo`
  is a game menu now: Play is still the biggest thing on it and still
  one click to a street with no form and no account, and the rest of
  the product is beside it. `/geo/setup` was deleted with the settings
  it held. The backdrop is the Natural Earth polygon set already in the
  bundle, so the page needs no key and cannot be blank while a third
  party decides whether to answer. If no imagery is configured at all
  the button starts Script rather than leading to a dead end. Harness
  scenario: `coldOpen`.
- **3. The round screen.** Done. Three labelled pills across the top
  (what you are playing and how to change it, which round this is, the
  score and the clock), one cluster bottom left for looking around with
  a line of words under it that says only what is true for the format
  being played, and the map as a card whose footer carries the hint on
  the left and the one button on the right. The instruction used to be
  the button's label, so the only call to action on the screen changed
  its words under the cursor. Harness scenarios: `appleSolo`, `pinGame`,
  `notEarth`.
- **4. The end of a game.** Done. Score, the rounds, then the account
  ask (`KeepThis`), then the share actions. The ask renders for guests
  only, says what an account is for rather than what it unlocks, and
  gates nothing. `appleSolo` asserts a guest sees it.
- **5. Accounts.** Done, ahead of 3 and 4 because the founder asked for
  the account layers directly. Guest, signed in, role and tier: see
  `docs/GEO.md`, "Accounts".
- **6. The admin backend.** Done. `/geo/admin`.


- **7. Everything else.** Rebuilt on the components above: the menu,
  Rankings, the Profile (three tabs - Record, Shop, Settings - so the
  first thing a player sees about themselves is their record and not a
  price list), Friends and the room browser. The Script screens and the
  admin backend use the components for their cards and have not been
  laid out again.

Still to do: the type and spacing scales in phase 1, and the type pass
over every screen that follows from them.

## What this replaces

`app/geo/components/GeoLobby.js` is the main casualty. The lobby's job
splits: the cold open takes the front door, a settings surface takes the
configuration nobody should meet first, and the eight sidebar cards
either move behind navigation or stop existing.
