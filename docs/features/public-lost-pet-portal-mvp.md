# Feature Spec: Public Lost Pet Case Portal MVP

**Phase:** 15–16
**Status:** IN PROGRESS
**Author:** Claude
**Date:** 2025-11-25

---

## 0. Summary

The Public Lost Pet Case Portal allows anyone to view active lost pet cases and submit reports without requiring authentication. This increases visibility of lost pets and lowers the barrier for community members to help.

---

## 1. Problem / Why

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

---

## 3. User Stories

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

---

## 4. Data Model

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

**Authentication:** None required

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `city` | string | - | Filter by city name |
| `state` | string | - | Filter by state (2-letter) |
| `species` | string | - | Filter by pet species |
| `status` | string | ACTIVE | Case status filter |
| `limit` | number | 20 | Results per page (max 50) |
| `offset` | number | 0 | Pagination offset |

**Response:**
```json
{
  "cases": [
    {
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

**Request Body:**
```json
{
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
  }
}
```

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

---

## 7. Logging & Observability

### Event Types

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
}
```

---

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
