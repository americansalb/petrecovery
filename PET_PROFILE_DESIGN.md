# The Pet Profile: Design Constitution

What the profile is, what goes in it, how it stays uncluttered as it
grows, how data stays trustworthy, and why a pet owner would choose
this over everything else. Every future addition to /pets/[id] gets
measured against this document.

---

## 1. The thesis: one record, two lives

Every other product holds half the picture. Vet apps hold records.
Trackers sell hardware. Alert sites hold lost posters. ReunitePets
holds the only thing none of them can: **the same record serving the
pet's daily life AND their worst day.**

Every field in the profile must do double duty:

| Field | Daily life | The day they go missing |
|---|---|---|
| Photos | memories, sharing | flyer and poster assets, instantly |
| Coat colors (validated swatches) | identity | accurate search descriptions on flyers and briefs |
| Size / weight / age | health tracking | probability-zone radius tuning (already wired into mission maps) |
| Personality ("shy", "do not chase") | knowing your pet | the helper's 10-second brief in Mission Control (already wired) |
| Microchip / collar | records | verification when found |
| Medication schedule | the daily tracker | **search urgency: "needs seizure medication by 8 PM" changes how a neighborhood searches** |
| Care team | shared chores | the instant seed of a search party: people who already love this pet |
| Care routines | the happy stuff | behavior patterns for searchers ("walks the lakefront at 6 PM daily") |

That last column is the moat. Nobody else can render a mission brief
from a medication schedule, because nobody else holds both. **A
complete profile is a pre-built rescue mission.** This is the benefit
no one else offers, and it is why profile completeness matters enough
to design for (see Rescue Readiness, section 5).

## 2. The room plan: tabs are jobs, not data types

A tab exists because a PERSON has a recurring JOB, not because a
database has a table (the lesson of the care-on-the-meds-page bug,
paid for twice).

Today's hallway (amended per docs/PRODUCT_IA_PLAN.md: rooms are jobs,
and the jobs are STATE / RHYTHM / RECORD / PEOPLE):
- **Overview** - STATE. The glance: readiness, status strips, identity.
- **Today** - RHYTHM. The one checklist: med doses and care routines,
  the week strip. The only surface where anyone taps "done".
- **Health Book** - RECORD. Medications (list, schedules, supply),
  vaccine stamps, weights, conditions, the vet, the story. Everything
  a vet would ask. (Absorbed the old Meds management and the reserved
  Health room.)
- **Sharing** - PEOPLE. Team, invites, view link. Grows: the sitter packet (section 6).

Reserved rooms (build when the job is real, never before):
- **Health** - vet records, vaccinations with expiry, weight-over-time,
  conditions, documents, vet contact. Distinct from Meds: Meds is a
  daily ACTION surface, Health is a REFERENCE surface; different
  rhythms, different rooms.
- **Memories** - photo timeline, milestones, reunion stories. Only if
  the emotional job proves real.

## 3. The anti-clutter laws

1. **The Overview owns nothing.** It renders summaries of rooms, max
   one card per room, each linking into its room. Add a feature = add
   it to a room + optionally one summary line. The Overview can never
   grow past one screen of cards.
2. **New data joins an existing job before it earns a tab.** A tab
   must answer a daily-or-weekly need; rarities live inside rooms
   behind plain headings.
3. **Five tabs maximum on a phone.** When a sixth job becomes real,
   the rarest-used room folds into another before a new one opens.
4. **Every field earns its keep in both columns of the table above**,
   or it lives in a collapsible "More details", or it does not exist.
5. **One source of truth.** The Pet row is canonical. Cases copy pet
   facts once, at report time, deliberately (a flyer must not change
   under a searcher's feet). Nothing else duplicates pet data.

## 4. Validation: structured where search needs it, free where love needs it

- **Colors** come from the swatch system (lib/petAppearance), never
  free text: search descriptions and flyers depend on it.
- **Breeds** come from species-scoped lists with an escape hatch.
- **Microchip** is format-validated (9-15 alphanumeric, existing
  MICROCHIP_REGEX); shown masked-last-4 in public contexts.
- **Dates are dates, weights are numbers with units**, so charts and
  expiry warnings stay possible.
- **Free text is for stories** (personality details, medical notes),
  never for anything a searcher or a system must parse.
- **The wizard pattern is the entry style** (one decision at a time,
  validation inline) for anything longer than two fields.
- **Nothing beyond name + species + one photo is ever required.**
  Completeness is invited (section 5), never demanded.

## 5. Rescue Readiness: the flagship to build next

The one feature that operationalizes this whole document: a meter on
the Overview scoring how mission-ready the profile is, each gap a
one-tap fix:

- Clear face photo (flyer-quality)
- Colors validated from swatches
- Microchip on file
- Behavior notes present (feeds the helper brief)
- Size/weight current (tunes the probability zones)
- At least one care-team member or an active view link
- Emergency contact reachable

Score it visibly ("Rescue ready: 5 of 7"). Frame it as protection,
not homework: "If Yamaraj ever slipped out, here is what the search
party would already know." Completing it IS the product's promise made
tangible, and no competitor can copy it without owning both halves of
the record.

## 6. The sitter packet: Sharing's next chapter

The view link already shows the care record to anyone. Evolve it into
the handoff document every owner actually needs: one link containing
feeding, meds with times, routines, quirks, vet contact, emergency
contacts, and the request-caretaker button. "Going away for a weekend"
is the most common pet-data emergency there is; we already have every
ingredient.

## 7. What this means for the next ten features

Before building anything on the profile, three questions:
1. Which room's job does it serve? (No room, no build.)
2. What does it contribute to the lost-day column? (Nothing, think twice.)
3. Is its data structured enough for a flyer to consume? (No, fix entry first.)
