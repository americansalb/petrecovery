# Squads, Divisions & Missions – Product Vision

ReunitePets.org should feel like the **best search & rescue UI in the world**, starting with lost pets. This doc nails down what **Squads**, **Divisions**, and **Missions** *mean* so we stop drifting.

---

## 1. Glossary (Source of Truth)

**City**
Canonical geographic unit. Every U.S. city has exactly one **Rescue Force** in ReunitePets.org.

**Rescue Force (Squad)**
- One per city: `Chicago Rescue Force`, `Carpentersville Rescue Force`, etc.
- Represents the *whole community* of rescuers for that city.
- Contains zero or more **Divisions** (neighborhood-level units).
- People join squads, then optionally "tune" what divisions they care about.

**Division**
- A **sub-area of a Squad's city** (usually a neighborhood or cluster of neighborhoods).
- Examples in Chicago: `Lakeview`, `Logan Square`, `South Side`.
- Some big neighborhoods may later split (e.g., `Lakeview East` / `Lakeview West`).
- Small cities may effectively have **one "whole city" division**, even if the UI doesn't rub their nose in that word.
- Divisions are mainly about **who gets notified** and **which map area a mission belongs to**.

**Mission**
- A single active rescue mission for one pet.
- Belongs to exactly:
  - **One Squad** (city)
  - **One primary Division** (where the pet is anchored)
- Has:
  - A pet owner (mission "leader")
  - A set of helpers (squad members who accepted the mission)
  - Status (e.g., `ACTIVE`, `IN_PROGRESS`, `SIGHTING_REPORTED`, `REUNITED`, `CLOSED_OTHER`)
  - A rich coordination workspace: map, searched areas, sightings, shelter contacts, flyers, chat, photos.

**Squad Hub (Layer A – "Community / City view")**
- City-level home page.
- Shows divisions, mission queues, map of active missions, and squad community activity.

**Mission Command Center (Layer B – "Mission view")**
- Deep, focused page per mission.
- The "state-of-the-art search-and-rescue UI" where coordination happens (map, timelines, photos, AI, checklists).

---

## 2. Hierarchy & Data Model

### 2.1. Conceptual hierarchy

```text
COUNTRY: United States
  └── City (Chicago)
        └── Squad (Chicago Rescue Force)
              ├── Divisions
              │    ├── Lakeview
              │    │     ├── Mission #CHI-LKV-0001 (Max)
              │    │     └── Mission #CHI-LKV-0002 (Whiskers)
              │    ├── South Side
              │    │     └── Mission #CHI-SS-0003
              │    └── Logan Square
              │          └── Mission #CHI-LSQ-0004
              └── Members (people)
```

For a small city (no real neighborhood complexity), we still model a single division under the hood, e.g.:

```text
City: Carpentersville
  └── Carpentersville Rescue Force
        └── Division: "Entire City" (can be hidden in the UI)
              ├── Mission #CRP-0001
              ├── Mission #CRP-0002
              └── ...
```

### 2.2. Core rules

1. **One Squad per City.**
   All local rescue activity is anchored to that squad.

2. **Missions live in exactly one primary Division.**
   We can later support "spillover" visibility into neighboring divisions, but the mission always has a home.

3. **Divisions are notification scopes, not separate orgs.**
   They define who should be pinged first and what area is emphasized on the map.
   The Squad is still the umbrella community.

---

## 3. Membership & Notifications

### 3.1. Joining a Squad

When a user hits "Join Chicago Rescue Force":

1. They become a member of that Squad (city-level).
2. Onboarding asks:
   - "What's your main neighborhood?" → choose one **home Division**.
   - Optional: select extra nearby divisions (e.g., someone who lives in Lakeview but works in Loop).
3. Result:
   ```
   UserMembership { squadId, homeDivisionId, extraDivisionIds[] }
   ```

### 3.2. Division membership semantics

- **Being in a Squad** means:
  - You can see all public missions in that city.
  - You can help anywhere if you want, but you're notified most about your chosen divisions.

- **Being in a Division (home or extra)** means:
  - You get priority notifications for new missions in that division.
  - Those missions appear at the top of your personal "Help Queue."

### 3.3. Mission visibility & escalation (Lakeview example)

**Pet goes missing in Lakeview:**

1. **Initial scope (Division-first):**
   - Mission is created with `division = Lakeview`.
   - Notifications go to:
     - Members whose `homeDivision = Lakeview`.
     - Members who have Lakeview in `extraDivisionIds`.

2. **Optional spillover (neighbors):**
   - After X hours or when owner / coordinator clicks "Expand Area":
     - Notify adjacent divisions (e.g., Lincoln Park, North Center).
     - Visual: faint "leak out" overlay on map showing search expansion.

3. **Squad-wide escalation:**
   - For high-priority missions (service animals, extreme weather) or manual override:
     - "Escalate to entire Chicago Squad" button.
     - Notifies all squad members, but UI still highlights the origin division.

### 3.4. Carpentersville behavior

- There is effectively one division: `Entire Carpentersville`.
- Everyone in the squad receives notifications for all missions.
- The UI can downplay the word "division" and just say "Your city."

---

## 4. Roles & Permissions (High-Level)

We keep roles simple but powerful:

| Role | Description |
|------|-------------|
| **Pet Owner (Mission Leader)** | The person who created the mission / is responsible for the pet |
| **Squad Member** | Anyone who joined the city's squad |
| **Division Lead** | Trusted member for one or more divisions |
| **Squad Lead / Admin** | Runs the whole city squad |

### 4.1. What each role can do (initial draft)

| Action | Pet Owner | Squad Member | Division Lead | Squad Lead |
|--------|-----------|--------------|---------------|------------|
| Report new mission | ✅ | ✅ | ✅ | ✅ |
| Accept mission | (auto) | ✅ | ✅ | ✅ |
| Mark pet as found / reunited | ✅ | ❌ (unless lead/admin) | ✅ (override) | ✅ |
| Invite members to squad | ✅ (share link) | ✅ (share link) | ✅ | ✅ |
| Moderate chat (mute/remove msg) | ❌ | ❌ | ✅ | ✅ |
| Remove member from squad | ❌ | ❌ | ❌ | ✅ |
| Create/Edit division | ❌ | ❌ | ✅ (with guardrails) | ✅ |
| Escalate mission to full squad | ✅ | ✅ (if assigned) | ✅ | ✅ |

**Note:** "Mission Leader" is a property of the mission, not a global role. In many flows the pet owner is the leader, but a shelter or vet could also create missions.

---

## 5. UX Layers (How it feels to users)

There are two main UI layers that everything hangs off of.

### 5.1. Layer A – Squad / Division Hub (Community View)

**URL examples:**
- `/squads/chicago`
- `/squads/chicago/lakeview` (pre-filtered to one division)

**Purpose:**
- Show the city's rescue energy at a glance.
- Let people join, go on duty, pick divisions, and grab missions to help with.

**Core structural elements:**

1. **Header:**
   - City name, join/On Duty button.
   - Row of division chips: `Lakeview`, `Logan Square`, `South Side`, etc.

2. **Left panel: Mission queue**
   - Tabs: `Incoming`, `Active`, `Reunited`.
   - Big, visual mission cards with status, time, and "Help with this pet" button.

3. **Center: City map**
   - Pins colored by status, grouped by division.
   - "Use my location" to snap to nearest division and relevant missions.

4. **Right: Squad activity lane**
   - Division / city-wide chat, announcements, quick checklists.

### 5.2. Layer B – Mission Command Center (Mission View)

**URL example:**
- `/missions/CHI-LKV-0001`

**Purpose:**
- Be the place where actual rescue coordination happens.
- Designed so that even low-literacy users can:
  - See where to look.
  - See what's already been done.
  - Mark what they did with minimal reading.

**Structure (high-level):**

1. **Left:** Mission summary and people (owner, helpers, status, reward).
2. **Center:** Big map with:
   - Last seen point
   - Search sectors
   - Flyer coverage
   - Sightings
   - Shelters contacted
3. **Right:** Timeline + chat:
   - Messages with the owner and squad.
   - AI suggestions & checklists inserted as "cards".

We will design this page in depth separately; this doc only pins down the concepts.

---

## 6. Illiterate-Friendly Design Constraints

These constraints apply across both layers:

1. **Icons & color first, text second.**
   - Status represented by icon + color (e.g., green check = reunited).
   - Buttons use icons and short labels:
     - ✅ Help
     - 📍 Here (for marking location)
     - 🗺️ Area done

2. **Tap-optimized.**
   - Large tap targets, minimal typing, auto-filled fields where possible.

3. **Step-by-step flows.**
   - Wizards for complex tasks like initial mission setup and marking searched areas.

4. **Mobile-first.**
   - Assume the user is outside, one hand, sunlight, possibly stressed.

5. **Audio cues, haptics, and more advanced accessibility** can come later, but we design from day one with this constraint in mind.

---

## 7. Which Page Do We Build First?

Given all this, here's the decision:

### 7.1. First page to build: Squad / Division Hub

**Reasoning:**
- It's the home base of the city's rescue community.
- It wires together:
  - Squad membership (join/on duty)
  - Divisions (Lakeview vs South Side)
  - Mission queue (which missions need help)
  - The first version of the map mental model.
- It gives us a natural entry point into the Mission Command Center:
  - Tap a mission card or map pin → open the mission UI.

### 7.2. Second page to build: Mission Command Center

Once the hub exists, we immediately design & implement the Mission Command Center as the "hero" experience:
- The hub gets people into the right mission,
- The mission page delivers the wow.

---

## 8. TL;DR Rules for Any Future Doc or Tool

If another AI (Claude, Gemini, etc.) is confused, these are the non-negotiables:

1. **One Squad per city.** Divisions belong to a Squad.
2. **Missions belong to exactly one primary Division** and one Squad.
3. **Membership is at Squad level;** users tune divisions for notifications.
4. **Divisions are about who gets notified first** and where on the map the mission lives.
5. **Two main UI layers:**
   - Squad / Division Hub (community & queues)
   - Mission Command Center (deep coordination)
6. **If a proposal conflicts with this doc, this doc wins** unless you explicitly decide to change it.

---

## 9. On Duty System

### 9.1. States

| State | Description |
|-------|-------------|
| **Not a member** | CTA is "Join {City} Rescue Force" |
| **Member, Off Duty** | Default state. Can see missions, manually accept. Low-frequency notifications. |
| **Member, On Duty** | Actively available. Appears as green presence. Prioritized for notifications. Location shown if permitted. |

### 9.2. Effects of On Duty

- Appear as a green presence ("12 on duty in Lakeview")
- Prioritized for notifications for new missions in chosen divisions
- If location sharing allowed, approximate location shown on map
- Ephemeral: auto-timeout after ~12 hours

---

## 10. Mission Queue Tab Definitions

| Tab | Shows | Sorted By |
|-----|-------|-----------|
| **Incoming** | Missions where user is NOT a helper, status is NEW/ACTIVE/IN_PROGRESS, still seeking helpers | Urgency → Recency |
| **Active** | All non-reunited missions (shows "You're helping" badge if user is helper) | Urgency → Recency |
| **Reunited** | Missions with status REUNITED | Reunion time (recent first) |

---

## 11. Division Chip Behavior

- **Single-select** with "All" option
- **"All"** is default - shows entire squad
- Each chip shows active mission count: `Lakeview (3)`
- Selecting a division filters: mission queue, map, activity lane

---

## 12. Visual Design Direction

### 12.1. Theme
- **Dark-first** (bioluminescent aesthetic)
- Light mode can be added later

### 12.2. Color Palette

| Token | Purpose | Example |
|-------|---------|---------|
| `--color-bg-root` | Deep background | `#020617` (near-black navy) |
| `--color-bg-panel` | Panel backgrounds | `#020817` → `#020b1f` |
| `--color-accent-primary` | Primary glow | Teal/cyan |
| `--color-accent-secondary` | Secondary accent | Violet/indigo |
| `--color-status-low` | Low urgency | Cool indigo |
| `--color-status-medium` | Medium urgency | Amber |
| `--color-status-high` | High/critical urgency | Crimson |
| `--color-status-success` | Reunited/success | Saturated green |

### 12.3. Typography
```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, "Inter", sans-serif;
```

---

## 13. Responsive Layout

| Viewport | Layout |
|----------|--------|
| **Mobile** | Tabbed: Missions / Map / Squad |
| **Tablet** | 2-panel: Missions + Map (activity in drawer) |
| **Desktop** | 3-panel: Missions / Map / Activity |
