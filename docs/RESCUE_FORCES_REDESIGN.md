# Rescue Forces Redesign — the pages, not Mission Control

Status: **Plan, 2026-07-27.** Scope: `/rescue-forces` (landing/search), `/rescue-forces/[id]`,
`/rescue-forces/[id]/divisions/[divisionId]`, the join flow, and the create wizard.
Mission Control (`/mission-control`) is explicitly **out of scope** — it is already the
strongest screen in the product; these pages must *lead into it*, not compete with it.

The brief, verbatim intent: the hierarchy — Forces (areas and the people in them) →
Divisions → Missions → participation — must be understood **from the design alone,
with zero explanatory copy**. Elegant, clean, simple, on-brand (midnight/flash).

---

## 1. Diagnosis — why the current pages fail (from the 2026-07-04 screenshots)

1. **The hierarchy is described, never shown.** Divisions are two text pills
   (`North Austin` `South Austin (1)`) that read as filter tags; members are a count
   chip; territory is nowhere. Nothing on any page *looks like* "a city team split
   into neighborhood crews."
2. **Parent and child are visually identical.** The force page and the division page
   share the same hero, same four stat chips (with the same numbers), same tabs, same
   "Featured Cases" strip, same empty forum. If two levels look the same, there are no
   levels. (Gestalt: hierarchy is perceived through contrast in scale and composition,
   not through labels.)
3. **Urgency is inverted.** Max — a real dog, missing 18 hours, the entire reason the
   product exists — is a 90px dim card labeled "FEATURED CASES", while a Sarama bot
   post explaining "how you can help" gets 400px of prime space. The page explains
   instead of showing, which is precisely the failure the brief names.
4. **Three words for one concept on one screen**: "Featured **Cases**", the
   "**Missions**" tab, the "1 **Active**" chip. The reader must do vocabulary
   reconciliation the design should have done.
5. **Wrong genre.** The page is structured as a Reddit clone (Hot/New/Top, posts,
   "Be the first to share something!"). A 4-member team fragmented across a force
   forum *and* per-division forums guarantees permanent ghost towns — and the Hub
   already owns forum behavior. A force is not a subreddit; it is a **team with a
   territory and live operations**.
6. **Curiosity is punished.** A member tapping "Divisions" gets a red **Access
   Denied** card ("Only founders and leaders can manage divisions") with a "Back to
   Squad" button — legacy naming included. Browsing the structure of your own force
   is an error state.
7. **Zeros on display.** "0 Reunited" as a hero chip is anti-social-proof. Never
   render a zero as an achievement.
8. **Off-brand register.** Browse pages are full-dark, while the house style
   (homepage, `/for-shelters`, `/shelters`) is light pages with midnight hero bands
   and flash accents. Because everything is already dark, entering Mission Control —
   the actual night-operations room — has no threshold moment.
9. **The city expansion is invisible.** `/rescue-forces` lands on an empty search
   form with dead whitespace. Dozens of seeded city forces exist; a visitor sees none
   of them, no map, no proof of network.

## 1.5 The site around these pages — registers and funnels (full-gallery review)

Reviewed against the complete 2026-07-04 gallery, not just the force captures.
Two facts reframe the project:

**The design north star already exists.** The homepage and the public case portal
are the house voice at its best: light civic register, midnight hero, one flash
CTA, labeled social-proof stats, urgency at the top — and the homepage already
speaks the exact metaphors this plan builds on: *"neighbors organized like a
volunteer fire department"*, *"Just be reachable when a pet near you needs more
eyes"*, a dashed flashlight-beam motif in the hero, and live mission cards with
pet photos. The force pages aren't missing a design language; they're violating
one the site already has. (The Lantern Map is the homepage's flashlight motif,
promoted to a system.)

**Three visual registers are fighting.** Midnight/flash (homepage, nav, case
portal, shelters), the scoped care worlds (paper/teal — fine, deliberate), and a
rogue **purple register on `/lost-pet/[city]` SEO landings** (purple gradient
hero, purple CTAs) that also self-contradicts: its stat cards claim "29 Active
Missions · 44 Active Searchers" while sections below say "No active cases in
this area" and "No rescue forces in this area yet" — with Austin Rescue Force
and a live mission in the same database. That page is where search engines send
desperate owners.

**The funnels into these pages** (every arrival the redesign must catch):

| Entry | Arrives with | Redesign must |
|---|---|---|
| Homepage "Find your Rescue Force" card, "Browse all forces", footer + final CTA | Civic curiosity ("be the neighbor") | Land on the §5.1 network map, never an empty form; hero join copy inherits homepage language ("Be reachable…") |
| Case portal "Join Search Party — N searching now" | Crisis-adjacent urgency about one specific pet | MISSING NOW at the top of the force page; that pet visible in one scroll |
| `/join/[missionId]` share links (redirects to force page `?joined=true` after join) | A friend's share, zero context | Absorb into JoinSheet; page currently captures as a dark Connection Error — the funnel's most fragile link |
| `/lost-pet/[city]` SEO landings ("Rescue Forces in TX" cards, "Start a Rescue Force") | Google, mid-panic | Consume the same `ForceCard` + data source as §5.1; restyle purple → house register; one source of truth ends the self-contradiction |
| Dashboard "My Rescue Forces" + "Helping Find" | Returning member | Same `MissionLiveCard` DNA as homepage "Active missions" and dashboard "Helping Find" — one component, three surfaces, the funnels visually rhyme |
| Nav dropdown (find / start a force) | Deliberate intent | Straight to network map / create wizard |

Exits: mission cards → Mission Control (the one light→dark threshold); authored
discussion → the Hub; owners → the report wizard.

Two audiences follow from the funnels, and the force page serves both without
splitting: the **crisis-adjacent** arrival (came from a case; wants Max found)
is served by MISSING NOW dominating the page; the **civic-curious** arrival
(came from the homepage; wants to matter) is served by the hero join + the
watchtower state. Additional register notes: the vocabulary drift extends beyond
these pages (the dashboard's "My Pets" empty state says "No active missions" —
the lockdown table travels with the shared components), and the ambient push
popup interrupts browse surfaces site-wide — its one home is the JoinSheet done
state (§5.4).

## 2. The design thesis (three sentences)

1. **The map is the org chart.** A force is a place; divisions are sub-places; a
   mission is a point on the place. Draw the territory once per page and the
   hierarchy explains itself in 200 ms with zero words.
2. **Levels must look like levels.** Network → Force → Division → Mission each get a
   visibly different composition: smaller hero, tighter zoom, more concrete content
   at every step down. Same three questions answered in the same order on every
   level — **Where is this? Who is here? What is happening right now?**
3. **Day pages, night room.** Browse surfaces are calm, light, civic (light ground,
   midnight hero band, flash accents — the house style). Mission Control stays dark
   and immersive. The light→dark transition *is* the "you're going on an operation"
   threshold, felt rather than explained.

## 3. The psychology, applied

| Principle | Application |
|---|---|
| Recognition over recall | Territory drawn on maps, faces in rosters, pet photos on missions — never abstractions the mind must decode (pills, counts, tabs). |
| Hierarchy through scale contrast | Force hero: full midnight band. Division: light header + breadcrumb chip. Mission card: a card. Squint at any page and its level is legible. |
| Attention follows urgency | The live mission card is the largest, warmest, only-animated element on the page (pulsing LIVE dot, elapsed-hours counter). Everything else is still. |
| Social proof | Avatar stacks with on-duty glow, reunion photo shelf, member count *in faces not digits*. A team of humans, near you, actually watching. |
| Concrete value at the ask | "Join" never means "membership in a forum." The button says what you get: alerts + a role in searches for a specific area, division auto-suggested from location. |
| Commitment gradient | Visitor → one-click join (low ask) → availability toggles (optional) → first mission join (the real conversion, made by the mission card, not the join form). |
| Cold start is a state, not a failure | Zero missions renders the **watchtower state** — "All quiet in Austin tonight. 4 volunteers on duty." Quiet vigilance is the brand's best image; an empty forum is its worst. |
| Peak–end rule | Reunions are the emotional payoff: a photo shelf of wins ("Max — home after 3 days"), shown only when > 0. Zeros and shame states never render. |
| Error prevention over error messages | Non-leaders never see management affordances; Access Denied pages cease to exist. Browsing divisions is public. |
| One primary action per screen | Force page: **Join this force**. Mission card: **Join the search**. Nothing else is flash-filled. |

## 4. Vocabulary lockdown (one word per concept, everywhere on these pages)

| Concept | The word | Never |
|---|---|---|
| The city team | **Rescue Force** | Squad, community, group |
| The neighborhood crew | **Division** | Chapter, area, sub-squad |
| One lost/found-pet operation | **Mission** | Case (UI copy; `/cases/*` URLs stay), Active, Featured |
| A person in the force | **Member** (role: Founder / Leader / Member) | Volunteer (except marketing copy), user |
| Currently available | **On duty** | Active, online |
| The live surface | **Missing now** | Featured cases, active cases |

Level kickers use one consistent chip grammar so position in the tree is always
stamped on the page: `RESCUE FORCE · AUSTIN, TX` / `DIVISION · NORTH AUSTIN` /
`MISSION · MAX`.

## 5. Page blueprints

### 5.1 `/rescue-forces` — the network (replaces the empty search page)

Purpose: show the network exists (the city-expansion work finally visible), let
people find or found their force. Light page.

```
┌─ midnight hero band (short) ─────────────────────────────────────┐
│ RESCUE FORCES                                                    │
│ The volunteer search network.            [ city or ZIP ⌕ ]       │
│ 132 forces · 41 cities · 6 countries                             │
└──────────────────────────────────────────────────────────────────┘
│ ┌─ THE MAP (wide, light Carto tiles) ──────────────────────────┐ │
│ │   ●Austin(12)   ●Chicago(31)   ●CDMX(8)  … shield-dot pins,  │ │
│ │   pin size ∝ members; pulsing halo if a mission is live      │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ YOUR FORCE (member shortcut, pinned first when applicable)       │
│ ┌ force card ┐ ┌ force card ┐ ┌ force card ┐ ┌ start-one card ┐  │
│ │ coverage   │ │            │ │            │ │ No force near  │  │
│ │ blob thumb │ │            │ │            │ │ you yet — be   │  │
│ │ Austin, TX │ │            │ │            │ │ the founder →  │  │
│ │ 12 members │ │            │ │            │ └────────────────┘  │
│ │ ●1 missing now · 17 reunited · 🐕drones🌙                     │  │
└──────────────────────────────────────────────────────────────────┘
```

- Search filters the map + grid live; typing is optional (the empty-form cold start
  is gone — first paint is already the network).
- Force card = coverage-shape thumbnail (real geometry from `centerLat/lng +
  radiusMiles` or `customBoundary`), name, city, member count, a **pulsing "1
  missing now"** when true, reunion count when > 0, capability glyphs
  (`hasDrones`, `hasTrackingDogs`, `availableNight`) as quiet icons.
- The "start one" card is the standing CTA for uncovered areas — founding framed as
  an honor, not a fallback.

### 5.2 `/rescue-forces/[id]` — the force (the centerpiece)

Light page. One screen answers Where / Who / What-now; no tabs, no forum.

```
┌─ midnight hero band ────────────────────────────────────────────────┐
│ RESCUE FORCE · AUSTIN, TX                    ┌───────────────────┐  │
│ Austin Rescue Force                          │ (◉◉◉◉ +8 avatars) │  │
│ “Every pet comes home.”                      │ 12 members·4 on   │  │
│ VETERAN ★ · 🐕 tracking dogs · ✈ drones · 🌙 │ duty now          │  │
│                                              │ [⚡ Join this     │  │
│                                              │    force]         │  │
│                                              └───────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
│ vitals: ● 1 pet missing now   ♥ 17 reunited   ⏱ ~12 min response    │
├──────────────────────────────────────┬──────────────────────────────┤
│ MISSING NOW                          │ TERRITORY                    │
│ ┌──────────────────────────────────┐ │ ┌──────────────────────────┐ │
│ │ [MAX photo]   ● LIVE    18h      │ │ │  map: force boundary,    │ │
│ │ Max · Golden Retriever           │ │ │  division zones shaded + │ │
│ │ Zilker Park · 2 sightings        │ │ │  labeled; missions as    │ │
│ │ (◉◉◉ 3 searching)                │ │ │  pulsing dots. Click a   │ │
│ │        [ Join the search → ]     │ │ │  zone → division page.   │ │
│ └──────────────────────────────────┘ │ │  “You're in North        │ │
│ (zero-state: watchtower — “All      │ │  Austin's area.”          │ │
│ quiet in Austin tonight. 4 on       │ │ └──────────────────────────┘ │
│ duty.” + soft green pulse)          │ │ CREW                         │
│                                      │ │ North Austin  ◉◉◉ Sarah ★  │
│ ACTIVITY                             │ │ South Austin  ◉◉ Mike      │
│ · Sighting reported near Barton 4h  │ │ (on-duty = glow dot;       │
│ · Avery joined North Austin     1d  │ │ leaders = ★; “+6 more”)    │
│ · Flyers posted on the greenbelt 2d │ │ REUNITED ─ photo shelf     │
│ (auto-generated events — no         │ │ [🐕][🐈][🐕] “Luna — home  │
│ authored posts, no empty states)    │ │ after 3 days” (hidden at 0)│
└──────────────────────────────────────┴──────────────────────────────┘
```

Decisions:

- **Hero** carries identity + the single join CTA with concrete value copy
  (e.g. subtext under button: "Get alerted when a pet goes missing near you").
  Level/badges (`rescueSquadLevel`, `badges`) render as one quiet chip row —
  pride, not clutter.
- **Vitals** are labeled sentences-in-miniature, color-coded by meaning: flash +
  pulse for missing-now, green heart for reunions, neutral for response time.
  A vital that would read 0 does not render; a brand-new force shows
  "Founded July 2026" instead of empty trophies.
- **MISSING NOW** is the dominant element (largest card, only animation on the
  page). CTA goes straight to Mission Control — the light→dark register shift is
  the threshold. Card is pet-first: photo, name, elapsed time, last-seen, searcher
  avatars.
- **TERRITORY** replaces division pills: real geometry (`Division.centerLat/lng +
  radiusMiles` or `customBoundary`) drawn as labeled zones inside the force
  boundary. Clicking a zone *is* division navigation. Geolocated visitors get a
  "You're in X's area" pin — the join suggestion made spatial. Full visual +
  interaction spec: §5.2.1, the Lantern Map.
- **CREW** replaces "4 Members": avatars grouped by division, role stars, on-duty
  glow (`availabilityStatus`), overflow count. Faces do the explaining.
- **ACTIVITY** replaces the forum: an auto-generated event pulse (joins, sightings,
  flyers, reunions from `SquadActivity`) that is alive without anyone writing a
  post. Authored discussion belongs to the Hub; link out if a force has a Hub tag.
- **Deleted from this page**: tabs, Hot/New/Top, Sarama welcome post, "FEATURED
  CASES", per-force forum, any explanatory bullet list.

### 5.2.1 The Lantern Map — TerritoryMap visual & interaction spec

The brand is a flashlight in the midnight dark; the territory map takes it
literally. The map card is a **window into the night layer** — deep midnight
tiles (same CARTO dark family Mission Control uses) set inside the light civic
page. You look *into* the operational world from the calm one, and the card
quietly foreshadows the room the mission CTA leads to.

**Encoding — one channel per meaning, no rainbow, no crime map:**

- **Zone fill = midnight, luminance = watch level.** Exactly three named steps,
  not a gradient: *resting* (base), *watched* (≥1 member on duty — the windows
  are lit), *active* (searchers currently in the field — brightest). One hue
  family; meaning rides on luminance, which survives every colorblindness type
  by construction. Validate the three steps against the dark surface with the
  dataviz palette validator during build.
- **Flash is the signal, never a fill.** Live missions render as pulsing flash
  flares (dot + soft beam radius). Selected zone gets a flash ring. Scarcity is
  what keeps flash meaning "something is happening *here*."
- **Neighbor separability** comes from hairline borders + the luminance steps +
  always-on zone labels — never from assigning each division its own hue.
  (Rainbow zones read as data where none exists: "why is North red?")
- **"Needs searchers"** is the one status state: a *dim zone with a live flare*
  — a neighborhood where a pet is missing and nobody's light is on. The
  composition itself is the alarm (a flare burning alone in the dark), backed by
  a small amber chip `⚠ Needs searchers` pinned to the zone — icon + label,
  never color alone. Trigger: live missions > on-duty members in the zone.
- **Rejected: continuous lost-pet-density choropleth.** Dark-red-shaded
  neighborhoods read as a crime heatmap and stigmatize exactly the areas that
  need volunteers; all-time aggregates go stale; 2–6 zones can't support a ramp's
  implied precision; and the flares already *show* density concretely — clustered
  pulsing dots are the honest, self-updating version of the same information.

**The four states a squint must distinguish:**

| Zone look | Meaning | What it makes you feel / do |
|---|---|---|
| Bright, no flare | Watched and calm | Safety — "the lights are on here" |
| Bright + flare | Active response underway | Confidence — help is already out |
| Dim + flare | Mission without coverage | The pull — "bring your light" → Join |
| Dim, no flare | Resting | Neutral; no alarm |

**Interaction (the click):**

- Hover / keyboard focus: zone lifts ~8% luminance, label brightens. Zones are
  focusable; `Enter` opens.
- **Click/tap → zone card**: anchored popover on desktop, bottom-sheet peek on
  mobile. Contents in order: `DIVISION · NORTH AUSTIN` kicker → on-duty avatars
  with glow → live missions as pet thumbnails (`Max · 18h`) → `[Open division →]`
  `[Join]`. Zero-suppression rules apply (a division with nothing live shows
  avatars + "all quiet"). Activating the header or the zone a second time
  navigates; `Esc` / tap-out dismisses. On dim-state zones the join line reads
  **"Keep North Austin lit."** — the metaphor persuades; no instructional copy.
- Legend is a one-line caption under the map (`● on duty · ✦ mission live ·
  dim = needs lights`), not a boxed legend.
- Optional micro-delight, build-gated: a faint radial luminance lift (~8%, 200ms
  ease) follows the cursor inside the map card only — visitors literally sweep a
  flashlight across their city. Ship only if it stays subtle; desktop only.

The network map on `/rescue-forces` (§5.1) speaks the same grammar at city
scale: pin glow = members on duty, flare halo = live mission — one visual
language from the country view down to the street view.

### 5.3 `/rescue-forces/[id]/divisions/[divisionId]` — the division

Visibly one level *down*: no midnight band. Light header with a breadcrumb chip
back to the force, street-level zoom, division-only data.

```
┌ light header ────────────────────────────────────────────────┐
│ [← Austin Rescue Force]   DIVISION · NORTH AUSTIN            │
│ North Austin        6 members · 2 on duty   [Join division]  │
├──────────────────────────────────────────────────────────────┤
│ street-level map: ONLY this zone's boundary, its missions    │
├──────────────────────────────┬───────────────────────────────┤
│ MISSING NOW (division only)  │ CREW (division members only)  │
│ …or watchtower state         │ + sibling-division footer nav │
└──────────────────────────────┴───────────────────────────────┘
```

- **Its own numbers, never the parent's.** If the division has 6 members, it says 6
  while the force says 12 — the difference is what teaches the containment.
- **Public to browse.** Access Denied dies. Leaders see a quiet `Manage` button;
  members see "Propose a division" (existing `DivisionRequest` flow) as a footer
  link, not a nav item.
- No forum, no activity feed at this level — divisions are thin operational slices,
  and thin pages are allowed to be short.

### 5.4 Join flow — one sheet, sensible defaults

Trigger: any Join CTA. A bottom sheet / modal, not a page:

1. **One glance**: "Join Austin Rescue Force" + auto-suggested division from
   geolocation/ZIP ("You're in North Austin's area — [change]").
2. **Optional toggles** (default sensible): weekends / weekdays / nights — maps to
   member availability; skippable.
3. **Done state**: "You're on duty for North Austin." — and *this* is the moment
   the push-notification prompt appears (motivation is at peak), never as an
   ambient popup on browse pages.

### 5.5 Create wizard — keep the bones, move it map-first

The 3-step wizard survives (Basics → Coverage → Review) with two changes: the
coverage step becomes a draw-on-map interaction (drag radius / pick ZIPs, live
preview of the blob), and the review step renders the *actual force card* the
network page will show — you finish by admiring the thing you made.

## 6. The kill list

| Dies | Replaced by |
|---|---|
| Per-force + per-division forums (`PostFeed`, Hot/New/Top, SquadPost UI) | Auto Activity pulse; authored discussion lives in the Hub |
| Sarama welcome post | Nothing (join-sheet done-state carries one warm line) |
| "FEATURED CASES" carousel | MISSING NOW mission cards |
| Four unlabeled stat chips | Vitals row (labeled, color-semantic, zero-suppressing) |
| Division pills in hero | Territory map zones + Crew grouping |
| Access Denied page for divisions | Public browse + role-gated Manage button |
| Full-dark browse theme | House style: light ground, midnight hero, flash accents |
| "Back to Squad" and all Squad-copy leftovers | Force, everywhere |
| Empty-form landing at `/rescue-forces/search` | Network map + force grid at `/rescue-forces` (search filters it) |
| Ambient push-notification popup on browse pages | Post-join done-state prompt |
| Purple register + contradictory data on `/lost-pet/[city]` | House register; force/mission sections consume `ForceCard`/`MissionLiveCard` and the §5.1 data source |
| Fragile dark `/join/[missionId]` page | JoinSheet flow with the mission's pet as the hero |

## 7. Component inventory

New (all on midnight/flash tokens, light ground, `shadow-card`, `rounded-2xl`):

- `ForceCard` — network-grid card w/ coverage thumbnail + pulsing missing-now.
- `TerritoryMap` — Leaflet, the Lantern Map (§5.2.1): midnight tiles, three-step
  luminance zones, flash flares, zone cards on click. (Reuse geometry logic from
  `SquadCoverageMap`; visually a sibling of the Mission Control map, not the SAR
  toolkit itself.)
- `MissionLiveCard` — pet-first live card; `animate-pulse-soft` LIVE dot; single
  flash CTA → Mission Control.
- `VitalsRow` — labeled vitals with zero-suppression rules.
- `CrewRoster` — avatar groups by division, role stars, on-duty glow.
- `ActivityPulse` — renders `SquadActivity` events; no compose box.
- `ReunionShelf` — photo strip, render-only-when-nonzero.
- `LevelKicker` — the `RESCUE FORCE · CITY` / `DIVISION · NAME` chip grammar.
- `JoinSheet` — the one-screen join flow.

Deleted: `PostFeed`, `FeaturedMissionsCarousel`, per-division feed wiring, division
Access-Denied page, dark page shells under `app/rescue-forces/`.

## 8. Data already there (no schema changes required for v1)

Everything the design needs exists today: coverage geometry on both `RescueForce`
and `Division` (`centerLatitude/Longitude`, `radiusMiles`, `customBoundary`,
`zipCodes`); capability + availability flags (`hasDrones`, `hasTrackingDogs`,
`availableNight/Day/Weekdays/Weekends`); performance (`successfulReunions`,
`avgResponseTimeMinutes`, `totalSearchHours`); gamification (`rescueSquadLevel`,
`squadPoints`, `badges`); per-member truth (`role`, `divisionId`,
`availabilityStatus`, `casesParticipated`, `successfulReunions`); events
(`SquadActivity`); live missions via `CaseAssignment` → `Case`. The redesign is a
presentation-layer project. (One denormalization to verify while building:
division-level mission counts — `Division.activeCases` exists but confirm it's
maintained.)

## 9. Mobile order (single column, per level)

Identity → Join → vitals → MISSING NOW → territory map → crew → activity/reunions.
The missing-pet card must be reachable in one thumb-scroll. Maps render as fixed-
height cards (~44vh), never page-height. Sub-headers follow the global chrome rule
(`sticky top-16`, no page-owned `sticky top-0` — `docs/APP_MAP.md` §8.2).

## 10. Acceptance criteria (the definition of "guides the mind")

1. **5-second test**: a stranger shown the force page can answer "what is this?"
   ("a volunteer team that searches for lost pets in Austin") without reading body
   copy. Same test on a division page yields "a neighborhood crew of that team."
2. **Squint test**: force page and division page are distinguishable as
   parent/child at 10 px blur — different hero weights, different map zooms.
3. **Zero instructional copy** — no "here's how you can help" anywhere.
4. Every number is labeled with a noun and a state; **no rendered zeros**, no
   identical stat rows on parent and child.
5. **One flash-filled CTA per screen.**
6. Light theme on all browse pages; dark begins only past the mission threshold.
7. No forum UI outside the Hub; no empty-state that asks the user to fill a void.
8. All routes keep link-preview metadata (`__tests__/link-previews.test.js`) and
   the global chrome contract (`__tests__/global-chrome.test.js`) green.

## 11. Build phases

1. **Force page core** (hero, vitals, MISSING NOW, TerritoryMap, CrewRoster,
   ActivityPulse) — 80% of the perceived fix.
2. **Network landing** (map + ForceCard grid replacing the empty search form).
3. **Division pages** (public browse, level-down composition, Manage gating).
4. **JoinSheet** + relocated push prompt; **create wizard** map-first reskin.
5. **Cleanup**: delete dead components/routes, purge "Squad" copy, redirects
   (`/rescue-forces/search` → `/rescue-forces` with `?q=` preserved), screenshot
   sweep + APP_MAP update.

Each phase ships independently; the force page alone (Phase 1) already converts
the worst screenshots into the best ones.
