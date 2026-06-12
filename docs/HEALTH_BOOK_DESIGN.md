# The Health Book: presenting the pet EMR

How an owner-held medical record gets presented so people love filling
it in. Companion to PET_PROFILE_DESIGN.md (this is the reserved
"Health" room, now earning its tab). The internal frame is "pet EMR";
that acronym never reaches the UI.

## 1. The metaphor: a book, not a filing cabinet

Owners already know one warm medical object: the vaccination booklet
the vet stamps. We present the record as "{Pet}'s Health Book."
Entries are stamps, not rows. A stamped page feels collected;
a database table feels like homework. Every presentation decision
below follows from the book metaphor.

- Vaccines render as STAMPS: rounded badge, vaccine icon, name, date,
  and a status ring (emerald: protected / amber: due soon / red:
  expired / slate: unknown).
- The book fills visibly. Empty slots are dashed ghost stamps that
  invite a tap ("Rabies: add the certificate"), the same move as the
  Care room's seed chips.
- History (visits, weights, notes) reads as a TIMELINE, the pet's
  story, newest first: "Mar 3: 65 lbs, annual checkup, all clear."

## 2. Status before data

The owner's question is never "list my records"; it is "is anything
wrong or due?" The room opens with one sentence, exactly like the
Rescue Ready strip:

- All good: "Protections current. Next: rabies booster in 3 months."
- Action needed: "Bordetella expired in May. One tap to update."

One sentence, one accent color, one next action. The stamps and
timeline live below for whoever wants the detail.

## 3. One record, three faces

The same data presents differently per audience. This is the whole
trick of the feature:

1. **Owner face** (the Health tab): status line, stamps, weight
   sparkline, conditions chips, documents, vet card. Warm, nudging.
2. **Clinical face** (the share/view link, printable): what a vet or
   sitter scans in 20 seconds, in their order: allergies and
   conditions first, current medications with doses, recent vaccines
   with dates, weight trend, owner and chip ID. Dense, neutral,
   zero cuteness. The existing tokenized view link grows this section;
   "hand this link to any vet" is the product's portability promise.
3. **Worst-day face** (mission brief): only what changes a search:
   urgent medication windows ("seizure meds by 8 PM"), conditions
   affecting behavior, and proof-of-ownership pointers. Already the
   moat per PET_PROFILE_DESIGN §1; the Health Book feeds it.

## 4. Entry must feel like magic, not forms

Data entry kills medical records. Presentation of INPUT matters as
much as output:

- Primary path: photograph the certificate or label. The AI parse
  pattern already exists for medications (/api/ai/parse-medication
  with a non-AI fallback); certificates are the same move. The mock
  shows "Snap the certificate" as the hero action on every ghost stamp.
- Secondary path: tap-first manual entry in the existing vocabulary
  (chips for vaccine types, stepper dates, swatch-level simplicity).
- Weight: one number, one tap, chart draws itself (recharts is
  already a dependency).

## 5. Placement and restraint

- Fifth tab: Overview · Care · Meds · Sharing · Health. That is the
  constitution's maximum; no sixth room without folding one.
- The Overview gets ONE summary line (status sentence, linking in),
  per the anti-clutter laws.
- Meds stays the daily ACTION surface; Health is the REFERENCE
  surface. Dose logging never moves here.
- Conditions/allergies are structured chips (search and the clinical
  face need parseability), with a free-text notes field for stories.

## 6. The marketing face

The landing pitch upgrades from "medication tracking" to:
"Your pet's complete health book. Free forever." Vaccines, weights,
meds, documents, one shareable link any vet can read. The lost-pet
safety net is the quiet closing line, not the headline. SEO targets:
"pet medical records," "pet vaccination tracker," "dog health record
app." The word EMR appears only in docs like this one.

## 7. Trust presentation

- Soft, constant disclaimer in the room's footer (mirrors Meds):
  "A record you keep, not medical advice. Your vet's guidance comes
  first."
- Tokenized share links stay noindex (already enforced); documents
  inherit the same privacy posture.
- Nothing here diagnoses. Status colors come from dates the owner
  entered (expiry math), never from interpretation of health data.
