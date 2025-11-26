<<<<<<< HEAD
# Feature Spec: Public Lost Pet Case Portal MVP (Phase 15–16)

**Status:** ✅ Fully Implemented
**Owner:** Product + Engineering
**Last Updated:** November 25, 2025
**Phase:** 15–16 (Public Lost Pet Case Portal)
=======
# Feature Spec: Public Lost Pet Case Portal MVP

**Phase:** 15–16
**Status:** IN PROGRESS
**Author:** Claude
**Date:** 2025-11-25
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz

---

## 0. Summary

<<<<<<< HEAD
We're building a **public-facing lost pet case portal** that enables the general public to:

- **Browse active lost pet cases** in their area without requiring an account.
- **View detailed information** about individual lost pets to help reunite them with owners.
- **Report a lost pet** through a simple form that creates a case for admin review.

This MVP transforms the existing internal `LostPetCase` system (Phase 13–14) into a **safe, read-only public portal** with a minimal entry mechanism for public reports. It maintains the platform's commitment to **legal compliance**, **observability**, and **data safety** while opening up the most valuable feature to the people who need it most.

**Key Principles:**

- **Safety first**: Only cases marked `isPublic = true` are visible to the public.
- **Privacy controls**: Contact information is only shown when `publicContactOk = true`.
- **Admin moderation**: Public reports start as `isPublic = false` and require admin approval.
- **Full observability**: All public interactions emit structured events visible in `/admin/health`.
- **No authentication required**: Public can browse and report without creating an account (MVP).

This phase builds directly on:
- **Phase 13–14**: Internal case management system
- **Phase 0**: Observability + legal baseline
- **Phase 20–21**: QA harness for testing

Future phases will add: owner accounts, public comments, geospatial maps, email notifications, and automated matching.
=======
The Public Lost Pet Case Portal allows anyone to view active lost pet cases and submit reports without requiring authentication. This increases visibility of lost pets and lowers the barrier for community members to help.
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz

---

## 1. Problem / Why

<<<<<<< HEAD
### Current State

After Phase 13–14, we have a **fully functional internal case management system** where admins and rescue squad members can:
- Create and track lost pet cases
- Update case status and add notes
- Associate cases with rescue squads

However:
- **The public cannot see any of this data**
- Pet owners must contact admins directly to report lost pets
- Community members cannot browse cases to help find lost pets
- The platform's most valuable feature is locked behind admin access

### Problems This Solves

1. **Visibility Gap**: Lost pet information is hidden from the people who could help most.
2. **Friction for Reporters**: No easy way for public to submit lost pet reports.
3. **Community Engagement**: No way for neighbors to check if they've seen a lost pet.
4. **Discovery**: Owners can't search for found pets that match their missing pet.

### Why MVP Now

- **Phase 13–14 foundation is solid**: Internal case system is fully built and tested.
- **Observability is in place**: We can monitor public usage patterns immediately.
- **QA harness exists**: We can test public endpoints without shell access.
- **Legal baseline is ready**: We can add public disclaimers easily.
- **High impact, low risk**: Read-only public access is safe; write access is gated.

### Non-Goals (For This MVP)

- ❌ Owner accounts or direct owner login
- ❌ Public comments or public notes on cases
- ❌ Geospatial map UI or radius-based search
- ❌ Email/SMS notifications to owners or finders
- ❌ Advanced matching algorithms (image recognition, ML)
- ❌ Public editing of existing cases
- ❌ Rate limiting on public report submissions (future phase)

---

## 2. Goals

### Functional Goals

1. **Public Case Discovery**
   - Public can view a list of active lost pet cases
   - Filter by city, state, species, status
   - No authentication required
   - Only shows cases where `isPublic = true`

2. **Public Case Detail View**
   - Public can view detailed information about a specific case
   - Access via shareable URL: `/cases/{caseNumber}`
   - Shows pet info, location, status, and notes (if any)
   - Contact information only shown if `publicContactOk = true`

3. **Public Report Lost Pet**
   - Simple form for pet owners to submit a lost pet report
   - Creates case with `source = "PUBLIC_REPORT"` and `isPublic = false`
   - Admin review required before case becomes public
   - No authentication required (MVP)

4. **Admin Control**
   - Admins can toggle `isPublic` flag on any case
   - Admins can toggle `publicContactOk` flag to control contact visibility
   - Admins can see `source` field to distinguish PUBLIC_REPORT vs ADMIN cases

### Non-Functional Goals

1. **Observability**
   - All public API calls emit structured events
   - New event types: `public_case.*`
   - Events visible in `/admin/health` for monitoring

2. **Safety & Privacy**
   - No sensitive admin-only data exposed to public
   - Contact info only shown with explicit consent
   - Legal disclaimers on all public pages

3. **Performance**
   - Public list queries are indexed and fast
   - Case detail pages load quickly
   - No N+1 queries

4. **Testing**
   - Public endpoints tested via `/admin/qa` harness
   - Generator tools can create public test cases
=======
**Current State:**
- Lost pet cases are only visible to authenticated users
- Reporting a lost pet requires creating an account first
- Social sharing links don't work for non-logged-in viewers
- SEO/search engines can't index lost pet pages

**Impact:**
- Reduced visibility = fewer eyes on lost pets
- Friction in reporting = delayed reports
- Missing viral potential from social shares

**Goal:**
Enable public access to increase reach and reduce time-to-reunion.

---

## 2. Goals / Non-goals

### Goals
- Allow public viewing of lost pet cases (list and detail)
- Allow public submission of lost pet reports (creates user + case)
- Respect privacy controls (reporter can opt-out of public visibility)
- Enable SEO indexing of public case pages
- Support social sharing with Open Graph meta tags

### Non-goals
- Public comments/updates on cases (requires auth)
- Public access to found pet reports (privacy concerns)
- Real-time case updates without refresh
- Advanced search/filtering on public pages (Phase 27+)
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz

---

## 3. User Stories

<<<<<<< HEAD
### Visitor Stories

**Story 1: Browse Lost Pets**
- As a **community member**, I want to **view a list of lost pets in my area** so that I can **help reunite them with their owners if I see them**.
- Acceptance: Public list page shows active cases with filters for city, state, species

**Story 2: View Case Details**
- As a **potential finder**, I want to **see detailed information about a specific lost pet** so that I can **confirm if the pet I found matches the description**.
- Acceptance: Public detail page shows pet info, location, status, and contact (if allowed)

**Story 3: Share Case Link**
- As a **pet owner**, I want to **share a direct link to my lost pet's case** so that **friends and neighbors can help spread the word**.
- Acceptance: Case detail URL is shareable and works without authentication

### Reporter Stories

**Story 4: Report Lost Pet**
- As a **pet owner**, I want to **report my lost pet online** so that **rescue squads can start helping immediately**.
- Acceptance: Public form creates case with source = PUBLIC_REPORT, shows confirmation

**Story 5: Submit Without Account**
- As a **distressed pet owner**, I want to **report my lost pet without creating an account** so that I can **get help as quickly as possible**.
- Acceptance: Report form works without authentication (MVP)

### Admin Stories

**Story 6: Review Public Reports**
- As an **admin**, I want to **see which cases came from public reports** so that I can **review and approve them for publication**.
- Acceptance: Admin list shows `source` field, can filter by PUBLIC_REPORT

**Story 7: Control Public Visibility**
- As an **admin**, I want to **toggle whether a case is visible to the public** so that I can **protect sensitive or incomplete cases**.
- Acceptance: Admin can set `isPublic` flag on any case

**Story 8: Control Contact Visibility**
- As an **admin**, I want to **control whether contact info is shown publicly** so that **owners' privacy is protected**.
- Acceptance: Admin can set `publicContactOk` flag independently of `isPublic`
=======
### US-P01: View Public Cases
**As a** community member (not logged in),
**I want to** see a list of lost pets in my area,
**So that** I can help keep an eye out while going about my day.

### US-P02: View Case Details
**As a** community member (not logged in),
**I want to** see full details of a lost pet case,
**So that** I can identify the pet if I see it.

### US-P03: Report Lost Pet (Public)
**As a** pet owner without an account,
**I want to** quickly report my lost pet,
**So that** the community can start looking immediately.

### US-P04: Control Visibility
**As a** pet owner,
**I want to** control whether my case is publicly visible,
**So that** I can protect my privacy if needed.

### US-P05: Share Case
**As a** community member,
**I want to** share a lost pet case on social media,
**So that** more people see it.
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz

---

## 4. Data Model

<<<<<<< HEAD
### Prisma Schema Changes

Extend the existing `LostPetCase` model with three new fields:

```prisma
model LostPetCase {
  // ... existing fields from Phase 13-14 ...

  // NEW: Public visibility flags
  isPublic        Boolean  @default(false)
  publicContactOk Boolean  @default(false)
  source          String   @default("ADMIN")  // Values: "ADMIN", "PUBLIC_REPORT"

  // ... existing relations ...
}
```

### Field Descriptions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `isPublic` | Boolean | `false` | Whether this case is visible on public pages. Admins must explicitly set to `true`. |
| `publicContactOk` | Boolean | `false` | Whether to show `contactName`, `contactPhone`, `contactEmail` on public detail page. |
| `source` | String | `"ADMIN"` | How the case was created: `"ADMIN"` (created via admin UI) or `"PUBLIC_REPORT"` (submitted via public form). |

### Migration Strategy

- Add new fields to existing `LostPetCase` table
- All existing cases default to `isPublic = false` (safe default)
- No breaking changes to existing Phase 13–14 functionality
- Migration is reversible (can drop columns if needed)

---

## 5. API Endpoints

### 5.1 GET /api/public/cases

**Purpose:** List public lost pet cases with filtering
=======
### Schema Changes

Add to `Case` model in `prisma/schema.prisma`:

```prisma
model Case {
  // ... existing fields ...

  // Public Visibility
  isPublic          Boolean  @default(true)   // Show on public listing
  publicContactOk   Boolean  @default(true)   // Allow public contact form
  publicPhoneVisible Boolean @default(false)  // Show phone on public page
  publicEmailVisible Boolean @default(false)  // Show email on public page
}
```

### Field Semantics

| Field | Default | Description |
|-------|---------|-------------|
| `isPublic` | true | Case appears in public listing and is accessible by URL |
| `publicContactOk` | true | Shows "Contact Owner" form on public detail page |
| `publicPhoneVisible` | false | Phone number shown on public page (opt-in) |
| `publicEmailVisible` | false | Email shown on public page (opt-in) |

---

## 5. API Design

### GET /api/public/cases

List public cases with basic filtering.
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz

**Authentication:** None required

**Query Parameters:**
<<<<<<< HEAD
- `city` (optional): Filter by city name
- `state` (optional): Filter by state code (e.g., "TX")
- `status` (optional): Filter by `LostPetCaseStatus` enum
- `species` (optional): Filter by `PetSpecies` enum
- `limit` (optional, default: 20, max: 100): Number of results per page
- `page` (optional, default: 1): Page number for pagination

**Response (200 OK):**
=======
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `city` | string | - | Filter by city name |
| `state` | string | - | Filter by state (2-letter) |
| `species` | string | - | Filter by pet species |
| `status` | string | ACTIVE | Case status filter |
| `limit` | number | 20 | Results per page (max 50) |
| `offset` | number | 0 | Pagination offset |

**Response:**
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz
```json
{
  "cases": [
    {
<<<<<<< HEAD
      "id": "cuid123",
      "caseNumber": "AUS-2025-0042",
      "petName": "Buddy",
      "petSpecies": "DOG",
      "petBreed": "Golden Retriever",
      "petColor": "Golden",
      "city": "Austin",
      "state": "TX",
      "status": "ACTIVE_SEARCH",
      "lastSeenAt": "2025-11-20T14:30:00Z",
      "lastSeenLandmark": "Zilker Park",
      "createdAt": "2025-11-20T15:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "pages": 3
  }
}
```

**Logging:**
- Event: `public_case.list_viewed`
- Metadata: `{ city, state, status, species, results_count }`

**Security:**
- Only returns cases where `isPublic = true`
- Does NOT return: `contactName`, `contactPhone`, `contactEmail`, `createdById`, `squadId`, internal notes

---

### 5.2 GET /api/public/cases/[caseNumber]

**Purpose:** Get detailed information about a specific public case

**Authentication:** None required

**Path Parameters:**
- `caseNumber`: Case number (e.g., "AUS-2025-0042")

**Response (200 OK):**
```json
{
  "case": {
    "id": "cuid123",
    "caseNumber": "AUS-2025-0042",
    "petName": "Buddy",
    "petSpecies": "DOG",
    "petBreed": "Golden Retriever",
    "petColor": "Golden",
    "petDescription": "Friendly golden retriever, wearing blue collar",
    "city": "Austin",
    "state": "TX",
    "zipCode": "78701",
    "lastSeenAt": "2025-11-20T14:30:00Z",
    "lastSeenLandmark": "Zilker Park, near the playground",
    "status": "ACTIVE_SEARCH",
    "isUrgent": true,
    "createdAt": "2025-11-20T15:00:00Z",
    "updatedAt": "2025-11-21T10:00:00Z",

    // Only if publicContactOk = true
    "contactName": "Jane Doe",
    "contactPhone": "512-555-1234",
    "contactEmail": "jane@example.com"
  }
}
```

**Response (404 Not Found):**
```json
{
  "error": "Case not found or not public",
  "code": "CASE_NOT_FOUND"
}
```

**Logging:**
- Event: `public_case.detail_viewed`
- Metadata: `{ case_number, case_id, has_contact_info }`

**Security:**
- Only returns case if `isPublic = true`
- Contact fields only included if `publicContactOk = true`
- Does NOT return: `createdById`, `squadId`, `source`, detailed notes

---

### 5.3 POST /api/public/cases/report

**Purpose:** Submit a lost pet report from the public

**Authentication:** None required (MVP)
=======
      "caseNumber": "CHI-2024-001847",
      "petName": "Max",
      "petSpecies": "DOG",
      "petBreed": "Golden Retriever",
      "petColor": "Golden",
      "petPhotoUrl": "https://...",
      "lastSeenAddress": "Lincoln Park, Chicago IL",
      "lastSeenAt": "2024-11-20T14:30:00Z",
      "status": "ACTIVE",
      "hasReward": true,
      "createdAt": "2024-11-20T15:00:00Z"
    }
  ],
  "total": 142,
  "limit": 20,
  "offset": 0
}
```

**Events:**
- `public_case.list_viewed` on success

---

### GET /api/public/cases/[caseNumber]

Get public case details.

**Authentication:** None required

**Response (200):**
```json
{
  "caseNumber": "CHI-2024-001847",
  "petName": "Max",
  "petSpecies": "DOG",
  "petBreed": "Golden Retriever",
  "petColor": "Golden",
  "petSize": "LARGE",
  "petPhotoUrl": "https://...",
  "petDescription": "Friendly golden retriever, 4 years old...",
  "lastSeenAt": "2024-11-20T14:30:00Z",
  "lastSeenAddress": "Lincoln Park near North Pond",
  "lastSeenLatitude": 41.9225,
  "lastSeenLongitude": -87.6372,
  "escapeScenario": "Slipped out of backyard gate",
  "status": "ACTIVE",
  "hasReward": true,
  "rewardAmount": 500,
  "publicContactOk": true,
  "ownerFirstName": "John",
  "ownerPhone": null,  // Only if publicPhoneVisible
  "ownerEmail": null,  // Only if publicEmailVisible
  "createdAt": "2024-11-20T15:00:00Z",
  "sightings": [
    {
      "address": "Diversey Harbor",
      "sightedAt": "2024-11-21T08:00:00Z",
      "certaintyLevel": 4
    }
  ]
}
```

**Response (404):**
```json
{
  "error": "Case not found or not public"
}
```

**Events:**
- `public_case.detail_viewed` on success

---

### POST /api/public/cases

Submit a public lost pet report.

**Authentication:** None required
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz

**Request Body:**
```json
{
<<<<<<< HEAD
  "petName": "Buddy",
  "petSpecies": "DOG",
  "petBreed": "Golden Retriever",
  "petColor": "Golden",
  "petDescription": "Friendly golden retriever, wearing blue collar with tags",
  "city": "Austin",
  "state": "TX",
  "zipCode": "78701",
  "lastSeenAt": "2025-11-20T14:30:00Z",
  "lastSeenLandmark": "Zilker Park, near the playground",
  "contactName": "Jane Doe",
  "contactPhone": "512-555-1234",
  "contactEmail": "jane@example.com"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Your lost pet report has been submitted for review. You will be contacted by our team within 24 hours.",
  "caseNumber": "AUS-2025-0043",
  "caseId": "cuid456"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Invalid input",
  "code": "VALIDATION_ERROR",
  "details": {
    "petSpecies": "Must be one of: DOG, CAT, BIRD, OTHER",
    "city": "City is required"
=======
  "reporter": {
    "email": "owner@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "312-555-1234"
  },
  "pet": {
    "name": "Max",
    "species": "DOG",
    "breed": "Golden Retriever",
    "color": "Golden",
    "size": "LARGE",
    "photoUrl": "https://...",
    "description": "Friendly golden retriever..."
  },
  "incident": {
    "lastSeenAt": "2024-11-20T14:30:00Z",
    "lastSeenAddress": "123 Main St, Chicago IL 60614",
    "lastSeenLatitude": 41.9225,
    "lastSeenLongitude": -87.6372,
    "escapeScenario": "Slipped out of backyard gate",
    "escapeDetails": "Gate was left open by delivery person"
  },
  "visibility": {
    "isPublic": true,
    "publicContactOk": true,
    "publicPhoneVisible": false,
    "publicEmailVisible": false
  },
  "reward": {
    "hasReward": true,
    "rewardAmount": 500
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz
  }
}
```

<<<<<<< HEAD
**Logging:**
- Success: `public_case.report_submitted`
- Failure: `public_case.report_failed`
- Metadata: `{ case_number, city, state, species, has_contact_info }`

**Behavior:**
- Creates `LostPetCase` with:
  - `source = "PUBLIC_REPORT"`
  - `isPublic = false` (requires admin approval)
  - `publicContactOk = false` (default)
  - `status = OPEN`
  - `createdById = null` (no user account yet)
- Generates case number using existing logic
- Validates all required fields
- Does NOT require waiver acceptance (public doesn't have accounts yet)

**Future:**
- Add rate limiting (IP-based, session-based)
- Add CAPTCHA for bot protection
- Add email confirmation to reporter

---

## 6. UI / UX

### 6.1 Public Case List Page (`/cases`)

**Route:** `/cases`
**Access:** Public (no auth required)

**Layout:**

```
┌─────────────────────────────────────────────────┐
│ Navigation Bar (Home, Browse Cases, Report)     │
├─────────────────────────────────────────────────┤
│                                                 │
│  🐾 Find Lost Pets Near You                     │
│  Help reunite lost pets with their families     │
│                                                 │
│  ┌───────┬───────┬──────────┬────────┐          │
│  │ City  │ State │ Species  │ Status │  Search │
│  └───────┴───────┴──────────┴────────┘          │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ 🐕 Buddy - Golden Retriever             │   │
│  │ Austin, TX • Active Search • 2 days ago │   │
│  │ Last seen: Zilker Park                  │   │
│  │ [View Details]                          │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ 🐱 Whiskers - Tabby Cat                 │   │
│  │ Seattle, WA • Open • 1 week ago         │   │
│  │ Last seen: Capitol Hill                 │   │
│  │ [View Details]                          │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  < 1 2 3 > (Pagination)                        │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Features:**
- **Hero section** with clear call-to-action
- **Filter bar** with city, state, species, status dropdowns
- **Case cards** showing key info at a glance
- **Status pills** color-coded (OPEN=yellow, ACTIVE_SEARCH=orange, RESOLVED=green)
- **Pagination** for browsing multiple pages
- **Empty state** when no cases match filters

**Technical:**
- Calls `GET /api/public/cases` with query params
- Client-side filtering updates URL params
- Case cards link to `/cases/[caseNumber]`

---

### 6.2 Public Case Detail Page (`/cases/[caseNumber]`)

**Route:** `/cases/AUS-2025-0042`
**Access:** Public (no auth required)

**Layout:**

```
┌─────────────────────────────────────────────────┐
│ Navigation Bar                                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  ← Back to Cases                                │
│                                                 │
│  🐕 Buddy                                       │
│  Case #AUS-2025-0042 • Active Search           │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Pet Information                         │   │
│  │ Species: Dog                            │   │
│  │ Breed: Golden Retriever                 │   │
│  │ Color: Golden                           │   │
│  │ Description: Friendly golden retriever, │   │
│  │ wearing blue collar with tags           │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Last Seen                               │   │
│  │ Date: Nov 20, 2025 at 2:30 PM           │   │
│  │ Location: Austin, TX 78701              │   │
│  │ Landmark: Zilker Park, near playground  │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Contact Information (if publicContactOk)│   │
│  │ Name: Jane Doe                          │   │
│  │ Phone: 512-555-1234                     │   │
│  │ Email: jane@example.com                 │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ⚠️ Disclaimer: This is a community service.   │
│  Please contact the owner directly if you      │
│  have information. Do not attempt to capture   │
│  the pet yourself if it appears dangerous.     │
│                                                 │
│  [Share This Case]                             │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Features:**
- **Clear case header** with pet name, case number, status
- **Pet information section** with all known details
- **Last seen section** with location and landmark
- **Contact section** (only if `publicContactOk = true`)
- **Legal disclaimer** about community service
- **Share button** to copy URL to clipboard
- **404 page** if case not found or not public

**Technical:**
- Calls `GET /api/public/cases/[caseNumber]`
- Conditionally renders contact section based on API response
- Static page (could be pre-rendered for SEO in future)

---

### 6.3 Public Report Form (`/cases/report`)

**Route:** `/cases/report`
**Access:** Public (no auth required)

**Layout:**

```
┌─────────────────────────────────────────────────┐
│ Navigation Bar                                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  📝 Report a Lost Pet                           │
│  Our volunteer network will help you search     │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Pet Information                         │   │
│  │ Pet Name: [___________]                 │   │
│  │ Species: [DOG ▼]                        │   │
│  │ Breed: [___________]                    │   │
│  │ Color: [___________]                    │   │
│  │ Description: [__________________]       │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Last Seen                               │   │
│  │ City: [___________]                     │   │
│  │ State: [TX ▼]                           │   │
│  │ ZIP Code: [_____]                       │   │
│  │ Date/Time: [2025-11-20 14:30]           │   │
│  │ Landmark: [__________________]          │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Contact Information                     │   │
│  │ Your Name: [___________]                │   │
│  │ Phone: [___________]                    │   │
│  │ Email: [___________]                    │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ☑ I understand that my report will be         │
│    reviewed by volunteers and that my          │
│    contact information may be shared with      │
│    rescue squads to help find my pet.          │
│                                                 │
│  [Submit Report]                               │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Success State:**

```
┌─────────────────────────────────────────────────┐
│  ✅ Report Submitted Successfully!              │
│                                                 │
│  Your case number is: AUS-2025-0043            │
│                                                 │
│  What happens next:                            │
│  1. Our volunteer team will review your report │
│  2. You'll be contacted within 24 hours        │
│  3. Your case will be visible to rescue squads │
│                                                 │
│  [View Your Case] [Report Another Pet]         │
└─────────────────────────────────────────────────┘
```

**Features:**
- **Multi-section form** (Pet Info, Location, Contact)
- **Required field indicators** (*)
- **Validation on submit** with clear error messages
- **Checkbox disclaimer** about volunteer review
- **Success state** with case number and next steps
- **"Report Another Pet" link** for multiple pets

**Technical:**
- Posts to `/api/public/cases/report`
- Client-side validation before submit
- Shows loading state during submission
- Displays success message with case number
- Handles errors gracefully with user-friendly messages

=======
**Response (201):**
```json
{
  "success": true,
  "caseNumber": "CHI-2024-001848",
  "message": "Your lost pet report has been submitted. Check your email for confirmation."
}
```

**Response (400):**
```json
{
  "error": "Validation failed",
  "details": {
    "reporter.email": "Valid email required",
    "pet.name": "Pet name required"
  }
}
```

**Behavior:**
1. Validate all required fields
2. Check if user exists by email
   - If exists: Use existing user as reporter
   - If not: Create new user with USER role (no password)
3. Generate case number (format: `{CITY_CODE}-{YEAR}-{SEQUENCE}`)
4. Create Case record with public visibility settings
5. Send confirmation email (non-blocking)
6. Send admin alert email (non-blocking)

**Events:**
- `public_case.report_attempted` when request received
- `public_case.report_submitted` on success
- `public_case.report_failed` on validation/error

---

## 6. UI/UX

### /cases — Public Case Listing

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  [Logo]  Lost Pets Near You          [Report Lost]  │
├─────────────────────────────────────────────────────┤
│  Filters: [City ▼] [Species ▼] [Status ▼]          │
├─────────────────────────────────────────────────────┤
│  ┌─────┐ Max - Golden Retriever                    │
│  │photo│ Lost near Lincoln Park, Chicago           │
│  └─────┘ Nov 20 • ACTIVE • $500 Reward  [View →]   │
├─────────────────────────────────────────────────────┤
│  ┌─────┐ Whiskers - Tabby Cat                      │
│  │photo│ Lost near Wicker Park, Chicago            │
│  └─────┘ Nov 19 • ACTIVE               [View →]    │
├─────────────────────────────────────────────────────┤
│                  [Load More]                        │
└─────────────────────────────────────────────────────┘
```

**Features:**
- Responsive grid/list view
- Filter by city, species, status
- Sort by date (newest first)
- Infinite scroll or pagination
- "Report Lost Pet" CTA prominently placed

---

### /cases/[caseNumber] — Public Case Detail

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  ← Back to Lost Pets                   [Share 📤]  │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐  Case #CHI-2024-001847            │
│  │             │  MAX                               │
│  │   [Photo]   │  Golden Retriever • Large • Male  │
│  │             │  Golden color                      │
│  └─────────────┘                                   │
├─────────────────────────────────────────────────────┤
│  📍 Last Seen                                       │
│  Lincoln Park near North Pond                       │
│  November 20, 2024 at 2:30 PM                      │
│  [Interactive Map]                                  │
├─────────────────────────────────────────────────────┤
│  📝 Description                                     │
│  Friendly golden retriever, 4 years old.           │
│  Wearing blue collar with tags.                    │
├─────────────────────────────────────────────────────┤
│  🚪 How They Got Out                               │
│  Slipped out of backyard gate                      │
├─────────────────────────────────────────────────────┤
│  💰 REWARD: $500                                   │
├─────────────────────────────────────────────────────┤
│  📞 Contact Owner                                   │
│  ┌─────────────────────────────────────────────┐   │
│  │ Your Name: [______________]                 │   │
│  │ Your Email: [______________]                │   │
│  │ Message: [________________]                 │   │
│  │           [Send Message]                    │   │
│  └─────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  👁️ Recent Sightings (2)                          │
│  • Diversey Harbor - Nov 21, 8:00 AM (Likely)     │
│  • Oz Park - Nov 21, 6:00 PM (Possible)           │
└─────────────────────────────────────────────────────┘
```

**SEO/Meta Tags:**
```html
<title>LOST: Max the Golden Retriever - Chicago, IL | PetRecovery</title>
<meta name="description" content="Lost golden retriever named Max. Last seen near Lincoln Park, Chicago on Nov 20. $500 reward. Help bring Max home!">
<meta property="og:title" content="LOST: Max the Golden Retriever">
<meta property="og:description" content="Last seen near Lincoln Park, Chicago. $500 reward.">
<meta property="og:image" content="https://petrecovery.org/photos/max.jpg">
```

---

### /cases/report — Public Report Form

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Report a Lost Pet                                  │
│  We'll help spread the word immediately            │
├─────────────────────────────────────────────────────┤
│  Your Information                                   │
│  Email*: [_______________________]                 │
│  First Name*: [__________________]                 │
│  Last Name: [____________________]                 │
│  Phone: [________________________]                 │
├─────────────────────────────────────────────────────┤
│  Pet Information                                    │
│  Name*: [________________________]                 │
│  Species*: [Dog ▼]                                 │
│  Breed: [________________________]                 │
│  Color*: [_______________________]                 │
│  Size*: [Medium ▼]                                 │
│  Photo*: [Upload Photo 📷]                         │
│  Description: [__________________]                 │
├─────────────────────────────────────────────────────┤
│  Where & When                                       │
│  Last Seen Date*: [📅 Nov 20, 2024]               │
│  Last Seen Time*: [🕐 2:30 PM]                    │
│  Address*: [_____________________]                 │
│  [Interactive Map - Click to Mark Location]        │
│  How did they get out?*: [_______]                │
│  Additional details: [___________]                │
├─────────────────────────────────────────────────────┤
│  Privacy & Reward                                   │
│  ☑️ Make this case publicly visible                │
│  ☑️ Allow people to contact me                     │
│  ☐ Show my phone number publicly                   │
│  ☐ Show my email publicly                          │
│  ☐ Offering a reward                               │
│     Amount: [$_______]                             │
├─────────────────────────────────────────────────────┤
│            [Submit Report →]                        │
│  By submitting, you agree to our Terms of Service  │
└─────────────────────────────────────────────────────┘
```

>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz
---

## 7. Logging & Observability

### Event Types

<<<<<<< HEAD
All public case interactions emit structured events via `logEvent()`:

| Event Type | Trigger | Result | Metadata |
|------------|---------|--------|----------|
| `public_case.list_viewed` | GET /api/public/cases succeeds | `success` | `{ city, state, status, species, results_count }` |
| `public_case.list_failed` | GET /api/public/cases fails | `failure` | `{ error_code, error_message }` |
| `public_case.detail_viewed` | GET /api/public/cases/[caseNumber] succeeds | `success` | `{ case_number, case_id, has_contact_info }` |
| `public_case.detail_failed` | GET /api/public/cases/[caseNumber] fails | `failure` | `{ case_number, error_code }` |
| `public_case.report_attempted` | POST /api/public/cases/report starts | `pending` | `{ city, state, species }` |
| `public_case.report_submitted` | POST /api/public/cases/report succeeds | `success` | `{ case_number, case_id, city, state, species }` |
| `public_case.report_failed` | POST /api/public/cases/report fails | `failure` | `{ error_code, error_message, validation_errors }` |

### Admin Health Integration

Update `ERROR_IMPACT` mapping in `/admin/health`:

```javascript
const ERROR_IMPACT = {
  // ... existing mappings ...

  // Medium severity - public-facing features
  'public_case.list_failed': { label: 'Public Case List', severity: 'medium' },
  'public_case.detail_failed': { label: 'Public Case Detail', severity: 'medium' },
  'public_case.report_failed': { label: 'Public Reports', severity: 'medium' },

  // Low severity - successful public interactions
  'public_case.list_viewed': { label: 'Public Browse', severity: 'low' },
  'public_case.detail_viewed': { label: 'Public Views', severity: 'low' },
  'public_case.report_submitted': { label: 'Public Reports', severity: 'low' },
};
```

### Metrics

Add to `/api/admin/health/metrics`:

```json
{
  "public_cases_visible": 12,  // Count of isPublic=true cases
  "public_reports_pending": 5,  // Count of source=PUBLIC_REPORT, isPublic=false
  "public_views_last_24h": 143  // Count of detail_viewed events
=======
| Event | Trigger | Data |
|-------|---------|------|
| `public_case.list_viewed` | GET /api/public/cases | filters, result_count, ip |
| `public_case.detail_viewed` | GET /api/public/cases/[id] | caseNumber, ip, referrer |
| `public_case.report_attempted` | POST /api/public/cases started | email (hashed), ip |
| `public_case.report_submitted` | Report created successfully | caseNumber, city, species |
| `public_case.report_failed` | Validation or server error | error_type, validation_errors |

### Logging Implementation

```javascript
// lib/logging.js
export function logEvent(event, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...data,
  };
  console.log(JSON.stringify(entry));
  // Future: send to log aggregator
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz
}
```

---

<<<<<<< HEAD
## 8. Legal & Privacy Considerations

### Static Disclaimers

All public pages include static disclaimers:

**On `/cases` List Page:**
> **Community Service Notice:** This is a volunteer-run service. We cannot guarantee the accuracy of information posted. Please exercise caution when contacting pet owners or handling found animals.

**On `/cases/[caseNumber]` Detail Page:**
> **Privacy Notice:** Contact information is provided with the owner's consent. Please respect their privacy and only contact them if you have relevant information about their lost pet.
>
> **Safety Notice:** If you find a lost pet, do not attempt to capture it yourself if it appears injured, sick, or dangerous. Contact your local animal control or rescue squad for assistance.

**On `/cases/report` Form:**
> **By submitting this report, you acknowledge that:**
> - Your information will be reviewed by volunteer staff
> - Your contact information may be shared with rescue squads
> - Your case may be published publicly to help find your pet
> - This service is provided as-is with no guarantees
> - You agree to our Terms of Service and Privacy Policy

### Future Legal Gating

For future phases, we can add:
- Checkbox: "I agree to the Lost Pet Posting Terms"
- Require acceptance before showing contact info
- Track acceptance in `LegalAcceptance` table
- Full waiver flow for public reporters who want accounts

For MVP, static disclaimers are sufficient.

---

## 9. Testing Strategy

### Manual Testing (Browser)

1. **Public List Page:**
   - [ ] Navigate to `/cases` without logging in
   - [ ] Verify only isPublic=true cases appear
   - [ ] Test filters: city, state, species, status
   - [ ] Verify pagination works correctly
   - [ ] Check empty state when no results

2. **Public Detail Page:**
   - [ ] Navigate to `/cases/[caseNumber]` for public case
   - [ ] Verify all pet information displays correctly
   - [ ] Verify contact info shows only if publicContactOk=true
   - [ ] Try accessing non-public case (should 404)
   - [ ] Verify disclaimer text appears

3. **Public Report Form:**
   - [ ] Navigate to `/cases/report`
   - [ ] Submit with missing required fields (should validate)
   - [ ] Submit with valid data (should succeed)
   - [ ] Verify case created with isPublic=false
   - [ ] Verify success message shows case number

### QA Harness Tests (Phase 20-21 Integration)

Add to `/admin/qa` test suite:

**Public Case Tests:**
- Test 1: Public list returns only isPublic cases
- Test 2: Public detail shows contact info when allowed
- Test 3: Public detail returns 404 for non-public cases
- Test 4: Public report creates case with correct source

### Data Generators

Update `/admin/qa` generators:

- **Public Case Generator:**
  - Creates N cases with `isPublic = true`
  - Random mix of publicContactOk values
  - Helps test public list/detail pages

---

## 10. Security Considerations

### Data Exposure

**Safe to expose publicly:**
- Pet name, species, breed, color, description
- City, state, ZIP code (general location)
- Last seen date/time, landmark (general area)
- Case number, status, created date

**NEVER expose publicly:**
- `createdById` (internal user IDs)
- `squadId` (internal rescue squad IDs)
- `source` field (implementation detail)
- Internal notes with type="SYSTEM_STATUS_CHANGE"
- Any admin-only metadata

**Conditional exposure (requires publicContactOk=true):**
- `contactName`
- `contactPhone`
- `contactEmail`

### Input Validation

All public report submissions must validate:
- Required fields: city, state, petSpecies, contactName, contactEmail
- Enum validation: petSpecies must be valid PetSpecies value
- String length limits: prevent abuse (max 500 chars for description)
- Email format validation for contactEmail
- Phone format validation (basic) for contactPhone

### Rate Limiting (Future)

For future phases, add:
- IP-based rate limiting: 10 reports per IP per day
- Session-based rate limiting (cookie/fingerprint)
- CAPTCHA for form submission
- Honeypot fields to catch bots

---

## 11. Implementation Phases

This feature is broken into 6 sequential tasks:

1. **TASK-P01**: Prisma schema changes (add isPublic, publicContactOk, source)
2. **TASK-P02**: Public API endpoints (GET list, GET detail, POST report)
3. **TASK-P03**: Public list page UI (`/cases`)
4. **TASK-P04**: Public detail page UI (`/cases/[caseNumber]`)
5. **TASK-P05**: Public report form UI (`/cases/report`)
6. **TASK-P06**: QA integration, ERROR_IMPACT, documentation updates

Each task builds on the previous one and can be tested independently.

---

## 12. Acceptance Criteria

### Phase Complete When:

- [ ] Prisma schema updated with new fields
- [ ] Migration applied successfully
- [ ] All 3 public API endpoints implemented
- [ ] Public list page renders and filters work
- [ ] Public detail page renders with privacy controls
- [ ] Public report form creates cases correctly
- [ ] All public interactions emit structured events
- [ ] Events visible in `/admin/health` Errors tab
- [ ] ERROR_IMPACT updated with public_case.* events
- [ ] QA tests added for public endpoints
- [ ] Admin can toggle isPublic and publicContactOk flags
- [ ] Phase 15–16 marked COMPLETE in VISION.md
- [ ] No regressions to existing features

---

## 13. Future Enhancements (Post-MVP)

These are explicitly **out of scope** for Phase 15–16 but can be added later:

1. **Owner Accounts**
   - Let public reporters create accounts
   - Track report history
   - Enable direct case editing by owner

2. **Public Comments**
   - Allow sightings/tips from community
   - Moderation queue for spam

3. **Geospatial Search**
   - Map view of lost pets
   - Radius-based search
   - "Near me" functionality

4. **Email Notifications**
   - Notify owner when case is published
   - Notify owner of new sightings
   - Daily digest of new cases in area

5. **Advanced Matching**
   - Image recognition for found pets
   - ML-based matching suggestions
   - Alert owners when similar pet is found

6. **Social Sharing**
   - One-click share to Facebook, Twitter
   - Generate shareable image cards
   - QR codes for posters

7. **Rate Limiting & Abuse Prevention**
   - IP-based limits
   - CAPTCHA integration
   - Spam detection

---

**End of Feature Spec**
=======
## 8. Testing / QA

### Unit Tests

| Test | Description |
|------|-------------|
| `public-cases.list.test` | GET returns only isPublic=true cases |
| `public-cases.detail.test` | Returns 404 for non-public cases |
| `public-cases.submit.test` | Creates user + case on valid submission |
| `public-cases.validation.test` | Rejects invalid submissions with details |

### QA Harness Tests (/admin/qa)

Add to QA harness page:

```javascript
// Public Portal Tests
{
  name: 'Public case list loads',
  endpoint: '/api/public/cases',
  method: 'GET',
  expectedStatus: 200,
  validate: (res) => Array.isArray(res.cases)
},
{
  name: 'Public case detail returns case',
  endpoint: '/api/public/cases/TEST-2024-001',
  method: 'GET',
  expectedStatus: 200,
  validate: (res) => res.caseNumber === 'TEST-2024-001'
},
{
  name: 'Public report validates required fields',
  endpoint: '/api/public/cases',
  method: 'POST',
  body: {},
  expectedStatus: 400,
  validate: (res) => res.error === 'Validation failed'
}
```

### ERROR_IMPACT Entries (/admin/health)

| Event | Impact Level | Description |
|-------|--------------|-------------|
| `public_case.report_failed` | MEDIUM | Public user couldn't submit report |
| `public_case.list_viewed` (error) | LOW | Public listing unavailable |

---

## 9. Risks & Open Questions

### Risks

| Risk | Mitigation |
|------|------------|
| Spam submissions | Rate limiting by IP, email verification for follow-ups |
| Fake reports | Require photo, admin review queue |
| Privacy exposure | Default conservative (no phone/email visible) |
| SEO spam | noindex non-public cases, robots.txt |

### Open Questions

1. **Should we require email verification before publishing?**
   - Pro: Prevents fake reports
   - Con: Delays visibility, friction
   - Decision: Publish immediately, mark unverified

2. **Contact form rate limiting?**
   - Recommend: 5 messages per case per IP per hour

3. **What about found pet reports?**
   - Phase 27+: Different privacy model needed

---

## 10. Acceptance Criteria

### Must Have
- [ ] GET /api/public/cases returns public cases only
- [ ] GET /api/public/cases/[caseNumber] returns public case details
- [ ] POST /api/public/cases creates user + case
- [ ] /cases page displays public cases
- [ ] /cases/[caseNumber] displays case with map
- [ ] /cases/report form submits successfully
- [ ] Confirmation email sent on submission
- [ ] Admin alert email sent on submission
- [ ] All endpoints log appropriate events
- [ ] ERROR_IMPACT entries added to health dashboard

### Should Have
- [ ] SEO meta tags on case detail pages
- [ ] Social sharing buttons
- [ ] Filters on case listing (city, species)

### Nice to Have
- [ ] Contact form on case detail
- [ ] Sighting display on public case detail

---

*Spec version: 1.0*
*Last updated: 2025-11-25*
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz
