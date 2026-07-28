# Product IA: one home, two doors, one record

The deep plan for how ReunitePets presents two products without being
confusing, and how the pet profile organizes health as ONE domain.
Supersedes the tab layout in PET_PROFILE_DESIGN.md §2 (amendment at
the end). Status: site-level doors are buildable immediately; the
profile restructure (§3) is a breaking IA change gated on owner
approval.

## 1. The diagnosis

Three findings, all the same root cause:

1. **Meds and Health are siblings, but meds ARE health.** The current
   five tabs mix two organizing principles. Care (rhythm), Meds
   (rhythm AND record), Health (record). A person looking for "my
   pet's medical stuff" faces two doors and can't predict what's
   behind either. Organizing by DATA TYPE was the mistake; the true
   axes are rhythm (today's actions) and record (what's true).
2. **The daily product is invisible.** Nothing on the homepage or in
   the navigation says "you can keep your pet's health here." The
   only people who find the profile are people who already lost a pet.
3. **One hero can't carry two promises.** "Every lost pet deserves a
   search party" and "your pet's complete health book" are both true
   and cannot share a headline. Trying to be both things in one
   breath makes us neither.

## 2. Site level: one home, two doors

The umbrella: **ReunitePets is your pet's home. Every day, and on the
worst day.** Each door gets its own surface and its own promise; the
shared account and the shared record are the bridge.

- **Door 1, the worst day** (already built): the homepage hero,
  Lost & Found, report flow, rescue forces. Involuntary demand;
  arrives via search and shared links. No change.
- **Door 2, every day** (to build):
  - `/care` landing page: "Your pet's complete Health Book. Free
    forever." Meds with one-tap logging, vaccine stamps, weight
    chart, the sitter/vet share link. The safety-net line appears
    once, at the bottom, as the quiet kicker. SEO targets: pet
    medication tracker, pet vaccination record, pet health app.
  - **Navigation**: a top-level "Pet Care" item, visible logged-out,
    linking to `/care`. Logged-in users already have My Pets. The nav
    naming the second product IS the framing fix.
  - **Homepage lane**: one section after the missions block:
    "Not lost? Keep it that way." Three feature chips and a CTA to
    `/care`. The hero stays 100% rescue.
- **Growth loop stays the share link**: every care/vet link a member
  sends shows a non-member a working Health Book with a join path.

## 3. Profile level: rhythm and record (the restructure)

Four rooms, two organizing principles, zero ambiguity about where
anything lives:

| Tab | Principle | Contents |
|---|---|---|
| **Overview** | state | readiness, status strips, about, photos |
| **Today** | rhythm | ONE checklist: med doses + care routines, the week strip, streaks. The only place anyone taps "done". |
| **Health Book** | record | medications (list, schedules, supply, history), vaccine stamps, weights, conditions, vet card, documents, export. Everything a vet would ask. |
| **Sharing** | people | team, invites, view link |

What moves:
- Meds tab's day card + week strip → **Today** (merged with care
  chips; one unified checklist sorted by time).
- Meds tab's "All medications" + add/edit/pause + backup → **Health
  Book**, as its medications section.
- Care tab's routine management → Today (chips) and its "Recent joys"
  → the Health Book story (or stays under Today; decide in build).
- The Health Book keeps stamps, weights, vet, story, and gains the
  medications section at the top (a vet's first question).

Mechanics:
- Routes: `/pets/[id]/today` and `/pets/[id]/health`;
  `/pets/[id]/medications` and `/care` sub-tab 301/redirect into them
  (muscle memory and old links keep working). The medications/new
  wizard stays, reached from the Health Book.
- The Overview's strips become: Today (doses + routines in one line),
  Health Book, Care team. Three strips, unchanged count.
- The public view link mirrors the same split: today's schedule for
  sitters, the record for vets. Already mostly true.
- PET_PROFILE_DESIGN.md §2 amended: rooms are jobs, and the jobs are
  STATE / RHYTHM / RECORD / PEOPLE. Five-tab cap becomes four plus
  Overview, satisfied forever.

Risks and answers:
- "Today" must stay fast: it renders ONLY actionable slots; the
  moment it loads reference material the merge has failed.
- Caregiver permissions unchanged (same APIs, same access rails).
- No schema changes at all; this is pure presentation IA.

## 4. Naming truths

- "Health Book" is the product noun for the record, everywhere:
  profile tab, landing page, share link, marketing.
- "Today" is the action surface. Not "Care", not "Meds": those words
  become sections inside the book and labels on chips.
- The acronym EMR never appears in UI (HEALTH_BOOK_DESIGN.md §6).

## 5. Build order

1. Site doors (no approval needed; twice specified): `/care` landing,
   nav item, homepage lane. Link previews per docs/LINK_PREVIEWS.md.
2. Profile restructure (gated on owner approval of §3): build Today,
   fold meds list into Health Book, dissolve Care tab, wire redirects,
   amend the constitution, update Overview strips, re-verify all
   flows (dose logging, care chips, stamps) by driving the app.
3. Follow-ons: "snap the certificate" parsing, documents, landing
   page screenshots refreshed from the final UI.

## 6. Three doors, one record (amendment, 2026-07-27)

The "two doors" of §2 gain a third, and the doors become wearable. One
account, three hats — **Owner / Searcher / Shelter** — chosen with the
account switcher (`AccountModeSwitcher`, fed by `/api/account/modes`),
never in settings. A hat is UI EMPHASIS ONLY: presentation re-aims,
permission is always re-derived server-side, and switching hides
nothing and loses nothing.

Naming decision: the middle hat is **Searcher** (not "Rescuer", which
implies housing animals). It matches the product's own language: search
party, "3 searching", "Join the search".

Rules (Phase A shipped 2026-07-27):

1. **The chrome wears the hat.** `HatContext` (`app/contexts/`) holds
   owner|searcher, persisted per device; the top bar's CENTER link set
   and the mobile tab bar swap with it. Owner: My Pets · Pet Care ·
   Lost & Found · Shelters · Hub. Searcher: Lost & Found · Rescue
   Forces · Hub. Bar geometry, logo, the Report CTA, and the session
   slot are hat-invariant. Shelter is a PLACE, not a bar state: the
   /my-shelter portal owns its chrome, and "switching to Shelter" is
   navigation.
2. **Deep links auto-switch.** A searcher-world URL (/rescue-forces,
   /mission-control, /divisions, /join) puts the searcher hat on; an
   owner-world URL (/pets, /care, /my-alerts) the owner hat; shared
   surfaces (hub, lost-and-found, shelters directory, report flows)
   never switch. Nobody lands in a chrome that mismatches the page.
3. **The searcher door is always offered** — it is the recruitment
   door. Members land on their force; everyone else lands on
   /rescue-forces/search. The shelter door renders for hat-holders as
   their shelter, and for everyone else as the quiet "Shelter Portal"
   discovery link.
4. **Report is never behind a hat.** The emergency action stays global
   in every chrome, desktop and mobile.

The universal-navbar rule (APP_MAP §8.2) is amended accordingly:
identical on every route *per hat*; hat conditionals are session-state,
not route conditionals, and remain enforced by
`__tests__/global-chrome.test.js`.

Phase B (open): per-hat home surfaces (a searcher dashboard leading
with missions near you), duty toggle in the searcher bar, hat-aware
notification preferences.
