# PetRecovery Technical Reference

> **Last Updated**: November 27, 2025
> **Status**: Pre-MVP Development Phase (~45% complete)
> **Honest Assessment**: See [ROADMAP.md](/ROADMAP.md) for accurate project status
> **Next Steps**: Password reset, image upload, mission coordination UI

**IMPORTANT**: This document was previously titled "MVP Complete Reference" which was inaccurate. The project is NOT at MVP status. Critical features like password reset, image upload, and mission coordination UI are not implemented. See ROADMAP.md for the comprehensive assessment.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Summary](#architecture-summary)
3. [Data Model (Prisma Schema)](#data-model)
4. [API Routes Reference](#api-routes-reference)
5. [Frontend Pages](#frontend-pages)
6. [Core Features](#core-features)
7. [Security & Permissions](#security--permissions)
8. [Email Notifications](#email-notifications)
9. [Admin Dashboard](#admin-dashboard)
10. [QA Harness](#qa-harness)
11. [Environment Variables](#environment-variables)
12. [Deployment](#deployment)
13. [Launch Checklist](#launch-checklist)
14. [Known Issues & Future Work](#known-issues--future-work)

---

## Project Overview

PetRecovery is a community-driven platform for reuniting lost pets with their families. The platform enables:

- **Pet Owners**: Report lost pets, receive community alerts
- **Community Members**: Join rescue squads, help search for lost pets
- **Admins**: Manage missions, squads, and monitor platform health

### Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 14 (App Router) |
| Database | PostgreSQL via Prisma ORM |
| Auth | NextAuth.js with credentials |
| Email | Nodemailer |
| Hosting | Render (recommended) |
| Maps | Leaflet |
| Styling | Tailwind CSS + inline styles |

---

## Architecture Summary

```
frontend/
├── app/
│   ├── api/                    # API routes
│   │   ├── auth/               # NextAuth
│   │   ├── missions/              # Mission management (authenticated)
│   │   ├── public/missions/       # Public mission portal (no auth)
│   │   ├── rescue-squads/      # Squad operations
│   │   ├── divisions/          # Division management
│   │   ├── admin/              # Admin-only endpoints
│   │   └── legal/              # Legal document & consent
│   ├── lib/                    # Shared utilities
│   │   ├── auth.js             # NextAuth config
│   │   ├── prisma.js           # Prisma client singleton
│   │   ├── cities.js           # US cities database (~29k)
│   │   ├── email.js            # Email sending
│   │   ├── notifications.js    # Notification helpers
│   │   ├── permissions.js      # RBAC helpers
│   │   └── logging.js          # Structured event logging
│   └── [pages]/                # Frontend pages
├── lib/
│   └── logging.js              # Event logging utility
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── seed.js                 # Database seeding
└── package.json
```

---

## Data Model

### Core Entities

#### User
```prisma
model User {
  id                    String    @id @default(uuid())
  email                 String    @unique
  passwordHash          String?
  firstName             String?
  lastName              String?
  role                  Role      @default(USER)  // USER, ADMIN, MODERATOR
  emailVerified         DateTime?

  // Legal Consent
  waiverAcceptedAt      DateTime?
  waiverVersionAccepted String?
  tosAcceptedAt         DateTime?
  tosVersionAccepted    String?

  // Stats
  rescueLevel           RescueLevel @default(NONE)
  squadsJoinedCount     Int         @default(0)

  // Relations
  squadMemberships      SquadMember[]
  missionsCreated          LostPetMission[]     @relation("CreatedBy")
  coordinatedMissions      LostPetMission[]     @relation("Coordinator")
}
```

#### LostPetMission
```prisma
model LostPetMission {
  id              String   @id @default(uuid())
  missionNumber      String   @unique   // Format: "CHI-2025-0001"

  // Location
  city            String
  state           String
  zipCode         String?
  lastSeenLandmark String?
  lastSeenAt      DateTime?

  // Pet Info
  petName         String?
  petSpecies      PetSpecies    // DOG, CAT, BIRD, OTHER
  petBreed        String?
  petColor        String?
  petDescription  String?

  // Contact
  contactName     String?
  contactPhone    String?
  contactEmail    String?

  // Status
  status          MissionStatus @default(OPEN)
  statusReason    String?
  isUrgent        Boolean    @default(false)

  // Public Portal
  isPublic        Boolean    @default(false)   // Admin must approve
  publicContactOk Boolean    @default(false)   // Show contact publicly
  source          MissionSource @default(ADMIN)   // ADMIN or PUBLIC_REPORT

  // Relations
  squadId         String?
  squad           RescueSquad? @relation(fields: [squadId])
  coordinatorId   String?
  coordinator     User?        @relation("Coordinator")
  createdById     String?
  createdBy       User?        @relation("CreatedBy")
  notes           LostPetMissionNote[]
}
```

#### RescueSquad
```prisma
model RescueSquad {
  id                String   @id @default(uuid())
  name              String
  city              String
  state             String
  zipCodes          String   // JSON array
  centerLatitude    Float?
  centerLongitude   Float?
  radiusMiles       Float    @default(10)
  isActive          Boolean  @default(true)

  // Stats
  totalMissionsAccepted   Int @default(0)
  successfulReunions   Int @default(0)

  // Relations
  members           SquadMember[]
  divisions         SquadDivision[]
  missions             LostPetMission[]
}
```

#### SquadMember
```prisma
model SquadMember {
  id         String   @id @default(uuid())
  squadId    String
  userId     String
  divisionId String?
  role       SquadRole @default(MEMBER)  // FOUNDER, LEADER, MEMBER
  isActive   Boolean   @default(true)

  squad      RescueSquad    @relation(fields: [squadId])
  user       User           @relation(fields: [userId])
  division   SquadDivision? @relation(fields: [divisionId])
}
```

#### EventLog
```prisma
model EventLog {
  id              String   @id @default(uuid())
  event_type      String       // e.g., "mission.created", "squad.join_failed"
  timestamp       DateTime @default(now())
  correlation_id  String?

  actor_user_id   String?
  actor_role      String?

  resource_type   String       // "mission", "squad", "user", etc.
  resource_id     String?

  action          String       // "create", "update", "delete", "read"
  result          String       // "success" or "failure"

  error_code      String?
  error_message   String?
  metadata        String?      // JSON
}
```

### Enums

| Enum | Values |
|------|--------|
| `Role` | `USER`, `ADMIN`, `MODERATOR` |
| `RescueLevel` | `NONE`, `SCOUT`, `RANGER`, `HERO`, `LEGEND` |
| `SquadRole` | `FOUNDER`, `LEADER`, `MEMBER` |
| `PetSpecies` | `DOG`, `CAT`, `BIRD`, `OTHER` |
| `MissionStatus` | `OPEN`, `ACTIVE_SEARCH`, `RESOLVED`, `CLOSED_OTHER` |
| `MissionSource` | `ADMIN`, `PUBLIC_REPORT` |

---

## API Routes Reference

### Authentication
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/[...nextauth]` | - | NextAuth handlers |
| POST | `/api/auth/register` | - | User registration |

### Missions (Authenticated - Admin/Staff Only)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/missions` | Required + Waiver | List missions with filters |
| POST | `/api/missions` | Required + Waiver + Staff | Create new mission |
| GET | `/api/missions/[id]` | Required + Waiver | Get mission detail |
| POST | `/api/missions/[id]/status` | Required + Staff | Update mission status |
| POST | `/api/missions/[id]/notes` | Required + Waiver | Add note to mission |
| POST | `/api/missions/[id]/assign-coordinator` | Required + Admin | Assign coordinator |
| POST | `/api/missions/[id]/assign-squad` | Required + Admin | Assign squad |

### Public Missions (No Auth)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/public/missions` | None | List public missions |
| GET | `/api/public/missions/[missionNumber]` | None | Get public mission detail |
| POST | `/api/public/missions` | None | Submit lost pet report |

### Rescue Squads
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/rescue-squads` | Optional | Search squads by ZIP/city |
| POST | `/api/rescue-squads` | Required + Waiver | Create new squad |
| GET | `/api/rescue-squads/[id]` | Optional | Get squad detail |
| POST | `/api/rescue-squads/[id]/join` | Required + Waiver | Join squad |
| POST | `/api/rescue-squads/[id]/leave` | Required | Leave squad |

### Legal
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/legal/documents` | Required | Get legal documents |
| POST | `/api/legal/accept` | Required | Accept legal agreements |

### Admin Health
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/admin/health/summary` | Admin | Get service health status |
| GET | `/api/admin/health/metrics` | Admin | Get platform metrics |
| GET | `/api/admin/health/errors` | Admin | Get aggregated errors |
| POST | `/api/admin/health/test-geocode` | Admin | Test geocoding |
| POST | `/api/admin/health/test-email` | Admin | Send test email |

### Admin QA
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/admin/qa/log-test` | Admin | Log QA test event |

---

## Frontend Pages

### Public Pages
| Route | Description |
|-------|-------------|
| `/` | Homepage with main CTAs |
| `/login` | Sign in |
| `/register` | Create account |
| `/missions` | Public lost pet missions list |
| `/missions/[missionNumber]` | Public mission detail |
| `/missions/report` | Submit public lost pet report |
| `/database` | Pet database search |
| `/advice` | Pet recovery advice |

### Authenticated Pages
| Route | Description |
|-------|-------------|
| `/dashboard` | User dashboard |
| `/profile` | User profile management |
| `/legal/consent` | Accept terms & waiver |
| `/rescue-squads` | Browse rescue squads |
| `/rescue-squads/search` | Search squads by location |
| `/rescue-squads/[id]` | Squad detail |
| `/divisions/request` | Request new division |
| `/report/new` | Report lost pet (authenticated) |
| `/report/found` | Report found pet |

### Admin Pages
| Route | Auth | Description |
|-------|------|-------------|
| `/admin/missions` | Admin | List all missions |
| `/admin/missions/new` | Admin | Create new mission |
| `/admin/missions/[id]` | Admin | Mission detail with actions |
| `/admin/rescue-squads` | Admin | Manage squads |
| `/admin/rescue-squads/create` | Admin | Create squad |
| `/admin/divisions` | Admin | Manage divisions |
| `/admin/health` | Admin | Health dashboard |
| `/admin/qa` | Admin | QA test harness |
| `/admin/communities` | Admin | Community management |

---

## Core Features

### 1. Lost Pet Missions MVP (Phase 13-14)

**Mission Lifecycle:**
1. `OPEN` - Initial state when mission is created
2. `ACTIVE_SEARCH` - Rescue squad is actively searching
3. `RESOLVED` - Pet found and reunited
4. `CLOSED_OTHER` - Closed for other reasons

**Mission Number Format:** `{CITY_PREFIX}-{YEAR}-{SEQUENCE}`
Example: `CHI-2025-0001` (Chicago, 2025, 1st mission)

**Key Features:**
- Mission notes timeline
- Coordinator assignment
- Squad assignment
- Status transitions with reason
- Urgent flag

### 2. Public Lost Pet Portal (Phase 15-16)

**Public Report Flow:**
1. User submits form at `/missions/report`
2. Mission created with `isPublic=false`, `source=PUBLIC_REPORT`
3. Confirmation email sent to contact
4. Admin alerted via email
5. Admin reviews and sets `isPublic=true` to publish
6. Mission appears on `/missions` public list

**Privacy Controls:**
- `isPublic` - Whether mission appears in public list
- `publicContactOk` - Whether contact info is visible publicly
- Sensitive fields (createdById, squadId, source) never exposed via public API

### 3. Rescue Squads & Divisions

**Squad Features:**
- City-based squads (one per city)
- ZIP code coverage area
- Member roles: FOUNDER, LEADER, MEMBER
- Stats: totalMissionsAccepted, successfulReunions

**Division System:**
- Subdivisions within a squad (e.g., by neighborhood)
- Each division has its own coordinates
- Members can belong to one division within a squad

### 4. Legal Consent Flow (Phase 0)

**Required Agreements:**
1. **Terms of Service** - Required for all users
2. **Liability Waiver** - Required before participating in rescue activities

**Gated Actions (require waiver acceptance):**
- Creating/joining rescue squads
- Creating/viewing missions
- Participating in rescue operations

**Flow:**
1. User attempts protected action
2. API returns 403 with `code: WAIVER_NOT_ACCEPTED`
3. User redirected to `/legal/consent?returnUrl=...`
4. User accepts agreements
5. User redirected back to original action

---

## Security & Permissions

### Role Hierarchy

| Role | Capabilities |
|------|-------------|
| `USER` | Join squads, view assigned missions |
| `MODERATOR` | Above + manage assigned squads |
| `ADMIN` | Full access to all features |

### Permission Helpers (`/app/lib/permissions.js`)

```javascript
// Check if user is admin
isAdmin(session) → boolean

// Check if user is admin or moderator
isStaff(session) → boolean

// Require admin role (throws PermissionError)
await requireAdmin(session, context)

// Require staff role (throws PermissionError)
await requireStaffOrAdmin(session, context)

// Check if user can edit mission
canEditMission(session, missionData) → boolean

// Check if user can assign missions
canAssignMission(session) → boolean
```

### Protected Routes

All protected API routes follow this pattern:
1. Check session exists
2. Check waiver acceptance
3. Check role permissions
4. Emit structured events on failure

---

## Email Notifications

### Configuration

Set these environment variables:
```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=PetRecovery <your-email@gmail.com>
ADMIN_NOTIFICATION_EMAIL=admin@petrecovery.org
```

### Notification Types

| Function | Trigger | Recipient |
|----------|---------|-----------|
| `sendMissionReportConfirmation()` | Public report submitted | Report contact |
| `sendAdminPublicReportAlert()` | Public report submitted | Admin email |
| `sendMissionStatusUpdate()` | Mission status changes | Mission contact |

### Email Templates

All emails use HTML templates with:
- PetRecovery branding
- Mission details summary
- Next steps for recipient
- Links to relevant pages

---

## Admin Dashboard

### Health Dashboard (`/admin/health`)

**Tabs:**
1. **Overview** - Service health grid, key metrics, smart alerts
2. **Errors** - Aggregated error log with filtering
3. **Tools** - Test geocoding, test email

**Services Monitored:**
- Database connectivity
- Geocoding API (zippopotam.us)
- Email service configuration

**Key Metrics:**
- Total users
- Total squads
- Active squads
- Total missions
- Open missions
- Active searches

### QA Harness (`/admin/qa`)

**Test Suites:**
1. **Legal Tests** - Waiver acceptance, blocked actions
2. **Squad Tests** - Create, search, join, leave
3. **Mission Tests** - Create, status update, add note
4. **Public Mission Tests** - List, detail, submit report
5. **Notification Tests** - Confirmation email, admin alert
6. **Permission Tests** - Role validation, assignment logic

**Data Generators:**
- Generate demo squads
- Generate demo missions
- Cleanup test data

---

## Environment Variables

### Required for Production

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/petrecovery

# NextAuth
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=https://your-domain.com

# Email (for notifications)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
ADMIN_NOTIFICATION_EMAIL=admin@petrecovery.org
```

### Optional

```env
# Environment identifier (shown in admin dashboard)
NEXT_PUBLIC_ENV_NAME=Production

# Base URL for email links
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

---

## Deployment

### Render Deployment

1. Create PostgreSQL database on Render
2. Create Web Service pointing to frontend directory
3. Set environment variables
4. Deploy

**Build Command:**
```bash
npm install && npm run build
```

**Start Command:**
```bash
npm start
```

### Post-Deployment Checklist

- [ ] Database connected and migrated
- [ ] Admin user created with `role: ADMIN`
- [ ] Email service configured and tested
- [ ] Legal documents seeded
- [ ] Health dashboard shows all green

---

## Launch Checklist

### Pre-Launch

- [ ] All environment variables set
- [ ] Database migrations applied
- [ ] Admin account created
- [ ] Legal documents seeded (Terms of Service, Liability Waiver)
- [ ] Email service configured and tested
- [ ] Health dashboard shows healthy status
- [ ] QA harness tests passing

### Day 1 Monitoring

- [ ] Check `/admin/health` for errors
- [ ] Monitor public report submissions
- [ ] Review and approve pending missions (`isPublic=false`)
- [ ] Verify email notifications working

### Key URLs to Test

| URL | Expected Behavior |
|-----|------------------|
| `/` | Homepage loads with CTAs |
| `/missions` | Public mission list (may be empty) |
| `/missions/report` | Public report form works |
| `/login` | Can log in |
| `/legal/consent` | Waiver acceptance works |
| `/admin/health` | Shows healthy status |
| `/admin/qa` | Tests pass |

---

## Known Issues & Critical Gaps

### CRITICAL - Must Fix Before Launch

1. **Password Reset Flow** - Users cannot recover accounts. This is a blocker.
2. **Image Upload** - No actual upload mechanism exists. Pet photos are URL fields only.
3. **Mission Coordination UI** - APIs exist but there is NO frontend UI for squad chat, search areas, or sightings.
4. **Fake Statistics** - Home page displays "847 pets reunited" which is hardcoded, not real data.

### Not Yet Implemented

1. **SMS Notifications** - Schema exists, no Twilio integration
2. **Push Notifications** - Schema exists, no implementation
3. **Social Login** - Only email/password
4. **Pet Profile Management** - Pet model exists, no user-facing UI
5. **Lost/Found Matching Algorithm** - No automatic matching
6. **Sighting Verification Workflow** - Fields exist, no UI
7. **Meta Ads Integration** - Schema fields only, no API integration

### Technical Debt

1. **Inline CSS throughout** - No consistent design system
2. **No TypeScript** - JavaScript throughout, error-prone
3. **Large cities database** - 29k entries, no pagination
4. **No automated tests** - Only manual QA harness
5. **No error boundaries** - Crashes show white screen
6. **No loading states** - Many pages lack spinners
7. **No mobile testing** - Basic responsive only

### See ROADMAP.md for Complete Assessment

The full project roadmap with accurate status, priority phases, and timeline estimates is in [ROADMAP.md](/ROADMAP.md).

---

## Event Logging Reference

### Event Types

| Prefix | Resource | Example |
|--------|----------|---------|
| `mission.*` | LostPetMission | `mission.created`, `mission.status_changed` |
| `squad.*` | RescueSquad | `squad.created`, `squad.join_failed` |
| `public_mission.*` | Public Portal | `public_mission.report_submitted` |
| `notification.*` | Email | `notification.send_succeeded` |
| `auth.*` | Authentication | `auth.permission_denied` |
| `admin.*` | Admin Actions | `admin.health_check_viewed` |
| `legal.*` | Legal Consent | `legal.waiver_accepted` |
| `qa.*` | QA Harness | `qa.test_executed` |

### Event Structure

```javascript
{
  event_type: "mission.created",
  timestamp: "2025-11-26T10:00:00.000Z",
  correlation_id: "uuid",
  actor_user_id: "user-uuid",
  actor_role: "ADMIN",
  resource_type: "mission",
  resource_id: "mission-uuid",
  action: "create",
  result: "success",
  error_code: null,
  error_message: null,
  metadata: { ... }
}
```

---

## Quick Reference

### Common Commands

```bash
# Development
npm run dev

# Build
npm run build

# Seed database
npm run seed

# Clear squads (development only)
npm run clear:squads
```

### Key Files

| Purpose | File |
|---------|------|
| Database Schema | `prisma/schema.prisma` |
| Auth Config | `app/lib/auth.js` |
| Permissions | `app/lib/permissions.js` |
| Logging | `lib/logging.js` |
| Email | `app/lib/email.js` |
| Notifications | `app/lib/notifications.js` |
| Cities Data | `app/lib/cities.js` |

### Admin Credentials

After deployment, create an admin user:
1. Register normally at `/register`
2. Use database or Prisma Studio to set `role: "ADMIN"`

---

## Contact & Support

For issues or questions:
- GitHub: https://github.com/anthropics/claude-code/issues
- Documentation: This file and `/docs` folder

---

*Document generated for MVP launch preparation. Keep this updated as the platform evolves.*
