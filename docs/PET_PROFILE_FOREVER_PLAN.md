# The Forever Profile: Make It Once, Use It for Life

**Companion to [PET_PROFILE_DESIGN.md](../PET_PROFILE_DESIGN.md)** (the design
constitution — rooms, anti-clutter laws, validation rules). That document
defines what the profile *is*; this one plans where it *goes*: how a profile
created once serves a pet for their whole life, every home they live in, and
their worst day — free, forever.

Current state (screenshots in `/screenshots`, `auth-34…41`, `pub-20`): four
rooms (Overview, Care, Meds, Sharing), pet switcher, live missing-pet banner
wired to Mission Control, dose checklist with week strip and supply tracking,
care team with invites and a public view link. The foundation is real. What
follows is sequenced by leverage, and every item cites the schema that already
exists for it — most of this plan is *connecting* built pieces, not building
new ones.

---

## Pillar 1 — Permanence: the record outlives everything

A "forever" record must survive the four things that kill pet records today:
a lost phone, a changed owner, a dead app, and a forgotten password.

### 1a. Ownership transfer (adoption, rehoming, inheritance)
The single biggest "make once, use forever" gap. When a pet changes hands
today, the record dies with the old account.
- Flow: owner taps "Transfer Max" → enters new owner's email → recipient
  accepts → full record moves (meds, dose history, photos, microchip), old
  owner optionally stays as VIEWER for 30 days.
- Schema: **`OwnershipHistory` already exists** for the chain of custody;
  `PetShare` roles handle the transition window. Needs one API + one screen.
- The dose history is medical data and never breaks: `MedicationAuditLog`
  and tombstoned doses (`deletedAt`) already guarantee that.

### 1b. The Pet Passport (export = trust)
"Forever" means *even if we disappear*. People trust records they can take.
- One button: "Download Max's record" → clean PDF (identity, photos, chip,
  meds + schedule, dose history, vet, care notes) + a `pet.json` machine copy.
- Reuses the flyer PDF pipeline (`lib/flyerGenerator.js`) — same skeleton,
  different content. The meds export button on the Meds tab is the precedent.
- This is also the boarding/kennel/travel document and the shelter intake
  packet (Pillar 4).

### 1c. Account-loss recovery
A profile shared with one caregiver is a profile that survives a forgotten
password. Nudge every solo owner to add one care-team member or print the
passport ("a record this important deserves a second keyholder"). No new
schema — `PetShare` is it.

### 1d. Memorial mode
Pets die; deleting fifteen years of record is cruel, and "is Buddy still with
us?" is data shelters need. Add `Pet.status: ACTIVE | MEMORIAL` (one enum +
soft styling: profile goes quiet, meds stop reminding, photos remain).
Cheap, deeply loved, and it closes the record honestly.

## Pillar 2 — Rescue Readiness: the profile IS the rescue (build first)

The constitution's section 5, and the highest-leverage feature in this plan.
**A complete profile is a pre-built rescue mission** — that is the moat no
competitor holding half the record can cross.

- Meter on Overview: "Rescue ready: 5 of 7" — face photo, validated colors,
  microchip, behavior notes, current weight, one care-team member or view
  link, reachable contact. Each gap is a one-tap fix.
- Frame as protection, never homework: *"If Max ever slipped out, here's
  what the search party would already know."*
- The payoff is already wired: the missing-pet banner → Mission Control flow
  exists; report/new can prefill every field from the profile (photo →
  flyer, weight → probability radius, personality → helper brief,
  **medication schedule → search urgency**: "needs seizure meds by 8 PM"
  changes how a neighborhood searches).
- Done = a pet owner can go from "Max is gone" to a live, fully-briefed
  mission in under 60 seconds, because they filled the profile on a calm
  Sunday two years ago. That's the product's promise made tangible.

## Pillar 3 — Free care tools that earn daily love

The meds tracker is the proof: serious tools, free forever. Each addition
below joins an existing room (no new tabs — constitution law #3).

- **Dose reminders that arrive** (Meds): push at dose time, escalate to the
  care team if unlogged 30 min later. `PushSubscription`,
  `EmailPreference`, `SmsPreference` all exist; the tracker computes due
  slots already. The "escalate to family" half is something no free app does.
- **Refill radar** (Meds): `quantityRemaining`/`refillAlertAt` are already
  in the schema and UI — add the notification when supply crosses the line.
- **The sitter packet** (Sharing; constitution §6): evolve the view link
  into the weekend-handoff document — feeding, meds with times, quirks, vet
  contact, emergency numbers, "request caretaker" button. Every ingredient
  ships today; this is assembly.
- **Health room, when the job is real** (reserved room): vaccination
  records with expiry warnings ("Rabies due in 3 weeks" is a legal issue in
  most states), weight-over-time chart, vet visits, documents. Distinct
  job from Meds (reference vs. daily action) — earns its tab the moment
  vaccine expiry lands.
- **Care streaks & gentle rhythm** (Care): the joys history exists; show
  streaks and weekly rhythm. Warmth, not gamification.

## Pillar 4 — For the benefit of the world

The profile as infrastructure for everyone who touches a pet's life:

- **QR collar tag (free, printable)**: generate a QR from the pet's public
  view token → finder scans → sees "I'm Max, I'm chipped, here's how to
  reach my family" (contact relayed, never exposed) → one tap reports a
  found-pet sighting into the mission system. A printable tag template
  costs us nothing and beats $30 smart tags. Token rotation already
  revokes lost tags.
- **Disaster mode**: in an `EmergencyEvent` radius (model exists, with
  `PetEvacuation`), every profile becomes an evacuation card — photo, chip,
  meds, carrier notes — and shelters in the region can accept the passport
  digitally. Built once, lifesaving forever.
- **Shelter handoff**: when a found pet lands in a shelter, the passport is
  the intake record (`ShelterIntake`, `ShelterMatch` exist). A chip match
  against profiles reunites without a single phone call.
- **Multilingual care cards**: the i18n scaffolding exists (en/es/fr) —
  sitter packets and QR landing pages in the caregiver's language.
- **Open data door**: the `pet.json` export doubles as our anti-lock-in
  pledge: your record was never hostage. Trust is the growth engine a free
  product runs on.

## Pillar 5 — Trust & liability (shipped with this plan)

The care tools touch medication, so the legal posture is: **honest, calm,
one sentence at a time — never scary.**

- **Terms of Service** now carries a "Pet care tools" section (DB doc bumped
  to v1.1.0 with a boot-time sync; the prose page at `/legal/terms`
  matches): helper-not-vet, your judgment leads, reminders can fail,
  release folded in once. Registration's existing terms checkbox covers
  acceptance — no extra signature step, no scare.
- **In-product tone**: one quiet line on the Meds tab and the public care
  page — *"Free forever. A helper for remembering — your vet's guidance
  always comes first."* Reassurance and disclaimer in the same breath.
- **Already-built trust spine** worth advertising: dose history is
  tombstoned, never deleted (`MedicationAuditLog`); view links rotate;
  public pages mask the microchip to last-4; care pages are noindex.

## Build order (each phase ships value alone)

| Phase | What | Size | Why first |
|---|---|---|---|
| 1 | Rescue Readiness meter + report-from-profile prefill | M | The moat; makes every other field worth filling |
| 2 | Dose push reminders + refill alerts | M | Daily-love loop; all plumbing exists |
| 3 | Pet Passport PDF/JSON export | M | Permanence promise + sitter/boarding/shelter document |
| 4 | Ownership transfer + memorial mode | M | Closes the "forever" gaps |
| 5 | Sitter packet (view-link evolution) | S | Constitution §6, pure assembly |
| 6 | QR collar tag + found-flow landing | M | World-benefit flagship, viral surface |
| 7 | Health room (vaccines w/ expiry, weight chart) | L | Earns the fifth tab |
| 8 | Disaster mode + shelter handoff | L | Builds on passport + emergency models |

Every phase passes the constitution's three questions (which room's job,
what's the lost-day contribution, is the data flyer-structured) — they were
checked at the table above.
