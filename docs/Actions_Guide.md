# Actions Guide: Mission Control Task System

> **Purpose:** This document defines the complete vision for the pet recovery action/task system. It serves as the authoritative reference for all implementation decisions.

> **Single Source of Truth:** If existing behavior in the app disagrees with this document, this document wins unless explicitly overridden by a subsequent decision. When in doubt, refer here.

---

## Engineer Quick-Start (v1 Scope)

**High-level:** This doc is the single source of truth for the new Mission Control / Actions system.

**v1 = Phases 1–4 only:**

| Phase | Focus | Key Deliverables |
|-------|-------|------------------|
| **1 – Foundation** | Task structure | Task categories (SEARCH, OUTREACH, AT_HOME, OTHER), `ownerRequested*` fields, Scout tip banner, task card UI |
| **2 – Points & Verification** | Tracking | `DailyPointsLog` with 100pt/day cap, `VerifiedAction` model, point calculations + bonuses, after-action points UI |
| **3 – Shelter Contacts** | Outreach | `ShelterContact` + `ShelterContactAttempt` models, Apple Maps proxy, call logging, platform email via Resend + webhooks |
| **4 – Flyers** | Distribution | `FlyerPosting` model, one-tap GPS posting, cold-spot detection (100m grid), flyer PDF generation |

**Out of scope for v1:** Full Scout intelligence, real-time websockets, push notifications, offline queueing, advanced accessibility, analytics dashboards, ML-based dynamic priorities (use `BASE_PRIORITIES` + modifiers as described).

**For implementation details, see:**
- [Points System](#points-system) – canonical points + cap rules
- [Verification Methods](#verification-methods) – what counts as verified and creates `VerifiedAction`
- [Shelter Contact Flow](#shelter-contact-flow) / [Email System](#email-system) – full UX + API behavior
- [Search Tracking](#search-tracking) / [Flyer Tracking](#flyer-tracking) – GPS vs manual, coverage, cold spots
- [Appendix A](#a-task-definitions-reference) – canonical `TASK_DEFINITIONS`

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
16. [Future Enhancements](#future-enhancements)

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

### Data Flywheel and Verification

The Actions system doesn't exist just to gamify behavior. Its main job is to collect clean, verified data that can improve recommendations and increase reunion rates over time.

**Verified actions** (GPS-tracked searches, platform-sent emails, GPS flyer marks, photo proof) are treated as trustworthy signals. These populate a `VerifiedAction` table and are used directly in analytics and ML.

**Self-reported actions** ("I searched here", "I called them") are still valuable for engagement and coordination, but they are capped daily and do not feed into the algorithm training.

**The Flywheel:**

```
More verified actions
        ↓
Better outcome data (which actions worked, when, where)
        ↓
Smarter task priorities & tips
        ↓
Higher reunion rates and user trust
        ↓
More users willing to enable GPS and use platform email
        ↓
(cycle repeats)
```

This is why the spec differentiates carefully between verified and self-reported actions and rewards them differently.

---

## Task Categories

### Overview

Four categories, each with a distinct purpose.

**Internal category enum (in code/DB):**

```typescript
type TaskCategory = 'SEARCH' | 'OUTREACH' | 'AT_HOME' | 'OTHER';
```

**UI labels & icons:**

| Category Key | UI Label | Icon | Purpose |
|--------------|----------|------|---------|
| `SEARCH` | SEARCH | 🔍 | Physical searching for the pet |
| `OUTREACH` | OUTREACH | 📢 | Contacting orgs & people / spreading the word |
| `AT_HOME` | AT HOME | 🏠 | Actions done at or near home to attract pet back |
| `OTHER` | OTHER | ✏️ | Custom activity logging |

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

### Category 2: Outreach 📢

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

### Category 3: At Home 🏠

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

### Canonical Points Table

This is the authoritative reference for all point values. Use this as the "law" for implementation.

> **GPS Search Rate (canonical):** 100 points per mile (equivalently: 10 pts per 0.1 mi).
> All examples and calculations should use this rate. Formula: `pointsEarned = distanceMiles × 100`

#### Verified Actions (No Daily Cap)

| Action | Points | Verification Method |
|--------|--------|---------------------|
| GPS-tracked search | 100 pts per mile (10 pts per 0.1 mi) | Continuous GPS tracking |
| Platform-sent email | 15 pts per email | Platform sends via Resend |
| Flyer with GPS mark | 8 pts per flyer | GPS location stamped |
| Photo proof attached | +3 pts bonus | On top of base for any action |
| Door-knocking with GPS | 5 pts per door/cluster | GPS tracking or per exact address |
| Call with technical detection (future) | 12 pts per call | Call duration > N seconds |

**Photo Verification Behavior:**

When an action completion includes required or optional photo proof, that completion is treated as verified:
- We create a `VerifiedAction` with `verificationMethod = 'PHOTO'`
- Both the base points and the +3pt photo bonus count as `verifiedPoints` (not subject to the 100pt self-reported cap)
- If the same action is completed without photo, it is self-reported only and counts against the daily cap

Examples:
- **AT_HOME tasks** (litter_outside, food_station, etc.) have `verificationMethod: 'PHOTO'` → completing with required photo = verified, uncapped
- **Any task with optional photo attached** → completing with photo upgrades that completion to verified

#### Self-Reported Actions (100 pts/day shared cap)

| Action | Points | Notes |
|--------|--------|-------|
| Manual search logged ("I searched this area") | 5 pts per log | Simple self-report, no polygon (v1) |
| Call logged with outcome | 8 pts per call | User self-report |
| Door-knocking self-report (no GPS) | 5 pts per area/cluster | Estimate |
| "Other / custom" activity log | 3 pts per entry | Free-form |

**Phase 5+ (not v1):**
| Action | Points | Notes |
|--------|--------|-------|
| Manual search area polygon on map | 5 pts per area | Draw polygon on map (Phase 5+) |
| Flyer posted (no GPS mark) | 4 pts per flyer | Claim without location (Phase 5+) |

### Action → Tables Matrix

This table shows exactly which tables are written for each user action:

| User Action | Tables Written | VerifiedAction? | Points Bucket |
|-------------|---------------|-----------------|---------------|
| GPS search session end | `SearchSession`, `VerifiedAction`, `DailyPointsLog` | Yes (`GPS`) | verifiedPoints |
| Manual search log ("I searched") | `DailyPointsLog` | No | selfReportedPoints |
| Platform shelter email | `ShelterContact`, `ShelterContactAttempt`, `VerifiedAction`, `DailyPointsLog` | Yes (`PLATFORM_EMAIL`) | verifiedPoints |
| Shelter call log | `ShelterContactAttempt`, `DailyPointsLog` | No | selfReportedPoints |
| GPS flyer posting | `FlyerPosting`, `VerifiedAction`, `DailyPointsLog` | Yes (`GPS`) | verifiedPoints |
| AT_HOME task with photo | `VerifiedAction`, `DailyPointsLog` | Yes (`PHOTO`) | verifiedPoints |
| AT_HOME task self-report (no photo) | `DailyPointsLog` | No | selfReportedPoints |
| "Other" activity log | `DailyPointsLog` | No | selfReportedPoints |

> **Note:** "Other" activities never create `VerifiedAction` rows, even with photo. They're for misc tracking, not algorithm training.

### Time/Context Bonuses

Applied as **multipliers** to base points:

| Condition | Bonus | Applies To |
|-----------|-------|------------|
| Dawn search (5-7am) | +10% | Search task points |
| Dusk search (5-8pm) | +10% | Search task points |
| Business hours (9am-5pm) | +10% | Shelter/vet/animal-control contact tasks |
| Within 0.5mi of recent sighting | +15% | Search task points |
| First 6 hours after pet marked missing | +20% | All tasks |
| 6-24 hours after missing time | +10% | All tasks |
| Task explicitly marked as "Owner requested help" | +25% | That task's points |

**Calculation rule:** Compute base points, then apply all applicable percentage bonuses multiplicatively, then round to nearest integer.

### Daily Self-Reported Cap Behavior

We track self-reported points per user per day in `DailyPointsLog.selfReportedPoints`.

**Rules:**

1. Once a user reaches 100 self-reported points for that date:
   - Additional self-reported actions log normally but earn **0 extra points**
   - Verified actions (GPS, platform emails, GPS flyers, photos) **always** earn full value with no cap

2. The cap resets at midnight UTC. (In v2, we may migrate to per-user local time based on profile/device timezone.)

> **UX note:** Users may notice their cap doesn't reset at their local midnight (e.g., a US Pacific user's cap resets at 4/5pm local). This is intentional for v1 simplicity. If we get complaints, we can add per-user timezone support later.

**UI copy before cap:**

```
┌─────────────────────────────────────────┐
│ ✓ Area marked as searched (+5 pts)      │
│                                         │
│ 💡 You've earned 85/100 manual points   │
│    today. Enable GPS tracking for       │
│    unlimited points!                    │
│                                         │
│    [Enable GPS]     [Maybe Later]       │
└─────────────────────────────────────────┘
```

**UI copy after cap reached:**

```
┌─────────────────────────────────────────┐
│ ✓ Area marked as searched (+0 pts)      │
│                                         │
│ ⚠️ You've reached your 100 manual       │
│    points for today.                    │
│                                         │
│    Verified actions like GPS searches   │
│    and platform emails still earn       │
│    unlimited points.                    │
│                                         │
│    [Enable GPS]     [Got It]            │
└─────────────────────────────────────────┘
```

### Points Calculation Example

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

### Points Display (After Action)

```
┌─────────────────────────────────────────┐
│ ✓ Search completed                      │
│                                         │
│   Base points (0.1 mi):  10 pts         │
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

> **Rule: Primary vs Secondary Proofs**
>
> `VerifiedAction.verificationMethod` is always the **primary** proof (usually `GPS` or `PLATFORM_EMAIL`).
> Secondary proofs like photos are stored in `metadata`:
> - `metadata.hasPhotoProof = true`
> - `metadata.photoUrl = "..."`
>
> **Never** overwrite `verificationMethod = 'PHOTO'` when GPS is available—that would lose the location signal for algorithm training.
> The +3pt photo bonus is still awarded; just store the photo in metadata.

### GPS Tracking

**What:** Continuous location recording during search sessions.

**How it works:**
1. User starts a search session
2. App requests location permission (if not granted)
3. Location recorded every 10 seconds while searching
4. Path drawn on map in real-time
5. Distance calculated from path
6. Session ends when user stops or app goes to background for 5+ minutes

**Session End Rules (Client + Server):**
- **Client:** Auto-end the session after 5 minutes in background
- **Server:** Treat a session as ended if no `/search/ping` is received for 10 minutes (prevents zombie sessions)

**Data stored:** (See `model SearchSession` in Data Models - this is a real Prisma table)
```typescript
// SearchSession persisted to DB for debugging, replays, and algorithm training
{
  id: string;
  userId: string;
  caseId: string;

  startedAt: Date;
  endedAt: Date;

  path: GeoPoint[];  // JSON: [{lat, lng, timestamp}, ...]
  distanceMiles: number;

  pointsEarned: number;
  isVerified: true;  // GPS sessions are always verified
}
```

**Privacy note:** Location data is only used for this case and algorithm improvement. Not sold or shared.

**Search session lifecycle (`/search/end`):**

When the client calls `/search/end`, the server performs these steps atomically:
1. Finalize `SearchSession` row: set `endedAt`, compute `distanceMiles` from path
2. Compute points: `basePoints = distanceMiles × 100`, apply time/context multipliers
3. Award points via `DailyPointsLog` (verified bucket, no cap)
4. Create `VerifiedAction` row with:
   - `actionType = 'search_area'`
   - `verificationMethod = 'GPS'`
   - `metadata = { distanceMiles, gridCellsCovered, searchSessionId }`
5. Return `{ distanceMiles, pointsEarned, bonusesApplied }` to client

> This keeps `SearchSession` as the source of truth for the raw data, while `VerifiedAction` is the algorithm-training record. Link them via `metadata.searchSessionId`.

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

User taps "Contact Shelters" (or Vets, or Animal Control) in the Outreach section.

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

**Enum definition:**

```typescript
enum ShelterContactStatus {
  NOT_CONTACTED,
  CONTACTED,
  AWAITING_RESPONSE,
  NO_MATCH,
  POSSIBLE_MATCH,
  MATCH_FOUND
}
```

**Display rules:**

| Status | Label Text | Icon | Color | Meaning |
|--------|------------|------|-------|---------|
| `NOT_CONTACTED` | Not contacted yet | ○ | Gray | No contact attempts logged |
| `CONTACTED` | Contact in progress | ◐ | Yellow | Contact attempts exist (call/email) |
| `AWAITING_RESPONSE` | Awaiting response | ⏳ | Blue | Contact made, waiting on shelter reply |
| `NO_MATCH` | No matching animals | ✗ | Light gray | Shelter explicitly said no match |
| `POSSIBLE_MATCH` | Possible match | ⚠️ | Orange | Shelter thinks there might be a match |
| `MATCH_FOUND` | Pet is here! | ✓ | Green | Confirmed that the pet is at this shelter |

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

### Call Logging Behavior

**When user selects "Didn't call (skip)":**
- Do NOT create a `ShelterContactAttempt` row
- Do NOT change `ShelterContact.status`
- Do NOT award points
- Simply dismiss the modal

**When user selects any other outcome:**

1. Create `ShelterContactAttempt` with:
   - `method = CALL`
   - `callOutcome` matching the choice
   - `pointsEarned = 8` (self-reported call)
   - `isVerified = false` (unless we implement call detection)

2. Update `ShelterContact.status` based on outcome:

| Call Outcome | Staff Response | New Status |
|--------------|----------------|------------|
| `NO_ANSWER` | - | `CONTACTED` |
| `LEFT_VOICEMAIL` | - | `CONTACTED` |
| `WRONG_NUMBER` | - | `CONTACTED` |
| `SPOKE_WITH_STAFF` | No matching animals | `NO_MATCH` |
| `SPOKE_WITH_STAFF` | Possible match | `POSSIBLE_MATCH` |
| `SPOKE_WITH_STAFF` | Confirmed match | `MATCH_FOUND` |
| `SPOKE_WITH_STAFF` | Will check / call back | `AWAITING_RESPONSE` |

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

### Platform Email Behavior

**Email configuration:**
- Sent from: `rescue-[caseId]@mail.petrecovery.com`
- Reply-To header: Owner's email address
- Body: Fixed template (not editable from UI)

**"Send" flow:**

1. User sees preview screen with:
   - To: [shelter email]
   - Subject: "Lost [Cat/Dog] - [Pet Name] - [City]"
   - Non-editable body (includes description, photo, case link, owner contact)
   - Notice: "Template cannot be edited to prevent spam and ensure quality"

2. User presses "Send":
   - Backend calls Resend API to send email
   - Creates `ShelterContactAttempt` with:
     - `method = EMAIL`
     - `emailId = provider's message ID`
     - `isVerified = true`
     - `pointsEarned = 15`
   - Sets `ShelterContact.status`:
     - `CONTACTED` if first contact
     - `AWAITING_RESPONSE` if no response yet

3. After success, app shows:
   - "✅ Email Sent!" message
   - Points earned (+15)
   - Brief explanation: "Shelter will reply to YOUR email. We'll update the status when they open or reply."

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
│  │ Base (0.82 mi × 100):   82 pts     ││
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

### End-of-Search Summary Specification

When a GPS-tracked search session ends, show a summary modal:

```
┌─────────────────────────────────────────┐
│         Search Complete                 │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────────┐│
│  │     [MAP with completed path]      ││
│  │     showing the route walked       ││
│  └─────────────────────────────────────┘│
│                                         │
│  📊 Summary                             │
│  ┌─────────────────────────────────────┐│
│  │ Distance:        0.82 miles        ││
│  │ Duration:        34 minutes        ││
│  │ Grid cells:      6 cells covered   ││
│  └─────────────────────────────────────┘│
│                                         │
│  🏆 Points Breakdown                    │
│  ┌─────────────────────────────────────┐│
│  │ Base (0.82 mi × 100):   82 pts     ││
│  │ Dusk bonus (+10%):       8 pts     ││
│  │ Near sighting (+15%):   12 pts     ││
│  │ ─────────────────────────────      ││
│  │ Total:                 102 pts     ││
│  └─────────────────────────────────────┘│
│                                         │
│  [Search Again]       [Back to Tasks]   │
│                                         │
└─────────────────────────────────────────┘
```

**Data created:**

GPS search sessions always create a `VerifiedAction` with:
- `actionType = 'search_area'`
- `verificationMethod = 'GPS'`
- `metadata.distanceMiles` - Total distance covered
- `metadata.gridCellsCovered` - Number of discrete map cells traversed
- `metadata.path` - Array of coordinates (or reference to stored path)
- `hoursAfterLost` - Hours from case's `lostAt` to search end time

**Manual search logging (v1):**
- User taps "I searched this area" (no polygon drawing)
- Earns 5 self-reported points per log
- Does NOT create a `VerifiedAction` row
- Shows on team activity feed as "Searched near [location]"
- Counts toward daily self-reported cap

> **Phase 5+:** Full polygon drawing on map with area coverage metrics. v1 is just a simple "I searched" button with optional location note.

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

Algorithm identifies areas that need flyers.

#### Cold Spot Definition (v1)

1. Define a **mission search radius** around the last-seen location (e.g., 1 mile radius)

2. Within that radius, lay down a simple grid:
   - Default cell size: 100m × 100m (configurable)
   - Each cell has a unique `cellId` (e.g., "A1", "B3", etc.)

3. A grid cell is a **cold spot** if:
   - It lies inside the search radius, AND
   - There are **zero** `FlyerPosting` records with coordinates in that cell

#### API Response

The `GET /api/mission/[caseId]/flyers` endpoint returns:

```typescript
{
  flyers: FlyerPosting[],        // All posted flyers
  coldSpots: {
    center: GeoPoint,           // Center of the cold spot cell
    cellId: string,             // e.g., "B4"
    distanceFromLastSeen: number // miles
  }[]
}
```

#### Client Rendering

- **Flyer pins (📌):** Where flyers have been posted
- **Cold spot indicators (🔴):** Red overlay or pins for cells with no flyers
- Optionally show cell grid lines at high zoom levels

#### Future Enhancement (not v1)

Incorporate points-of-interest data to classify some cold spots as "high-traffic":
- Bus stops, train stations
- Grocery stores, coffee shops
- Pet stores, vet offices
- Schools, community centers

High-traffic cold spots get prioritized in Scout tips:
> "The grocery store on Oak St has high foot traffic - no flyer there yet!"

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
// ⚠️ PHASE 5+ - This dynamic tip generation is NOT v1.
// v1 Scout uses static, hard-coded tips only.

function generateTips(caseData: Case): Tip[] {
  const tips: Tip[] = [];
  const now = new Date();
  const hour = now.getHours();

  // Time-based tips (Dawn = 5-7am, Dusk = 5-8pm / 17-20)
  if (hour >= 5 && hour <= 7) {
    tips.push({
      type: 'TIME',
      priority: 80,
      message: "Early bird! Dawn is prime search time for cats.",
      expiresAt: addHours(now, 2)
    });
  }

  if (hour >= 17 && hour <= 20) {
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
│  Category: OUTREACH                     │
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

### Owner Request Behavior

**When an owner taps "Request Help" on a task:**

**1. Data changes:**

The task is updated with:
- `ownerRequested = true`
- `ownerRequestMessage = optional owner text`
- `ownerRequestedAt = timestamp`
- `ownerRequestedBy = owner's userId`

**2. Priority algorithm:**

That task's priority score gets a **+25% boost** compared to its base score and other modifiers.

**3. UI changes:**

- The task card shows a 👑 **Owner requested** badge
- In category sections, tasks with `ownerRequested = true` bubble to the **top** within their category

**4. Messaging/notifications (future phases):**

- A mission chat message is posted summarizing the request
- Volunteers subscribed to that case receive a notification: "Owner requested help on Contact Shelters"

**5. Clearing the request:**

`ownerRequested` is set back to `false` when:
- Task is marked complete, OR
- Owner explicitly clicks "Cancel request" (optional for v1)

**What the user sees:**
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

  outcome: 'REUNITED' | 'NOT_FOUND' | 'DECEASED' | 'CLOSED_OTHER';
  timeToReunionHours?: number;

  // How was pet found? (matches FoundMethod enum)
  foundMethod?: 'CAME_HOME' | 'SHELTER_INTAKE' | 'NEIGHBOR_FOUND' | 'SIGHTING_LED_TO' | 'TRAP_CAUGHT' | 'FLYER_RESPONSE' | 'SOCIAL_MEDIA' | 'OTHER';
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
// NOTE: Keys here must match the task `id` in TASK_DEFINITIONS (canonical keys).
// IMPORTANT: This object is intentionally partial (just showing high-priority overrides).
// Any actionType not listed falls back to basePriority from TASK_DEFINITIONS[id].
const BASE_PRIORITIES = {
  contact_shelters: 85,
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

// NOTE: FlyerPosting is ONLY created for GPS-verified flyer postings.
// Non-GPS "I posted a flyer" claims (Phase 5+) would use a separate
// FlyerClaim model or just DailyPointsLog with no location data.

model FlyerPosting {
  id        String   @id @default(cuid())
  caseId    String
  case      LostPetCase @relation(fields: [caseId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id])

  latitude  Float    // Required - GPS-verified only
  longitude Float    // Required - GPS-verified only

  photoUrl  String?
  notes     String?

  pointsEarned Int   @default(8)
  isVerified   Boolean @default(true)  // Always true - only GPS flyers stored here

  createdAt DateTime @default(now())

  @@index([caseId])
  @@index([userId])
}

// ============================================
// MASCOT TIPS (Phase 5+ - not v1)
// ============================================
// v1 Scout uses static, hard-coded tips only.
// This model and the generateTips logic below are for Phase 5+.

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
// SEARCH SESSIONS (GPS tracking)
// ============================================

model SearchSession {
  id        String   @id @default(cuid())
  caseId    String
  case      LostPetCase @relation(fields: [caseId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id])

  startedAt DateTime @default(now())
  endedAt   DateTime?

  // Path stored as JSON array: [{lat, lng, timestamp}, ...]
  // For v1, JSON is fine. Phase 5+ may compress or externalize.
  path      Json     @default("[]")

  distanceMiles Float  @default(0)
  pointsEarned  Int    @default(0)
  isVerified    Boolean @default(true)  // GPS sessions are always verified

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([caseId])
  @@index([userId])
}

// WHY PERSIST SEARCH SESSIONS:
// - Debugging: "Why did I get these points?"
// - Map replays: Show team where searches happened
// - Search history: Per-case activity timeline
// - Algorithm training: Correlate search patterns with outcomes

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

// MULTI-PROOF CLARIFICATION:
// For actions with multiple proofs (e.g., GPS search + photo), `verificationMethod`
// is the PRIMARY proof type (usually GPS or PLATFORM_EMAIL).
//
// Photo proof is stored in metadata as:
//   metadata.hasPhotoProof = true
//   metadata.photoUrl = "..."
//
// The +3pt photo bonus is STILL awarded (added to pointsEarned).
// This preserves the GPS signal for algorithm training while still rewarding photos.
//
// DO NOT overwrite verificationMethod='PHOTO' when GPS is available - that would
// lose the location data signal.

// ============================================
// VERIFIED ACTION USAGE EXAMPLES
// ============================================

// When to create VerifiedAction rows:

// 1. After a GPS search session:
//    actionType = 'search_area'
//    verificationMethod = 'GPS'
//    hoursAfterLost = hours from case's lostAt to search end time
//    metadata = {
//      distanceMiles: 0.82,
//      gridCellsCovered: 6,
//      path: [...] or pathId reference
//    }

// 2. After sending a platform email to a shelter:
//    actionType = 'contact_shelter'
//    verificationMethod = 'PLATFORM_EMAIL'
//    hoursAfterLost = hours from lostAt to email send time
//    metadata = {
//      shelterId: "shelter_123",
//      shelterName: "Chicago Animal Care"
//    }

// 3. After a GPS flyer post:
//    actionType = 'post_flyer'
//    verificationMethod = 'GPS'
//    metadata = {
//      location: { latitude: 41.8781, longitude: -87.6298 }
//    }

// IMPORTANT: Self-reported actions NEVER create VerifiedAction rows.
// They only affect DailyPointsLog.selfReportedPoints.

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
  weatherConditions     String?  // e.g., "clear", "rain", "snow", or JSON

  // Actions summary (denormalized for fast queries)
  verifiedActionsCount  Int      @default(0)
  verifiedActionsSummary Json    @default("[]")

  createdAt             DateTime @default(now())
}

// NOTE: weatherConditions is an optional snapshot of weather at or around
// the time of reunion/closure, so we can later analyze whether weather
// correlates with action effectiveness.

// NOTE: petType, petBehavior, petSize, and locationType are stored as
// strings for flexibility, but should only use these values:
//   petType: 'CAT' | 'DOG'
//   petBehavior: 'INDOOR' | 'OUTDOOR' | 'SKITTISH' | 'FRIENDLY'
//   petSize: 'SMALL' | 'MEDIUM' | 'LARGE'
//   locationType: 'URBAN' | 'SUBURBAN' | 'RURAL'
// Consider migrating to proper enums in a future schema update.

// OWNERSHIP & LIFECYCLE:
// - Created when the owner or moderator closes a case
// - Only admins/moderators can edit after creation (prevent accidental changes)
// - For v1, can be set manually via internal tool or owner close-case flow
// - ML training can tolerate some missing outcomes initially

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

  date          DateTime @db.Date  // Just the date portion, in UTC

  verifiedPoints    Int  @default(0)  // Unlimited
  selfReportedPoints Int @default(0)  // Capped at 100

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([userId, date])
  @@index([userId])
}

// TIMESTAMP & TIMEZONE RULES:
// - All internal timestamps stored as UTC
// - DailyPointsLog.date = date portion of UTC time (midnight UTC boundary)
// - hoursAfterLost = (action.createdAt_utc - case.lostAt_utc) / 1 hour
// - Cap resets at midnight UTC
// - Display times in user's local timezone (from device/profile), but all
//   caps & analytics calculations use UTC.
// - v2 may introduce per-user local timezone caps if needed.

// ============================================
// DAILY POINTS LOG BEHAVIOR
// ============================================

// One row per (user, date).

// Fields:
// - verifiedPoints: Unlimited, for reporting/display only
// - selfReportedPoints: Must not exceed 100

// Award Points Logic:
//
// function awardPoints(userId, points, isVerified) {
//   const today = getDateOnly(new Date());
//   let log = findOrCreate(DailyPointsLog, { userId, date: today });
//
//   if (isVerified) {
//     // Verified: always award full points, no cap
//     log.verifiedPoints += points;
//     return points;
//   } else {
//     // Self-reported: check against cap
//     const remaining = Math.max(0, 100 - log.selfReportedPoints);
//     const awarded = Math.min(remaining, points);
//     log.selfReportedPoints += awarded;
//     return awarded; // May be 0 if cap reached
//   }
// }

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

POST   /api/mission/[caseId]/search/log
       → Manual search log ("I searched this area")
       → Body: { note?: string, approximateLocation?: { lat, lng } }
       → Returns: { pointsEarned }
       → NOTE: v1 is just a log entry. Phase 5+ adds polygon drawing via
         /search/mark-area with { polygon: GeoPoint[] }
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
       → Get leaderboard for this case (per-mission points only)
       → Returns: { users: { id, name, points, verifiedPoints?, selfReportedPoints? }[] }
       → NOTE: This is case-specific. Global/all-time leaderboards use
         /api/users/me/points and separate analytics queries.
       → LEADERBOARD SEMANTICS (v1): points = verifiedPoints + selfReportedPoints
         for that case. Future: may add "verified %" badge or filter toggle.

GET    /api/users/me/points
       → Get current user's points
       → Returns: { total, today: { verified, selfReported } }

GET    /api/users/me/points/history
       → Get points history
       → Returns: { logs: PointsLog[] }
```

### Email Webhooks

```
POST   /api/webhooks/email
       → Receives webhook events from email provider (Resend/SendGrid)
       → Handles: delivered, opened, clicked, bounced, complained
```

**Webhook Handler Behavior:**

This endpoint receives webhook events from the email provider.

For each event with a known `emailId`:

1. Find the corresponding `ShelterContactAttempt` row by `emailId`

2. Update based on event type:

| Event Type | Action |
|------------|--------|
| `delivered` | Log delivery timestamp |
| `opened` | Set `emailOpened = true`, `emailOpenedAt = timestamp` |
| `clicked` | Log click (user clicked link in email) |
| `bounced` | Mark email as bounced, flag shelter email as potentially invalid |
| `complained` | Mark as spam complaint, flag for review |

3. Optionally update `ShelterContact.status`:
   - If email opened but no reply yet → keep `AWAITING_RESPONSE`
   - If reply detected (via separate mechanism) → may update to appropriate status

4. Append info to `VerifiedAction.metadata` for analytics:
   - `emailOpened: true`
   - `emailOpenedAt: timestamp`

**Security:** Verify webhook signature from provider to prevent spoofing.

---

## UI Specifications

> **Implementation Note:** Unless otherwise marked as "future" or "Phase 5+", UI examples in this doc represent intended v1 behavior. However, exact layout and wording can differ as long as:
> - The same data is captured
> - The same points and verification rules apply
> - The same states (statuses, caps, etc.) are represented
>
> Don't feel locked into every pixel of the ASCII mockups.

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
│ 📢 OUTREACH                     [5/12] │
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
│ 🏠 AT HOME                      [3/5]  │
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
| SEARCH category | Blue | #3B82F6 |
| OUTREACH category | Orange | #F97316 |
| AT_HOME category | Green | #22C55E |
| OTHER category | Gray | #6B7280 |
| Verified badge | Gold | #EAB308 |
| Owner request | Purple | #8B5CF6 |
| Cold spot alert | Red | #EF4444 |
| Success/complete | Green | #22C55E |

### Iconography

| Meaning | Icon |
|---------|------|
| SEARCH | 🔍 |
| OUTREACH | 📢 |
| AT_HOME | 🏠 |
| OTHER | ✏️ |
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
- [ ] Create Scout tip banner component (static/hard-coded tips only - no `MascotTip` model yet)
- [ ] Update task card UI to new design
- [ ] Add task progress indicators

> **Scout v1 note:** Phase 1 Scout uses a static ruleset or hard-coded tips (e.g., "dusk is a good search time"). The `MascotTip` model, dynamic tip generation via weather + cold spots, and ML-driven tips arrive in Phase 5.

### Phase 2: Points & Verification (Week 2-3)

**Goal:** Points system with verified vs manual tracking

- [ ] Create `DailyPointsLog` model
- [ ] Implement 100 pts/day cap for self-reported
- [ ] Create `VerifiedAction` model
- [ ] Add points display in UI
- [ ] GPS search session tracking (`SearchSession` model)
- [ ] Manual search logging ("I searched this area" - no polygon)

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
// NOTE: `verificationMethod` here is a UI/points hint, not the DB enum.
// Values:
//
//   'GPS'            → can create VerifiedAction with verificationMethod = 'GPS'
//   'PLATFORM_EMAIL' → can create VerifiedAction with verificationMethod = 'PLATFORM_EMAIL'
//   'PHOTO'          → can create VerifiedAction with verificationMethod = 'PHOTO'
//   'SELF_REPORT'    → self-reported only, no VerifiedAction
//   null             → self-reported only, no VerifiedAction
//
// Only actions with GPS/PLATFORM_EMAIL/PHOTO actually create VerifiedAction rows.
// Self-reported actions affect DailyPointsLog.selfReportedPoints only.

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
    verificationMethod: 'GPS',  // GPS required; photo recommended but not required for verification
    tips: [
      'Use a flashlight even during the day',
      'Check high places for cats',
      'Look inside garages and sheds',
      'Take photos of hiding spots you check',
    ],
  },

  // OUTREACH
  // NOTE: For shelter/vet/animal-control tasks with both call + email:
  //   - Calls are SELF-REPORTED (8 pts, counts toward daily cap, no VerifiedAction)
  //   - Platform emails are VERIFIED (15 pts, uncapped, creates VerifiedAction)
  // The verificationMethod below refers to email only.

  contact_shelters: {
    id: 'contact_shelters',
    category: 'OUTREACH',
    displayName: 'Contact Shelters',
    description: 'Call or email local animal shelters',
    icon: '🏥',
    role: 'BOTH',
    petType: 'BOTH',
    basePriority: 85,
    basePoints: { call: 8, email: 15 },  // call = self-reported, email = verified
    verificationMethod: 'PLATFORM_EMAIL', // For emails only; calls are self-reported
    hasSubtasks: true, // One per shelter
    tips: [
      'Call during business hours for best results',
      'Ask if you can email a photo',
      'Request to be notified if a matching pet comes in',
    ],
  },

  contact_vets: {
    id: 'contact_vets',
    category: 'OUTREACH',
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
    category: 'OUTREACH',
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
    category: 'OUTREACH',
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
    category: 'OUTREACH',
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
    category: 'OUTREACH',
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
    category: 'OUTREACH',
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
    category: 'OUTREACH',
    displayName: 'Share Online',
    description: 'Post on social media, Nextdoor, and lost pet sites',
    icon: '📱',
    role: 'BOTH',
    petType: 'BOTH',
    basePriority: 60,
    basePoints: 5,
    verificationMethod: null,  // Self-reported only; no VerifiedAction created
    // NOTE: Users can optionally submit a link to their post. For v1, we store
    // this in the activity log (no VerifiedAction). If we later want to treat
    // links as semi-verified for analytics, we can add metadata.linkUrl to the
    // DailyPointsLog entry or create a separate ShareLink model.
    tips: [
      'Post in local community groups',
      'Use relevant hashtags',
      'Ask friends to share',
    ],
  },

  // AT_HOME
  litter_outside: {
    id: 'litter_outside',
    category: 'AT_HOME',
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
    category: 'AT_HOME',
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
    category: 'AT_HOME',
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
    category: 'AT_HOME',
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
    category: 'AT_HOME',
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
    category: 'AT_HOME',
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

## Future Enhancements

> **Note:** These features are important but should not block v1 of the Actions system. They are documented here for planning purposes. Mark as "Phase 5+" or "Not required for initial Actions release."

### Notifications (Phase 5+)

Push notifications to keep volunteers and owners informed.

**Notification Types:**

| Trigger | Title | Body | Priority |
|---------|-------|------|----------|
| New case nearby | "🚨 Lost pet near you" | "{Name} went missing 0.3mi away" | High |
| Owner requests help | "👑 Help requested!" | "Owner needs backup on {task}" | High |
| Sighting reported | "👁 New sighting!" | "{Name} spotted at {location}" | High |
| Optimal search time | "🌅 Great time to search" | "Dawn is the best time to find cats" | Medium |
| Task needs help | "🆘 Volunteer needs backup" | "{User} needs help with {task}" | Medium |
| Case update | "📢 Case update" | "{Name}: {update summary}" | Medium |
| Points milestone | "🎉 Achievement!" | "You earned {badge}!" | Low |
| Weekly summary | "📊 Your impact" | "You helped on {n} cases this week" | Low |

**Implementation Notes:**
- Push notification service (Firebase, OneSignal, or native)
- User notification preferences (opt-in/out per type)
- Subscription management per case

### Real-Time Updates (Phase 5+)

WebSocket or SSE for live collaboration.

**MissionEvent Types:**

```typescript
type MissionEvent =
  | { type: 'TASK_JOINED'; taskId: string; userId: string; userName: string }
  | { type: 'TASK_LEFT'; taskId: string; userId: string }
  | { type: 'TASK_COMPLETED'; taskId: string; completedBy: string }
  | { type: 'TASK_PROGRESS'; taskId: string; progress: number; total: number }
  | { type: 'OWNER_REQUEST'; taskId: string; message?: string }
  | { type: 'SEARCH_STARTED'; userId: string; userName: string }
  | { type: 'SEARCH_ENDED'; userId: string; areaCovered: number }
  | { type: 'FLYER_POSTED'; location: GeoPoint; userId: string }
  | { type: 'SHELTER_CONTACTED'; shelterId: string; status: ContactStatus }
  | { type: 'TIP_GENERATED'; tip: MascotTip }
  | { type: 'SIGHTING_REPORTED'; sighting: Sighting }
  | { type: 'CASE_UPDATE'; update: CaseUpdate }
  | { type: 'PET_FOUND'; resolution: Resolution };
```

**Implementation Notes:**
- Clients subscribe to `mission_events` for a specific caseId
- Server broadcasts events to all subscribed clients
- Consider Redis pub/sub for multi-instance support
- Existing SSE infrastructure at `/api/mission/[caseId]/stream` can be extended

### Offline Support (Phase 6+)

Allow users to continue working when offline.

**Actions Queued When Offline:**
- Flyer postings (location marked)
- Manual search area marks
- Call logs with outcomes
- "Other" activity logs

**UI Indicator:**

```
┌─────────────────────────────────────────┐
│ ⚠️ You're offline                       │
│ Actions will sync when you reconnect    │
│ ████████████░░░░░░ 3 pending            │
└─────────────────────────────────────────┘
```

**Implementation Notes:**
- IndexedDB or AsyncStorage for local queue
- Background sync when connection restored
- Conflict resolution for overlapping edits

### Accessibility (Phase 5+)

Ensure the Actions UI is usable by everyone.

**Requirements:**

| Requirement | Details |
|-------------|---------|
| ARIA labels | All interactive elements (buttons, links, form fields) |
| Touch targets | Minimum 44×44 points |
| Color contrast | 4.5:1 minimum for text |
| Motion | Respect `prefers-reduced-motion` |
| Font scaling | Support up to 200% text size |

**Screen Reader Announcements:**
- "New sighting reported 5 minutes ago at Oak Street"
- "Task: Contact Shelters. 5 of 18 completed. Owner requested help."
- "Search area marked. You earned 10 points."
- "Email sent to Chicago Animal Shelter. Awaiting response."

### Error Handling (Phase 5+)

Graceful error states throughout the app.

**Network Failures:**

```
┌─────────────────────────────────────────┐
│         📡 Connection Lost              │
│                                         │
│  Don't worry - your actions are saved   │
│  locally and will sync automatically.   │
│                                         │
│         [Try Again]  [Work Offline]     │
└─────────────────────────────────────────┘
```

**Email Send Failure:**

```
┌─────────────────────────────────────────┐
│         ❌ Email Failed                 │
│                                         │
│  Couldn't send to this shelter.         │
│  The email address may be invalid.      │
│                                         │
│  [Try Again]  [Call Instead]  [Skip]    │
└─────────────────────────────────────────┘
```

**GPS Permission Denied:**

```
┌─────────────────────────────────────────┐
│         📍 Location Needed              │
│                                         │
│  GPS tracking earns full points and     │
│  helps coordinate the search team.      │
│                                         │
│  [Enable Location]  [Mark Manually]     │
│                                         │
│  ℹ️ Manual marking earns 5 pts          │
│     (GPS earns 10 pts per 0.1 mi)       │
└─────────────────────────────────────────┘
```

### Analytics & Data Collection (Phase 6+)

Track events for algorithm improvement and business metrics.

**Event Categories:**

| Category | Events |
|----------|--------|
| User Behavior | Task views, joins, completions; search sessions; flyer posts; call/email actions |
| Algorithm Data | VerifiedAction creation; CaseOutcome recording |
| Business Metrics | Cases created, active volunteers per case, time to reunion, reunion rate, verified vs self-reported ratio |

**Data Pipeline:**

```
User Action → Event Logged → Analytics DB →
  → ML Model Training → Algorithm Update → Better Recommendations
```

**Key Insight:**

The `VerifiedAction` and `CaseOutcome` tables are the primary sources for training or tuning any recommendation logic. Self-reported actions are logged (and can be included as separate features) but must NOT be treated as ground truth.

---

*Last updated: December 2024*
*Version: 2.4*
