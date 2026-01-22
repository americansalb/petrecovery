# ReunitePets Naming Strategy

## Overview

This document captures the official naming conventions for ReunitePets.org and provides guidance for maintaining consistency across the codebase.

**Status: ✅ IMPLEMENTED** - All naming changes completed on 2025-12-12.

---

## Official Names

### 1. Platform: **ReunitePets**
- **Full name**: ReunitePets.org
- **Usage**: Website branding, legal references, email domains
- **Tagline**: "Bring Them Home"
- **Status**: ✅ Unchanged

### 2. Communities: **Rescue Forces**
- **Singular**: Rescue Force
- **Plural**: Rescue Forces
- **Usage**: Volunteer community groups organized by city
- **Connotation**: First-responder energy, heroism, teamwork
- **Status**: ✅ Unchanged

### 3. Lost Pet Cases: **Missions**
- **Singular**: Mission
- **Plural**: Missions
- **Usage**: Individual lost pet recovery efforts
- **Previously**: "Case" / "Cases" (now deprecated)
- **Rationale**: "Mission" pairs with "Rescue Force" (squads run missions), supports gamification, feels action-oriented
- **Status**: ✅ Migrated from "Case/Cases"

### 4. Mascot: **Sarama**
- **Pronunciation**: suh-RUH-mah (Sanskrit: सरमा)
- **Origin**: Divine dog from the Rig Veda who tracked and recovered lost sacred cattle
- **Tagline**: "Your Guide Home"
- **Previously**: "Surumaa" (now deprecated)
- **Status**: ✅ Migrated from "Surumaa"

---

## Naming Rationale

### Why "Sarama"?
Sarama (Sanskrit: सरमा, "the fleet one") is a mythological being from Hinduism's oldest text, the Rig Veda. She is the divine dog (Devasuni) who:

- Tracked down the Panis (demons) who had stolen the sacred cattle
- Followed a long journey to find where they were hidden
- Helped reunite them with their rightful owners

This origin story perfectly mirrors ReunitePets's mission: helping families find and recover their lost pets.

The spelling "Surumaa" was an attempt to aid English pronunciation, but "Sarama" preserves the cultural connection and is more distinctive as a brand name.

### Why "Mission" over "Case"?
| Aspect | "Case" (old) | "Mission" (new) |
|--------|--------------|-----------------|
| Tone | Clinical, bureaucratic | Action-oriented, purposeful |
| Pairing | Cases + Squads (weak) | Squads run Missions (strong) |
| Gamification | Low engagement | High engagement |
| Emotional | Detached | Invested |
| User feeling | Filing paperwork | Joining a cause |

---

## What Was Changed

### Sarama Migration (Completed)
- `lib/brandAssets.js`: `SURUMAA_*` → `SARAMA_*`
- System user email: `surumaa@reunitepets.app` → `sarama@reunitepets.app`
- Route: `/about-surumaa` → `/about-sarama`
- All UI text and alt attributes updated

### Mission Migration (Completed)
- Routes: `/cases/*` → `/missions/*`, `/admin/cases/*` → `/admin/missions/*`
- API: `/api/cases/*` → `/api/missions/*`
- Components: `Case*` → `Mission*` (e.g., `CaseCommandCenter` → `MissionCommandCenter`)
- Variables: `caseId` → `missionId`, `caseNumber` → `missionNumber`
- UI text: "Case" → "Mission" throughout

### Note on Database Schema
The Prisma schema still uses `Case` model names for database compatibility. A future migration will update the schema when safe to do so. The application layer uses "Mission" terminology while the data layer retains "Case" naming.

---

## Style Guide

### Capitalization
- **Rescue Force**: Capitalize when referring to the feature/concept
- **Mission**: Capitalize when referring to the feature/concept
- **Sarama**: Always capitalize (proper noun)

### Articles
- "a Mission" (not "a mission")
- "the Rescue Force" or "your Rescue Force"
- "Sarama says..." (no article needed)

### Plurals
- "Rescue Forces across the country..."
- "Active Missions in your area..."

### In Code
- Variables: `missionId`, `missionData`, `rescueSquad`
- Components: `MissionCard`, `RescueSquadList`
- Routes: `/missions`, `/rescue-forces`
- Database: `Case`, `RescueSquad` (PascalCase for models - schema pending)

---

## Gamification Terminology (Reference)

Volunteer progression levels (aligned with guardian/protector theme):

| Level | Name | Requirement |
|-------|------|-------------|
| 1 | Scout | Joined a Rescue Force |
| 2 | Sentry | Participated in first Mission |
| 3 | Shepherd | Marked 5+ search areas |
| 4 | Pathfinder | 1+ successful reunion |
| 5 | Pack Guardian | 5+ successful reunions |
| 6 | Pack Legend | 50+ successful reunions |

---

*Last updated: 2025-12-12*
*Status: ✅ Implemented*
