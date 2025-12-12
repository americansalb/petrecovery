# PetRecovery Naming Strategy

## Overview

This document captures the official naming conventions for PetRecovery.org and provides guidance for maintaining consistency across the codebase.

---

## Official Names

### 1. Platform: **PetRecovery**
- **Full name**: PetRecovery.org
- **Usage**: Website branding, legal references, email domains
- **Tagline**: "Bring Them Home"
- **Status**: ✅ No changes needed

### 2. Communities: **Rescue Squads**
- **Singular**: Rescue Squad
- **Plural**: Rescue Squads
- **Usage**: Volunteer community groups organized by city
- **Connotation**: First-responder energy, heroism, teamwork
- **Status**: ✅ No changes needed

### 3. Lost Pet Cases: **Missions**
- **Singular**: Mission
- **Plural**: Missions
- **Usage**: Individual lost pet recovery efforts
- **NOT**: "Case" or "Cases" (legacy terminology being phased out)
- **Rationale**: "Mission" pairs with "Rescue Squad" (squads run missions), supports gamification, feels action-oriented
- **Status**: ⚠️ Migration required (currently inconsistent)

### 4. Mascot: **Sarama**
- **Pronunciation**: suh-RUH-mah (Sanskrit: सरमा)
- **Origin**: Divine dog from the Rig Veda who tracked and recovered lost sacred cattle
- **Tagline**: "Your Guide Home"
- **NOT**: "Surumaa" (legacy spelling being phased out)
- **Status**: ⚠️ Migration required (currently uses "Surumaa")

---

## Naming Rationale

### Why "Sarama"?
Sarama (Sanskrit: सरमा, "the fleet one") is a mythological being from Hinduism's oldest text, the Rig Veda. She is the divine dog (Devasuni) who:

- Tracked down the Panis (demons) who had stolen the sacred cattle
- Followed a long journey to find where they were hidden
- Helped reunite them with their rightful owners

This origin story perfectly mirrors PetRecovery's mission: helping families find and recover their lost pets.

The spelling "Surumaa" was an attempt to aid English pronunciation, but "Sarama" preserves the cultural connection and is more distinctive as a brand name.

### Why "Missions" over "Cases"?
| Aspect | "Case" | "Mission" |
|--------|--------|-----------|
| Tone | Clinical, bureaucratic | Action-oriented, purposeful |
| Pairing | Cases + Squads (weak) | Squads run Missions (strong) |
| Gamification | Low engagement | High engagement |
| Emotional | Detached | Invested |
| User feeling | Filing paperwork | Joining a cause |

---

## Migration Plan

### Phase 1: Sarama (Mascot) - Low Risk
**Scope**: ~22 files, UI/copy changes, no schema changes

1. Update `lib/brandAssets.js`:
   - Rename exports: `SURUMAA_*` → `SARAMA_*`
   - Update name value: `'Surumaa'` → `'Sarama'`

2. Update system user references (3 files):
   - Email: `surumaa@petrecovery.app` → `sarama@petrecovery.app`
   - firstName: `'Surumaa'` → `'Sarama'`

3. Update UI components:
   - Import statements
   - Alt text attributes
   - Display text

4. Update routes:
   - `/about-surumaa` → `/about-sarama`
   - Add redirect for old URL

### Phase 2: Missions (Cases → Missions) - High Risk
**Scope**: ~150+ files, schema changes, API changes

**Recommended approach**: Create new migration, keep backward compatibility during transition.

1. **Database Schema** (Prisma):
   - Rename models: `Case` → `Mission`, `LostPetCase` → `Mission`
   - Rename fields: `caseId` → `missionId`, `caseNumber` → `missionNumber`
   - Update all relations and foreign keys

2. **API Routes**:
   - Consolidate `/api/cases/*` and `/api/mission/*` into `/api/missions/*`
   - Deprecate old routes with redirects

3. **Page Routes**:
   - `/cases` → `/missions`
   - `/cases/[caseNumber]` → `/missions/[missionNumber]`
   - `/admin/cases` → `/admin/missions`

4. **Components**:
   - Rename directory: `/components/case/` → `/components/mission/`
   - Update component names: `CaseCommandCenter` → `MissionCommandCenter`

5. **Documentation**:
   - Update all markdown files
   - Rename doc files where appropriate

---

## Style Guide

### Capitalization
- **Rescue Squad**: Capitalize when referring to the feature/concept
- **Mission**: Capitalize when referring to the feature/concept
- **Sarama**: Always capitalize (proper noun)

### Articles
- "a Mission" (not "a mission")
- "the Rescue Squad" or "your Rescue Squad"
- "Sarama says..." (no article needed)

### Plurals
- "Rescue Squads across the country..."
- "Active Missions in your area..."

### In Code
- Variables: `missionId`, `missionData`, `rescueSquad`
- Components: `MissionCard`, `RescueSquadList`
- Routes: `/missions`, `/rescue-squads`
- Database: `Mission`, `RescueSquad` (PascalCase for models)

---

## Gamification Terminology (Reference)

Volunteer progression levels (aligned with guardian/protector theme):

| Level | Name | Requirement |
|-------|------|-------------|
| 1 | Scout | Joined a Rescue Squad |
| 2 | Sentry | Participated in first Mission |
| 3 | Shepherd | Marked 5+ search areas |
| 4 | Pathfinder | 1+ successful reunion |
| 5 | Pack Guardian | 5+ successful reunions |
| 6 | Pack Legend | 50+ successful reunions |

---

## Questions to Resolve

1. **Mission Number Format**: Keep `CHI-2024-001847` or change to `M-CHI-2024-001847`?
2. **URL Structure**: Should Mission detail pages use ID or number? `/missions/123` vs `/missions/CHI-2024-001847`
3. **Database Migration**: Big-bang vs gradual migration with aliases?

---

*Last updated: 2025-12-12*
*Status: Approved - Ready for implementation*
