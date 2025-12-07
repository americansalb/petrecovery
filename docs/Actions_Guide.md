# Actions Guide: Mission Control Task System

> **Purpose:** This document defines the complete vision for the pet recovery action/task system. It serves as the authoritative reference for all implementation decisions.

---

## Table of Contents

1. [Philosophy](#philosophy)
2. [Task Categories](#task-categories)
3. [Points System](#points-system)
4. [Verification Methods](#verification-methods)
5. [Shelter Contact Flow](#shelter-contact-flow)
6. [Email System](#email-system)
7. [Search Tracking](#search-tracking)
8. [Flyer Tracking](#flyer-tracking)
9. [Mascot Tips (Scout)](#mascot-tips-scout)
10. [Task Collaboration](#task-collaboration)
11. [Algorithm Self-Improvement](#algorithm-self-improvement)
12. [Data Models](#data-models)
13. [API Endpoints](#api-endpoints)
14. [UI Specifications](#ui-specifications)
15. [Implementation Phases](#implementation-phases)

---

## Philosophy

### Core Principles

1. **Speed Matters** - Every UI decision optimizes for getting things done fast. A stressed pet owner shouldn't have to think.

2. **Verification Creates Value** - Verified actions (GPS, platform emails, photos) are worth more because they:
   - Provide reliable data for algorithm improvement
   - Enable accurate team coordination
   - Build trust in progress reporting

3. **Don't Punish, Incentivize** - Users without GPS or verification capabilities still earn points, just with daily caps. Verification is a bonus, not a requirement.

4. **Data Feeds the Algorithm** - Every verified action contributes to improving recommendations for future cases. The system gets smarter over time.

5. **Collaboration Over Competition** - Multiple people can work on tasks together. The goal is finding the pet, not individual glory.

### What We're NOT Doing

- Time-specific task names (no "dawn_search" in UI - algorithm handles timing internally)
- Punitive messaging for unverified actions
- Overwhelming users with options
- Gamification that distracts from the mission

---

## Task Categories

### Overview

Four categories, each with a distinct purpose:

| Category | Icon | Purpose |
|----------|------|---------|
| **Search** | 🔍 | Physical searching for the pet |
| **Spread the Word** | 📢 | Contacting organizations and people |
| **Attract Home** | 🏠 | Things to bring the pet back |
| **Other** | ✏️ | Custom activity logging |

### Category 1: Search 🔍

Physical searching in the field.

#### Actions

| Action ID | Display Name | Description | Who | Verification |
|-----------|--------------|-------------|-----|--------------|
| `search_area` | Search Area | Walk through neighborhood/area | BOTH | GPS tracking |
| `check_hiding` | Check Hiding Spots | Look under decks, bushes, sheds | BOTH | GPS + photo |

#### UI Behavior

- Single "Search" task displayed (no dawn/dusk variants in UI)
- GPS tracking encouraged via prompt, not required
- Map shows: searched areas (green), unsearched (gray), high-priority (red)
- Real-time path drawing when GPS enabled

#### Algorithm Notes (Internal)

The priority algorithm applies these boosts invisibly:

| Condition | Boost | Mascot Tip |
|-----------|-------|------------|
| Dawn (5-7am) | +10% | "Pets are most active at dawn - great time to search!" |
| Dusk (5-8pm) | +10% | "Dusk is prime search time - cats often emerge now" |
| Near recent sighting | +15% | "A sighting was reported nearby - focus here!" |
| Weather: Clear | +5% | - |
| Weather: Rain | -10% | "Pets seek shelter in rain - check covered areas" |

These boosts affect internal priority scoring. Users see simplified task names.

---

### Category 2: Spread the Word 📢

Contacting shelters, vets, neighbors, and spreading awareness.

#### Actions

| Action ID | Display Name | Description | Who | Verification |
|-----------|--------------|-------------|-----|--------------|
| `contact_shelters` | Contact Shelters | Call or email local animal shelters | BOTH | Platform email = verified, call = self-report |
| `contact_vets` | Contact Vet Clinics | Call or email local veterinarians | BOTH | Same as above |
| `contact_animal_control` | Contact Animal Control | Reach out to animal control offices | BOTH | Same as above |
| `notify_microchip` | Notify Microchip Company | Report pet as lost with chip provider | OWNER | Self-report with confirmation screenshot |
| `post_flyers` | Post Flyers | Put up physical flyers | BOTH | GPS location mark per flyer |
| `knock_doors` | Talk to Neighbors | Go door-to-door in neighborhood | BOTH | GPS tracking or address log |
| `alert_delivery` | Alert Delivery Workers | Tell mail carriers, Amazon drivers, etc. | BOTH | Self-report |
| `share_online` | Share Online | Post on social media, Nextdoor, etc. | BOTH | Link submission |

#### Priority Order (Default)

1. Contact shelters/vets/animal control (highest probability of intake)
2. Notify microchip company (if applicable)
3. Talk to neighbors (high value, low effort)
4. Post flyers (visual coverage)
5. Alert delivery workers
6. Share online

#### Shelter/Vet Contact Sub-Flow

When user taps "Contact Shelters":

1. Opens shelter lookup view (Apple Maps API)
2. Shows list + map of nearby shelters (25mi default, expandable to 75mi)
3. Sorted by distance from **last seen location** (not user's current location)
4. Each shelter shows contact status and history
5. User can call (logs outcome) or email (platform sends)

See [Shelter Contact Flow](#shelter-contact-flow) for complete specification.

---

### Category 3: Attract Home 🏠

Actions the owner does at/near home to attract the pet back.

#### Actions

| Action ID | Display Name | Description | Who | Pet Type | Verification |
|-----------|--------------|-------------|-----|----------|--------------|
| `litter_outside` | Put Litter Box Outside | Place used litter near entry points | OWNER | CAT | Photo upload |
| `scent_items` | Leave Scent Items | Put worn clothing outside | OWNER | BOTH | Photo upload |
| `food_station` | Set Up Food Station | Leave food and water outside | OWNER | BOTH | Photo upload |
| `camera_setup` | Set Up Camera | Monitor food station with camera | OWNER | BOTH | Photo or camera link |
| `humane_trap` | Set Humane Trap | For skittish pets that won't approach | OWNER | BOTH | Photo + check-in logging |
| `garage_open` | Leave Garage Cracked | Leave garage/shed slightly open overnight | OWNER | BOTH | Self-report |

#### Notes

- Primarily owner tasks, but volunteers can help with setup
- Photo verification encouraged for all
- Humane trap requires regular check-in logging (every 4-6 hours)
- Camera integration for live feed viewing (future feature)

---

### Category 4: Other ✏️

Custom activity logging for anything not covered above.

#### Input Fields

- **Activity description** (required): Free-form text, "What did you do?"
- **Location** (optional): GPS or manual address
- **Photo** (optional): Evidence upload
- **Time spent** (optional): Duration in minutes

#### Purpose

1. Capture edge cases the predefined actions don't cover
2. Data mine for new action types to add
3. Show engagement even for uncategorized help
4. Allow creative problem-solving

#### Examples of "Other" Activities

- "Checked with the construction crew working on Oak St"
- "Asked the homeless community near the park"
- "Searched the abandoned warehouse with permission"
- "Set up a second food station at neighbor's house"

---

## Points System

### Philosophy

Points serve two purposes:

1. **Gamification** - Reward and recognize volunteer effort
2. **Data Quality Signal** - Verified actions earn more, incentivizing verification

### Point Values

#### Verified Actions (No Daily Cap)

| Action | Points | Verification Method |
|--------|--------|---------------------|
| GPS-tracked search | 10 pts per 0.1 mi | Continuous GPS tracking |
| Email sent via platform | 15 pts | Platform sends email |
| Flyer posted with GPS mark | 8 pts | Location stamped |
| Photo uploaded as proof | +3 pts bonus | Any action with photo |
| Call logged after phone dial | 12 pts | We detect call was placed |

#### Self-Reported Actions (100 pts/day cap total)

| Action | Points | Notes |
|--------|--------|-------|
| "I searched this area" (manual mark) | 5 pts | Draw polygon on map |
| "I called, here's what happened" | 8 pts | Select outcome |
| "I posted a flyer" (no GPS) | 4 pts | Claim without location |
| "I knocked on doors" | 5 pts | Estimate doors visited |
| "I did something else" (Other) | 3 pts | Custom activity |

#### Daily Cap Breakdown

The 100 pts/day cap for self-reported actions prevents gaming while still allowing meaningful contribution:

```
Example day for user without GPS:
- Manual search marks: 5 + 5 + 5 = 15 pts
- Calls logged: 8 + 8 + 8 = 24 pts
- Flyers claimed: 4 + 4 + 4 + 4 = 16 pts
- Door knocking: 5 + 5 = 10 pts
- Other activities: 3 + 3 = 6 pts
────────────────────────────────
Total: 71 pts (under cap, all count)

If they claimed more, stops at 100 pts for the day.
Verified actions would still earn unlimited on top.
```

### Time-Based Bonuses

Applied to the base points:

| Condition | Bonus | Applies To |
|-----------|-------|------------|
| Dawn search (5-7am) | +10% | Search actions |
| Dusk search (5-8pm) | +10% | Search actions |
| Business hours (9am-5pm) | +10% | Shelter/vet contacts |
| Within 0.5mi of sighting | +15% | Search actions |
| First 6 hours after lost | +20% | All actions |
| Owner-requested task | +25% | The specific task |

### Points Display

```
┌─────────────────────────────────────────┐
│ ✓ Search completed                      │
│                                         │
│   Base points:           10 pts         │
│   Dawn bonus (+10%):     +1 pt          │
│   Near sighting (+15%):  +2 pts         │
│   ─────────────────────────────         │
│   Total earned:          13 pts         │
│                                         │
│   Your daily total:      47 pts         │
│   Team total:            234 pts        │
└─────────────────────────────────────────┘
```

---

## Verification Methods

### GPS Tracking

**What:** Continuous location recording during search sessions.

**How it works:**
1. User starts a search session
2. App requests location permission (if not granted)
3. Location recorded every 10 seconds while searching
4. Path drawn on map in real-time
5. Distance calculated from path
6. Session ends when user stops or app goes to background for 5+ minutes

**Data stored:**
```typescript
interface SearchSession {
  id: string;
  userId: string;
  caseId: string;

  startedAt: Date;
  endedAt: Date;

  path: GeoPoint[];  // Array of {lat, lng, timestamp}
  distanceMiles: number;

  pointsEarned: number;
  wasVerified: true;
}
```

**Privacy note:** Location data is only used for this case and algorithm improvement. Not sold or shared.

### Platform Email

**What:** Emails sent through our infrastructure with tracking.

**How it works:**
1. User previews templated email
2. Taps "Send"
3. We send via Resend/SendGrid
4. From: `rescue-[caseId]@mail.petrecovery.com`
5. Reply-to: Owner's email address
6. We log send, track opens (pixel), detect replies

**Verification:** 100% - we know the email was sent.

See [Email System](#email-system) for complete specification.

### Photo Upload

**What:** User uploads photo as proof of action.

**How it works:**
1. User completes action (e.g., sets up litter box)
2. Takes photo showing completed action
3. Uploads via app
4. Photo stored with EXIF data (timestamp, location if available)

**Verification:** Strong - photo evidence with metadata.

**Bonus:** +3 pts for any action with photo proof.

### Call Detection (Future)

**What:** Detect that user actually placed a call.

**How it works:**
1. User taps "Call" on a shelter
2. Phone dialer opens with number
3. After call ends, app prompts for outcome
4. If call duration > 10 seconds, likely connected

**Note:** This is technically complex and may not be possible on all platforms. Start with self-reported call logging.

### Self-Reported (Fallback)

**What:** User claims they did something.

**How it works:**
1. User taps "I did this"
2. Selects outcome/details from options
3. Optionally adds notes
4. We log the claim

**Verification:** None - we trust the user but cap daily points.

---

## Shelter Contact Flow

### Entry Point

User taps "Contact Shelters" (or Vets, or Animal Control) in Spread the Word section.

### Shelter Lookup View

```
┌─────────────────────────────────────────┐
│ ← Back          Contact Shelters        │
├─────────────────────────────────────────┤
│ [MAP VIEW]              [Toggle: List]  │
│ ┌─────────────────────────────────────┐ │
│ │    •  📍                            │ │
│ │      ╲   • Shelter A                │ │
│ │       ╲                             │ │
│ │    🏠 Last seen                     │ │
│ │         ╲  • Shelter B              │ │
│ │          ╲                          │ │
│ │           • Shelter C               │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ 📍 Within 25 miles        [Expand ▼]   │
│    of last seen location    50mi 75mi  │
├─────────────────────────────────────────┤
│ Filter: [All] [Not Contacted] [Pending] │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ 🏥 Chicago Animal Care & Control    │ │
│ │    2.3 mi · Open until 5pm          │ │
│ │    ○ Not contacted                  │ │
│ │    [📞 Call]  [📧 Email]  [📍 Map]  │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 🏥 Anti-Cruelty Society             │ │
│ │    3.8 mi · Closed                  │ │
│ │    ✓ Emailed by Sarah (2h ago)      │ │
│ │      "Awaiting response"            │ │
│ │    [📞 Call]  [📧 Email]  [📍 Map]  │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 🏥 PAWS Chicago                     │ │
│ │    5.1 mi · Open                    │ │
│ │    📞 Called by Mike (1d ago)       │ │
│ │      "Left voicemail"               │ │
│ │    [📞 Call]  [📧 Email]  [📍 Map]  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│        [Load More - 12 remaining]       │
└─────────────────────────────────────────┘
```

### Data Source

- **Primary:** Apple Maps API (MapKit JS)
- **Query terms:** "animal shelter", "animal control", "humane society", "pet rescue", "veterinarian"
- **Radius:** 25mi default, expandable to 50mi, 75mi
- **Sort:** Distance from last seen location
- **Enrichment:** Our shelter database for hours, email, policies (community-sourced over time)

### Contact Status Per Shelter

| Status | Icon | Meaning |
|--------|------|---------|
| `NOT_CONTACTED` | ○ | No one has reached out |
| `CONTACTED` | ◐ | Contact made, details pending |
| `AWAITING_RESPONSE` | ⏳ | Waiting for shelter reply |
| `NO_MATCH` | ✗ | Confirmed no matching animals |
| `POSSIBLE_MATCH` | ❓ | They may have a match, needs verification |
| `MATCH_FOUND` | ✓ | Pet is there! |

### Call Flow

1. User taps [📞 Call]
2. Phone dialer opens with shelter number
3. After returning to app, prompt appears:

```
┌─────────────────────────────────────────┐
│         Log Your Call                   │
├─────────────────────────────────────────┤
│ Chicago Animal Care & Control           │
│                                         │
│ What happened?                          │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 📵 No answer                        │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 📱 Left voicemail                   │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 💬 Spoke with staff                 │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ ❌ Wrong number / closed            │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ ⏭️ Didn't call (skip)               │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

4. If "Spoke with staff", follow-up:

```
┌─────────────────────────────────────────┐
│         What did they say?              │
├─────────────────────────────────────────┤
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 🔍 No matching animals currently    │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 🤔 Possible match - needs follow-up │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 🎉 They have the pet!               │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 📝 Other (add note)                 │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Notes (optional):                       │
│ ┌─────────────────────────────────────┐ │
│ │ Staff said to call back tomorrow    │ │
│ │ after 2pm when intake manager is in │ │
│ └─────────────────────────────────────┘ │
│                                         │
│           [Save Call Log]               │
│                                         │
│           +8 pts earned                 │
└─────────────────────────────────────────┘
```

5. Contact status updates based on outcome
6. Visible to entire team

---

## Email System

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    EMAIL FLOW                            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  User taps "Email"                                       │
│         │                                                │
│         ▼                                                │
│  ┌────────────────┐                                      │
│  │ Preview Email  │  ← Fixed template, not editable     │
│  │ [Send Button]  │                                      │
│  └───────┬────────┘                                      │
│          │                                               │
│          ▼                                               │
│  ┌────────────────────────────────────────┐              │
│  │ Resend API                             │              │
│  │                                        │              │
│  │ From: rescue-abc123@mail.petrecovery.com             │
│  │ Reply-To: owner@gmail.com              │              │
│  │ To: shelter@example.org                │              │
│  └────────────────────────────────────────┘              │
│          │                                               │
│          ├──────────────────────┐                        │
│          ▼                      ▼                        │
│  ┌──────────────┐      ┌──────────────┐                  │
│  │ Shelter gets │      │ We track:    │                  │
│  │ email        │      │ - Sent ✓     │                  │
│  │              │      │ - Opened     │                  │
│  │ Replies to   │      │ - Replied    │                  │
│  │ owner's email│      │ - Bounced    │                  │
│  └──────────────┘      └──────────────┘                  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Email Template

```
Subject: Lost [Cat/Dog] - [Pet Name] - [City, State]

──────────────────────────────────────────

Hello,

I am searching for my lost [cat/dog], [Pet Name], who went
missing on [Date] near [Address, City, State].

[PET PHOTO - Embedded]

DESCRIPTION:
• [Color/Breed]: [Orange tabby / Golden Retriever / etc.]
• Sex: [Male/Female], [Neutered/Spayed/Intact]
• Weight: [Approximately X lbs]
• Age: [X years old]
• Distinguishing features: [Collar, microchip, markings]
• Microchip: [Yes - ID: XXXXX / No / Unknown]

Please check your intake records and let me know if any
animals matching this description have been brought in.

📍 View full case with more photos:
[Link to petrecovery.com/case/xxx]

Thank you for your help in bringing [Pet Name] home.

[Owner Name]
[Owner Phone]
[Owner Email]

──────────────────────────────────────────
Sent via PetRecovery.com - Helping reunite lost pets
```

### Why Fixed Template

1. **Prevents spam/abuse** - Users can't send inappropriate content
2. **Ensures quality** - Professional, complete information every time
3. **Speed** - One tap to send, no composing required
4. **Legal protection** - We control the content

### Email Preview UI

```
┌─────────────────────────────────────────┐
│ ← Cancel        Preview Email           │
├─────────────────────────────────────────┤
│                                         │
│ To: info@chicagoanimalcare.org          │
│                                         │
│ Subject: Lost Cat - Whiskers - Chicago  │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ │  Hello,                             │ │
│ │                                     │ │
│ │  I am searching for my lost cat,    │ │
│ │  Whiskers, who went missing on      │ │
│ │  December 4, 2025 near 123 Main     │ │
│ │  Street, Chicago, IL.               │ │
│ │                                     │ │
│ │  [PHOTO]                            │ │
│ │                                     │ │
│ │  DESCRIPTION:                       │ │
│ │  • Orange tabby                     │ │
│ │  • Male, neutered                   │ │
│ │  • 10 lbs                           │ │
│ │  • 5 years old                      │ │
│ │  • Blue collar with bell            │ │
│ │  • Microchip: 985112345678          │ │
│ │                                     │ │
│ │  [View full case →]                 │ │
│ │                                     │ │
│ │  Thank you,                         │ │
│ │  Sarah Johnson                      │ │
│ │  (555) 123-4567                     │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ⓘ Template cannot be edited to ensure  │
│   quality and prevent spam              │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │            Send Email               │ │
│ │                                     │ │
│ │            +15 pts                  │ │
│ └─────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### After Send Confirmation

```
┌─────────────────────────────────────────┐
│                                         │
│            ✅ Email Sent!               │
│                                         │
│  Your email to Chicago Animal Care      │
│  has been sent successfully.            │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ +15 points earned                   ││
│  └─────────────────────────────────────┘│
│                                         │
│  What happens next:                     │
│  • Shelter will reply to YOUR email     │
│  • We'll update the status when they    │
│    open or reply                        │
│  • You can check back here for updates  │
│                                         │
│  [Email Another]    [Back to Tasks]     │
│                                         │
└─────────────────────────────────────────┘
```

### Email Infrastructure

| Component | Service | Cost |
|-----------|---------|------|
| Sending | Resend | ~$1/1000 emails |
| Domain | mail.petrecovery.com | DNS setup |
| Open tracking | Resend pixel | Included |
| Reply detection | Webhook or forward parsing | Custom |
| Bounce handling | Resend webhooks | Included |

### Shelter Partnerships (Free Advertising)

Every platform email serves as free advertising:

1. **Footer branding:** "Sent via PetRecovery.com - Helping reunite lost pets"
2. **Case link:** Shelter clicks through to see the full case on our platform
3. **Invitation CTA:** "Are you a shelter? Create a free account to receive and manage lost pet alerts"

**Shelter Account Benefits (Free Tier):**
- Receive organized lost pet alerts for their area
- Dashboard to track incoming cases
- One-click "No match" / "Possible match" responses
- Auto-update case status when they respond
- Featured in our shelter directory

**Value for Us:**
- Builds shelter network and trust
- Verified responses update case status automatically
- Potential for premium shelter features later
- Shelters become advocates for the platform

### Future: Paid Email Automation

Free tier (current):
- Send emails one at a time
- Unlimited manual sends
- No automation

Paid tier ($7.50 minimum):
- Bulk send: Email all shelters in one click
- Sequences: Auto follow-up in 3 days if no response
- Scheduling: Send at 9am when shelters open

---

## Search Tracking

### Two Modes

1. **GPS-Tracked** (Verified, unlimited points)
2. **Manual Marking** (Self-reported, daily cap applies)

### GPS-Tracked Search

#### Start Search Flow

```
┌─────────────────────────────────────────┐
│ ← Back          Search Mode             │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ │          [LIVE MAP]                 │ │
│ │                                     │ │
│ │   ─── Your path (blue line)         │ │
│ │   ███ Searched by team (green)      │ │
│ │   ░░░ Not searched (gray)           │ │
│ │   ⚑ Last seen (yellow pin)         │ │
│ │   👁 Sightings (orange pins)        │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│                                         │
│  📍 GPS tracking is enabled             │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │         START SEARCH               ││
│  │                                     ││
│  │    Your path will be tracked and   ││
│  │    shown to the team in real-time  ││
│  └─────────────────────────────────────┘│
│                                         │
│  Or: [Mark area manually instead]       │
│                                         │
└─────────────────────────────────────────┘
```

#### Active Search

```
┌─────────────────────────────────────────┐
│         🔴 SEARCHING                    │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ │    [MAP with live path drawing]     │ │
│ │                                     │ │
│ │    ═══════╗                         │ │
│ │           ║                         │ │
│ │           ╚═══ 📍 You               │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│                                         │
│  Distance: 0.34 mi                      │
│  Time: 12:45                            │
│  Points so far: 34 pts                  │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │         END SEARCH                 ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │  👁 REPORT SIGHTING                ││
│  └─────────────────────────────────────┘│
│                                         │
├─────────────────────────────────────────┤
│ 💡 Scout: Check under parked cars -    │
│    cats often hide there!               │
└─────────────────────────────────────────┘
```

#### End Search Summary

```
┌─────────────────────────────────────────┐
│         Search Complete                 │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────────┐│
│  │     [MAP with completed path]      ││
│  └─────────────────────────────────────┘│
│                                         │
│  📊 Summary                             │
│  ┌─────────────────────────────────────┐│
│  │ Distance:        0.82 miles        ││
│  │ Duration:        34 minutes        ││
│  │ Areas covered:   3 grid cells      ││
│  └─────────────────────────────────────┘│
│                                         │
│  🏆 Points Earned                       │
│  ┌─────────────────────────────────────┐│
│  │ Base (0.82 mi × 10):    82 pts     ││
│  │ Dusk bonus (+10%):       8 pts     ││
│  │ ─────────────────────────────      ││
│  │ Total:                  90 pts     ││
│  └─────────────────────────────────────┘│
│                                         │
│  [Search Again]       [Back to Tasks]   │
│                                         │
└─────────────────────────────────────────┘
```

### Manual Marking (No GPS)

For users who can't or won't enable GPS:

```
┌─────────────────────────────────────────┐
│ ← Back       Mark Searched Area         │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ │          [MAP VIEW]                 │ │
│ │                                     │ │
│ │    Tap corners to draw the area     │ │
│ │    you searched                     │ │
│ │                                     │ │
│ │         •─────────•                 │ │
│ │         │░░░░░░░░░│                 │ │
│ │         │░░░░░░░░░│                 │ │
│ │         •─────────•                 │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│                                         │
│  Area: ~0.3 sq mi                       │
│                                         │
│  [Clear]              [Confirm Area]    │
│                                         │
│  ⚠️ Manual marking: 5 pts              │
│     (GPS tracking earns 10 pts/0.1mi)  │
│                                         │
│  💡 Enable GPS for unlimited points     │
│     and better team coordination        │
│                                         │
│     [Enable GPS Instead]                │
│                                         │
└─────────────────────────────────────────┘
```

### Search Coverage Visualization

Map overlay showing search coverage:

| Color | Meaning |
|-------|---------|
| 🟢 Dark green | Thoroughly searched (3+ passes) |
| 🟢 Light green | Searched once |
| 🟡 Yellow | Searched >24 hours ago (stale) |
| ⚪ Gray | Not searched |
| 🔴 Red pulse | High priority (near sighting, unsearched) |

---

## Flyer Tracking

### Posting a Flyer

One-tap location marking while posting flyers:

```
┌─────────────────────────────────────────┐
│ ← Back           Post Flyers            │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ │          [MAP VIEW]                 │ │
│ │                                     │ │
│ │   📍 Your location                  │ │
│ │   📌 Flyers posted (by team)        │ │
│ │   🔴 Cold spots (needs flyers)      │ │
│ │                                     │ │
│ │         📌  📌                      │ │
│ │              📌                     │ │
│ │     🔴          📍 You              │ │
│ │         📌                          │ │
│ │                    🔴               │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────────┐│
│  │      📌 MARK FLYER HERE            ││
│  │                                     ││
│  │    Tap when you post a flyer       ││
│  │    +8 pts with GPS                 ││
│  └─────────────────────────────────────┘│
│                                         │
│  📊 Progress                            │
│  Flyers by you: 3                       │
│  Team total: 18                         │
│                                         │
├─────────────────────────────────────────┤
│ 💡 Scout: The bus stop on Elm St has   │
│    high foot traffic - no flyer there! │
└─────────────────────────────────────────┘
```

### Mark Flyer Flow

1. User taps "Mark Flyer Here"
2. Confirm current GPS location
3. Optional: Take photo of posted flyer (+3 bonus pts)
4. Pin appears on map immediately
5. Visible to entire team

### Cold Spot Detection

Algorithm identifies areas that need flyers:

**Simple Version (MVP):**
- Areas within search radius with no flyers marked
- Grid-based: divide area into cells, highlight empty cells

**Future Version:**
- High foot traffic areas (POI data)
- Intersections and bus stops
- Businesses (pet stores, coffee shops, grocery stores)

### Flyer Generation

In-app flyer PDF generation:

```
┌─────────────────────────────────────────┐
│ ← Back         Generate Flyer           │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────────┐│
│  │                                     ││
│  │      🚨 LOST CAT 🚨                ││
│  │                                     ││
│  │      [PET PHOTO]                    ││
│  │                                     ││
│  │      WHISKERS                       ││
│  │      Orange tabby, male             ││
│  │      Last seen: 123 Main St         ││
│  │      December 4, 2025               ││
│  │                                     ││
│  │      REWARD OFFERED                 ││
│  │                                     ││
│  │      CALL: (555) 123-4567           ││
│  │                                     ││
│  │      [QR CODE]                      ││
│  │      Scan for more info             ││
│  │                                     ││
│  └─────────────────────────────────────┘│
│                                         │
│  Template: [Classic ▼]                  │
│                                         │
│  Size:                                  │
│  ○ Full page (1 per sheet)             │
│  ● Half page (2 per sheet)             │
│  ○ Quarter page (4 per sheet)          │
│                                         │
│  [Download PDF]  [Print from Phone]     │
│                                         │
└─────────────────────────────────────────┘
```

**QR Code:** Links to case page on petrecovery.com with:
- More photos
- Up-to-date sighting info
- Easy "I saw this pet" button
- Analytics: track scans by location

---

## Mascot Tips (Scout)

### Overview

Scout is the friendly mascot that provides contextual tips and encouragement. Tips appear as banners in the UI and as messages in mission chat.

### Tip Types

| Type | Trigger | Example |
|------|---------|---------|
| `TIME` | Approaching optimal search time | "It's almost dusk - great time for a search!" |
| `WEATHER` | Weather conditions | "Rain starting soon - pets seek shelter under porches" |
| `PROGRESS` | Milestones reached | "Amazing! 10 shelters contacted. Keep going!" |
| `LOCATION` | Unsearched areas | "The alley behind Oak St hasn't been checked" |
| `COLD_SPOT` | Missing flyer coverage | "No flyers near the grocery store yet" |
| `STRATEGY` | General advice | "Cats usually hide within 0.5 miles of home" |
| `ENCOURAGE` | Morale boost | "Every action brings [Pet] closer to home!" |

### Tip Display

#### Banner (in task list)

```
┌─────────────────────────────────────────┐
│ 🐕 Scout:                               │
│ "It's 5:30pm - dusk is the best time   │
│  to search for cats. They often come   │
│  out to hunt!"                          │
│                              [Dismiss]  │
└─────────────────────────────────────────┘
```

#### Mission Chat Message

```
┌─────────────────────────────────────────┐
│ Scout 🐕                        5:30 PM │
│                                         │
│ 🌅 Dusk Alert!                          │
│                                         │
│ It's the golden hour for searching.     │
│ Cats are most active at dawn and dusk.  │
│ If you can, head out for a search now!  │
│                                         │
│ [Start Search →]                        │
└─────────────────────────────────────────┘
```

### Tip Generation Logic

```typescript
function generateTips(caseData: Case): Tip[] {
  const tips: Tip[] = [];
  const now = new Date();
  const hour = now.getHours();

  // Time-based tips
  if (hour >= 4 && hour <= 6) {
    tips.push({
      type: 'TIME',
      priority: 80,
      message: "Early bird! Dawn is prime search time for cats.",
      expiresAt: addHours(now, 2)
    });
  }

  if (hour >= 16 && hour <= 18) {
    tips.push({
      type: 'TIME',
      priority: 80,
      message: "Dusk approaching - great time to search!",
      expiresAt: addHours(now, 3)
    });
  }

  // Weather-based tips
  const weather = await getWeather(caseData.lastSeenLocation);
  if (weather.willRain) {
    tips.push({
      type: 'WEATHER',
      priority: 90,
      message: `Rain expected in ${weather.hoursUntilRain} hours. Pets seek shelter under porches, cars, and sheds.`,
      expiresAt: addHours(now, weather.hoursUntilRain)
    });
  }

  // Cold spot tips
  const coldSpots = detectFlyerColdSpots(caseData.id);
  if (coldSpots.length > 0) {
    tips.push({
      type: 'COLD_SPOT',
      priority: 60,
      message: `The area around ${coldSpots[0].name} has no flyers yet.`,
    });
  }

  // Progress tips
  const sheltersContacted = await getShelterContactCount(caseData.id);
  if (sheltersContacted === 5) {
    tips.push({
      type: 'PROGRESS',
      priority: 50,
      message: "5 shelters contacted! You're making great progress.",
    });
  }

  // Sort by priority, return top 3
  return tips.sort((a, b) => b.priority - a.priority).slice(0, 3);
}
```

### Tip Examples by Situation

**Lost indoor cat, first day:**
- "Indoor cats usually hide very close to home - within 3-5 houses"
- "Check under decks, in bushes, and any gaps where a scared cat could squeeze"
- "Put the litter box outside - cats can smell it from far away"

**Lost dog, 3+ days:**
- "As days pass, dogs may travel further. Expand your search radius"
- "Alert delivery drivers - they cover lots of ground daily"
- "Keep those shelter calls going - dogs are often brought in by good samaritans"

**Recent sighting reported:**
- "🚨 New sighting 0.3 miles away! Focus your search there"
- "Sightings are hot leads - tell neighbors in that exact area"

---

## Task Collaboration

### Joining Tasks

Multiple people can work on the same task:

```
┌─────────────────────────────────────────┐
│            Contact Shelters             │
├─────────────────────────────────────────┤
│                                         │
│  Priority: HIGH                         │
│  Category: Spread the Word              │
│  18 shelters within 25 miles            │
│                                         │
│  👥 Currently helping:                  │
│     • Sarah M. (5 contacted)            │
│     • Mike T. (started 10 min ago)      │
│     • You could join!                   │
│                                         │
│  📊 Progress: 7/18 shelters             │
│  ████████░░░░░░░░░░░░░░ 39%             │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │        JOIN THIS TASK              ││
│  │   Help contact remaining shelters  ││
│  └─────────────────────────────────────┘│
│                                         │
│  [View Shelter List →]                  │
│                                         │
└─────────────────────────────────────────┘
```

### Task States

| State | Badge | Meaning |
|-------|-------|---------|
| `AVAILABLE` | ○ | No one working on it |
| `IN_PROGRESS` | ◐ | 1+ people working |
| `NEEDS_HELP` | 🆘 | Someone requested backup |
| `OWNER_REQUESTED` | 👑 | Owner specifically wants help here |
| `COMPLETED` | ✓ | All subtasks done |
| `BLOCKED` | ⛔ | Can't proceed (dependency or issue) |

### Owner Request Feature

Owner can request help on any task:

```
┌─────────────────────────────────────────┐
│         Request Help                    │
├─────────────────────────────────────────┤
│                                         │
│  Ask volunteers to prioritize:          │
│  "Contact Shelters"                     │
│                                         │
│  Why do you need help? (optional)       │
│  ┌─────────────────────────────────────┐│
│  │ I'm stuck at work until 6pm and    ││
│  │ can't make phone calls. Please     ││
│  │ help if you have time!             ││
│  └─────────────────────────────────────┘│
│                                         │
│           [Send Request]                │
│                                         │
└─────────────────────────────────────────┘
```

**What happens:**
1. Task gets +25% priority boost
2. Shows 👑 badge on task
3. Notification sent to all volunteers
4. Message posted in mission chat
5. Owner's message shown on task detail

### Live Collaboration View

```
┌─────────────────────────────────────────┐
│ 👥 Team Activity                        │
├─────────────────────────────────────────┤
│                                         │
│ Right now:                              │
│ 🟢 Sarah - Searching (GPS active)       │
│ 🟢 Mike - Calling PAWS Chicago          │
│ 🟢 Lisa - Posting flyers on Oak St      │
│ 🟡 John - Idle (5 min ago)              │
│                                         │
│ Recent:                                 │
│ • Sarah marked 0.3 mi searched (2m ago) │
│ • Mike logged call to shelter (5m ago)  │
│ • Lisa posted flyer at Elm & 5th (8m)   │
│                                         │
└─────────────────────────────────────────┘
```

---

## Algorithm Self-Improvement

### The Feedback Loop

```
┌──────────────────────────────────────────────────────────────┐
│                    ALGORITHM IMPROVEMENT CYCLE               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                    ┌─────────────┐                           │
│              ┌────▶│ User takes  │                           │
│              │     │ VERIFIED    │                           │
│              │     │ action      │                           │
│              │     └──────┬──────┘                           │
│              │            │                                  │
│              │            ▼                                  │
│     ┌────────┴───┐  ┌─────────────┐                         │
│     │ Better     │  │ Data logged │                         │
│     │ recommend- │  │ with case   │                         │
│     │ ations     │  │ context     │                         │
│     └────────────┘  └──────┬──────┘                         │
│              ▲            │                                  │
│              │            ▼                                  │
│              │     ┌─────────────┐                           │
│              │     │ Case        │                           │
│              │     │ resolves    │                           │
│              │     │ (or closes) │                           │
│              │     └──────┬──────┘                           │
│              │            │                                  │
│              │            ▼                                  │
│              │     ┌─────────────┐                           │
│              │     │ Analyze:    │                           │
│              │     │ What worked?│                           │
│              └─────┤ What didn't?│                           │
│                    └─────────────┘                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Data Collection Requirements

For algorithm training, we log:

```typescript
interface VerifiedAction {
  id: string;
  caseId: string;
  userId: string;

  actionType: string;  // 'search_area', 'contact_shelter', etc.
  hoursAfterLost: number;  // When action was taken relative to missing time

  // Verification proof
  verificationMethod: 'GPS' | 'PLATFORM_EMAIL' | 'PHOTO' | 'CALL_DETECT';

  // Action-specific data
  metadata: {
    distanceMiles?: number;      // For searches
    shelterId?: string;          // For contacts
    callOutcome?: string;        // For calls
    location?: GeoPoint;         // GPS location
  };

  pointsEarned: number;
  createdAt: Date;
}
```

When case resolves:

```typescript
interface CaseOutcome {
  caseId: string;

  outcome: 'REUNITED' | 'NOT_FOUND' | 'DECEASED' | 'CLOSED';
  timeToReunionHours?: number;

  // How was pet found?
  foundMethod?: 'CAME_HOME' | 'SHELTER' | 'NEIGHBOR' | 'SIGHTING' | 'TRAP' | 'FLYER' | 'SOCIAL' | 'OTHER';
  foundMethodDetails?: string;

  // Case context for ML
  petType: 'CAT' | 'DOG';
  petBehavior?: 'INDOOR' | 'OUTDOOR' | 'SKITTISH' | 'FRIENDLY';
  petSize?: 'SMALL' | 'MEDIUM' | 'LARGE';
  locationType?: 'URBAN' | 'SUBURBAN' | 'RURAL';

  // Snapshot of what was done
  verifiedActionsCount: number;
  verifiedActionsSummary: {
    actionType: string;
    count: number;
    avgHoursAfterLost: number;
  }[];
}
```

### Analysis Queries

After accumulating cases:

```sql
-- Which actions correlate with faster reunions?
SELECT
  va.action_type,
  AVG(co.time_to_reunion_hours) as avg_hours_to_reunion,
  COUNT(DISTINCT co.case_id) as case_count
FROM verified_actions va
JOIN case_outcomes co ON va.case_id = co.case_id
WHERE co.outcome = 'REUNITED'
GROUP BY va.action_type
ORDER BY avg_hours_to_reunion ASC;

-- Does early shelter contact help?
SELECT
  CASE
    WHEN MIN(va.hours_after_lost) < 6 THEN 'Within 6 hours'
    WHEN MIN(va.hours_after_lost) < 24 THEN 'Within 24 hours'
    ELSE 'After 24 hours'
  END as contact_timing,
  AVG(co.time_to_reunion_hours) as avg_reunion_time,
  COUNT(*) as cases
FROM verified_actions va
JOIN case_outcomes co ON va.case_id = co.case_id
WHERE va.action_type = 'contact_shelter'
  AND co.outcome = 'REUNITED'
GROUP BY contact_timing;

-- Dawn vs any-time search effectiveness
SELECT
  CASE
    WHEN EXTRACT(HOUR FROM va.created_at) BETWEEN 5 AND 7 THEN 'Dawn'
    WHEN EXTRACT(HOUR FROM va.created_at) BETWEEN 17 AND 20 THEN 'Dusk'
    ELSE 'Other'
  END as search_time,
  SUM(CASE WHEN co.outcome = 'REUNITED' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as reunion_rate
FROM verified_actions va
JOIN case_outcomes co ON va.case_id = co.case_id
WHERE va.action_type = 'search_area'
GROUP BY search_time;
```

### Priority Score Adjustments

Based on data, we adjust base priorities:

```typescript
// Current static values
const BASE_PRIORITIES = {
  contact_shelter: 85,
  search_area: 75,
  post_flyers: 65,
  // ...
};

// Future: Dynamic based on outcome data
async function getDynamicPriority(actionType: string, caseContext: CaseContext): Promise<number> {
  const basePriority = BASE_PRIORITIES[actionType];

  // Get effectiveness multiplier from ML model
  const effectiveness = await getActionEffectiveness(actionType, {
    petType: caseContext.petType,
    hoursLost: caseContext.hoursLost,
    locationType: caseContext.locationType,
  });

  // Adjust base priority by effectiveness
  // effectiveness: 0.5 = less effective, 1.0 = baseline, 1.5 = very effective
  return basePriority * effectiveness;
}
```

### Why Only Verified Actions?

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  SELF-REPORTED: "I searched the whole neighborhood"        │
│  REALITY: Maybe they walked one block                      │
│  ALGORITHM SEES: Unreliable → Garbage In                   │
│                                                             │
│  GPS-VERIFIED: Walked 1.3 miles covering 6 grid cells      │
│  REALITY: We KNOW this happened                            │
│  ALGORITHM SEES: Reliable → Good Data                      │
│                                                             │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  Self-reported actions still:                               │
│  ✓ Earn points (with daily cap)                            │
│  ✓ Show on team activity feed                              │
│  ✓ Help with coordination                                  │
│                                                             │
│  But for algorithm training:                                │
│  → Only verified actions count                              │
│  → This ensures recommendations improve over time           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Models

### New Models to Add

```prisma
// Add to schema.prisma

// ============================================
// SHELTER CONTACT TRACKING
// ============================================

model ShelterContact {
  id              String   @id @default(cuid())
  caseId          String
  case            LostPetCase @relation(fields: [caseId], references: [id], onDelete: Cascade)
  shelterId       String
  shelter         Shelter  @relation(fields: [shelterId], references: [id])

  status          ShelterContactStatus @default(NOT_CONTACTED)

  attempts        ShelterContactAttempt[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([caseId, shelterId])
  @@index([caseId])
  @@index([shelterId])
}

enum ShelterContactStatus {
  NOT_CONTACTED
  CONTACTED
  AWAITING_RESPONSE
  NO_MATCH
  POSSIBLE_MATCH
  MATCH_FOUND
}

model ShelterContactAttempt {
  id                String   @id @default(cuid())
  shelterContactId  String
  shelterContact    ShelterContact @relation(fields: [shelterContactId], references: [id], onDelete: Cascade)
  userId            String
  user              User     @relation(fields: [userId], references: [id])

  method            ContactMethod

  // For calls
  callOutcome       CallOutcome?
  staffResponse     StaffResponse?

  // For emails
  emailId           String?  // Resend message ID
  emailOpened       Boolean  @default(false)
  emailOpenedAt     DateTime?
  emailReplied      Boolean  @default(false)
  emailRepliedAt    DateTime?

  notes             String?
  pointsEarned      Int      @default(0)
  isVerified        Boolean  @default(false)

  createdAt         DateTime @default(now())

  @@index([shelterContactId])
  @@index([userId])
}

enum ContactMethod {
  CALL
  EMAIL
  IN_PERSON
}

enum CallOutcome {
  NO_ANSWER
  LEFT_VOICEMAIL
  SPOKE_WITH_STAFF
  WRONG_NUMBER
  BUSY
}

enum StaffResponse {
  NO_MATCHING_ANIMALS
  POSSIBLE_MATCH
  CONFIRMED_MATCH
  WILL_CHECK_AND_CALL_BACK
  OTHER
}

// ============================================
// FLYER TRACKING
// ============================================

model FlyerPosting {
  id        String   @id @default(cuid())
  caseId    String
  case      LostPetCase @relation(fields: [caseId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id])

  latitude  Float
  longitude Float

  photoUrl  String?
  notes     String?

  pointsEarned Int   @default(8)
  isVerified   Boolean @default(true)  // GPS-marked = verified

  createdAt DateTime @default(now())

  @@index([caseId])
  @@index([userId])
}

// ============================================
// MASCOT TIPS
// ============================================

model MascotTip {
  id          String   @id @default(cuid())
  caseId      String
  case        LostPetCase @relation(fields: [caseId], references: [id], onDelete: Cascade)

  tipType     TipType
  message     String
  priority    Int      @default(50)

  expiresAt   DateTime?
  dismissedBy String[] @default([])  // User IDs who dismissed

  postedToChat Boolean @default(false)

  createdAt   DateTime @default(now())

  @@index([caseId])
}

enum TipType {
  TIME
  WEATHER
  PROGRESS
  LOCATION
  COLD_SPOT
  STRATEGY
  ENCOURAGE
}

// ============================================
// VERIFIED ACTIONS (for algorithm training)
// ============================================

model VerifiedAction {
  id              String   @id @default(cuid())
  caseId          String
  case            LostPetCase @relation(fields: [caseId], references: [id], onDelete: Cascade)
  userId          String
  user            User     @relation(fields: [userId], references: [id])

  actionType      String   // 'search_area', 'contact_shelter', etc.
  hoursAfterLost  Float    // When action was taken

  verificationMethod VerificationMethod

  // Action-specific metadata
  metadata        Json     @default("{}")

  pointsEarned    Int

  createdAt       DateTime @default(now())

  @@index([caseId])
  @@index([actionType])
}

enum VerificationMethod {
  GPS
  PLATFORM_EMAIL
  PHOTO
  CALL_DETECT
}

// ============================================
// CASE OUTCOMES (for algorithm training)
// ============================================

model CaseOutcome {
  id                    String   @id @default(cuid())
  caseId                String   @unique
  case                  LostPetCase @relation(fields: [caseId], references: [id], onDelete: Cascade)

  outcome               OutcomeType
  timeToReunionHours    Float?

  foundMethod           FoundMethod?
  foundMethodDetails    String?

  // Context snapshot
  petType               String
  petBehavior           String?
  petSize               String?
  locationType          String?

  // Actions summary (denormalized for fast queries)
  verifiedActionsCount  Int      @default(0)
  verifiedActionsSummary Json    @default("[]")

  createdAt             DateTime @default(now())
}

enum OutcomeType {
  REUNITED
  NOT_FOUND
  DECEASED
  CLOSED_OTHER
}

enum FoundMethod {
  CAME_HOME
  SHELTER_INTAKE
  NEIGHBOR_FOUND
  SIGHTING_LED_TO
  TRAP_CAUGHT
  FLYER_RESPONSE
  SOCIAL_MEDIA
  OTHER
}

// ============================================
// USER POINTS (daily tracking)
// ============================================

model DailyPointsLog {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])

  date          DateTime @db.Date  // Just the date, no time

  verifiedPoints    Int  @default(0)  // Unlimited
  selfReportedPoints Int @default(0)  // Capped at 100

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([userId, date])
  @@index([userId])
}

// ============================================
// MODIFICATIONS TO EXISTING MODELS
// ============================================

// Add to SquadTask model:
model SquadTask {
  // ... existing fields ...

  ownerRequested        Boolean   @default(false)
  ownerRequestMessage   String?
  ownerRequestedAt      DateTime?
  ownerRequestedBy      String?   // Should always be owner, but track anyway
}
```

### Model Relationships Diagram

```
┌─────────────────┐     ┌──────────────────────┐
│   LostPetCase   │────<│   ShelterContact     │
└────────┬────────┘     └──────────┬───────────┘
         │                         │
         │              ┌──────────┴───────────┐
         │              │ ShelterContactAttempt│
         │              └──────────────────────┘
         │
         │────<┌──────────────────┐
         │     │   FlyerPosting   │
         │     └──────────────────┘
         │
         │────<┌──────────────────┐
         │     │   MascotTip      │
         │     └──────────────────┘
         │
         │────<┌──────────────────┐
         │     │  VerifiedAction  │
         │     └──────────────────┘
         │
         │────1┌──────────────────┐
              │   CaseOutcome    │
              └──────────────────┘

┌─────────────────┐     ┌──────────────────────┐
│      User       │────<│   DailyPointsLog     │
└─────────────────┘     └──────────────────────┘
```

---

## API Endpoints

### Tasks

```
GET    /api/mission/[caseId]/tasks
       → List all tasks with status, participants, progress

POST   /api/mission/[caseId]/tasks/[taskId]/join
       → Add current user as participant

POST   /api/mission/[caseId]/tasks/[taskId]/leave
       → Remove current user as participant

POST   /api/mission/[caseId]/tasks/[taskId]/complete
       → Mark task complete with outcome

POST   /api/mission/[caseId]/tasks/[taskId]/request-help
       → Owner requests help (body: { message?: string })
```

### Shelter Contacts

```
GET    /api/mission/[caseId]/shelters
       → List shelters with contact status
       → Query params: radius=25, type=shelter|vet|animal_control

GET    /api/places/search
       → Apple Maps proxy
       → Query params: query, lat, lng, radius

POST   /api/mission/[caseId]/shelters/[shelterId]/call
       → Log a call attempt
       → Body: { outcome, staffResponse?, notes? }

POST   /api/mission/[caseId]/shelters/[shelterId]/email
       → Send email via platform
       → Returns: { success, emailId, pointsEarned }
```

### Search Tracking

```
POST   /api/mission/[caseId]/search/start
       → Start GPS-tracked session
       → Returns: { sessionId }

POST   /api/mission/[caseId]/search/ping
       → Update location during search
       → Body: { sessionId, lat, lng }

POST   /api/mission/[caseId]/search/end
       → End search session
       → Body: { sessionId }
       → Returns: { distanceMiles, pointsEarned }

POST   /api/mission/[caseId]/search/mark-area
       → Manual area marking
       → Body: { polygon: GeoPoint[] }
       → Returns: { pointsEarned }
```

### Flyers

```
GET    /api/mission/[caseId]/flyers
       → List all flyer locations
       → Returns: { flyers, coldSpots }

POST   /api/mission/[caseId]/flyers
       → Mark flyer location
       → Body: { lat, lng, photoUrl? }
       → Returns: { id, pointsEarned }

GET    /api/mission/[caseId]/flyers/generate
       → Generate flyer PDF
       → Query params: template, size
       → Returns: PDF stream
```

### Tips

```
GET    /api/mission/[caseId]/tips
       → Get active mascot tips
       → Returns: { tips: Tip[] }

POST   /api/mission/[caseId]/tips/[tipId]/dismiss
       → Dismiss a tip for current user
```

### Points

```
GET    /api/mission/[caseId]/points
       → Get leaderboard for this case
       → Returns: { users: { id, name, points }[] }

GET    /api/users/me/points
       → Get current user's points
       → Returns: { total, today: { verified, selfReported } }

GET    /api/users/me/points/history
       → Get points history
       → Returns: { logs: PointsLog[] }
```

### Email Webhooks

```
POST   /api/webhooks/resend
       → Resend webhook for email events
       → Handles: delivered, opened, clicked, bounced, complained
```

---

## UI Specifications

### Main Task View

```
┌─────────────────────────────────────────┐
│ ← Back        Actions                   │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ 🐕 Scout:                           │ │
│ │ "Dusk is approaching - great time  │ │
│ │  to search for [Pet Name]!"         │ │
│ │                          [Dismiss]  │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ 📊 Team Progress                        │
│ ████████████░░░░░░░░░░ 58%              │
│ 14/24 actions completed                 │
├─────────────────────────────────────────┤
│                                         │
│ 🔍 SEARCH                        [2]   │
│ ┌─────────────────────────────────────┐ │
│ │ ▸ Search nearby              +10/mi │ │
│ │   👥 2 searching now                │ │
│ │   📍 0.8 mi covered today           │ │
│ │   [START SEARCH]                    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 📢 SPREAD THE WORD              [5/12] │
│ ┌─────────────────────────────────────┐ │
│ │ ▸ Contact Shelters  👑      +15pts │ │
│ │   ⚠️ Owner needs help!              │ │
│ │   7/18 contacted                    │ │
│ │ ▸ Contact Vets              +12pts │ │
│ │   0/6 contacted                     │ │
│ │ ▸ Post Flyers               +8pts  │ │
│ │   📌 12 posted, 2 cold spots        │ │
│ │ [VIEW ALL →]                        │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 🏠 ATTRACT HOME                 [3/5]  │
│ ┌─────────────────────────────────────┐ │
│ │ ▸ Litter Box Outside        ✓ Done │ │
│ │ ▸ Scent Items               ✓ Done │ │
│ │ ▸ Food Station              +8pts  │ │
│ │ [VIEW ALL →]                        │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ✏️ OTHER                               │
│ ┌─────────────────────────────────────┐ │
│ │ [+ LOG ACTIVITY]                    │ │
│ └─────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### Color Palette

| Element | Color | Hex |
|---------|-------|-----|
| Search category | Blue | #3B82F6 |
| Spread the Word | Orange | #F97316 |
| Attract Home | Green | #22C55E |
| Other | Gray | #6B7280 |
| Verified badge | Gold | #EAB308 |
| Owner request | Purple | #8B5CF6 |
| Cold spot alert | Red | #EF4444 |
| Success/complete | Green | #22C55E |

### Iconography

| Meaning | Icon |
|---------|------|
| Search | 🔍 |
| Spread the Word | 📢 |
| Attract Home | 🏠 |
| Other | ✏️ |
| Owner requested | 👑 |
| Needs help | 🆘 |
| Verified | ✓ (gold) |
| GPS tracking | 📍 |
| Phone call | 📞 |
| Email | 📧 |
| Flyer | 📌 |
| Scout mascot | 🐕 |
| Cold spot | 🔴 |
| In progress | ◐ |
| Completed | ✓ |

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal:** Core task system with simplified categories

- [ ] Add "Other" category for custom activities
- [ ] Hide time-specific task names in UI (keep algorithm)
- [ ] Add `ownerRequested` fields to SquadTask
- [ ] Create Scout tip banner component
- [ ] Update task card UI to new design
- [ ] Add task progress indicators

### Phase 2: Points & Verification (Week 2-3)

**Goal:** Points system with verified vs manual tracking

- [ ] Create `DailyPointsLog` model
- [ ] Implement 100 pts/day cap for self-reported
- [ ] Create `VerifiedAction` model
- [ ] Add points display in UI
- [ ] GPS search session tracking
- [ ] Manual area marking alternative

### Phase 3: Shelter Contacts (Week 3-4)

**Goal:** Complete shelter contact flow

- [ ] Create `ShelterContact` and `ShelterContactAttempt` models
- [ ] Build shelter lookup UI with Apple Maps
- [ ] Implement call logging flow
- [ ] Set up email sending via Resend
- [ ] Email template generation
- [ ] Contact status tracking

### Phase 4: Flyer Tracking (Week 4-5)

**Goal:** Location-based flyer marking

- [ ] Create `FlyerPosting` model
- [ ] One-tap flyer marking UI
- [ ] Flyer map visualization
- [ ] Cold spot detection (simple version)
- [ ] Flyer PDF generation enhancement

### Phase 5: Scout Intelligence (Week 5-6)

**Goal:** Contextual mascot tips

- [ ] Create `MascotTip` model
- [ ] Tip generation logic
- [ ] Time-based tips
- [ ] Weather integration
- [ ] Progress-based tips
- [ ] Mission chat integration

### Phase 6: Algorithm Training (Week 6-7)

**Goal:** Data collection for self-improvement

- [ ] Create `CaseOutcome` model
- [ ] Outcome recording flow
- [ ] Verified actions aggregation
- [ ] Basic analytics queries
- [ ] Dashboard for insights

### Phase 7: Polish & Optimization (Week 7-8)

**Goal:** Refinement and performance

- [ ] UI polish and animations
- [ ] Offline support for key features
- [ ] Performance optimization
- [ ] Error handling improvements
- [ ] User testing and feedback integration

---

## Appendix

### A. Task Definitions Reference

Full list of all possible tasks with metadata:

```typescript
const TASK_DEFINITIONS = {
  // SEARCH
  search_area: {
    id: 'search_area',
    category: 'SEARCH',
    displayName: 'Search Area',
    description: 'Walk through the neighborhood looking for your pet',
    icon: '🔍',
    role: 'BOTH',
    petType: 'BOTH',
    basePriority: 75,
    basePoints: 10, // per 0.1 mile
    verificationMethod: 'GPS',
    tips: [
      'Bring treats and a favorite toy',
      'Call their name in a calm voice',
      'Check under porches, decks, and bushes',
    ],
  },

  check_hiding: {
    id: 'check_hiding',
    category: 'SEARCH',
    displayName: 'Check Hiding Spots',
    description: 'Look in common hiding places like under decks, in sheds, and behind bushes',
    icon: '👀',
    role: 'BOTH',
    petType: 'BOTH',
    basePriority: 70,
    basePoints: 8,
    verificationMethod: 'GPS_PHOTO',
    tips: [
      'Use a flashlight even during the day',
      'Check high places for cats',
      'Look inside garages and sheds',
    ],
  },

  // SPREAD THE WORD
  contact_shelters: {
    id: 'contact_shelters',
    category: 'SPREAD_THE_WORD',
    displayName: 'Contact Shelters',
    description: 'Call or email local animal shelters',
    icon: '🏥',
    role: 'BOTH',
    petType: 'BOTH',
    basePriority: 85,
    basePoints: { call: 8, email: 15 },
    verificationMethod: 'PLATFORM_EMAIL',
    hasSubtasks: true, // One per shelter
    tips: [
      'Call during business hours for best results',
      'Ask if you can email a photo',
      'Request to be notified if a matching pet comes in',
    ],
  },

  contact_vets: {
    id: 'contact_vets',
    category: 'SPREAD_THE_WORD',
    displayName: 'Contact Vet Clinics',
    description: 'Call or email local veterinarians',
    icon: '🩺',
    role: 'BOTH',
    petType: 'BOTH',
    basePriority: 80,
    basePoints: { call: 8, email: 15 },
    verificationMethod: 'PLATFORM_EMAIL',
    hasSubtasks: true,
    tips: [
      'Vets often see found pets brought in for checkups',
      'Ask to post a flyer in their office',
    ],
  },

  contact_animal_control: {
    id: 'contact_animal_control',
    category: 'SPREAD_THE_WORD',
    displayName: 'Contact Animal Control',
    description: 'Reach out to local animal control offices',
    icon: '🚔',
    role: 'BOTH',
    petType: 'BOTH',
    basePriority: 82,
    basePoints: { call: 8, email: 15 },
    verificationMethod: 'PLATFORM_EMAIL',
    hasSubtasks: true,
    tips: [
      'Animal control handles strays and found pets',
      'Ask about their hold period before adoption',
    ],
  },

  notify_microchip: {
    id: 'notify_microchip',
    category: 'SPREAD_THE_WORD',
    displayName: 'Notify Microchip Company',
    description: 'Report your pet as lost with the microchip registry',
    icon: '📟',
    role: 'OWNER',
    petType: 'BOTH',
    basePriority: 88,
    basePoints: 10,
    verificationMethod: 'SELF_REPORT',
    requiresMicrochip: true,
    tips: [
      'Most microchip companies have online lost pet registries',
      'Make sure your contact info is up to date',
    ],
  },

  post_flyers: {
    id: 'post_flyers',
    category: 'SPREAD_THE_WORD',
    displayName: 'Post Flyers',
    description: 'Put up flyers in the neighborhood',
    icon: '📌',
    role: 'BOTH',
    petType: 'BOTH',
    basePriority: 65,
    basePoints: 8,
    verificationMethod: 'GPS',
    tips: [
      'Post at eye level where people will see them',
      'Include a clear photo and phone number',
      'Ask permission before posting on private property',
    ],
  },

  knock_doors: {
    id: 'knock_doors',
    category: 'SPREAD_THE_WORD',
    displayName: 'Talk to Neighbors',
    description: 'Go door-to-door asking if anyone has seen your pet',
    icon: '🚪',
    role: 'BOTH',
    petType: 'BOTH',
    basePriority: 72,
    basePoints: 5, // per door
    verificationMethod: 'GPS',
    tips: [
      'Bring a photo to show',
      'Leave your contact info',
      'Ask if they have outdoor cameras',
    ],
  },

  alert_delivery: {
    id: 'alert_delivery',
    category: 'SPREAD_THE_WORD',
    displayName: 'Alert Delivery Workers',
    description: 'Tell mail carriers, Amazon drivers, and other delivery people',
    icon: '📦',
    role: 'BOTH',
    petType: 'BOTH',
    basePriority: 55,
    basePoints: 5,
    verificationMethod: 'SELF_REPORT',
    tips: [
      'Delivery workers cover lots of ground every day',
      'Give them a flyer to keep in their truck',
    ],
  },

  share_online: {
    id: 'share_online',
    category: 'SPREAD_THE_WORD',
    displayName: 'Share Online',
    description: 'Post on social media, Nextdoor, and lost pet sites',
    icon: '📱',
    role: 'BOTH',
    petType: 'BOTH',
    basePriority: 60,
    basePoints: 5,
    verificationMethod: 'LINK',
    tips: [
      'Post in local community groups',
      'Use relevant hashtags',
      'Ask friends to share',
    ],
  },

  // ATTRACT HOME
  litter_outside: {
    id: 'litter_outside',
    category: 'ATTRACT_HOME',
    displayName: 'Put Litter Box Outside',
    description: 'Place used litter box near entry points',
    icon: '🚽',
    role: 'OWNER',
    petType: 'CAT',
    basePriority: 78,
    basePoints: 8,
    verificationMethod: 'PHOTO',
    tips: [
      'Cats can smell their litter from very far away',
      'Place near doors and garage',
      'Cover partially to protect from rain',
    ],
  },

  scent_items: {
    id: 'scent_items',
    category: 'ATTRACT_HOME',
    displayName: 'Leave Scent Items',
    description: 'Put worn clothing outside for your pet to smell',
    icon: '👕',
    role: 'OWNER',
    petType: 'BOTH',
    basePriority: 75,
    basePoints: 8,
    verificationMethod: 'PHOTO',
    tips: [
      'Use unwashed clothing that smells like you',
      'Include their favorite blanket or bed',
    ],
  },

  food_station: {
    id: 'food_station',
    category: 'ATTRACT_HOME',
    displayName: 'Set Up Food Station',
    description: 'Leave food and water outside',
    icon: '🍽️',
    role: 'OWNER',
    petType: 'BOTH',
    basePriority: 70,
    basePoints: 8,
    verificationMethod: 'PHOTO',
    tips: [
      'Use their favorite food',
      'Place near a hiding spot',
      'Check regularly for activity',
    ],
  },

  camera_setup: {
    id: 'camera_setup',
    category: 'ATTRACT_HOME',
    displayName: 'Set Up Camera',
    description: 'Monitor your food station with a camera',
    icon: '📹',
    role: 'OWNER',
    petType: 'BOTH',
    basePriority: 65,
    basePoints: 10,
    verificationMethod: 'PHOTO',
    tips: [
      'Use a wildlife camera or security camera',
      'Point at the food station',
      'Check footage regularly',
    ],
  },

  humane_trap: {
    id: 'humane_trap',
    category: 'ATTRACT_HOME',
    displayName: 'Set Humane Trap',
    description: 'For skittish pets that won\'t approach',
    icon: '🪤',
    role: 'OWNER',
    petType: 'BOTH',
    basePriority: 60,
    basePoints: 10,
    verificationMethod: 'PHOTO',
    requiresSkittish: true,
    tips: [
      'Check trap every 4-6 hours',
      'Use strong-smelling food as bait',
      'Cover trap to make it feel safer',
    ],
  },

  garage_open: {
    id: 'garage_open',
    category: 'ATTRACT_HOME',
    displayName: 'Leave Garage Cracked',
    description: 'Leave garage or shed slightly open overnight',
    icon: '🏠',
    role: 'OWNER',
    petType: 'BOTH',
    basePriority: 55,
    basePoints: 5,
    verificationMethod: 'SELF_REPORT',
    tips: [
      'Pets often return at night when it\'s quiet',
      'Leave food and water inside',
      'Check in the morning',
    ],
  },
};
```

### B. Priority Algorithm Summary

The priority score determines task order. Higher = more important.

**Base Score:** Each task has a base priority (50-100).

**Modifiers Applied:**
1. Time urgency (how long pet has been missing)
2. Time of day (dawn/dusk bonuses for search)
3. Pet type matching (indoor cat vs outdoor dog)
4. Recent sightings (boost nearby searches)
5. Weather conditions
6. Task dependencies (prerequisites completed?)
7. Diminishing returns (don't repeat same task)
8. Owner request (+25% boost)

**Final Score = Base + All Modifiers**

See `taskPriority.js` for full implementation.

### C. Glossary

| Term | Definition |
|------|------------|
| **Verified Action** | An action confirmed by GPS, platform email, photo, or call detection |
| **Self-Reported Action** | An action the user claims to have done without verification |
| **Cold Spot** | An area with no flyer coverage that should have flyers |
| **Scout** | The mascot that provides tips and encouragement |
| **Case Outcome** | The final resolution of a lost pet case |
| **Points Cap** | The 100 pts/day limit on self-reported actions |
| **Owner Request** | When the pet owner asks volunteers to prioritize a specific task |

---

*Last updated: December 2024*
*Version: 1.0*
