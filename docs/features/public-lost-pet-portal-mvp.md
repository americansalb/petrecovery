# Feature Spec: Public Lost Pet Case Portal MVP (Phase 15–16)

**Status:** ✅ Fully Implemented
**Owner:** Product + Engineering
**Last Updated:** November 25, 2025
**Phase:** 15–16 (Public Lost Pet Case Portal)

---

## 0. Summary

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

---

## 1. Problem / Why

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

---

## 3. User Stories

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

---

## 4. Data Model

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

**Authentication:** None required

**Query Parameters:**
- `city` (optional): Filter by city name
- `state` (optional): Filter by state code (e.g., "TX")
- `status` (optional): Filter by `LostPetCaseStatus` enum
- `species` (optional): Filter by `PetSpecies` enum
- `limit` (optional, default: 20, max: 100): Number of results per page
- `page` (optional, default: 1): Page number for pagination

**Response (200 OK):**
```json
{
  "cases": [
    {
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

**Request Body:**
```json
{
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
  }
}
```

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

---

## 7. Logging & Observability

### Event Types

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
}
```

---

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
