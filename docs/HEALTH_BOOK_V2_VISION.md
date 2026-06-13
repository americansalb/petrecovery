# What the Book Knows: Health Book v2

The deep answer to two questions: what does a pet owner actually NEED
across a pet's whole life, and what becomes POSSIBLE here that nobody
has built, because nobody else holds what this platform holds. This
supersedes the v1 surface (stamps + weight + vet card) and gives the
care plan its real definition. Companion to PRODUCT_IA_PLAN.md.

## 0. The unfair advantages (why "possible" is different here)

Every pet product holds one fragment. This platform holds five at once:

1. An owner-held longitudinal record (the Book)
2. Daily rhythm telemetry (doses, routines, weights: a behavioral
   sensor that runs itself because checking things off is the product)
3. A geographic community graph (Rescue Forces are neighborhood cells)
4. The worst-day machinery (record becomes rescue mission)
5. AI parsing already in production (medication labels)

Everything in §2 is an intersection of two or more of these. That is
the test for "no one has thought about it": if it needs only one
asset, someone else can build it.

## 1. What is NEEDED: the owner's real jobs, whole-life

A pet's life: adoption → maintenance → chronic condition (often
years) → senior decline → end of life. Plus crises: emergencies,
surgery, getting lost, disasters, owner incapacity. The needs, in
order of how badly current tools fail them:

**N1. Memory the owner doesn't have.** Vets ask "when did the limping
start?", "how long has she been drinking more water?" Nobody knows.
The single most valuable medical data (the slow change before the
diagnosis) is exactly the data nobody writes down. The missing
primitive is the OBSERVATION: a 10-second timestamped note, photo, or
voice memo ("limping again, back left"). Everything intelligent below
feeds on this primitive.

**N2. The condition is the unit of care, not the medication.** Owners
think "Max's arthritis", not "carprofen 75mg BID". A CARE PLAN is the
connective tissue: this condition → treated by these meds on these
schedules → watched by these measurements and observations → with
these review dates. Once plans exist, "Today" is not a feature beside
health: it is today's slice of every active plan plus the happy
routines. (This closes the tangle: Today renders plans, it doesn't
own medical content.)

**N3. Translation across contexts.** The same record must speak to: a
vet (clinical summary), an emergency vet at 2am who has never seen
this pet (critical facts first: weight for dosing, conditions, current
meds, allergies), a sitter (operational), a boarding facility (vaccine
proof), an insurer (claim documentation), a finder (urgent needs +
contact), a new owner (full handoff). One book, many faces; we built
three, the record needs them all as first-class exports.

**N4. The visit loop.** Before: a one-tap brief ("since last visit:
weight down 0.8 lb, adherence 94%, 6 observations, your 3 saved
questions"). After: photograph the discharge papers and the Book reads
them (the AI parse pattern already shipped for med labels) into
conditions, meds, and instructions, which update the plan, which
updates Today. The Book maintains itself at exactly the moments
information enters the world. This is the killer mechanic: it deletes
the data-entry problem that kills every health record product.

**N5. Shared care without shared anxiety.** Multi-caregiver households
and chronic meds (insulin every 12h) make missed/double doses
dangerous. The dose engine already handles this; the plan layer adds
handoff confidence: the sitter packet becomes "everything active in
the plans, printable, with the 2am face on top."

**N6. Money is medical.** People delay care they can't predict. The
Book should know costs (visit amounts, med refills) and forecast the
year (vaccines due, refill cadence), and its records ARE insurance
claim documentation (InsurancePolicy/InsuranceClaim models already
exist in the schema, unwired).

**N7. The hardest chapter.** Senior decline and "is it time?" A
humane quality-of-life check-in (the veterinary HHHHHMM scale exists
for this) tracked gently over time turns the most agonizing decision
a pet owner ever makes into informed love instead of guilt. No
consumer product does this with any care. This is "for the benefit of
the world" territory.

**N8. The record outlives the relationship.** Pets are rehomed,
inherited, fostered; owners move, get sick, die. A continuity
protocol: a designated successor (godparent) who can claim the Book
intact (PetShare + OwnershipHistory models already exist). Records
that die at institutional boundaries are the status quo; a record
that follows the animal is the point.

## 2. What is POSSIBLE that no one has thought about

**P1. Neighborhood pet health signals (the moonshot).** Aggregate,
anonymized, opt-in rhythm data across geographic cells (Rescue Forces
ARE the cells): five dogs within two miles starting GI medications in
the same week is an outbreak, a toxin, or a bad food batch, visible
DAYS before any official channel. Wastewater epidemiology, but for
pets, powered by check-offs people already do. Parvo clusters, blue-
green algae, recall detection. Nobody can build this without both the
rhythm data and the geography. (Assets: 2+3.)

**P2. Drift detection.** The care log is a passive sensor. Walk
completion sliding, appetite routines declining, weight slope
turning, PRN pain meds creeping up: "Max's pattern changed this
month" is an early-warning nudge built from data that already exists,
phrased as observation, never diagnosis. (Assets: 1+2.)

**P3. The 2am triage face.** Not "is this serious?" answered from a
generic symptom list, but framed by HIS record: species, breed, age,
weight, conditions, current medications (interactions matter: "he is
on an NSAID, do not give X, tell the ER vet Y"). Output is always
"what to do and what to tell a vet now", never a diagnosis. Possible
only because the record is held. (Assets: 1+5.)

**P4. The record that rescues, deepened.** Mission urgency derived
from the plan ("diabetic, last insulin 14h ago" escalates the search
tier automatically); the finder's face of the Book attached to every
mission and collar QR (urgent needs, vet, owner). The two halves of
the product feed each other in both directions. (Assets: 1+2+4.)

**P5. Collective playbooks.** When a plan starts for a new diagnosis,
the Hub's accumulated experience for that condition+species (questions
to ask, what helped, what it costs) surfaces beside it, community
wisdom clearly marked as stories, not medicine. (Assets: 1+3.)

## 3. The Book's real table of contents (the red-line skeleton)

1. **Conditions & Care Plans** (the spine; each plan links meds,
   monitoring, observations, review dates)
2. **Medications** (current + past, each tied to a plan where known)
3. **Observations** (the journal: notes, photos, voice; promptable)
4. **Vitals** (weight now; body condition, appetite scale later)
5. **Vaccinations** (stamps, as shipped)
6. **Visits & Documents** (prep briefs, discharge parsing, files)
7. **Allergies & Alerts** (front of book, every face leads with them)
8. **Costs & Insurance** (ledger, forecast, claim export)
9. **Quality of Life** (senior mode, off until invited)
10. **Continuity** (successor, transfer, the finder face, exports)

Today = today's slice of 1+2+4 plus the good stuff. The Overview
strip stays one line. Faces (N3) are views over this one structure.

## 4. Discoverability, fixed at the root

- The pet creation wizard asks two more taps: "Any conditions?"
  "Any medications?" The Book is born alive, not discovered later.
- The /care landing shows a real populated Book (the depth is the
  pitch), not feature cards.
- The nav item stays; the landing page becomes a tour of an actual
  record.

## 5. Build order (each step usable alone)

1. Observations + Conditions/Care Plans (the spine and the primitive
   everything else eats)
2. Today re-rooted on plans; wizard asks the two questions
3. Visit loop (prep brief + discharge photo parsing)
4. Faces: 2am/emergency face and finder face; landing page becomes
   the populated tour
5. Costs + insurance wiring; continuity protocol
6. Drift nudges; QoL senior mode
7. Neighborhood signals (opt-in, anonymized, with a public health
   dashboard per Rescue Force)

Liability posture throughout: the Book records and reminds; it never
diagnoses. Every intelligent surface phrases output as observations
and questions for a vet.
