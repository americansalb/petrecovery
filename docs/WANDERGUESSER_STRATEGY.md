# Beating GeoGuessr

Notes toward a product strategy, written 2026-09-10 from what the market
actually looks like rather than from a feature list. The companion
document is docs/WANDERGUESSER_SPLIT.md, which is how the game becomes
its own product; this one is what that product should be for.

The short version: do not chase feature parity. GeoGuessr has a decade
of maps, a World Cup circuit and a community. Copying that is a losing
race. There are three places it is structurally weak, and one of them is
close to an open goal.

## 1. What the market looks like

Four findings, each of which changes what is worth building.

**GeoGuessr made itself expensive and closed.** Full free play ended in
January 2024, leaving one daily challenge. Prices went up again in
January 2026: the monthly plan from $4.99 to $6.99, the yearly from
$2.99 to $3.99 a month. Multiplayer, custom maps, country streaks,
unlimited rounds and ranked are all behind the subscription.

**Its own audience is angry about it.** The Steam edition, launched
free-to-play in name, is now one of the lowest-rated games on the
platform, with thousands of negative reviews. The specific complaints
are the subscription wall, missing features against the browser version,
and locations repeating for free players.

**Every free alternative is a desktop project that loads on a phone.**
That line is from a comparison of fifteen of them, and it is the most
useful sentence I found. Most people looking for a GeoGuessr alternative
are looking on a phone, and nobody is serving them properly.

**AI has broken the leaderboard, everywhere.** A desktop screen-reader
measures about 81% country accuracy across 1,600 real ranked rounds. A
model trained for the task places over 40% of its guesses within 25 km
worldwide and beat a professional player six games out of six. Browser
anti-cheat cannot see a tool that reads the screen from outside the
browser, so the tools that work best are the ones hardest to catch.

That fourth one is the important one. Every ranked ladder in this genre
is quietly becoming fiction, and the incumbent cannot fix it without
rebuilding what a round is.

## 2. Where this game already stands

Honest inventory, so the plan starts from the truth.

| | State |
|---|---|
| Free tier | 25 solo rounds and one room a day on Google, daily and cup on top, Apple unlimited. Far more generous than one daily challenge |
| Imagery cost | Apple Look Around costs nothing per view. This is a structural cost advantage, not a feature |
| Multiplayer | Rooms on a server-authoritative clock, classic and duel, rematch. Free, which it is not on GeoGuessr |
| Competitive | Glicko ratings with a deviation, three-month seasons, a weekly cup, formats including No Move and NMPZ |
| Progression | Points, country badges, cosmetics that cost nothing to serve |
| Modes | World, balanced, continent, country, city streets, streak, daily, cup, Kidnapped |
| Phone | A responsive layout and a map sheet. No installable app, no offline anything, no phone-shaped controls |
| Integrity | Nothing. The ladder is as forgeable as everyone else's |

Two of those are worth more than they look. Apple Look Around means the
free tier is not subsidised by anything, so it can stay free without a
sponsor or a runway. And Kidnapped, which was built as a fun mode, is
the only mode in the genre where the player watches motion over time
rather than a still panorama.

## 3. Three bets

Not twenty features. Three, in order of how much they differentiate.

### Bet 1. A ladder you can trust

This is the open goal. Nobody in the genre can currently say "our
rankings are real", and it is the thing serious players care most about.

The insight is that a screen-reading model is very good at one static
panorama and much worse at everything else. So change what a competitive
round is:

- **Motion over stills.** Kidnapped already does this: three minutes of
  moving imagery, no single frame that answers the question. A screen
  reader has to solve a video, not a screenshot. Make a motion format
  the ranked default rather than a novelty.
- **Server-side behavioural signals, which we already collect.** Rooms
  run on a server clock and every guess is timed on the server. A person
  pans, hesitates, moves the map, adjusts, commits. A screen-reader pins
  once, precisely, quickly. Time to first pin, pin revisions, pan
  distance, and zoom behaviour are all cheap to record and hard to fake
  convincingly across a season.
- **Two ladders, not one.** A casual ladder where nobody is policed, and
  a verified ladder with the motion format, tighter clocks, and the
  behavioural signals in play. Say plainly which is which. GeoGuessr
  cannot copy this without admitting its current ladder is broken.

What this needs: a decision on how much integrity work is worth, then a
signals table, a motion-based ranked format, and honest copy about what
is and is not policed. It does not need a detection arms race on day
one; it needs the ladder to be built so cheating is boring.

### Bet 2. Phone first, properly

The demand is documented and unserved. This is the largest audience gain
per unit of work, and it is ordinary engineering rather than research.

- Installable as a web app, with an icon on the home screen.
- Controls shaped for a thumb: the map sheet is a start, but panning,
  zooming and committing a guess all want redesigning for one hand.
- The daily challenge as a phone-shaped daily habit, with a shareable
  result. That is the front door the whole free tier is built around.
- Apple Look Around on a phone is a genuinely good experience, and it is
  the free tier, so the phone story and the free story are the same
  story.

What this needs: a real design pass on the play screen at phone width,
not a responsive tidy-up.

### Bet 3. Free that actually stays free

This is already most of the way there and mostly needs saying out loud.

The free tier is 25 rounds and a room a day on Google plus unlimited
Apple, against one daily challenge. That is the single clearest reason
to switch, and right now the lobby explains it as a meter rather than as
a promise. Meanwhile the money comes from prepaid round packs bought
once, never a subscription, which is precisely the thing the incumbent's
own audience is angry about.

Careful here: state what it costs today and what it includes today.
Do not write a promise about what it will never do. That is a house rule
and a good one.

## 4. What not to do

- **Do not chase map count.** GeoGuessr's community maps are a decade of
  work and a moat we cannot cross by trying.
- **Do not build an esports circuit.** That is downstream of having a
  trustworthy ladder, not a substitute for one.
- **Do not ship to Steam early.** The incumbent burned that ground; a
  second subscription-shaped launch there would be read the same way.
- **Do not add modes for the sake of a longer list.** Nine is already
  more than most players will try.

## 5. What I do not know

Stated plainly, because the plan turns on these.

- How many people play this today. The row counts in
  docs/WANDERGUESSER_SPLIT.md section 7 would say.
- Whether behavioural detection actually separates a good player from a
  good screen-reader at the sample sizes a small game gets. It is a
  hypothesis, not a result, and it should be tested on real rounds
  before anything is built on it.
- Whether the founder wants to invest in integrity at all, or would
  rather have a bigger casual game and no ranked claims. That is a
  legitimate answer and it makes bet 1 disappear.

## Sources

- GeoGuessr's 2026 price change: https://www.geoguessr.support/support/solutions/articles/206000067275-price-changes-2026
- Steam reception: https://www.thegamer.com/geoguessr-steam-edition-launch-met-with-overwhelmingly-negative-reviews-thousands-subscription-free-to-play-monetization/
- Free alternatives compared, including the mobile gap: https://whereamigame.app/blog/10-best-free-geoguessr-alternatives-in-2026/
- Model performance on geolocation: https://lukashaas.github.io/PIGEON-CVPR24/
