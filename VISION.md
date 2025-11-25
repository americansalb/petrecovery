# PetRecovery.org — Vision & Roadmap

## Executive Summary

PetRecovery.org aims to revolutionize lost pet recovery by combining organized volunteer rescue squads with real-time coordination technology. Unlike passive alert systems (PawBoost, HomeAgain), we provide active, coordinated search operations with gamification, progression, and community building.

**Target: 75% reunion rate vs industry average of ~50%**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         PetRecovery.org                         │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (Next.js 14)                                          │
│  ├── Public Pages (/cases, /cases/report, /cases/[caseNumber]) │
│  ├── Dashboard (/dashboard)                                     │
│  ├── Admin Portal (/admin/*)                                    │
│  └── Rescue Squad UI (/rescue-squads/*)                        │
├─────────────────────────────────────────────────────────────────┤
│  API Layer (/api/*)                                             │
│  ├── Public APIs (/api/public/*)                               │
│  ├── Authenticated APIs (/api/cases/*, /api/rescue-squads/*)   │
│  └── Admin APIs (/api/admin/*)                                 │
├─────────────────────────────────────────────────────────────────┤
│  Core Services (lib/)                                           │
│  ├── auth.js - NextAuth configuration                          │
│  ├── permissions.js - Role-based access control                │
│  ├── notifications.js - Email & alert system                   │
│  ├── email.js - SMTP transport                                 │
│  └── logging.js - Structured event logging                     │
├─────────────────────────────────────────────────────────────────┤
│  Database (PostgreSQL via Prisma)                               │
│  ├── Users (roles: USER, PATROL, MODERATOR, ADMIN)             │
│  ├── Cases (lost/found pet reports)                            │
│  ├── RescueSquads (volunteer teams)                            │
│  └── Supporting models (assignments, sightings, etc.)          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 108-Phase Roadmap

The full roadmap is organized into logical groupings. This document tracks the high-level phases; detailed task breakdowns live in `/docs/*.md`.

### Phases 0–14: Foundation (COMPLETE)

| Phase | Name | Status |
|-------|------|--------|
| 0 | Project Setup & Prisma Schema | COMPLETE |
| 1 | User Authentication (NextAuth) | COMPLETE |
| 2 | Pet Registration | COMPLETE |
| 3 | Lost Pet Reporting | COMPLETE |
| 4 | Found Pet Reporting | COMPLETE |
| 5 | Dashboard (Owner/Patrol Views) | COMPLETE |
| 6 | Patrol System | COMPLETE |
| 7 | Rescue Squad Model | COMPLETE |
| 8 | Squad Formation APIs | COMPLETE |
| 9 | Case Assignment System | COMPLETE |
| 10 | Squad Coordination (Chat, Search Areas) | COMPLETE |
| 11 | Sighting System | COMPLETE |
| 12 | Gamification (Levels, Stats) | COMPLETE |
| 13 | Division System | COMPLETE |
| 14 | Admin Squad Management | COMPLETE |

### Phases 15–16: Public Lost Pet Case Portal MVP (IN PROGRESS)

**Status:** IN PROGRESS
**Spec:** [docs/features/public-lost-pet-portal-mvp.md](docs/features/public-lost-pet-portal-mvp.md)
**Tasks:** [docs/PUBLIC_CASE_PORTAL_TASKS.md](docs/PUBLIC_CASE_PORTAL_TASKS.md)

**Summary:**
- Public-facing pages for viewing lost pet cases without authentication
- Public case reporting form for non-registered users
- Privacy controls (isPublic flag, publicContactOk)
- SEO-optimized case pages for social sharing

**Key Deliverables:**
- `GET /api/public/cases` — List public cases
- `GET /api/public/cases/[caseNumber]` — Public case detail
- `POST /api/public/cases` — Submit public report (creates case + user)
- `/cases` — Public case listing page
- `/cases/[caseNumber]` — Public case detail page
- `/cases/report` — Public reporting form

### Phases 17–21: Reserved

| Phase | Name | Status |
|-------|------|--------|
| 17 | Push Notifications | TODO |
| 18 | SMS Alerts | TODO |
| 19 | Meta Ads Integration | TODO |
| 20 | Social Sharing | TODO |
| 21 | Analytics Dashboard | TODO |

### Phases 22–24: Roles, Permissions & Case Assignment MVP (IN PROGRESS)

**Status:** IN PROGRESS
**Spec:** [docs/features/roles-and-assignment-mvp.md](docs/features/roles-and-assignment-mvp.md)
**Tasks:** [docs/ROLES_AND_ASSIGNMENT_TASKS.md](docs/ROLES_AND_ASSIGNMENT_TASKS.md)

**Summary:**
- Formalize the USER/PATROL/MODERATOR/ADMIN role hierarchy
- Permission helper module with requireAdmin/requireStaffOrAdmin
- Case coordinator assignment (individual user responsible for case)
- Squad assignment to cases (which squad is working the case)
- Admin UI for managing assignments

**Key Deliverables:**
- `lib/permissions.js` — Role checks, PermissionError
- `POST /api/cases/[id]/assign-coordinator` — Assign coordinator
- `POST /api/cases/[id]/assign-squad` — Assign squad
- Admin case detail with assignment dropdowns
- `auth.permission_denied` logging events
- `case.assignment_changed` logging events

### Phases 25–26: Notifications MVP (IN PROGRESS)

**Status:** IN PROGRESS
**Spec:** [docs/features/notifications-mvp.md](docs/features/notifications-mvp.md)
**Tasks:** [docs/NOTIFICATIONS_TASKS.md](docs/NOTIFICATIONS_TASKS.md)

**Summary:**
- Notification helper module for standardized email sending
- Public report confirmation emails
- Admin alerts for new public reports
- Case status change notifications
- Non-blocking notification delivery (API succeeds even if email fails)

**Key Deliverables:**
- `lib/notifications.js` — Notification helper functions
- `sendCaseReportConfirmation(case)` — Email to reporter
- `sendAdminPublicReportAlert(case)` — Email to admins
- `sendCaseStatusUpdate(case, oldStatus, newStatus)` — Status change emails
- `notification.*` logging events

### Phases 27–50: Growth Features (TODO)

| Phase | Name | Status |
|-------|------|--------|
| 27–30 | Advanced Search & Filtering | TODO |
| 31–35 | Mobile App (React Native) | TODO |
| 36–40 | Shelter Integration | TODO |
| 41–45 | Microchip Registry | TODO |
| 46–50 | AI Pet Matching | TODO |

### Phases 51–75: Scale & Performance (TODO)

| Phase | Name | Status |
|-------|------|--------|
| 51–55 | Caching & CDN | TODO |
| 56–60 | Real-time WebSockets | TODO |
| 61–65 | Geographic Sharding | TODO |
| 66–70 | Load Testing & Optimization | TODO |
| 71–75 | Multi-region Deployment | TODO |

### Phases 76–100: Enterprise Features (TODO)

| Phase | Name | Status |
|-------|------|--------|
| 76–80 | White-label for Shelters | TODO |
| 81–85 | API Partnerships | TODO |
| 86–90 | Premium Features | TODO |
| 91–95 | Corporate Sponsorships | TODO |
| 96–100 | International Expansion | TODO |

### Phases 101–108: Polish & Launch (TODO)

| Phase | Name | Status |
|-------|------|--------|
| 101–104 | Security Audit | TODO |
| 105–106 | Performance Audit | TODO |
| 107 | Documentation | TODO |
| 108 | Public Launch | TODO |

---

## Role Hierarchy

```
ADMIN (full access)
  └── MODERATOR (manage cases, squads, divisions)
        └── PATROL (search operations, squad membership)
              └── USER (report pets, view dashboard)
```

See [docs/features/roles-and-assignment-mvp.md](docs/features/roles-and-assignment-mvp.md) for full permission matrix.

---

## Event Logging Categories

All significant actions are logged with structured events for observability:

| Category | Events |
|----------|--------|
| `auth.*` | `login`, `logout`, `register`, `permission_denied` |
| `case.*` | `created`, `updated`, `status_changed`, `assignment_changed` |
| `public_case.*` | `list_viewed`, `detail_viewed`, `report_attempted`, `report_submitted` |
| `notification.*` | `send_attempted`, `send_succeeded`, `send_failed` |
| `squad.*` | `created`, `joined`, `left`, `case_accepted` |

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# Auth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://petrecovery.org

# Email (SMTP)
EMAIL_SERVICE=gmail
EMAIL_USER=alerts@petrecovery.org
EMAIL_PASSWORD=...
EMAIL_FROM=PetRecovery <alerts@petrecovery.org>

# Admin Alerts
ADMIN_ALERT_EMAIL=admin@petrecovery.org
```

---

## Related Documentation

- [PROGRESS_SUMMARY.md](PROGRESS_SUMMARY.md) — Detailed implementation history
- [FEATURE_NOTES.md](FEATURE_NOTES.md) — Feature notes and known limitations
- [SCHEMA_REDESIGN.md](SCHEMA_REDESIGN.md) — Database schema documentation
- [docs/features/](docs/features/) — Feature specifications
- [docs/*.md](docs/) — Task breakdowns

---

*Last updated: 2025-11-25*
