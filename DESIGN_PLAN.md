# ReunitePets Design Plan

## The Only Thing That Matters

A person is living through the worst week of their life.

Their hands are shaking. They haven't slept. They've been crying so much their eyes are swollen. They're standing in an alley at 6 AM calling a name into the darkness.

They find us.

Everything we build must serve this person in this moment.

Not "users." Not "customers." Not "conversions."

A human being who loves their pet and is terrified they'll never see them again.

---

## Part 1: First Contact

### The Moment They Arrive

They googled "lost dog what to do" or a friend shared our link. They land on our homepage.

They have about 3 seconds of attention. They're panicking. They're scanning.

**What they need to see instantly:**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                                                             │
│              Lost your pet?                                 │
│                                                             │
│              We'll help you bring them home.                │
│                                                             │
│                                                             │
│         ┌─────────────────────────────────────┐            │
│         │                                     │            │
│         │     Report Your Lost Pet Now        │            │
│         │                                     │            │
│         └─────────────────────────────────────┘            │
│                                                             │
│              Free. Takes 2 minutes.                         │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**What we do NOT show:**
- Feature lists
- Statistics about reunions
- Testimonials
- Navigation menus
- App download prompts
- Newsletter signups
- Anything that isn't helping them RIGHT NOW

**Typography:**
- "Lost your pet?" — Large. Warm. Not clinical.
- The button — Huge. Impossible to miss. The only thing to click.
- "Free. Takes 2 minutes." — Removes friction. Removes fear.

**Color:**
- Calm. Not sterile white. Not aggressive red.
- Warm, soft tones. Think: a hand on your shoulder.
- The button: warm orange or coral. Life. Hope. Action.

---

## Part 2: The Report Flow

### Design Philosophy

This person is shaking. They might be crying. It's 2 AM. They can barely see their screen.

Every single field we add is a wall between them and help.

We ask for the absolute minimum. Everything else can come later.

### Screen 1: The Photo

The photo is the most important thing. It's what people will recognize. It's what makes this real.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ← Back                                              1 of 4 │
│                                                             │
│                                                             │
│         Let's start with a photo.                          │
│                                                             │
│         This is what people will look for.                 │
│                                                             │
│                                                             │
│         ┌─────────────────────────────────────┐            │
│         │                                     │            │
│         │                                     │            │
│         │         +                           │            │
│         │                                     │            │
│         │    Tap to add photo                 │            │
│         │                                     │            │
│         │                                     │            │
│         └─────────────────────────────────────┘            │
│                                                             │
│                                                             │
│         Don't have a photo right now?                      │
│         You can add one later.                             │
│                                                             │
│                                                             │
│         ┌─────────────────────────────────────┐            │
│         │            Continue                  │            │
│         └─────────────────────────────────────┘            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Why this works:**
- One thing per screen. No overwhelm.
- The photo upload area is huge. Easy to tap on mobile.
- "Don't have a photo right now?" — We don't block them. We understand.
- Progress indicator (1 of 4) — They can see the end. It's close.

**Technical notes:**
- Accept camera or photo library
- Compress on device before upload
- Show uploading state
- If upload fails, cache locally and retry

### Screen 2: The Basics

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ← Back                                              2 of 4 │
│                                                             │
│                                                             │
│         Tell us about your pet.                            │
│                                                             │
│                                                             │
│         Name                                               │
│         ┌─────────────────────────────────────┐            │
│         │ Benny                               │            │
│         └─────────────────────────────────────┘            │
│                                                             │
│         What kind of pet?                                  │
│         ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│         │  🐕    │ │  🐈    │ │  🐦    │ │ Other  │       │
│         │  Dog   │ │  Cat   │ │  Bird  │ │        │       │
│         └────────┘ └────────┘ └────────┘ └────────┘       │
│                                                             │
│         Breed (optional)                                   │
│         ┌─────────────────────────────────────┐            │
│         │ Golden Retriever                    │            │
│         └─────────────────────────────────────┘            │
│                                                             │
│         Color                                              │
│         ┌─────────────────────────────────────┐            │
│         │ Golden / Yellow                     │            │
│         └─────────────────────────────────────┘            │
│                                                             │
│                                                             │
│         ┌─────────────────────────────────────┐            │
│         │            Continue                  │            │
│         └─────────────────────────────────────┘            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Why this works:**
- Name first. It's personal. It's their baby.
- Visual pet type selector. No typing required.
- Breed is optional. Not everyone knows breeds. Don't make them feel stupid.
- Color with examples. "Golden / Yellow" — we help them.

**What we DON'T ask yet:**
- Age
- Weight
- Sex
- Microchip number
- Collar description
- Medical conditions
- Temperament

All of that can come later. Right now, we just need to identify the pet.

### Screen 3: Where and When

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ← Back                                              3 of 4 │
│                                                             │
│                                                             │
│         Where did you last see Benny?                      │
│                                                             │
│                                                             │
│         ┌─────────────────────────────────────┐            │
│         │ 📍 Use my current location          │            │
│         └─────────────────────────────────────┘            │
│                                                             │
│         ┌─────────────────────────────────────┐            │
│         │ 🔍 Search for an address            │            │
│         └─────────────────────────────────────┘            │
│                                                             │
│                                                             │
│         When did Benny go missing?                         │
│                                                             │
│         ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│         │   Today    │ │ Yesterday  │ │  Earlier   │       │
│         └────────────┘ └────────────┘ └────────────┘       │
│                                                             │
│         [If Earlier selected: simple date picker]          │
│                                                             │
│                                                             │
│         ┌─────────────────────────────────────┐            │
│         │            Continue                  │            │
│         └─────────────────────────────────────┘            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Why this works:**
- "Use my current location" — One tap. They're probably standing where the pet was last seen.
- "Today / Yesterday / Earlier" — Most pets are reported within 48 hours. Don't make them think.
- We use the pet's name. "Where did you last see Benny?" — This is personal. We care.

**Technical notes:**
- Location permission request with clear explanation
- Fallback to address search if permission denied
- Reverse geocode to show friendly address

### Screen 4: Contact

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ← Back                                              4 of 4 │
│                                                             │
│                                                             │
│         How can people reach you if they find Benny?       │
│                                                             │
│                                                             │
│         Your phone number                                  │
│         ┌─────────────────────────────────────┐            │
│         │ (555) 123-4567                      │            │
│         └─────────────────────────────────────┘            │
│         This will be visible to people who want to help.   │
│                                                             │
│         Your email                                         │
│         ┌─────────────────────────────────────┐            │
│         │ sarah@email.com                     │            │
│         └─────────────────────────────────────┘            │
│         We'll send you updates here.                       │
│                                                             │
│         Your name (optional)                               │
│         ┌─────────────────────────────────────┐            │
│         │ Sarah                               │            │
│         └─────────────────────────────────────┘            │
│                                                             │
│                                                             │
│         ┌─────────────────────────────────────┐            │
│         │        Post Benny's Alert            │            │
│         └─────────────────────────────────────┘            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Why this works:**
- Phone number first. When someone finds Benny, they want to call immediately.
- Clear explanation of what's visible. Build trust.
- Name is optional. Privacy matters.
- "Post Benny's Alert" — Not "Submit." This is action. Something is happening.

---

## Part 3: The Confirmation

This is critical. They just posted. They need to feel like something is happening.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                                                             │
│                          ✓                                  │
│                                                             │
│         Benny's alert is live.                             │
│                                                             │
│         Here's what's happening right now:                 │
│                                                             │
│         ┌─────────────────────────────────────┐            │
│         │                                     │            │
│         │  📍 47 people within 2 miles        │            │
│         │     are being notified now          │            │
│         │                                     │            │
│         │  🏥 12 nearby shelters will         │            │
│         │     receive Benny's photo           │            │
│         │                                     │            │
│         │  🔍 Searching shelter databases     │            │
│         │     for possible matches...         │            │
│         │                                     │            │
│         └─────────────────────────────────────┘            │
│                                                             │
│                                                             │
│         ─────────────────────────────────────               │
│                                                             │
│         What you should do RIGHT NOW:                      │
│                                                             │
│         1. Walk your neighborhood                          │
│            Benny is most likely within 1 mile              │
│                                                             │
│         2. Tell your neighbors                             │
│            Knock on doors. Show them Benny's photo.        │
│                                                             │
│         3. Share everywhere                                │
│            ↓                                                │
│                                                             │
│         ┌─────────────────────────────────────┐            │
│         │     📤 Share Benny's Alert           │            │
│         └─────────────────────────────────────┘            │
│                                                             │
│         ┌─────────────────────────────────────┐            │
│         │     📄 Print Flyers                  │            │
│         └─────────────────────────────────────┘            │
│                                                             │
│         ┌─────────────────────────────────────┐            │
│         │     👁 View Benny's Page             │            │
│         └─────────────────────────────────────┘            │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Why this works:**

1. **"Here's what's happening right now"** — They feel like something is happening. They're not alone. The system is working.

2. **Real numbers** — "47 people within 2 miles." Not vague. Specific. Real.

3. **"What you should do RIGHT NOW"** — They need direction. They don't know what to do. We tell them exactly.

4. **Numbered steps** — Clear. Actionable. They can do this.

5. **Share and Print are prominent** — These are the two highest-impact things they can do.

---

## Part 4: The Case Page

This is Benny's public page. It's what gets shared. It's what strangers see.

### For Strangers (The Helper View)

Someone sees this on Facebook. They've never heard of ReunitePets. They click.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │                                                      │   │
│  │                   [BENNY'S PHOTO]                   │   │
│  │                                                      │   │
│  │                   Full width. Hero.                 │   │
│  │                   This is the first thing           │   │
│  │                   anyone sees.                      │   │
│  │                                                      │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  🔴 MISSING                                                 │
│                                                             │
│  BENNY                                                      │
│  Golden Retriever • Male                                    │
│                                                             │
│  Last seen: Oak Park, IL                                    │
│  December 23, 2024 — 5 days ago                             │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │         Have you seen Benny?                        │   │
│  │                                                      │   │
│  │    ┌───────────────────┐  ┌───────────────────┐    │   │
│  │    │                   │  │                   │    │   │
│  │    │  👁 I've seen     │  │  📞 Contact       │    │   │
│  │    │     Benny         │  │     owner         │    │   │
│  │    │                   │  │                   │    │   │
│  │    └───────────────────┘  └───────────────────┘    │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  📍 LAST SEEN                                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │              [MAP]                                  │   │
│  │              Showing 2-mile radius                  │   │
│  │              around last seen location              │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Oak & Maple Street, Oak Park, IL                          │
│  Near the park entrance by the playground                  │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  📋 DETAILS                                                 │
│                                                             │
│  Benny is a 7-year-old Golden Retriever. He's very        │
│  friendly but might be scared. He was wearing a red       │
│  collar with tags. He responds to "Benny" and "Ben."      │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  📤 SHARE THIS                                              │
│                                                             │
│  Every share helps. Someone in your network might          │
│  have seen Benny.                                          │
│                                                             │
│  [Facebook] [Nextdoor] [Twitter] [Copy Link] [Text]       │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  👀 1,247 people have seen this alert                       │
│  📤 89 shares                                               │
│  👁 3 possible sightings                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Design Principles:**

1. **Photo dominates.** This is what people will recognize. Make it huge.

2. **"I've seen Benny" is prominent.** This is the action we want. Make it obvious.

3. **The map shows search area.** Helpers need to know if they're in the right place.

4. **Stats at the bottom.** Social proof. This is real. People are helping.

5. **Share buttons are everywhere.** Every share is another chance.

---

### For the Owner (The Dashboard View)

This is what Sarah sees when she logs in. She's refreshing this page every 5 minutes.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  BENNY'S CASE                                     [Edit]   │
│  Case #M-00847 • Active                                    │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  📊 ACTIVITY                                                │
│                                                             │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐  │
│  │                │ │                │ │                │  │
│  │     1,247      │ │       89       │ │       3        │  │
│  │     views      │ │     shares     │ │   sightings    │  │
│  │                │ │                │ │                │  │
│  └────────────────┘ └────────────────┘ └────────────────┘  │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  👁 SIGHTINGS                                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🔴 NEW — 23 minutes ago                             │   │
│  │                                                      │   │
│  │  "I think I saw this dog near the gas station       │   │
│  │   on Madison Ave. He was sniffing around the        │   │
│  │   dumpster area."                                   │   │
│  │                                                      │   │
│  │  📍 Madison Ave & 5th St (0.8 miles away)           │   │
│  │                                                      │   │
│  │  [View on Map]  [Contact Reporter]                  │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Yesterday at 4:15 PM                                │   │
│  │                                                      │   │
│  │  "Saw a golden retriever running through the        │   │
│  │   park. Couldn't get close."                        │   │
│  │                                                      │   │
│  │  📍 Oak Park Central (0.3 miles away)               │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  📍 SEARCH MAP                                              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │         [MAP WITH SIGHTINGS MARKED]                 │   │
│  │                                                      │   │
│  │         🔴 = sighting                               │   │
│  │         📍 = last seen                              │   │
│  │         ░░ = searched areas                         │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  🔔 NOTIFICATIONS                                           │
│                                                             │
│  You'll receive alerts for:                                │
│  ☑ New sightings                                           │
│  ☑ Possible shelter matches                                │
│  ☑ New volunteers in your area                             │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  ✏️ NEXT STEPS                                              │
│                                                             │
│  ☑ Posted alert                                            │
│  ☑ Shared on social media                                  │
│  ☐ Print and post flyers                                   │
│  ☐ Call local shelters                                     │
│  ☐ Check with neighbors                                    │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │        🎉  Benny is home!  Mark as found            │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Design Principles:**

1. **Sightings are the hero.** This is what they're refreshing for. Make new sightings impossible to miss.

2. **"NEW" badge with time.** "23 minutes ago" — They need to know how fresh this is.

3. **Distance matters.** "0.8 miles away" — Is this plausible? Help them evaluate.

4. **The map tells a story.** Where are sightings clustering? Where should they search next?

5. **Next Steps checklist.** Give them things to do. Idle hands make anxious minds.

6. **"Mark as found" at the bottom.** Always visible. Always hopeful.

---

## Part 5: The Sighting Report

Someone saw Benny. They clicked "I've seen Benny."

This needs to be FAST. They might be standing on the street looking at Benny right now.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  👁 Report a Sighting of Benny                              │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  Where did you see Benny?                                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📍 Use my current location                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  When did you see Benny?                                   │
│                                                             │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                 │
│  │  Just now │ │  Today    │ │ Yesterday │                 │
│  └───────────┘ └───────────┘ └───────────┘                 │
│                                                             │
│  What was Benny doing? (optional)                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Running through the parking lot behind the          │   │
│  │ grocery store. Looked scared.                       │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Got a photo? (optional but super helpful!)               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          + Add photo                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Your phone number (so the owner can follow up)           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ (555) 987-6543                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           📤 Send Sighting Report                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                                             │
│  Benny's owner will be notified immediately.              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Why this works:**

1. **"Use my current location"** — One tap. They're probably still there.

2. **"Just now"** — Most sightings are real-time. Make it the first option.

3. **Description is optional.** Don't block them. Any data is better than no data.

4. **Photo is optional but encouraged.** "Super helpful!" — Friendly, not demanding.

5. **"Notified immediately"** — They know this matters. It's urgent.

---

## Part 6: The Notification

Sarah's phone buzzes. Her heart stops.

**Push Notification:**
```
┌─────────────────────────────────────────────────────────────┐
│  ReunitePets                                      just now  │
│                                                             │
│  👁 New sighting of Benny!                                  │
│  Someone reported seeing Benny near Madison Ave,           │
│  0.8 miles from where he went missing.                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**What we DON'T say:**
- "We have a potential sighting!" — Too corporate
- "A user has submitted..." — Too clinical
- "Click here to view" — Too spammy

**What we DO say:**
- "New sighting of Benny!" — Direct. His name. Real.
- "0.8 miles from where he went missing" — Immediate context. Is this plausible?

**SMS (if enabled):**
```
ReunitePets: New sighting of Benny near Madison Ave
(0.8 mi from last seen). View details:
reunitepets.org/s/abc123
```

**Email (subject line):**
```
👁 Someone spotted Benny near Madison Ave
```

---

## Part 7: The Flyer

Physical flyers still matter. They work. Someone at FedEx printed 50 for free because they saw Sarah crying.

The flyer needs to:
- Be instantly recognizable as a LOST PET flyer
- Have a huge photo
- Have a phone number you can read from 10 feet away
- Work in black and white (low ink)
- Include a QR code for more details

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                           ┃
┃                        LOST DOG                           ┃
┃                                                           ┃
┃    ┌─────────────────────────────────────────────────┐   ┃
┃    │                                                  │   ┃
┃    │                                                  │   ┃
┃    │                                                  │   ┃
┃    │                 [BENNY'S PHOTO]                 │   ┃
┃    │                                                  │   ┃
┃    │                 HUGE. CLEAR.                    │   ┃
┃    │                                                  │   ┃
┃    │                                                  │   ┃
┃    │                                                  │   ┃
┃    └─────────────────────────────────────────────────┘   ┃
┃                                                           ┃
┃                        "BENNY"                            ┃
┃                                                           ┃
┃               Golden Retriever • Male                     ┃
┃               Friendly but may be scared                  ┃
┃                                                           ┃
┃          Last seen: Oak Park near Maple St               ┃
┃                   December 23, 2024                       ┃
┃                                                           ┃
┃    ─────────────────────────────────────────────────     ┃
┃                                                           ┃
┃                     PLEASE CALL                           ┃
┃                                                           ┃
┃               (555) 123-4567                              ┃
┃                                                           ┃
┃    ─────────────────────────────────────────────────     ┃
┃                                                           ┃
┃         [QR CODE]     More info & updates:               ┃
┃                       reunitepets.org/benny              ┃
┃                                                           ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

**Design notes:**
- Phone number is THE BIGGEST TEXT after "LOST DOG"
- Photo fills 40% of the flyer
- Works in B&W
- QR code for people who want more details
- Tear-off strips at bottom with phone number (optional)

---

## Part 8: The Share Experience

When Sarah clicks "Share," she shouldn't have to think about what to write. We write it for her.

### Facebook Share

**Pre-filled post:**
```
🔴 LOST DOG — Please help!

My dog Benny has been missing since Tuesday. He's a
Golden Retriever, very friendly but probably scared.

Last seen near Oak Park.

If you've seen him, please call me: (555) 123-4567

Or report a sighting here: reunitepets.org/benny

Please SHARE this post — someone you know might have
seen him. Every share helps bring Benny home. 🙏

#LostDog #OakPark #GoldenRetriever #MissingPet
```

**Link preview (Open Graph):**
```
Image: Benny's photo
Title: 🔴 MISSING: Benny, Golden Retriever — Oak Park, IL
Description: Last seen Dec 23. Please call (555) 123-4567 if seen.
```

### Nextdoor Share

**Pre-filled:**
```
🔴 LOST DOG in Oak Park

Has anyone seen my dog Benny? He's a Golden Retriever
who went missing on Tuesday near Maple St.

He's friendly but might be scared. If you see him,
please call me at (555) 123-4567 or just keep him
safe and I'll come get him.

Full details: reunitepets.org/benny

Thank you neighbors! 🙏
```

### Text Message Share

**Pre-filled:**
```
Have you seen this dog? My friend lost their golden
retriever Benny in Oak Park. If you see him, call
(555) 123-4567. More info: reunitepets.org/benny
```

### Copy to Clipboard

**For Craigslist, Facebook Groups, Reddit, etc:**
```
🔴 LOST DOG — BENNY — GOLDEN RETRIEVER — OAK PARK, IL

Missing since: Tuesday, December 23
Last seen: Near Oak & Maple Street, Oak Park

Description: Male Golden Retriever, 7 years old,
wearing red collar with tags. Very friendly but
may be scared.

If found, PLEASE CALL: (555) 123-4567

More photos and updates: reunitepets.org/benny

Please share! Someone you know might have seen him.
```

---

## Part 9: The Empty States

These matter. When there's no data, what do we show?

### No Sightings Yet

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  👁 SIGHTINGS                                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │            No sightings yet.                        │   │
│  │                                                      │   │
│  │     This is normal — most sightings come            │   │
│  │     from shares. The more people who see            │   │
│  │     Benny's alert, the better.                      │   │
│  │                                                      │   │
│  │     ┌───────────────────────────────────┐          │   │
│  │     │     📤 Share Benny's Alert         │          │   │
│  │     └───────────────────────────────────┘          │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Why this works:**
- "This is normal" — Reassurance. They're not failing.
- Action-oriented — Share more. Do something.

### No Shelter Matches

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  🏥 SHELTER MATCHES                                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │     No matches found in 12 nearby shelters.         │   │
│  │                                                      │   │
│  │     We're checking every 6 hours. You'll be         │   │
│  │     notified immediately if there's a match.        │   │
│  │                                                      │   │
│  │     Shelters checked:                               │   │
│  │     • Oak Park Animal Shelter                       │   │
│  │     • Chicago Animal Care                           │   │
│  │     • Anti-Cruelty Society                          │   │
│  │     • [+9 more]                                     │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Why this works:**
- "We're checking" — The system is working. They don't have to.
- Specific shelters listed — Proof we're actually doing something.
- "Every 6 hours" — Set expectations. They don't need to refresh constantly.

---

## Part 10: The Reunion

The moment we exist for.

### Marking as Found

When Sarah clicks "Benny is home!":

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                         🎉                                  │
│                                                             │
│         Benny is home!                                      │
│                                                             │
│         We're so happy for you.                            │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  Would you like to share how Benny was found?              │
│  (This helps other pet owners and spreads hope)            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ A neighbor saw our flyer and called! She found      │   │
│  │ Benny hiding under her porch.                       │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Would you like to share a reunion photo?                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          + Add reunion photo                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          ✓ Complete Benny's Reunion                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                                             │
│  What happens next:                                        │
│  • Everyone who shared or helped will be notified         │
│  • Benny's page will show "REUNITED!"                     │
│  • Your story may inspire others who are still searching  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### The Thank You (Optional Tip)

After marking as found, ONE TIME, gently:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    Benny is home! 🎉                        │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  This community helped bring Benny home.                   │
│                                                             │
│  89 people shared his alert.                               │
│  12 shelters were checking for him.                        │
│  3 neighbors reported sightings.                           │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  ReunitePets is free for all pet owners.                   │
│                                                             │
│  If you'd like to help us keep it that way,               │
│  you can leave a tip. 100% optional.                       │
│                                                             │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐           │
│  │   $5   │  │  $10   │  │  $25   │  │ Other  │           │
│  └────────┘  └────────┘  └────────┘  └────────┘           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │     Leave a tip for ReunitePets                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [ No thanks — just show me Benny's reunion page ]         │
│                                                             │
│                                                             │
│  We will never ask again. Promise.                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Design principles:**
- Show impact: "89 people shared his alert" — They feel the community.
- "100% optional" — No pressure.
- "No thanks" is clearly visible — We mean it.
- "We will never ask again" — Builds trust.

---

## Part 11: The Voice

How we talk matters as much as what we show.

### We say:
- "Benny" (their pet's name, always)
- "bring them home" (warm, personal)
- "you" and "your" (direct)
- "we" (we're in this together)

### We never say:
- "the pet" or "the animal" (clinical)
- "users" or "customers" (corporate)
- "submit" or "process" (bureaucratic)
- "click here" (dated)

### We never use:
- Exclamation points in error messages
- Marketing jargon
- Technical language
- Passive voice

### Tone in different contexts:

**Normal state:** Warm, clear, helpful
> "47 people near you have been notified."

**Good news:** Celebratory but grounded
> "New sighting of Benny! Someone saw him near Madison Ave."

**Bad news:** Honest, compassionate
> "We haven't found any matches in nearby shelters yet. We're checking every 6 hours."

**Error state:** Calm, solution-focused
> "We couldn't upload that photo. Let's try a smaller file."

---

## Part 12: Mobile First

Most of this will be used on phones. Design for shaking hands and tear-filled eyes.

### Touch Targets
- Minimum 48x48px for all interactive elements
- 16px minimum spacing between targets
- Primary buttons: Full width on mobile

### Typography
- Body: 16px minimum (no pinching to read)
- Headings: Clear hierarchy
- Phone numbers: Huge. Tappable. tel: links.

### Forms
- One input visible at a time
- Appropriate keyboard (tel, email, text)
- Autocomplete where possible
- Paste-able fields

### Speed
- First meaningful paint: <1.5 seconds
- Photo upload: Show progress
- All actions: Optimistic UI where safe

### Offline
- Cache viewed cases
- Queue sightings for upload when reconnected
- Show clear offline indicator

---

## Part 13: Implementation Priority

Not features. Experiences.

### Must Have (Before Any Launch)

1. **Report a lost pet** — Photo, name, type, location, contact. 4 screens. Done.

2. **View a lost pet page** — Photo, details, map, "I've seen them" button.

3. **Report a sighting** — Location, time, description, optional photo.

4. **Notify the owner** — Push, SMS, or email when sighting reported.

5. **Share** — Pre-written posts for Facebook, Nextdoor, Twitter, text.

6. **Print flyers** — PDF generation with photo and phone number.

### Should Have (First Month)

7. **Owner dashboard** — View sightings, stats, map.

8. **Shelter matching** — Background checks against PetFinder/RescueGroups.

9. **Mark as found** — Close the loop. Reunion story optional.

10. **Next steps checklist** — Guide owners on what to do.

### Nice to Have (Later)

11. Volunteer search coordination
12. Ad campaigns (AdFund)
13. Gamification/points
14. AI image matching

---

## Summary

This isn't an app. It's a lifeline.

Every pixel, every word, every interaction should feel like a friend who's been through this before, taking you by the hand and saying:

**"I know this is terrifying. Here's exactly what to do. You're not alone."**

Build that.

---

*Design Plan v1.0*
*December 2024*
