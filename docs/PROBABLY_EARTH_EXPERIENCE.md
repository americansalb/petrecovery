# Probably Earth player experience

## Direction

Desktop first, with complete phone controls. Deep ocean and turquoise are the base; leaf green marks selection and progression, terracotta marks the main action, and sand paper belongs to Script. Original coastal menu artwork adds a sense of place. It is illustrative art, not gameplay imagery or a location clue.

Use open sections, typography, spacing, and distinctive game pieces to organize the interface. Avoid repeated rounded panels and panels inside panels. Containment is reserved for actionable controls and overlays where it clarifies what belongs together. Preserve visible keyboard focus, legible scripts, 44px actions, and reduced-motion behavior.

## Journey

- Home: Solo and Multiplayer are equally accessible. Solo offers Street and Script. Multiplayer offers Classic and Duel. One primary button follows the selection.
- Street: five relaxed rounds by default. Daily, ranked solo, weekly cup, streaks, country, and continent modes remain reachable.
- Script: the menu renders actual Devanagari, Tamil, and Ethiopic text with bundled fonts. Select a language pool; rounds and timing are optional customization. Guess, reveal, learn from the letter-level clues, and replay.
- Multiplayer: create a Classic or Duel room, or join by code. Defaults are playable; custom rules and privacy are in a disclosure. A room explains the next step: copy the invite, wait for another player, start. Rank and HP are not shown in the waiting roster. The UI now enforces the server's existing two-player minimum.
- Results: primary replay actions precede the detailed round recap. Profiles, cosmetic unlocks, and separate ladders remain linked into the journey.

All modes are free now, and that appears in the navigation and play flow. Guest play remains available. No monetization promises, fake activity counts, or simulated opponents were added.

## Competitive model

Each of Classic, Duel, and ranked solo has an independent Glicko rating. This update retains the calculation, numeric ratings, placement requirement, and season carry behavior. The five league names are Copper (below 1400), Silver (1400), Platinum (1550), Gold (1700), and Sapphire (1850). Five placement games precede a displayed personal league. Divisions within leagues are deferred.

Existing cosmetic IDs are retained: `title-gold` now displays Platinum at its original 1550 threshold; `title-master` displays Sapphire; `title-grandmaster` displays Wayfinder, also available at Sapphire. The latter two become available earlier under the five-league system. `frame-bronze` becomes Copper. Existing ownership remains valid. New-season league rewards are 0, 50, 100, 200, and 350 cosmetic points respectively; historical reward-name keys remain readable. No stored profile data is rewritten.

Script currently has solo pools, not a live multiplayer ladder. Public automatic matchmaking and AI opponents are separate work; the UI does not promise either.

## Assets

`frontend/public/geo/art/coastal-world.webp`: original artwork generated for this project, encoded as WebP (1672 × 941, approximately 285 KiB). Prompt direction: a richly detailed Mediterranean-inspired coastal game world, deep blue sea and turquoise bay, terracotta town on green cliffs, distant mountains, foreground foliage and cinematic depth; the left side leaves room for text; no lettering or UI. Do not mistake it for an Apple Look Around screenshot.

## Preview and verification

The normal lockfile is unchanged. Install with `npm ci`, generate Prisma, and run Next in the geo site mode. No database is required in development. The development memory store is shared across route bundles, so creating a room and opening it no longer loses the room. Development static chunks use `no-store`; production immutable caching is preserved.

Validated paths: desktop hub and Script visuals; mobile hub and a full five-round Script game with multilingual rendering, guesses, reveals, final results and replay choices; selected Duel routing; room creation and waiting-lobby state; rank boundaries, cosmetics compatibility, room service, and reduced motion. Apple street imagery still requires an authorized provider origin; live Street rounds need a deployment smoke test.

Final checks: 131 Jest suites, 1,432 passing tests (10 existing todos); scoped ESLint clean; full production compilation, type validation and static generation completed successfully. The final browser pass also verified the unboxed room selector, disabled one-player start, phone invite screen, profile badge legibility and five-league path.

## Main-page refinement

The homepage is now one full-width scene rather than an artwork banner above a control panel. Multiplayer is selected on first entry, Solo remains adjacent, and the primary action names the chosen game. Script replaces the landscape with real writing-system artwork. The controls, supporting links and daily-challenge navigation sit directly on the scene without another container. Daily, ranked solo and weekly cup entries use open sections below it. The presentation is isolated in `frontend/app/geo/home.css`. Desktop and phone layouts, mode selection, Duel routing, motion preferences and menu availability were checked; 37 focused tests and scoped lint pass.
