# The lost-pet report: what we ask, why, and where each answer goes

Founder brief, 2026-11-06: the flyers are only as good as what the report
knows. People in a panic do not think of the things a finder needs, so the
report has to ask. Ask more, but stay fast. Make every extra detail easy to
add and easy to skip. Ask about reward and make the owner acknowledge how
reward scams work. Ask about medication and conditions.

This document is the plan and the spec. The code that implements it:

- `frontend/app/lib/caseDetails.js`: the question set, the allowed answers,
  the sentence each answer produces, and `normalizeDetails()`. One source
  for the wizard, the APIs, the pet's page and the flyers.
- `frontend/app/report/new/page.js` and `frontend/app/components/report/*`:
  the wizard and the details hub.
- `frontend/app/api/reports/create/route.js`, `frontend/app/api/missions/[missionId]/route.js`:
  storing and editing.
- `frontend/app/lib/cascade/render/flyers/normalize.js`: the flyers read it.

## 1. Who fills this in

Someone whose pet vanished minutes or hours ago. They are standing in the
street with a phone, or at the kitchen table shaking. They have a minute
of attention, and they will not think of what a stranger needs to know.
Two jobs, in this order:

1. Get the alert out with the few facts that let a stranger recognise the
   pet and reach the family: photo, where, when, name, species, contact.
2. Draw out, one tap at a time, the facts that change what a finder does:
   run after the dog or sit down; call the number tonight or in the
   morning; look for a red collar; shake a treat bag.

Everything in job 2 is optional. Nothing in job 2 is hidden.

## 2. What actually finds pets

From what shelters, lost-pet recovery volunteers and our own reunions
show, in order of weight:

1. A clear photo. Nothing else comes close.
2. Where and when the pet was last seen. The search area.
3. A phone number that answers.
4. How the pet behaves with strangers. This decides the single most
   important line on a flyer. A scared dog in flight mode runs from
   everyone, its owner included; one person chasing it pushes it a mile.
   A friendly dog can be leashed by anyone. An indoor cat hides within a
   few houses and will not come out for a stranger.
5. Medical urgency. Insulin, seizure medication, a heart condition, an old
   or blind animal: the finder has to act now, and the search is urgent.
6. Identification a finder can use: a collar and its colour, a tag, a
   microchip (the shelter scans for it), markings, sex and whether the
   animal is fixed (an intact male roams far).
7. What the pet comes to: its name, a shaken treat bag, a squeaky toy, a
   familiar voice. What it is afraid of: men, children, other dogs.
8. How it got out. Spooked by fireworks means it bolted far. Slipped a
   collar means no ID. Lost from a car or a vet away from home means it is
   hiding close, in a place it does not know. Dragging a leash means it
   can get caught and is easy to spot.
9. Places it knows: an old home, a friend's house, the park it walks to.
10. A reward. It raises attention and it invites scams.

The report asks for all ten. Only the first three and the contact block the
posting.

## 3. The rules of the form

- One question per screen. The tap is the answer. Typing only where a
  choice cannot do the job (name, phone, a note).
- Every optional question has a visible skip and a "Not sure" answer.
- The three questions that change the flyer most (behaviour, health,
  reward) are asked before posting, one tap each.
- Everything else is asked after posting, as a checklist the owner can
  work through in any order: on the page after posting and on the pet's
  page in the owner's panel, one tap each, with what is answered and what
  is not. (2026-11-06 the nine questions were moved into the wizard, four
  of them required; 2026-11-07 the founder cut them back out: twenty-one
  screens before posting was too much friction. The alert goes out first.)
- Each answer shows, right on the screen, the sentence it will put on the
  flyer. The owner can change the wording of the finder instruction.
- Answers are saved the moment they are given. The flyers and share images
  are redrawn in the background when a detail changes.
- Wording is species-aware. A cat is not asked whether it jumps fences.
- The form shows where you are. A progress line fills across the whole
  report, and the label under it says the group and the place inside it
  ("For finders, 4 of 11"), so the long middle never looks stuck. On a
  computer the sidebar lists the screens of the current group.
- One yellow button per screen: Continue, and Post on the last step. A
  skip sits beside it, never under it. A chosen answer is navy, not red:
  red on the lost flow read as an error.
- The flyer is drawn from the answers as they are given
  (`app/components/report/FlyerPreview.js`): in the sidebar on a
  computer, and as the whole review screen, "Here is Max's flyer", where
  every line taps back to its question.

## 4. The questions

Names in `code` are the ids in `Case.details`. `{name}` is the pet.

### 4.1 Core (blocks posting)

| Screen | Asks | Answer |
| --- | --- | --- |
| species | What kind of pet | dog, cat, bird, rabbit, other (tap) |
| name | Name | text |
| size | Dog: size. Cat: indoor only or goes outside | tap |
| when | When last seen | the time bands (tap) |
| where | Where last seen | map pin |
| photo | A photo | upload, skippable |
| colors | Colours | chips, prefilled from the photo |
| `temperament` | How {name} acts around strangers | tap, see 4.2 |
| `health` | Medication or a health condition | chips, see 4.3 |
| contact | Name, phone or email | text |
| reward | Offering a reward | tap, see 4.4 |
| review | Ready to post, plus the details checklist | post |

Twelve screens for a guest with a dog, seven of them a single tap. The
checklist (4.5) is not in this list: it comes after posting.

### 4.2 Behaviour: `temperament`, `fears`, `approachNote`

"How does {name} act around strangers?" The answer writes the "If you see
{name}" line on the flyer, the pet's page and the share images.

| Dog | Cat | Bird | Rabbit, other |
| --- | --- | --- | --- |
| FRIENDLY: Friendly, goes up to people | Friendly, lets strangers pet them | Tame, steps onto a hand | Calm, can be picked up |
| SHY: Shy, keeps their distance | Shy, hides from strangers | | |
| SCARED: Scared, will run or hide | Terrified outside, will bolt | Flies from strangers | Skittish, will run |
| DEFENSIVE: May growl or snap if cornered | May scratch or bite if grabbed | | May bite or kick when held |
| UNKNOWN: Not sure | Not sure | Not sure | Not sure |

The lines, written for a stranger reading a flyer:

- Dog, SCARED: "Don't chase, call out or stare. {name} will run. Sit or
  crouch sideways, toss food if you have some, and call us right away with
  the exact spot."
- Dog, SHY: "Don't chase. Crouch down, speak softly and let {name} come to
  you. If {name} backs away, stop and call us with the exact spot."
- Dog, FRIENDLY: "{name} is friendly. Say the name, hold out a treat, and
  take hold of the collar or harness. Then call or text us."
- Dog, DEFENSIVE: "Please don't try to grab {name}, who may snap when
  frightened. Keep your distance, keep {name} in sight, and call us right
  away."
- Dog, UNKNOWN: "Don't chase. A frightened dog runs farther. Note the exact
  spot and time and call us right away."
- Cat, SCARED or SHY: "Don't chase or shout. {name} is hiding, probably
  within a few houses. Note the exact spot, keep your distance and call us.
  A cornered cat bolts."
- Cat, FRIENDLY: "{name} is friendly. Crouch, speak softly and let {name}
  come to you. A carrier or a towel helps. Then call us."
- Cat, DEFENSIVE: "Please don't pick {name} up; scared cats scratch. Keep
  {name} in sight from a distance and call us."
- Cat, UNKNOWN: "Don't chase. Note the exact spot, keep your distance and
  call us right away."
- Bird: "Please don't try to grab {name}. Note where {name} perched and
  call us right away. A familiar voice is what brings {name} down."
- Rabbit and other, any: "Please don't chase. Note the exact spot, keep
  your distance and call us right away."

`fears` (optional chips, in the details checklist): men, children, other
dogs, cats, loud noises, cars. Adds one sentence: "{name} is afraid of men
and other dogs."

`approachNote`: the owner's own words, up to 160 characters. When set, it
replaces the line above.

### 4.3 Health: `health`, `healthNote`

"Does {name} take medication or have a health condition?" Chips, more than
one allowed. "No, healthy" clears the rest.

| Chip | Flyer | Urgency |
| --- | --- | --- |
| MEDICATION: Takes medication | "Needs medication" tag; "Needs {note or 'daily medication'}. Please call the moment you see {name}." | urgent |
| DIABETIC: Diabetic | as MEDICATION, "Needs insulin." | urgent |
| SEIZURES: Has seizures | as MEDICATION | urgent |
| HEART: Heart condition | "Heart condition." | high |
| BLIND: Blind or nearly | "Blind: may walk into traffic." | high |
| DEAF: Deaf | "Deaf: won't come when called." | high |
| SENIOR: Old and frail | "Old and frail." | high |
| INJURED: Injured or just had surgery | "Injured." | urgent |
| ANXIOUS: Anxiety, panics easily | folds into the behaviour line | normal |
| PREGNANT: Pregnant or nursing | "Pregnant." / "Nursing: her babies are at home." | urgent |
| OTHER: Something else | the note | normal |

`healthNote`: "What, and how often" (e.g. "insulin twice a day"), 120
characters. `needsMedication` is a column of its own on the case
(MEDICATION, DIABETIC or SEIZURES) because the search is prioritised on it.
Any urgent chip makes the case URGENT; a high chip makes it HIGH.

### 4.4 Reward: `hasReward`, `rewardAmount`, `rewardScamAcknowledgedAt`

"Offering a reward?"

- "No reward": advances.
- "Yes": amount chips $100, $250, $500, $1,000, "Another amount" (a
  number), "Don't print an amount" (the flyer then says "Reward offered").
- With "Yes", a checkbox the owner must tick before continuing:

> I know how reward scams work. I will not pay anyone anything before
> {name} is back in my hands. People will claim to have {name}, send photos
> (some made with AI), and ask for money, gift cards or a "transport fee".
> I will report those messages instead of paying.

The tick is stored as `rewardScamAcknowledgedAt`. The same warning, as a
plain card, is on the success screen for everyone with or without a reward,
in the owner's panel on the pet's page, and in the day-1 follow-up email.

### 4.5 The details checklist (optional, any order)

| Screen | Asks | Answers |
| --- | --- | --- |
| `collar` | What {name} is wearing | No collar / A collar / A harness / Both. With a collar or harness: colour chips (red, blue, black, pink, purple, green, brown, yellow, orange, white or grey, patterned); tag: with our phone number / name only / no tag. "Dragging a leash" checkbox. |
| `microchip` | Microchipped? | Yes / No / Not sure. If yes: "Our phone number on the chip is current" yes / no / not sure, and a reminder to call the registry. Chip number optional and never shown publicly. |
| `facts` | Sex, fixed, age | Male / Female / Not sure. Neutered or spayed: yes / no / not sure. Puppy or kitten (under 1) / Adult / Senior (8 and up). |
| `marks` | What makes {name} easy to pick out | Species chips (dog: white chest, white paws, white tail tip, one ear up, floppy ears, cropped ears, docked tail, curly tail, scar, limp, missing teeth, grey muzzle, overweight, very thin, wearing clothes; cat: white chest, white paws, tipped or notched ear, bob tail, extra toes, fluffy tail, scar, limp, missing teeth, one eye, two eye colours; bird: leg band, clipped wings, missing feathers; rabbit: lop ears, one ear up) plus a note. |
| `howOut` | How {name} got out | Dashed out a door / Jumped a fence / Slipped a collar or leash / Spooked by fireworks or thunder / From a car, vet or boarding, away from home / Someone may have taken them / Not sure. "Was with another pet" checkbox. |
| `lure` | What {name} comes to | Their name / Treats or a shaken food bag / A squeaky toy / A whistle or clicker / Only us, not strangers / A car door opening, plus "words or commands". |
| `fears` | What {name} is afraid of | Men / Children / Other dogs / Cats / Loud noises / Cars / Nothing in particular. |
| `places` | Places {name} knows nearby | A friend's or family home / Their old home / A park or walking route / Our vet or groomer / A school or shop they love, plus addresses. |
| `notes` | Anything else a finder should know | 300 characters. |

Nine screens. The checklist shows "4 of 9 answered" and lists the
unanswered ones first.

## 5. Where each answer goes

| Answer | Flyer and poster | Share images | Pet's page | Search |
| --- | --- | --- | --- | --- |
| temperament, fears, approachNote | "If you see {name}" line above the contact panel | the same line | "If you see {name}" block at the top of How you can help | force feed post |
| health | "NEEDS MEDICATION" tag on the sticker; a health line with the facts | tag and line | red health line | URGENT / HIGH priority |
| reward | "$500 REWARD" or "REWARD OFFERED" tag (exists) | tag | "Reward offered" with the scam note for the owner | |
| collar, leash | in what to look for: "Red collar with a phone tag. Dragging a leash." | same | facts | |
| microchip | nothing on paper | | "Microchipped" so a finder knows to ask a vet to scan | |
| sex, fixed, age | in the facts line: "Intact male, senior" | same | facts | |
| marks | in what to look for | same | facts | matching found pets |
| howOut | shapes the guidance; "away from home" means hiding close | | timeline | search plan |
| lure | "Comes to: their name, a shaken treat bag" on the page; on the flyer when there is room | | "What {name} comes to" | |
| places | | | "May head for" with the force's needs | search plan |
| notes | | | the owner's note | |

In the wizard (`frontend/app/report/new/page.js`), the nine detail
screens follow the health step in a fixed order: collar and tags,
markings, sex and age and breed, microchip, how they got out, what they
come to, fears, places they know, anything else. Every reporter sees
every one. Four take an answer before Continue (collar, facts,
microchip, how they got out), each with a "not sure" chip; the other
five skip with one tap. The review's checklist and the success screen's
hub reopen any of them.

On paper (renderers in `frontend/app/lib/cascade/render/`): the head is
LOST on its red band with the name beside it and, under the name, "Needs
medication" (red) and the reward (cream) as pills. Nothing is ever drawn
over the photo. The photo is a tall print beside the facts column (where
and when, the map, what to look for, what the pet comes to), as wide as
the photo's own shape asks; then "If you see {name}" on a cream note card
with the health line in red. The sheet is planned on the words
(`render/flyers/plan.js`): every text is measured into lines, the card is
as tall as its words, the map takes what the column's words leave (or,
without a map on record, a QR card for the map and updates at the link
does), and what is still spare goes to the band, the card's type, the
contact panel and the gaps, never to one empty area. A thin report (a
name, a photo, where and when, nothing else) is laid out as thin: the
photo is cut toward a square and the print widens, the column's type
grows together, the QR card is a scannable size, and the row gives
height to the band, the card and the panel. The sample seed has one of
each: `AUS-2026-0001` (Max, every answer) and `AUS-2026-0004` (Pip,
nothing but the basics). Long answers are cut
with an ellipsis rather than pushed into the contact panel. A report made
before the questionnaire gets the species' general "don't chase" line.
The sheet under it all is the brand's yellow lit from behind the photo,
with sun rays, caution stripes and grain (`render/ground.js`). The design
canvas "Lost Pet Flyers, the sticker" shows all six sizes.

## 6. Storage

`Case.details` is one JSON column holding every answer above, validated by
`normalizeDetails()` into a fixed shape (unknown keys and values are
dropped, text is trimmed and capped). Three typed columns sit beside it
because the system acts on them: `needsMedication`, `rewardScamAcknowledgedAt`,
`detailsUpdatedAt`. `hasReward`, `rewardAmount` and `escapeScenario`
already exist and keep their meaning; `howOut` mirrors `escapeScenario`.

The deploy syncs the schema (`scripts/db-sync.js`, additive columns only).

## 7. Editing after posting

Members edit from the owner's panel on the pet's page. A guest who just
posted has no session yet, so the create response carries a details token
(HMAC over the case id, 24 hours) that lets the success screen save
answers for that one case and nothing else. The same details hub component
runs in all three places. Saving a detail schedules one redraw of the kit,
a minute after the last change.

## 7a. The page after posting (simplified 2026-11-07, second pass)

Redesigned 2026-11-07 from the report canvas (rows "After posting,
redesigned"), `app/components/report/SuccessScreen.js`. It answers the
owner's questions in order, and nothing else:

1. Is it live, and how do I get back here. A navy band: the stamp, "Max's
   report is live.", the short link (`reunitepets.org/p/CODE`) with Copy,
   one line saying where the link went (emailed, or texted to a phone-only
   guest) and that sightings land there, one line saying which Rescue
   Force got the report.
2. Is there a lead already. A found pet reported near the spot (the
   cascade's reverse match) goes first, each with "See it". The strongest
   one gets the yellow button.
3. What do I do now. Three numbered cards, in a row on a computer: post it
   (the square and story share images as themselves, drawn in as the
   cascade lands them, the caption with Copy post, Share the link,
   Facebook, the local groups found), print it (the flyer as a miniature,
   Open the flyer, half sheets, poster), call the shelters near the spot
   (the list with tap-to-call).
4. What would make it better. The details checklist, unanswered questions
   first, three shown and "All 9 questions"; each answer saves at once.
5. One warning that matters once the calls start (the scam note) and the
   way to the pet's page. Nothing is folded away: the half sheets, the
   poster, the other captions and the search plan live on the pet's page.

The found report's page: the link band, the lost pets reported nearby as
the first thing (MatchCard), then three cards for the person holding the
animal (keep them calm, get the chip scanned, share the report), the photo
nudge, the report page. `useRecoveryKit` (recoveryKit/useRecoveryKit.js)
feeds the lost page; the case page's share kit (RecoveryKit.js) reads the
same hook.

## 8. Phases

1. This change: the question set, the wizard, the hub, the APIs, the pet's
   page, the scam acknowledgement, tests.
2. Done with it: the flyers and share images draw the new lines and tags;
   design canvas updated; renderer version bumped so every open case is
   redrawn.
3. Done (2026-11-07): the wizard chrome and the page after posting
   redesigned from the canvas, with the flyer drawn live from the answers.
4. Later: prefill from a saved pet's profile; the same questions in the
   found-pet flow where they apply; the force's feed post carries the
   "don't chase" line.
