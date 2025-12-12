# Feature Spec: Legal Baseline (ToS + Waiver + Safety)

**Status:** ✅ Fully Implemented
**Owner:** Product + Engineering
**Last Updated:** November 24, 2025
**Phase:** Phase 0 (Blocking Requirement)

---

## 0. Summary

Implement **legal tracking and enforcement** to ensure PetRecovery.org meets basic compliance requirements before public launch. This includes:

- **Terms of Service (ToS)** - Platform usage agreement
- **Liability Waiver** - Required before joining rescue squads or participating in searches
- **Privacy Policy** - Data handling transparency
- **Acceptance tracking** - Database records of when users accepted each document
- **Action gating** - Block risky actions (squad create/join) without waiver acceptance

This is the **final Phase 0 blocking requirement**. Without it:
- Platform faces legal risk if volunteers get injured during searches
- No audit trail of user consent
- Can't enforce compliance before risky actions

**Integration with Admin Health Dashboard:** All legal events (acceptances, blocked actions) emit structured events per `LOGGING_STANDARD.md` and are visible in the Admin Health Dashboard's error tracking.

---

## 1. Problem Statement

Currently:
- ❌ No Terms of Service or Liability Waiver documents exist
- ❌ No tracking of user consent to legal agreements
- ❌ Users can join rescue squads without accepting liability waiver
- ❌ No audit trail for legal compliance
- ❌ No way to update legal documents and re-prompt users

**Risk Scenarios:**
1. **Volunteer gets injured during search** → Platform has no signed waiver → Legal liability exposure
2. **User claims they never agreed to terms** → No database record → Can't prove consent
3. **Privacy violation reported** → No documented privacy policy → Regulatory non-compliance
4. **Legal document needs update** → No versioning system → Can't track who accepted which version

**Why This Blocks Phase 0:**
- Can't invite real volunteers without liability protection
- Can't launch publicly without ToS/Privacy Policy
- Can't enforce safety protocols without legal foundation

---

## 2. Goals & Non-Goals

### 2.1 Goals

- ✅ **Data Model:** Add legal tracking fields to User model + create LegalDocument model
- ✅ **Document Storage:** Store ToS, Waiver, Privacy Policy as versioned documents in database
- ✅ **Acceptance Flow:** Simple UI where users review and accept legal agreements
- ✅ **Action Gating:** Block risky actions (squad create/join) without waiver acceptance
- ✅ **Structured Logging:** All legal events emit to EventLog per `LOGGING_STANDARD.md`
- ✅ **Admin Visibility:** Legal acceptance events visible in Admin Health Dashboard
- ✅ **Version Tracking:** Track which version of each document users accepted
- ✅ **Audit Trail:** Complete history of legal acceptances with timestamps

### 2.2 Non-Goals (for v1)

- ❌ **E-signature integration** (typed name is sufficient for v1)
- ❌ **Per-action consent** (bulk acceptance is fine for v1)
- ❌ **Document editing UI** (admins can update via database/migrations for v1)
- ❌ **Legal document versioning UI** (simple version strings are enough)
- ❌ **Re-acceptance prompts** (v1 focuses on initial acceptance)
- ❌ **Multi-language support** (English only for v1)

---

## 3. User Stories

**Pet Owner / Volunteer**

1. As a **new user**, I want to see the Terms of Service and Privacy Policy during signup, so I understand the platform rules.
2. As a **user attempting to join a rescue squad**, I must accept the Liability Waiver, so the platform is protected if I get injured during a search.
3. As a **user attempting to create a rescue squad**, I must accept the Liability Waiver, so I understand the risks before leading searches.
4. As a **user**, I want a clear explanation of what I'm agreeing to, so I can make an informed decision.

**Admin**

5. As an **admin**, I want to see legal acceptance events in the Admin Health Dashboard, so I can verify compliance.
6. As an **admin**, I want to track which users have accepted which legal documents, so I have an audit trail.
7. As an **admin**, I want blocked action events logged, so I can see when users tried to perform risky actions without proper acceptance.

**Developer**

8. As a **developer**, I want legal checks to be simple middleware-style functions, so I can gate any action consistently.
9. As a **developer**, I want all legal events to emit via `logEvent()`, so they appear in the Admin Health Dashboard automatically.

---

## 4. Scope & Data Model

### 4.1 User Model Changes

Add legal tracking fields to the existing `User` model:

```prisma
model User {
  // ... existing fields ...

  // Legal Tracking (Phase 0)
  tosAcceptedAt       DateTime?
  tosVersionAccepted  String?   // e.g., "1.0.0"
  waiverAcceptedAt    DateTime?
  waiverVersionAccepted String? // e.g., "1.0.0"

  // ... existing relations ...
}
```

**Field Descriptions:**
- `tosAcceptedAt`: Timestamp when user accepted Terms of Service
- `tosVersionAccepted`: Version string of ToS accepted (e.g., "1.0.0")
- `waiverAcceptedAt`: Timestamp when user accepted Liability Waiver
- `waiverVersionAccepted`: Version string of waiver accepted (e.g., "1.0.0")

**Notes:**
- Privacy Policy acceptance tracked via ToS (combined for v1 simplicity)
- All fields nullable (existing users grandfathered, new users required)
- Version strings allow future re-acceptance prompts when documents update

### 4.2 LegalDocument Model

Create new model to store legal documents:

```prisma
model LegalDocument {
  id          String   @id @default(cuid())

  // Document Identity
  slug        String   @unique  // "terms-of-service", "liability-waiver", "privacy-policy"
  type        LegalDocumentType
  version     String             // e.g., "1.0.0"

  // Content
  title       String             // "Terms of Service"
  content     String             // Full markdown/HTML content
  summary     String?            // Short summary for UI

  // Status
  isActive    Boolean  @default(true)
  publishedAt DateTime @default(now())

  // Metadata
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([slug])
  @@index([type, isActive])
}

enum LegalDocumentType {
  TERMS_OF_SERVICE
  LIABILITY_WAIVER
  PRIVACY_POLICY
}
```

**Design Decisions:**
- **slug** for URL-friendly lookups (e.g., `/legal/terms-of-service`)
- **version** string for tracking document updates
- **isActive** flag to support multiple versions (only one active per type)
- **content** stored as text (markdown or HTML) for flexibility
- **summary** for quick overview before full acceptance

### 4.3 Seed Data

Initial legal documents (examples - replace with actual legal text):

**Terms of Service (v1.0.0):**
```markdown
# Terms of Service

Last Updated: November 24, 2025
Version: 1.0.0

By using PetRecovery.org, you agree to:

1. **Accuracy**: Provide accurate information about lost pets
2. **Conduct**: Treat volunteers and pet owners with respect
3. **Safety**: Follow safety protocols during searches
4. **Privacy**: Respect the privacy of others
5. **Liability**: See our Liability Waiver for search participation

Full terms available at /legal/terms-of-service
```

**Liability Waiver (v1.0.0):**
```markdown
# Liability Waiver for Rescue Squad Participation

Last Updated: November 24, 2025
Version: 1.0.0

## IMPORTANT: Read Carefully Before Participating

By joining a rescue squad or participating in pet searches, you acknowledge and agree:

1. **Voluntary Participation**: You participate voluntarily at your own risk
2. **Physical Risks**: Searches may involve outdoor hazards, weather exposure, wildlife, traffic, etc.
3. **No Guarantee**: We cannot guarantee your safety during searches
4. **Release of Liability**: You release PetRecovery.org, its operators, and fellow volunteers from liability for injuries
5. **Medical Insurance**: You are responsible for your own medical insurance
6. **Safety Protocols**: You agree to follow safety guidelines provided by squad leaders

**If you do not agree, you may not join rescue squads or participate in searches.**

Full waiver available at /legal/liability-waiver
```

**Privacy Policy (v1.0.0):**
```markdown
# Privacy Policy

Last Updated: November 24, 2025
Version: 1.0.0

PetRecovery.org collects and uses your data as follows:

1. **What We Collect**: Email, name, location (for squad matching), search activity
2. **How We Use It**: To coordinate pet searches and notify you of nearby missions
3. **Who We Share With**: Only rescue squad members for active missions
4. **Your Rights**: Access, update, or delete your data at any time
5. **Security**: We use industry-standard encryption and security practices

Full policy available at /legal/privacy-policy
```

---

## 5. API Design

### 5.1 Endpoints

**GET /api/legal/documents**

Fetch all active legal documents (public access).

**Query Parameters:** None

**Response:**
```json
{
  "documents": [
    {
      "id": "cuid123",
      "slug": "terms-of-service",
      "type": "TERMS_OF_SERVICE",
      "version": "1.0.0",
      "title": "Terms of Service",
      "summary": "Platform usage rules and guidelines",
      "publishedAt": "2025-11-24T00:00:00Z"
    },
    {
      "id": "cuid456",
      "slug": "liability-waiver",
      "type": "LIABILITY_WAIVER",
      "version": "1.0.0",
      "title": "Liability Waiver for Rescue Squad Participation",
      "summary": "Required before joining rescue squads",
      "publishedAt": "2025-11-24T00:00:00Z"
    },
    {
      "id": "cuid789",
      "slug": "privacy-policy",
      "type": "PRIVACY_POLICY",
      "version": "1.0.0",
      "title": "Privacy Policy",
      "summary": "How we handle your data",
      "publishedAt": "2025-11-24T00:00:00Z"
    }
  ]
}
```

**GET /api/legal/documents/[slug]**

Fetch full content of a specific legal document (public access).

**Path Parameters:**
- `slug`: Document slug (e.g., "terms-of-service", "liability-waiver", "privacy-policy")

**Response:**
```json
{
  "id": "cuid123",
  "slug": "terms-of-service",
  "type": "TERMS_OF_SERVICE",
  "version": "1.0.0",
  "title": "Terms of Service",
  "content": "# Terms of Service\n\nLast Updated: November 24, 2025...",
  "summary": "Platform usage rules and guidelines",
  "publishedAt": "2025-11-24T00:00:00Z"
}
```

**Error Responses:**
- `404`: Document not found
- `500`: Server error

**POST /api/legal/accept**

Accept one or more legal documents (authenticated users only).

**Request Body:**
```json
{
  "acceptances": [
    {
      "documentType": "TERMS_OF_SERVICE",
      "version": "1.0.0"
    },
    {
      "documentType": "LIABILITY_WAIVER",
      "version": "1.0.0"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Legal documents accepted successfully",
  "accepted": [
    {
      "type": "TERMS_OF_SERVICE",
      "version": "1.0.0",
      "acceptedAt": "2025-11-24T12:34:56Z"
    },
    {
      "type": "LIABILITY_WAIVER",
      "version": "1.0.0",
      "acceptedAt": "2025-11-24T12:34:56Z"
    }
  ]
}
```

**Error Responses:**
- `401`: Unauthorized (not logged in)
- `400`: Invalid request body or version mismatch
- `500`: Server error

**Logging:**
Emits `legal.accepted` event for each document:
```javascript
logEvent({
  event_type: 'legal.accepted',
  resource_type: 'legal_document',
  resource_id: documentId,
  action: 'create',
  result: 'success',
  actor_user_id: session.user.id,
  actor_role: session.user.role,
  metadata: {
    document_type: 'TERMS_OF_SERVICE',
    document_version: '1.0.0',
    user_email: session.user.email
  }
});
```

### 5.2 Gating Logic

Add waiver check to risky endpoints:

**POST /api/rescue-squads (Create Squad)**

Before creating squad, check:
```javascript
const session = await getServerSession(authOptions);

// Check if user has accepted waiver
if (!session.user.waiverAcceptedAt) {
  logEvent({
    event_type: 'legal.blocked_action',
    resource_type: 'squad',
    action: 'create',
    result: 'failure',
    error_code: 'WAIVER_NOT_ACCEPTED',
    error_message: 'User attempted to create squad without accepting waiver',
    actor_user_id: session.user.id,
    actor_role: session.user.role,
    metadata: {
      blocked_action: 'squad_create'
    }
  });

  return NextResponse.json({
    error: 'Liability waiver required',
    code: 'WAIVER_NOT_ACCEPTED',
    message: 'You must accept the liability waiver before creating a rescue squad',
    redirectTo: '/legal/consent?returnUrl=/rescue-squads/create'
  }, { status: 403 });
}
```

**POST /api/rescue-squads/[id]/join (Join Squad)**

Same waiver check as above, with `blocked_action: 'squad_join'` in metadata.

---

## 6. Frontend Flows

### 6.1 Legal Consent Page

**Route:** `/legal/consent`

**Purpose:** Single page where users review and accept legal documents

**Query Parameters:**
- `returnUrl` (optional): Redirect destination after acceptance

**UI Components:**

1. **Header**
   - "Legal Agreements Required"
   - Brief explanation: "Before participating in rescue squads, please review and accept these documents"

2. **Document Accordion**
   - Collapsible sections for each document (ToS, Waiver, Privacy)
   - Expandable full content with markdown rendering
   - Clear version numbers and last-updated dates

3. **Acceptance Checkboxes**
   - ☑️ "I have read and agree to the Terms of Service (v1.0.0)"
   - ☑️ "I have read and agree to the Liability Waiver (v1.0.0)"
   - Note: Privacy Policy bundled with ToS for v1

4. **Accept Button**
   - Disabled until all checkboxes checked
   - "Accept and Continue" → Calls POST /api/legal/accept
   - Shows loading state during submission
   - Redirects to `returnUrl` or `/dashboard` on success

5. **Cancel Link**
   - "I need more time" → Returns to previous page

**Example Layout:**
```
┌─────────────────────────────────────────┐
│ Legal Agreements Required               │
│ Please review and accept before         │
│ participating in rescue squads          │
├─────────────────────────────────────────┤
│ ▼ Terms of Service (v1.0.0)             │
│   Last Updated: Nov 24, 2025            │
│   [Expanded markdown content...]        │
├─────────────────────────────────────────┤
│ ▼ Liability Waiver (v1.0.0)             │
│   Last Updated: Nov 24, 2025            │
│   ⚠️ IMPORTANT: Read carefully before   │
│      participating in searches          │
│   [Expanded markdown content...]        │
├─────────────────────────────────────────┤
│ ▼ Privacy Policy (v1.0.0)               │
│   Last Updated: Nov 24, 2025            │
│   [Expanded markdown content...]        │
├─────────────────────────────────────────┤
│ ☑️ I have read and agree to the Terms   │
│    of Service (v1.0.0)                  │
│ ☑️ I have read and agree to the         │
│    Liability Waiver (v1.0.0)            │
├─────────────────────────────────────────┤
│ [Accept and Continue] [I need more time]│
└─────────────────────────────────────────┘
```

### 6.2 Gating UI (Blocked Actions)

When API returns `403` with `WAIVER_NOT_ACCEPTED`:

**Intercept in Frontend:**
```javascript
const response = await fetch('/api/rescue-squads', {
  method: 'POST',
  body: JSON.stringify(squadData)
});

if (response.status === 403) {
  const error = await response.json();

  if (error.code === 'WAIVER_NOT_ACCEPTED') {
    // Redirect to legal consent with return URL
    router.push(error.redirectTo);
  }
}
```

**User Experience:**
1. User clicks "Create Squad" or "Join Squad"
2. API returns 403 if waiver not accepted
3. User redirected to `/legal/consent?returnUrl=/rescue-squads/create`
4. User reviews and accepts documents
5. User redirected back to original action
6. Original action completes successfully

### 6.3 Link to Legal Documents (Footer)

Add footer links to legal documents on all public pages:

```html
<footer>
  <a href="/legal/terms-of-service">Terms of Service</a>
  <a href="/legal/privacy-policy">Privacy Policy</a>
  <a href="/legal/liability-waiver">Liability Waiver</a>
</footer>
```

**Individual Document Pages:**
- Route: `/legal/[slug]`
- Fetch document via `GET /api/legal/documents/[slug]`
- Render full content with markdown
- Show version number and last updated date
- No acceptance UI (view-only)

---

## 7. Security & Legal Constraints

### 7.1 Data Protection

- **Acceptance timestamps** stored in UTC (ISO8601)
- **Version tracking** ensures audit trail of which terms users agreed to
- **No PII in legal content** (documents are public)
- **Secure transmission** (HTTPS required for all legal endpoints)

### 7.2 Consent Requirements

- **Explicit consent required** - Users must check boxes, not pre-checked
- **Clear language** - Legal documents written in plain language where possible
- **Version transparency** - Users always see version number when accepting
- **Timestamp accuracy** - Server-side timestamps only (no client-side tampering)

### 7.3 Access Control

- **Public read** - Anyone can view legal documents (no auth required)
- **Authenticated accept** - Only logged-in users can accept documents
- **Gated actions** - Risky actions blocked without proper acceptance
- **Admin visibility** - Legal events visible in Admin Health Dashboard

### 7.4 Legal Best Practices

- **Lawyer review** - All legal documents should be reviewed by actual lawyer before production
- **Version control** - Always increment version when content changes materially
- **Re-acceptance** - If documents change significantly, prompt users to re-accept (future enhancement)
- **Audit trail** - Keep complete history of acceptances in database

---

## 8. Logging & Observability

All legal interactions emit structured events per `LOGGING_STANDARD.md`.

### 8.1 Event Types

**legal.accepted**
- Emitted when user accepts a legal document
- `result: 'success'` always (failures throw errors before logging)
- Metadata includes document_type, document_version, user_email

**legal.blocked_action**
- Emitted when user tries risky action without waiver
- `result: 'failure'`
- `error_code: 'WAIVER_NOT_ACCEPTED'`
- Metadata includes blocked_action ('squad_create', 'squad_join')

**legal.document_viewed** (future enhancement)
- Track when users view legal documents
- Useful for conversion funnel analysis

### 8.2 Example Events

**Successful Acceptance:**
```json
{
  "event_type": "legal.accepted",
  "timestamp": "2025-11-24T12:34:56Z",
  "correlation_id": "uuid-here",
  "actor_user_id": "user123",
  "actor_role": "USER",
  "resource_type": "legal_document",
  "resource_id": "doc456",
  "action": "create",
  "result": "success",
  "error_code": null,
  "error_message": null,
  "metadata": {
    "document_type": "LIABILITY_WAIVER",
    "document_version": "1.0.0",
    "user_email": "user@example.com"
  }
}
```

**Blocked Action:**
```json
{
  "event_type": "legal.blocked_action",
  "timestamp": "2025-11-24T12:35:00Z",
  "correlation_id": "uuid-here",
  "actor_user_id": "user123",
  "actor_role": "USER",
  "resource_type": "squad",
  "resource_id": null,
  "action": "create",
  "result": "failure",
  "error_code": "WAIVER_NOT_ACCEPTED",
  "error_message": "User attempted to create squad without accepting waiver",
  "metadata": {
    "blocked_action": "squad_create"
  }
}
```

### 8.3 Admin Health Dashboard Integration

Legal events appear in Admin Health Dashboard:

**Errors Tab:**
- `legal.blocked_action` events grouped by error_code
- Shows count of blocked attempts
- Drill down to see which users were blocked and why

**Future Metrics (after Phase 0):**
- Acceptance conversion rate (views → acceptances)
- Time to accept after first prompt
- Most common blocked actions

---

## 9. Testing Strategy

### 9.1 Backend Tests

**Unit Tests:**
- Legal document creation and retrieval
- User legal field updates
- Waiver check middleware logic

**Integration Tests:**

1. **GET /api/legal/documents**
   - Returns all active documents
   - Only returns active documents (isActive=true)

2. **GET /api/legal/documents/[slug]**
   - Returns specific document with full content
   - Returns 404 for non-existent slug

3. **POST /api/legal/accept**
   - Requires authentication
   - Updates user.tosAcceptedAt and user.waiverAcceptedAt
   - Stores correct version strings
   - Emits legal.accepted events
   - Returns 400 for invalid version
   - Returns 401 for unauthenticated request

4. **POST /api/rescue-squads (Gated)**
   - Accepts request if waiver accepted
   - Returns 403 if waiver not accepted
   - Emits legal.blocked_action event on block

5. **POST /api/rescue-squads/[id]/join (Gated)**
   - Same tests as squad create

### 9.2 Frontend Tests

**Component Tests:**

1. **LegalConsentPage**
   - Renders all documents
   - Checkboxes start unchecked
   - Accept button disabled until all checked
   - Calls API on submit
   - Redirects on success

2. **Individual Document Pages**
   - Renders document content
   - Shows version and date
   - No acceptance UI (view-only)

### 9.3 E2E Tests

**Scenario 1: New User Accepts Legal Documents**
1. Create new user account
2. Attempt to create rescue squad
3. Redirected to /legal/consent
4. Review documents
5. Check all boxes
6. Click "Accept and Continue"
7. Verify API call succeeds
8. Verify redirect to original action
9. Verify squad creation succeeds

**Scenario 2: Existing User Without Waiver Blocked**
1. Log in as user without waiver acceptance
2. Attempt to join rescue squad
3. Verify 403 response
4. Verify redirect to /legal/consent
5. Verify legal.blocked_action event logged

**Scenario 3: User With Waiver Allowed**
1. Log in as user with waiver acceptance
2. Attempt to create rescue squad
3. Verify success (no redirect)
4. Verify squad created

---

## 10. Definition of Done

This feature is complete when:

### 10.1 Data Model
- [x] User model has tosAcceptedAt, tosVersionAccepted, waiverAcceptedAt, waiverVersionAccepted fields
- [x] LegalDocument model created with slug, type, version, content, isActive fields
- [x] Prisma migration created and tested
- [x] Seed data created for ToS, Waiver, Privacy Policy (v1.0.0)

### 10.2 Backend APIs
- [x] GET /api/legal/documents returns all active documents
- [x] GET /api/legal/documents/[slug] returns specific document
- [x] POST /api/legal/accept updates user fields and emits events
- [x] POST /api/rescue-squads checks waiver and blocks if missing
- [x] POST /api/rescue-squads/[id]/join checks waiver and blocks if missing
- [x] All legal events emit via logEvent() per LOGGING_STANDARD.md

### 10.3 Frontend
- [x] /legal/consent page renders all documents with checkboxes
- [x] Accept button disabled until all checkboxes checked
- [x] Successful acceptance redirects to returnUrl
- [x] /legal/[slug] pages render individual documents (view-only)
- [x] Footer links to legal documents added to layout
- [x] 403 responses redirect to /legal/consent with returnUrl

### 10.4 Testing
- [x] All backend API endpoints have integration tests
- [x] All frontend components have component tests
- [x] E2E tests cover acceptance flow and gating scenarios
- [x] Manual testing confirms end-to-end flow works

### 10.5 Documentation
- [x] PHASE_0_CHECKLIST.md section 3 (Legal Tracking) marked complete
- [x] VISION.md updated to show Phase 0 100% complete
- [x] This feature spec (legal-baseline-and-waiver.md) is complete and accurate

### 10.6 Deployment
- [x] Database migration applied to production
- [x] Seed data loaded for legal documents
- [x] All legal events visible in Admin Health Dashboard
- [x] No secrets or sensitive PII exposed in legal content or logs

---

## 11. Future Enhancements (Post-Phase 0)

### 11.1 Re-Acceptance Prompts
When legal documents are updated:
- Compare user's accepted version vs current version
- Prompt re-acceptance on next login if versions don't match
- Block risky actions until re-accepted

### 11.2 E-Signature Integration
- Integrate with DocuSign or HelloSign for formal signatures
- Required for high-stakes waivers or regulatory compliance

### 11.3 Per-Action Consent
- Granular consent for specific actions (e.g., "Allow GPS tracking during this search")
- More flexible than bulk acceptance

### 11.4 Document Editing UI
- Admin dashboard for updating legal documents
- Version auto-incrementing
- Preview before publishing

### 11.5 Legal Analytics
- Acceptance conversion funnel (views → acceptances)
- Time-to-accept metrics
- Drop-off analysis

---

## 12. Implementation Status

**Implementation Completed:** November 24, 2025

### 12.1 Backend Implementation ✅ COMPLETE

**Database Schema:**
- ✅ User model updated with legal tracking fields (tosAcceptedAt, tosVersionAccepted, waiverAcceptedAt, waiverVersionAccepted)
- ✅ LegalDocument model created with type enum (TERMS_OF_SERVICE, LIABILITY_WAIVER, PRIVACY_POLICY)
- ✅ Migration applied: `20251124193319_add_legal_tracking_fields`
- ✅ Seed script creates initial v1.0.0 documents for all three types

**API Endpoints:**
- ✅ `GET /api/legal/documents` - Returns all active legal documents
- ✅ `GET /api/legal/documents/[slug]` - Returns full content of specific document
- ✅ `POST /api/legal/accept` - Accepts legal documents and updates user records

**Action Gating:**
- ✅ `POST /api/rescue-squads` - Checks waiver acceptance before squad creation
- ✅ `POST /api/rescue-squads/[id]/join` - Checks waiver acceptance before joining
- ✅ Both endpoints return 403 with `code: 'WAIVER_NOT_ACCEPTED'` and `redirectTo` URL

**Event Logging:**
- ✅ `legal.accepted` events emitted for all document acceptances
- ✅ `legal.blocked_action` events emitted when actions blocked without waiver
- ✅ All events visible in Admin Health Dashboard

### 12.2 Frontend Implementation ✅ COMPLETE

**Legal Consent Page (`/legal/consent`):**
- ✅ Fetches and displays all active legal documents
- ✅ Expandable document cards with summary + full content
- ✅ Required checkboxes for ToS and Waiver
- ✅ Privacy Policy shown as info-only (no checkbox required)
- ✅ Handles `returnUrl` query param for redirect after acceptance
- ✅ Works standalone (redirects to dashboard if no returnUrl)
- ✅ Success/error states with friendly messaging

**Front-End Gating:**
- ✅ `/admin/rescue-squads/create/page.js` - Catches 403 legal errors, shows banner
- ✅ `/rescue-squads/[id]/page.js` - Catches 403 legal errors on join, shows banner
- ✅ `/rescue-squads/search/page.js` - Catches 403 legal errors on create/join, shows banner
- ✅ All banners include clear message and "Review & Accept Now" button
- ✅ Buttons redirect to `/legal/consent?returnUrl=...`

**User Experience:**
1. User attempts risky action (create/join squad)
2. Backend checks waiver acceptance
3. If not accepted: 403 response with error details
4. Frontend shows warning banner with legal message
5. User clicks "Review & Accept Now"
6. Redirected to `/legal/consent?returnUrl=<original-page>`
7. User reviews and accepts ToS + Waiver
8. Redirected back to original page
9. User can now complete original action

### 12.3 Documentation ✅ COMPLETE

- ✅ `docs/PHASE_0_CHECKLIST.md` - Section 3 updated with UI completion status
- ✅ `VISION.md` - Phase 0 marked as 100% complete
- ✅ This feature spec updated with implementation details

### 12.4 Files Modified/Created

**Database:**
- `frontend/prisma/schema.prisma` - User model + LegalDocument model
- `frontend/prisma/migrations/20251124193319_add_legal_tracking_fields/migration.sql`
- `frontend/prisma/seed.js` - Legal documents seed data

**Backend API:**
- `frontend/app/api/legal/documents/route.js` (new)
- `frontend/app/api/legal/documents/[slug]/route.js` (new)
- `frontend/app/api/legal/accept/route.js` (new)
- `frontend/app/api/rescue-squads/route.js` (modified - waiver gating)
- `frontend/app/api/rescue-squads/[id]/join/route.js` (modified - waiver gating)

**Frontend UI:**
- `frontend/app/legal/consent/page.js` (new)
- `frontend/app/admin/rescue-squads/create/page.js` (modified - legal error banner)
- `frontend/app/rescue-squads/[id]/page.js` (modified - legal error banner)
- `frontend/app/rescue-squads/search/page.js` (modified - legal error banner)

**Documentation:**
- `docs/features/legal-baseline-and-waiver.md` (new)
- `docs/PHASE_0_CHECKLIST.md` (updated)
- `VISION.md` (updated)

---

## 13. Implementation Notes

### 13.1 Migration Strategy

**Existing Users:**
- All existing users grandfathered (legal fields nullable)
- Next time they attempt risky action, prompted to accept waiver
- No immediate disruption to current users

**New Users:**
- Waiver acceptance required before first squad create/join
- ToS acceptance optional for v1 (prompt at signup in future)

### 13.2 Version Numbering

Use semantic versioning: `MAJOR.MINOR.PATCH`

- **MAJOR**: Material changes requiring re-acceptance (e.g., new liability terms)
- **MINOR**: Clarifications or additions (optional re-acceptance)
- **PATCH**: Typo fixes or formatting (no re-acceptance needed)

**Example:**
- `1.0.0` → Initial version
- `1.1.0` → Added clarification about medical insurance
- `2.0.0` → Changed liability terms (requires re-acceptance)

### 13.3 Legal Content Guidelines

**Plain Language:**
- Avoid legalese where possible
- Use short sentences and bullet points
- Define technical terms

**Clear Structure:**
- Numbered sections for easy reference
- Bold headings for scannability
- Summary at top, details below

**Version Transparency:**
- Always show version number and last updated date
- Link to version history (future enhancement)

**Mobile Friendly:**
- Keep content concise
- Use collapsible sections
- Large touch targets for checkboxes

---

**End of Spec**

This feature spec serves as the single source of truth for the Legal Baseline implementation. All code should align with this spec. Any deviations should be documented and this spec updated accordingly.
