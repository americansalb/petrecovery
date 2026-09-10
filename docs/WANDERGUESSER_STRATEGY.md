# Beating the incumbents

A product strategy for WanderGuesser and what comes after it, written
from what the market actually looks like rather than from a feature
list. Last revised 2026-09-10.

Companions: `docs/WANDERGUESSER_SPLIT.md` is how the game becomes its own
product; `docs/GEO.md` is how the game currently works. This document is
what the product should be for, and it supersedes the shorter draft that
sat here before.

## 1. The thesis

Do not chase feature parity. GeoGuessr has a decade of community maps, a
World Cup circuit and an audience. Copying that is a losing race.

There is a better position available, and it is the same one in two
different genres. Every incumbent in "guess it from a clue" quietly
encodes a Western default:

- **GeoGuessr's world is the third of the planet Google chose to drive.**
  A third of the land surface cannot appear, so a large part of expert
  play is memorising a corporate coverage map rather than knowing the
  world.
- **The language games flatten the same places, for two different
  reasons.** Most of them ask for a language name from a list, so they
  do not literally answer "India"; what they do is carry a list of
  between sixty and a hundred and fifty entries, which is a list of
  national languages, and score every wrong answer identically whether
  it was the neighbouring language or a different family on another
  continent. The ones that answer on a map inherit the country problem
  outright. Either way the dense parts of the map arrive as one or two
  entries: India has 22 scheduled languages and around 120 with more
  than ten thousand speakers, Nigeria roughly 500, Indonesia around 700.
  (Corrected in review: an earlier draft said flatly that the language
  games answer in countries. They mostly do not. The claim that survives
  is about list length and all-or-nothing scoring, and it is narrower.
  See §2.2, which had this right.)

Attacking that bias consistently is a real position. It produces a
better game rather than more content, it opens the largest language
markets on earth, and no incumbent can follow without rebuilding what
their answer format means.

Underneath it sits a second thesis, which is about trust rather than
content, and which the next section explains.

## 2. The market

### 2.1 Geography

Four findings, each of which changes what is worth building.

**GeoGuessr made itself expensive and closed.** Full free play ended in
January 2024, leaving one daily challenge. Prices rose again in January
2026: monthly from $4.99 to $6.99, yearly from $2.99 to $3.99 a month.
Multiplayer, custom maps, country streaks, unlimited rounds and ranked
all sit behind the subscription.

**Its own audience is angry about it.** The Steam edition, launched
free-to-play in name, became one of the lowest-rated games on the
platform. The complaints are specific: the subscription wall, missing
features against the browser version, and locations repeating for free
players.

**Every free alternative is a desktop project that loads on a phone.**
That phrasing comes from a comparison of fifteen of them and it is the
most useful sentence in the research. Most people looking for a
GeoGuessr alternative are looking on a phone. Nobody serves them
properly.

**AI has broken the ranked ladder, everywhere.** A desktop screen-reader
measures about 81% country accuracy across 1,600 real ranked rounds. A
model trained for the task places over 40% of its guesses within 25 km
worldwide and beat a professional player six games out of six. Browser
anti-cheat cannot see a tool that reads the screen from outside the
browser, so the tools that work best are the hardest to catch.

That fourth finding is the important one. Every ranked ladder in this
genre is quietly becoming fiction, and the incumbent cannot fix it
without rebuilding what a round is.

### 2.2 Language

Correcting an assumption before building on it: this space is more
crowded than it first appears, and a plain "guess the language" game is
not a gap.

| Who | What they are |
|---|---|
| The Great Language Game | Lars Yencken's original, the ancestor of the genre, dataset released publicly |
| Language Squad | 100+ languages, audio **and** script samples, explicitly playable by people with vision or hearing impairments |
| LanguageGuessr | Positions itself as GeoGuessr for languages, 150+ languages, a daily challenge |
| Guess That Language | 60+ languages, worldwide leaderboards, four difficulty tiers up to 60+ answer choices |
| Name That Language, Guess The Languages, LangGuesser | Small mobile entries, three-choice rounds |

Two consequences.

First, **script mode is not novel**. Language Squad already offers
script samples next to audio. Anyone pitching "the script one" as the
differentiator is wrong.

Second, **leaderboards already exist**, so "competitive" is not the
differentiator either, at least not as usually meant. Guess That
Language has global boards today.

What does not exist anywhere is the combination: a **rated ladder that
is worth trusting**, on a **clip pool clean and fair enough to rate
people on**, with answers that **fit linguistic reality rather than
borders**. That is a much narrower claim than "a language game" and it
is the only one worth making.

I could not verify LanguageGuessr's answer format directly; its site is
blocked from this environment. Before building against it, open it and
check whether it answers in countries or language names.

### 2.3 What nobody has

- A ladder anyone believes.
- A phone-first build in either genre.
- A world without coverage holes.
- Answers shaped like languages instead of countries.

## 3. Where we stand today

Honest inventory, so the plan starts from the truth.

| | State |
|---|---|
| Free tier | 25 solo rounds and one room a day on Google, daily and cup on top, Apple unlimited. Against one daily challenge at the incumbent |
| Imagery cost | Apple Look Around costs nothing per view. A cost structure, not a feature |
| Multiplayer | Rooms on a server-authoritative clock, classic and duel, rematch. Free, which it is not on GeoGuessr |
| Competitive | Glicko ratings with a deviation, three-month seasons, a weekly cup, formats including No Move and NMPZ |
| Progression | Points, country badges, cosmetics that cost nothing to serve |
| Modes | World, balanced, continent, country, city streets, streak, daily, cup, Kidnapped |
| Coverage | 119 countries in the pool. 125 excluded. See bet 2 |
| Phone | A responsive layout and a map sheet. No installable app, no phone-shaped controls |
| Integrity | Nothing. The ladder is as forgeable as everyone else's |
| Language games | Nothing built |

Three of those are worth more than they look.

**Apple Look Around** means the free tier is not subsidised by anything,
so it can stay generous without a sponsor or a runway.

**Kidnapped**, built as a fun mode, is the only format in the genre
where the player watches motion over time rather than a still panorama.
That turns out to matter enormously for bet 1.

**Rooms already time every guess on the server.** That is one signal,
and a place to put the rest. It is not the data integrity work needs:
`GeoRoomGuess` stores the final pin, the score and `submittedAt`, and
the room API takes a single `guess` action. Time to first pin, how often
a pin moved, pan and zoom, imagery load time: none of it is recorded
today. That is exactly what sequencing step 3 is for, and this line
previously claimed the work was already done.

## 4. The bets

Five, in order of how much they differentiate.

### Bet 1. A ladder worth trusting

This is the open goal. Nobody in either genre can currently say "our
rankings are real", and it is what serious players care about most.

The insight is that a screen-reading model is very good at one static
panorama and much worse at everything else. So change what a
competitive round is.

**Motion over stills.** Kidnapped already does this: three minutes of
moving imagery with no single frame that answers the question. A screen
reader has to solve a video, not a screenshot. Make a motion format the
ranked default rather than a novelty.

**Unusual imagery.** The models that beat professionals were trained on
Street View specifically. Photo spheres in uncovered countries, and
satellite, are both off that training distribution. Bet 2 therefore
feeds bet 1: the fix for coverage bias is also an anti-cheat measure.

**Server-side behavioural signals, which we already collect.** Rooms run
on a server clock and every guess is timed server-side. A person pans,
hesitates, moves the map, adjusts, commits. A screen-reader pins once,
precisely, quickly. Time to first pin, number of pin revisions, pan
distance, zoom behaviour and the gap between imagery load and commit are
all cheap to record and hard to fake convincingly across a season.

**Two ladders, not one.** A casual ladder where nobody is policed, and a
verified ladder with the motion format, tighter clocks and the signals
in play. Say plainly which is which. GeoGuessr cannot copy this without
admitting its current ladder is broken.

What this needs: a signals table, a motion-based ranked format, and
honest copy about what is and is not policed. It does not need a
detection arms race on day one. It needs the ladder built so that
cheating is boring.

Caution: whether these signals actually separate a strong player from a
strong screen-reader at the sample sizes a small game gets is a
hypothesis, not a result. Record the signals first, look at real rounds,
then decide. Do not ship an accusation you cannot support.

### Bet 2. The whole world

**The measurement.** `GOOGLE_COVERAGE` in `app/lib/geo/coverage.js` is a
curated list of 119 countries. The country metadata holds 249 entries,
five of them Antarctic; against the 244 that are not, the list leaves
**125 countries excluded, 34.1% of the world's non-Antarctic land**.
Memorise the list and a third of the planet disappears before you look
at the screen.

(Corrected in review. An earlier draft said 130 excluded, which
subtracted from all 249 while the land figure excluded Antarctica: two
different universes in one sentence. 125 and 34.1% are both measured
against the 244.)

Which modes that actually binds, since the earlier draft overstated it
as "every mode except pure-random world": Balanced, the daily, the cup,
Kidnapped and Streak all draw from `coveredPool()`, Continent filters to
the covered countries within one, and City streets takes its cities from
the coverage set. Random world samples any land, and Country mode uses
whatever country was chosen, so neither is capped by the list. What the
list caps is what the lobby offers and what a random draw is likely to
produce.

The largest missing pieces:

| Country | Land |
|---|---|
| China | 9,707,000 km² |
| Algeria | 2,382,000 km² |
| DR Congo | 2,345,000 km² |
| Saudi Arabia | 2,150,000 km² |
| Sudan | 1,886,000 km² |
| Libya | 1,760,000 km² |
| Iran | 1,648,000 km² |
| Chad, Niger, Angola, Mali | 1.2 to 1.3m each |
| Ethiopia, Mauritania, Egypt | ~1m each |

**One correction on mechanism.** We are not excluding China by choice
and we cannot seed it from Google. Official Street View does not exist
in mainland China, and the same holds for Iran, most of the Sahara belt
and much of Central Asia. Hong Kong, Macau and Taiwan do have coverage
and are already in the pool.

**The one real lever: user photo spheres.** The probe in
`app/lib/geo/server/streetview.js` currently rejects anything whose
copyright line is not Google, which throws away user-contributed photo
spheres. Those exist across most of the missing third. Turning that
filter into a per-mode setting is a small change.

The honest costs, all of which mean this is its own mode rather than a
change to existing ones:

- Photo spheres cluster at landmarks, so rounds get either trivial or
  unfair.
- Quality is wildly uneven.
- They carry no navigation links, so no walking and no Kidnapped drive.
- Attribution is handled by the API, but it is user content and the
  terms should be read before shipping.

**The structural answer: satellite.** Satellite and aerial imagery have
genuinely uniform global coverage. No gaps anywhere, so coverage
knowledge becomes worth exactly nothing. That is a different game rather
than a patch, it needs a different imagery source and cost model, and it
is the only version where the complaint fully disappears. It is also the
furthest from Street View training data, which is bet 1 again.

**The cheap partial: sampling weights.** `fromPool` currently weights
countries by the square root of area. Deliberately over-weighting rarely
seen covered countries makes the covered-set prior less informative
without adding any imagery. It is a one-function change. It does not
remove the 119-country prior, so treat it as a tweak, not the fix.

**Verify before building.** Photo sphere density in Iran, Chad or Sudan
decides whether this is a mode or a footnote, and it cannot be checked
without a live Google key. That is a half-hour job and it comes first.

### Bet 3. Phone first, properly

The demand is documented and unserved. This is the largest audience gain
per unit of work, and it is ordinary engineering rather than research.

- Installable as a web app, with an icon on the home screen.
- Controls shaped for a thumb. The map sheet is a start; panning,
  zooming and committing a guess all want redesigning for one hand.
- The daily challenge as a phone-shaped habit with a shareable result.
  That is the front door the whole free tier is built around.
- Apple Look Around on a phone is genuinely good, and it is the free
  tier, so the phone story and the free story are the same story.
- India, the market bet 5 points at, is mobile-first. Phone work is a
  precondition for that, not a parallel track.

What this needs: a real design pass on the play screen at phone width,
not a responsive tidy-up.

### Bet 4. Free that actually stays free

Mostly already true and mostly needs saying out loud.

The free tier is 25 rounds and a room a day on Google plus unlimited
Apple, against one daily challenge. That is the clearest single reason
to switch, and the lobby currently explains it as a meter rather than as
an offer. The money comes from prepaid round packs bought once, never a
subscription, which is precisely what the incumbent's own audience is
angry about.

Care with the copy. State what it costs today and what it includes
today. Do not write a promise about what the company will never do. That
is a house rule in `CLAUDE.md` and a good one: those promises bind the
founder from a marketing page and get cited back as policy later.

### Bet 5. The language family

Two products, not one, and they should ship in this order.

#### 5a. Script mode first

Text rounds need no recordings, no licensing negotiation and no playback
time. This is the cheapest possible testbed for the entire ranked layer:
a rated text ladder could follow within days of the mode itself,
exercising the rating infrastructure on content that costs nothing,
before any audio or panorama investment. The mode ships unranked first:
rating people on a corpus still being written puts noise in the ladder,
which is the thing bet 1 exists to avoid.

It is also silent, so it plays on trains and in meetings where an audio
game is impossible, and it is the mode where a GeoGuessr player's
existing skill at reading signage transfers directly.

**Corpora, already open:**

- The Universal Declaration of Human Rights exists in more than 500
  translations through the UN human rights office, and is the canonical
  parallel text.
- Tatoeba has millions of sentences across 400+ languages, CC BY with
  some CC0, tagged with ISO 639-3 codes and downloadable in bulk.
- Wikipedia covers 300+ languages.

**One curation rule matters more than the rest:** strip proper nouns. A
sentence containing "Mumbai" answers itself. Budget real work for this;
it is the difference between a game and a quiz with the answers printed
on it.

**The natural difficulty ladder**, which audio does not have as cleanly:

1. **Identify the script.** Devanagari against Gujarati against Gurmukhi
   against Bengali against Tamil. Visually learnable, satisfying, and it
   showcases exactly the diversity the incumbents flatten.
2. **Identify the language within a shared script.** Hindi against
   Marathi against Nepali, all Devanagari. Urdu against Persian against
   Arabic. Russian against Ukrainian against Bulgarian. This is where
   experts sweat and where a ranked ladder gets real depth.

**Technical trap, and it is the one that would kill this in the markets
that matter:** test Indic, Myanmar and Ethiopic rendering on cheap
Android hardware early. Missing-glyph boxes turn the game into nonsense
in precisely the audience bet 5 exists to serve. Either bundle webfonts
covering the scripts shipped, or render to images server-side, and
decide which before writing the client.

#### 5b. Audio mode second

The claimed edge here is a production capability rather than software:
AALB runs a studio-grade multilingual recording pipeline, with native
speakers on demand, consistent loudness and length, and dialect tagging
at the source. Taking that as given, two things follow.

**Clean audio is a precondition for rating, not a polish item.** A
rating system only means something if losing a round means the player
misread the language rather than the microphone. Muddy field clips turn
rated rounds into coin flips and players stop trusting the ladder. So
the two edges compound: the library the incumbents cannot match is what
makes possible the competitive layer they do not have.

**Parallel recordings are the asset nobody else can cheaply produce.**
The same passage spoken in forty languages isolates the language itself
as the only variable: no difference in content, register, length or
recording conditions to leak the answer. AALB already translates
identical scripts across fifteen or more languages, so recording them is
an afternoon per language. That gives ranked play a provably fair clip
pool, and it is a genuine moat.

A note on the incumbent's position: field-recorded clips are branded as
authenticity, not admitted as a weakness, which means walking it back
would mean rebuilding a 150-language library and contradicting their own
marketing. That is a structural bind, not a bug they will patch next
quarter.

#### 5c. Answers as linguistic regions

This is the deepest design point in the document and it applies to both
language modes.

Scoring a pin against country borders is what makes South Asia one tile.
The fix is scoring against **linguistic regions**: state-level polygons
in India, heartland polygons elsewhere, with a distance-decayed score
the same way geography rounds work. Tamil pinned in Tamil Nadu scores
full marks; Tamil pinned in Punjab does not; and Bhojpuri and Maithili
become distinguishable answers rather than both being "India".

That is more work than a country dropdown and it is the thing that makes
this a better game rather than another entry in section 2.2.

#### 5d. Why India specifically

India is mobile-first, enormous, and language identity there is a live
cultural force rather than a trivia category. "Guess the Indian
language" already works as a party game and as a short-video format.
Every incumbent treats South Asia as one answer, and none of them can
source Bhojpuri, Tulu, Maithili or Manipuri speakers. Through AALB's
network that sourcing is ordinary work.

A polished India pack alone could make this the largest language game in
the largest language market on earth, and it is the one direction the
incumbents structurally cannot follow.

## 5. Sequencing

Cheapest and most informative first. Each step is useful even if the
next never happens.

| | Step | Why here |
|---|---|---|
| 1 | Finish the split (`WANDERGUESSER_SPLIT.md`) | Everything else assumes an independent product |
| 2 | Check photo sphere density with a live Google key | Half an hour, and it decides whether bet 2 is a mode or a footnote |
| 3 | Record behavioural signals on rounds, change nothing | Bet 1 needs data before it needs a design. Collecting is cheap and reversible |
| 4 | Phone pass on the play screen | Largest audience gain per unit of work, unblocks India later |
| 5 | Script mode, unranked, from Tatoeba and the UDHR | Days of work, no licensing. It proves the content and the mechanic, not the ladder: an unranked mode exercises no rating code |
| 6 | Linguistic-region scoring in script mode | The real differentiator, tested where content is free |
| 7 | A provisional rated ladder on script rounds | The step that actually exercises rating on free content, and the one the earlier draft skipped. Provisional because the corpus is not yet curated enough to rate people on |
| 8 | Verified ladder using what step 3 learned | Now grounded in real data |
| 9 | Coverage mode, photo spheres or satellite | Depends on step 2 |
| 10 | Audio mode and the India pack | The expensive, defensible one, built last on proven mechanics |

The pattern: prove the ranked layer on text, which costs nothing, before
spending on recordings and imagery. That takes a rated text step to be
true, which is step 7; steps 5 and 6 prove the content and the answer
format and nothing about rating. (Corrected in review: the earlier draft
claimed step 5 proved the rating layer while also making it unranked.)

## 6. Naming

**WanderGuesser** stays for the geography game. It is the only candidate
that has cleared a conflict check.

**Worldly is occupied.** Two geography games already carry it: a live
social geography game across 196 countries, and an App Store title
running 50+ modes. One letter away sits Worldle, the country-shape
daily, plus a swarm of Wordly apps riding Wordle. Anyone hearing
"Worldly" lands on four other games before this one.

The instinct behind it was right and worth keeping: an identity word,
what the game makes you, rather than a description of the mechanic. That
is the strongest kind of name. It just has to be one nobody in the genre
holds.

**Do not name the language game yet.** Naming two products before one
exists is how this loop never ends. Name it when it ships.

## 7. What not to do

- **Do not chase map count.** GeoGuessr's community maps are a decade of
  work and not a race worth entering.
- **Do not build an esports circuit.** That is downstream of a
  trustworthy ladder, not a substitute for one.
- **Do not ship to Steam early.** The incumbent burned that ground; a
  second subscription-shaped launch there reads the same way.
- **Do not add modes for the sake of a longer list.** Nine already
  exceeds what most players will try.
- **Do not pitch script mode as novel.** Language Squad has it. The
  ladder and the region scoring are the claim.
- **Do not build audio before script.** Recording is the expensive,
  slow, hard-to-reverse part. Prove the mechanics on free text first.
- **Do not accuse anyone of cheating on a signal that has not been
  tested against real rounds.**

## 8. What I do not know

Stated plainly, because the plan turns on these.

- **How many people play this today.** The row counts in
  `WANDERGUESSER_SPLIT.md` section 7 would say, and they also settle two
  decisions in that document.
- **Whether behavioural detection actually separates a good player from
  a good screen-reader** at the sample sizes a small game gets. A
  hypothesis, not a result. Step 3 of the sequencing exists to find out.
- **How dense photo spheres are** in the excluded third. Unverifiable
  from here without a live key.
- **LanguageGuessr's answer format.** Its site is blocked from this
  environment. Check it before building against it.
- **What satellite imagery costs at play volumes**, and under what terms
  it may be shown in a game.
- **Whether the founder wants ranked integrity at all**, or would rather
  have a bigger casual game and make no ranking claims. That is a
  legitimate answer and it deletes bet 1.
- **Whether AALB's recording capacity is genuinely available** for this,
  as opposed to being fully committed to paying work.

## 9. Sources

- GeoGuessr 2026 price change: https://www.geoguessr.support/support/solutions/articles/206000067275-price-changes-2026
- Steam reception: https://www.thegamer.com/geoguessr-steam-edition-launch-met-with-overwhelmingly-negative-reviews-thousands-subscription-free-to-play-monetization/
- Free alternatives compared, including the mobile gap: https://whereamigame.app/blog/10-best-free-geoguessr-alternatives-in-2026/
- Model performance on geolocation: https://lukashaas.github.io/PIGEON-CVPR24/
- Language Squad: https://www.languagesquad.com/
- LanguageGuessr: https://languageguessr.io/
- Guess That Language: https://play.google.com/store/apps/details?id=com.pronunciatorllc.guessthatlanguage
- The Great Language Game: https://lars.yencken.org/projects/language-game/
- UDHR translations past 500: https://www.ohchr.org/en/stories/2016/11/universal-declaration-human-rights-now-available-more-500-languages-and-dialects
- Tatoeba downloads and licensing: https://tatoeba.org/en/downloads

Coverage figures in bet 2 were measured against
`frontend/app/lib/geo/coverage.js` and
`frontend/app/lib/geo/data/countries-meta.json` on 2026-09-10.
