# Feature Spec: Notifications MVP (Phase 25–26)

**Status:** ❌ Not Started
**Owner:** Product + Engineering
**Last Updated:** November 25, 2025
**Phase:** 25–26 (Notifications MVP - Case Alerts & Admin Signals)

---

## 0. Summary

We're building a **transactional notifications layer** that automatically sends email alerts for key case lifecycle events. This MVP focuses on:

- **Owner/contact notifications**: Email confirmations when public reports are submitted, and updates when case status changes.
- **Admin notifications**: Immediate alerts when public reports are submitted for review.
- **Full observability**: All notification attempts emit structured events visible in `/admin/health`.

This is a **minimal, safe, transactional-only** implementation:
- No SMS (email only for MVP)
- No subscriptions or preferences UI (hard-coded triggers)
- No marketing or newsletters
- Built entirely on existing infrastructure (nodemailer, event logging, case system)

**Key Principles:**

- **Transactional only**: Critical case lifecycle events, not marketing
- **Privacy-respecting**: Only send to case contact emails, no third parties
- **Observable**: Every send attempt logged with structured events
- **Non-blocking**: Email failures don't break API responses
- **Simple**: Minimal new models, leverage existing email utility

This phase builds directly on:
- **Phase 0**: Observability + event logging
- **Phase 13–14**: Internal case management system
- **Phase 15–16**: Public case portal (public reports)
- **Phase 20–21**: QA harness for testing

Future phases will add: SMS, subscription preferences, in-app notifications, and advanced templates.

---

## 1. Problem / Why

### Current State

After Phase 15–16, we have a **public lost pet case portal** where:
- The public can submit lost pet reports via `/cases/report`
- Admins can create and manage cases via `/admin/cases`
- Cases can transition through statuses: OPEN → ACTIVE_SEARCH → RESOLVED

However:
- **Reporters get no confirmation** when they submit a public report
- **Pet owners get no updates** when their case status changes
- **Admins must poll `/admin/cases`** to discover new public reports
- **No way to proactively inform stakeholders** of critical case events

### Problems Solved

**For Pet Owners/Reporters:**
- "I submitted a report but don't know if it went through"
- "My case status changed but I had no idea"
- "I want updates without checking the website every day"

**For Admins:**
- "I don't know when new public reports arrive"
- "I have to refresh the admin page constantly"
- "I miss urgent cases because I'm not always logged in"

**For Platform Operations:**
- "Email delivery failures go unnoticed"
- "We have no metrics on notification health"
- "Can't debug why users say they didn't receive emails"

---

## 2. Goals / Non-goals

### Goals

**MVP Notification Triggers (Email Only):**

1. **Public Report Submitted** (when `POST /api/public/cases` succeeds):
   - Send confirmation email to case contact
   - Send admin alert email to configured admin address

2. **Case Status Changed** (when `POST /api/cases/[id]/status` succeeds):
   - If status transitions to `ACTIVE_SEARCH`, `RESOLVED`, or `CLOSED_OTHER`:
     - Send status update email to case contact (if `contactEmail` present)

3. **Case Made Public** (optional for MVP, if easy):
   - When admin toggles `isPublic` from false → true:
     - Send notification to case contact that their case is now visible

**Observability:**
- All notification send attempts emit `notification.*` events
- Failures surfaced in `/admin/health` Errors tab
- Admin can view notification health metrics

**Admin Control:**
- Admin can configure default notification email address
- Email failures don't break API responses

### Non-goals (Deferred to Later Phases)

- ❌ **No SMS** - Email only for MVP
- ❌ **No subscription management** - No opt-in/opt-out UI
- ❌ **No user notification preferences** - Hard-coded triggers
- ❌ **No "follow city" or area subscriptions** - Only case-specific notifications
- ❌ **No marketing campaigns** - Transactional only
- ❌ **No rich templates** - Simple HTML emails
- ❌ **No in-app notifications** - Email only
- ❌ **No batch/digest emails** - Immediate send only

---

## 3. User Stories

### Pet Owner / Reporter

**Story 1: Report Confirmation**
> As a pet owner who submitted a lost pet report via the public form,
> I want to receive an email confirmation immediately,
> So I know my report was received and is under review.

**Acceptance:**
- Email arrives within 1 minute of submission
- Email contains case number, pet name, and review timeline
- Email is sent even if case is not yet public (isPublic=false)

**Story 2: Status Update Notifications**
> As a pet owner whose case is being managed,
> I want to receive email updates when the case status changes,
> So I know when volunteers start searching or when my pet is found.

**Acceptance:**
- Email sent when status changes to ACTIVE_SEARCH, RESOLVED, or CLOSED_OTHER
- Email explains what the new status means
- Email includes case number and link to public case page (if public)

### Admin

**Story 3: Public Report Alerts**
> As an admin,
> I want to receive an email immediately when a public report is submitted,
> So I can review and approve it quickly without constantly checking the admin dashboard.

**Acceptance:**
- Email arrives within 1 minute of public report submission
- Email includes pet details, location, and direct link to `/admin/cases/[id]`
- Email subject clearly indicates it's a new public report

**Story 4: Configure Notification Email**
> As an admin,
> I want to configure which email address receives admin notification alerts,
> So I can route them to a team inbox or my personal email.

**Acceptance:**
- Admin can set notification email via UI (or env var for MVP)
- Changes persist across sessions
- Multiple admins can configure their own notification preferences (future)

### Platform / Operations

**Story 5: Notification Observability**
> As a platform operator,
> I want to see all notification attempts and failures in the admin health dashboard,
> So I can debug delivery issues and monitor notification system health.

**Acceptance:**
- All send attempts emit `notification.*` events
- Failures appear in /admin/health Errors tab
- Can filter events by notification type

---

## 4. Delivery Channels & Triggers

### MVP: Email Only

For this MVP, we support **only email notifications**. All notifications are **transactional** (critical case lifecycle events).

### Trigger 1: Public Report Submitted

**Event:** `POST /api/public/cases` succeeds

**Notification 1A: Owner/Contact Confirmation**
- **To:** `contactEmail` from request body
- **Subject:** `"✅ We received your lost pet report: {PetName or CaseNumber}"`
- **Body:**
  ```
  Hi {ContactName},

  Thank you for submitting a lost pet report to PetRecovery.org.

  Case Details:
  - Case Number: {CaseNumber}
  - Pet: {PetName} ({PetSpecies})
  - Location: {City}, {State}
  - Submitted: {Timestamp}

  What happens next:
  1. Our admin team will review your report within 24-48 hours.
  2. Once approved, your case will be visible on the public portal.
  3. You'll receive email updates when the status changes.

  Important: Your contact information is NOT publicly visible by default.

  If you have questions, please reply to this email.

  PetRecovery.org Team
  ```

**Notification 1B: Admin Alert**
- **To:** Configured admin email (from settings or env var `ADMIN_NOTIFICATION_EMAIL`)
- **Subject:** `"🚨 New Public Report: {City}, {State} – {PetName}"`
- **Body:**
  ```
  A new public lost pet report requires review:

  Case Number: {CaseNumber}
  Pet: {PetName} ({PetSpecies}, {PetBreed})
  Location: {City}, {State} ({ZipCode})
  Landmark: {LastSeenLandmark}
  Contact: {ContactName} ({ContactEmail}, {ContactPhone})
  Submitted: {Timestamp}

  Review and approve this case:
  {BASE_URL}/admin/cases/{CaseId}

  This case is currently NOT public (requires approval).
  ```

### Trigger 2: Case Status Changed

**Event:** `POST /api/cases/[id]/status` succeeds **AND** new status is one of:
- `ACTIVE_SEARCH`
- `RESOLVED`
- `CLOSED_OTHER`

**Notification 2: Status Update to Contact**
- **To:** `contactEmail` from case record (if present)
- **Subject:** `"📢 Update on your lost pet case {CaseNumber}: {NewStatus}"`
- **Body (example for ACTIVE_SEARCH):**
  ```
  Hi {ContactName},

  Your lost pet case has been updated:

  Case Number: {CaseNumber}
  Pet: {PetName}
  New Status: ACTIVE SEARCH

  This means:
  Rescue squad volunteers are actively searching for {PetName} in {City}.

  You can view your case online:
  {BASE_URL}/cases/{CaseNumber}

  We'll notify you of any further updates.

  PetRecovery.org Team
  ```

- **Body (example for RESOLVED):**
  ```
  Hi {ContactName},

  Great news! Your lost pet case has been marked as RESOLVED:

  Case Number: {CaseNumber}
  Pet: {PetName}
  Status: RESOLVED
  Reason: {StatusReason}

  We're so glad {PetName} is safe!

  Thank you for using PetRecovery.org.
  ```

### Trigger 3 (Optional): Case Made Public

**Event:** Admin toggles `isPublic` from `false` → `true` (via future admin UI or manual DB update)

**Notification 3: Case Now Public**
- **To:** `contactEmail` from case record
- **Subject:** `"✅ Your lost pet case is now visible: {CaseNumber}"`
- **Body:**
  ```
  Hi {ContactName},

  Your lost pet case has been approved and is now visible on the public portal:

  View your case: {BASE_URL}/cases/{CaseNumber}

  Community members can now see your case and help search for {PetName}.

  Your contact information is {ContactPrivacyMessage}.

  PetRecovery.org Team
  ```

**Note:** This trigger can be deferred if admin doesn't have UI to toggle `isPublic` yet. Document as "Phase 2" enhancement.

---

## 5. Data Model

### Decision: Option A (No New Tables - Transactional Only)

For this MVP, we are choosing **Option A: No new database tables**.

**Rationale:**
- All notifications are **critical transactional events** (report confirmations, status updates)
- These should NOT have an unsubscribe option (they are essential service communications)
- No need to track subscription state or preferences yet
- Simpler implementation, faster delivery

**What This Means:**
- Email addresses come directly from case records (`contactEmail` field)
- Admin notification email comes from app config (env var or simple settings)
- No opt-in/opt-out UI
- No notification history table (events are already logged via `EventLog`)

**Future Enhancement (Phase 26+):**
- Add `NotificationPreferences` table for user-level controls
- Add `NotificationHistory` table for delivery tracking
- Add opt-out mechanism with tokenized unsubscribe links

**Data Sources for Notifications:**

| Trigger | Recipient Email | Data Source |
|---------|----------------|-------------|
| Public report submitted | Contact | `contactEmail` from POST body |
| Public report submitted | Admin | Config (`ADMIN_NOTIFICATION_EMAIL` env var) |
| Status changed | Contact | `case.contactEmail` from DB |
| Case made public | Contact | `case.contactEmail` from DB |

**No New Models Required**

---

## 6. Backend & Email Infrastructure

### Existing Email Infrastructure

**Email Utility:** `frontend/app/lib/email.js`

```javascript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export async function sendEmail({ to, subject, html }) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `PetRecovery <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

**Environment Variables:**
- `EMAIL_SERVICE` (e.g., "gmail")
- `EMAIL_USER` (SMTP username)
- `EMAIL_PASSWORD` (SMTP password)
- `EMAIL_FROM` (sender address)

**Test Endpoint:** `POST /api/admin/health/test-email`
- Sends test email to logged-in admin
- Emits `admin.test_email_sent` event
- Already demonstrates proper logging pattern

### New Notification Helper Module

**File:** `frontend/app/lib/notifications.js`

This module will provide high-level notification functions that:
1. Accept simple data objects (no Prisma client coupling)
2. Call the existing `sendEmail()` utility
3. Emit structured `notification.*` events via `logEvent()`
4. Handle errors gracefully (catch, log, return)

**Functions:**

```javascript
/**
 * Send confirmation email to contact when public report is submitted
 */
export async function sendCaseReportConfirmation(caseData, options = {}) {
  // caseData: { caseNumber, petName, petSpecies, city, state, contactName, contactEmail, createdAt }
  // options: { isPublicReport: true/false }
}

/**
 * Send alert to admin when public report is submitted
 */
export async function sendAdminPublicReportAlert(caseData) {
  // caseData: { caseNumber, petName, petSpecies, petBreed, city, state, zipCode, lastSeenLandmark, contactName, contactEmail, contactPhone, createdAt, id }
}

/**
 * Send status update to contact when case status changes
 */
export async function sendCaseStatusUpdate(caseData, previousStatus, newStatus) {
  // caseData: { caseNumber, petName, contactName, contactEmail, city, statusReason, isPublic }
  // previousStatus: "OPEN", "ACTIVE_SEARCH", etc.
  // newStatus: "ACTIVE_SEARCH", "RESOLVED", "CLOSED_OTHER"
}

/**
 * Send notification when case becomes public (optional for MVP)
 */
export async function sendCaseNowPublicNotification(caseData) {
  // caseData: { caseNumber, petName, contactName, contactEmail, publicContactOk }
}
```

**Logging Pattern (inside each function):**

```javascript
// Before sending
await logEvent({
  event_type: 'notification.send_attempted',
  resource_type: 'notification',
  resource_id: caseData.caseNumber,
  action: 'create',
  result: 'success',
  metadata: {
    notification_type: 'case_report_confirmation',
    recipient: caseData.contactEmail,
    case_number: caseData.caseNumber
  }
});

// After sending (success)
await logEvent({
  event_type: 'notification.send_succeeded',
  resource_type: 'notification',
  resource_id: caseData.caseNumber,
  action: 'create',
  result: 'success',
  metadata: {
    notification_type: 'case_report_confirmation',
    recipient: caseData.contactEmail,
    case_number: caseData.caseNumber,
    response_time_ms: responseTime
  }
});

// After sending (failure)
await logEvent({
  event_type: 'notification.send_failed',
  resource_type: 'notification',
  resource_id: caseData.caseNumber,
  action: 'create',
  result: 'failure',
  error_code: 'EMAIL_SEND_FAILED',
  error_message: error.message,
  metadata: {
    notification_type: 'case_report_confirmation',
    recipient: caseData.contactEmail,
    case_number: caseData.caseNumber
  }
});
```

---

## 7. API & Event Integration

### Integration Point 1: Public Report Submission

**File:** `frontend/app/api/public/cases/route.js`
**Endpoint:** `POST /api/public/cases`

**Current Behavior (Phase 15-16):**
- Validates input
- Creates case with `isPublic=false`, `source=PUBLIC_REPORT`
- Emits `public_case.report_submitted` event
- Returns success with case number

**New Behavior (Phase 25-26):**

After successful case creation:

```javascript
// Existing code creates newCase...

const responseTime = Date.now() - startTime;

// Existing event logging...
await logEvent({ event_type: 'public_case.report_submitted', ... });

// NEW: Send notifications (non-blocking)
try {
  // 1. Send confirmation to contact
  if (newCase.contactEmail) {
    await sendCaseReportConfirmation({
      caseNumber: newCase.caseNumber,
      petName: newCase.petName,
      petSpecies: newCase.petSpecies,
      city: newCase.city,
      state: newCase.state,
      contactName: newCase.contactName,
      contactEmail: newCase.contactEmail,
      createdAt: newCase.createdAt
    }, { isPublicReport: true });
  }

  // 2. Send alert to admin
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (adminEmail) {
    await sendAdminPublicReportAlert({
      id: newCase.id,
      caseNumber: newCase.caseNumber,
      petName: newCase.petName,
      petSpecies: newCase.petSpecies,
      petBreed: newCase.petBreed,
      city: newCase.city,
      state: newCase.state,
      zipCode: newCase.zipCode,
      lastSeenLandmark: newCase.lastSeenLandmark,
      contactName: newCase.contactName,
      contactEmail: newCase.contactEmail,
      contactPhone: newCase.contactPhone,
      createdAt: newCase.createdAt
    });
  }
} catch (notificationError) {
  // Log but don't break the API response
  console.error('Notification error:', notificationError);
  await logEvent({
    event_type: 'notification.send_failed',
    resource_type: 'notification',
    action: 'create',
    result: 'failure',
    error_code: 'NOTIFICATION_ERROR',
    error_message: notificationError.message,
    metadata: { case_number: newCase.caseNumber }
  });
}

// Return the original successful response
return NextResponse.json({ success: true, caseNumber: newCase.caseNumber, ... });
```

**Error Handling:**
- Email failures are caught and logged
- API still returns 201 Created if case creation succeeded
- Failures visible in `/admin/health` Errors tab

### Integration Point 2: Case Status Update

**File:** `frontend/app/api/cases/[id]/status/route.js`
**Endpoint:** `POST /api/cases/[id]/status`

**Current Behavior (Phase 13-14):**
- Validates status transition
- Updates case status
- Creates status change note
- Emits `case.status_changed` event
- Returns updated case

**New Behavior (Phase 25-26):**

After successful status update:

```javascript
// Existing code updates case status...

const responseTime = Date.now() - startTime;

// Existing event logging...
await logEvent({ event_type: 'case.status_changed', ... });

// NEW: Send notification if relevant status
const notifiableStatuses = ['ACTIVE_SEARCH', 'RESOLVED', 'CLOSED_OTHER'];
if (notifiableStatuses.includes(newStatus) && updatedCase.contactEmail) {
  try {
    await sendCaseStatusUpdate({
      caseNumber: updatedCase.caseNumber,
      petName: updatedCase.petName,
      contactName: updatedCase.contactName,
      contactEmail: updatedCase.contactEmail,
      city: updatedCase.city,
      statusReason: updatedCase.statusReason,
      isPublic: updatedCase.isPublic
    }, previousStatus, newStatus);
  } catch (notificationError) {
    console.error('Status notification error:', notificationError);
    // Don't break the API response
  }
}

// Return the original successful response
return NextResponse.json({ case: updatedCase });
```

**Important:**
- Only send if new status is `ACTIVE_SEARCH`, `RESOLVED`, or `CLOSED_OTHER`
- Only send if `contactEmail` is present
- Don't send duplicate emails if status is updated to same value repeatedly
  - (Can add simple check: `if (previousStatus !== newStatus)`)

### Integration Point 3 (Optional): Case Made Public

**File:** Future admin UI or manual process
**Trigger:** `isPublic` toggled from `false` → `true`

This can be deferred to a later task or phase if admin doesn't have a UI for toggling `isPublic` yet.

If implemented:
```javascript
// When admin approves case and sets isPublic=true
if (previousIsPublic === false && newIsPublic === true && caseData.contactEmail) {
  await sendCaseNowPublicNotification(caseData);
}
```

---

## 8. UI / UX

### Admin Notifications Settings

**Option for MVP: Environment Variable Only**

For the MVP, we can use a simple environment variable approach:

**Environment Variable:**
- `ADMIN_NOTIFICATION_EMAIL` - Email address for admin notifications

**Documentation:**
- Document in `SETUP.md` or `.env.example`
- Admins configure via Render environment variables

**Future Enhancement (Phase 26+):**
- Add `/admin/settings/notifications` page
- Fields:
  - Admin notification email (editable)
  - Toggle: "Send admin alerts for public reports" (on/off)
  - Preview email template button
- Persist to database (new `AppConfig` model or existing settings mechanism)

### Notifications Health in Admin Dashboard

**Location:** `/admin/health`

**New Card (Optional for MVP):**

Add a small "Notifications Health" card in the System Health section:

```
┌─────────────────────────────────────┐
│ 📧 Notifications (Last 24h)         │
├─────────────────────────────────────┤
│ Attempts:  42                       │
│ Succeeded: 40                       │
│ Failed:     2                       │
│                                     │
│ [View Notification Errors →]       │
└─────────────────────────────────────┘
```

Clicking "View Notification Errors" filters the Errors tab to `notification.*` events.

**Implementation:**
- Query `EventLog` for `notification.*` events in last 24h
- Count by result (success/failure)
- Link to filtered Errors tab

**Can be deferred** if too much scope for MVP. Core requirement is that notification failures appear in Errors tab.

---

## 9. Logging & Observability

### Event Types

All notification attempts must emit structured events via `logEvent()`:

**Event Types:**

| Event Type | When | Result | Severity |
|------------|------|--------|----------|
| `notification.send_attempted` | Before sending any notification | success | low |
| `notification.send_succeeded` | After successful email delivery | success | low |
| `notification.send_failed` | After failed email delivery | failure | medium |

**Additional context events** (optional, for granularity):
- `notification.case_report_confirmation_sent`
- `notification.admin_alert_sent`
- `notification.status_update_sent`

**Metadata Fields:**

All notification events should include:
```javascript
{
  notification_type: 'case_report_confirmation' | 'admin_alert' | 'status_update' | 'case_now_public',
  recipient: 'email@example.com',
  case_number: 'CHI-2025-0001',
  case_id: 'cuid123',
  response_time_ms: 1234 // for success/failure
}
```

**Error Fields (for failures):**
```javascript
{
  error_code: 'EMAIL_SEND_FAILED' | 'SMTP_ERROR' | 'INVALID_EMAIL',
  error_message: 'SMTP timeout after 30s'
}
```

### ERROR_IMPACT Configuration

**File:** `frontend/app/admin/health/page.jsx`

Add to `ERROR_IMPACT` object:

```javascript
const ERROR_IMPACT = {
  // ... existing mappings ...

  // Notifications (Phase 25-26)
  'notification.send_failed': { label: 'Notification Delivery', severity: 'medium' },
  'notification.send_attempted': { label: 'Notification Attempts', severity: 'low' },
  'notification.send_succeeded': { label: 'Notification Success', severity: 'low' },
};
```

**Severity Justification:**
- **medium** for `send_failed` - Notifications are important but not as critical as core case creation
- **low** for attempts/success - These are informational, not errors

### Example Event Logs

**Example 1: Successful Report Confirmation**

```json
{
  "event_type": "notification.send_succeeded",
  "timestamp": "2025-11-25T10:30:00.000Z",
  "correlation_id": "uuid-abc-123",
  "resource_type": "notification",
  "resource_id": "CHI-2025-0042",
  "action": "create",
  "result": "success",
  "metadata": {
    "notification_type": "case_report_confirmation",
    "recipient": "owner@example.com",
    "case_number": "CHI-2025-0042",
    "case_id": "cuid456",
    "response_time_ms": 234
  }
}
```

**Example 2: Failed Admin Alert**

```json
{
  "event_type": "notification.send_failed",
  "timestamp": "2025-11-25T10:30:01.000Z",
  "correlation_id": "uuid-abc-124",
  "resource_type": "notification",
  "resource_id": "CHI-2025-0042",
  "action": "create",
  "result": "failure",
  "error_code": "SMTP_ERROR",
  "error_message": "Connection timeout to smtp.gmail.com",
  "metadata": {
    "notification_type": "admin_alert",
    "recipient": "admin@petrecovery.org",
    "case_number": "CHI-2025-0042"
  }
}
```

---

## 10. Legal & Privacy Considerations

### Transactional Communications

All notifications in this MVP are **transactional** (not marketing):
- Report confirmations: Acknowledge user-initiated action
- Status updates: Service-related updates about user's case
- Admin alerts: Operational notifications for platform management

**Legal Classification:** Transactional emails are **exempt from CAN-SPAM unsubscribe requirements** when they facilitate a transaction or provide information about an account/service.

### Data Used in Emails

**Personal Data Included:**
- Contact name (`contactName`)
- Contact email (`contactEmail`)
- Pet name (`petName`)
- Location (city, state, landmark)
- Case details (species, breed, color)

**Data NOT Included:**
- Internal case notes (from `LostPetCaseNote`)
- Rescue squad member names or IDs
- Admin user information
- IP addresses or tracking data (for MVP)

### Privacy Controls

**Contact Info Protection:**
- Public report emails only go to the email address provided in the report
- Admin emails only go to configured admin address (not to all admins)
- No CC or BCC to third parties
- Emails are plain text/HTML only (no tracking pixels for MVP)

**Public Links:**
- Emails to contacts include public-safe links only: `/cases/[caseNumber]`
- Emails to admins include authenticated admin links: `/admin/cases/[id]`
- All URLs use `BASE_URL` environment variable (configured per environment)

### Future Enhancements (Post-MVP)

- Add unsubscribe links (when adding subscription preferences)
- Add "Report spam" footer
- GDPR compliance: Data access and deletion via email requests
- Enhanced privacy: Redact sensitive data in email logs

---

## 11. Testing Strategy

### Manual Testing (During Development)

**Environment Setup:**
1. Configure email credentials in `.env.local`:
   ```
   EMAIL_SERVICE=gmail
   EMAIL_USER=test@gmail.com
   EMAIL_PASSWORD=app_specific_password
   EMAIL_FROM="PetRecovery Test <test@gmail.com>"
   ADMIN_NOTIFICATION_EMAIL=admin@petrecovery.org
   ```

2. Use a test email service (Gmail with app password or Mailtrap for dev)

**Test Scenarios:**

**Test 1: Public Report Confirmation**
- Submit a lost pet report via `/cases/report`
- Verify two emails are sent:
  - [ ] Contact receives confirmation email with case number
  - [ ] Admin receives alert email with case details
- Check `/admin/health` for `notification.*` events

**Test 2: Status Change Notification**
- Create a case with `contactEmail` in `/admin/cases`
- Update status to `ACTIVE_SEARCH`
- Verify contact receives status update email
- Update status to `RESOLVED`
- Verify contact receives resolved email
- Check `/admin/health` for events

**Test 3: Email Failure Handling**
- Configure invalid SMTP credentials
- Submit public report
- Verify:
  - [ ] API still returns success (case created)
  - [ ] `notification.send_failed` event logged
  - [ ] Error appears in `/admin/health` Errors tab

**Test 4: Missing Contact Email**
- Submit public report with no email
- Verify:
  - [ ] Case created successfully
  - [ ] No contact email sent (gracefully skipped)
  - [ ] Admin email still sent
  - [ ] No errors logged

### QA Harness Tests (TASK-N06)

Add to `/admin/qa` page:

**Test Suite: "Notification Tests"**

**Test 1: Public Report Notification Events**
- Calls `POST /api/public/cases` with test data
- Verifies API returns success
- Checks event logs for:
  - [ ] `notification.send_attempted` (2x: contact + admin)
  - [ ] `notification.send_succeeded` OR `notification.send_failed`
- Returns: Event counts, success rate

**Test 2: Status Change Notification Events**
- Creates a test case with contact email
- Updates status to `ACTIVE_SEARCH`
- Checks event logs for:
  - [ ] `notification.send_attempted`
  - [ ] `notification.send_succeeded` OR `notification.send_failed`
- Returns: Event counts, notification type

**Test 3: Email Configuration Check**
- Checks environment variables:
  - [ ] `EMAIL_USER` set
  - [ ] `EMAIL_PASSWORD` set
  - [ ] `ADMIN_NOTIFICATION_EMAIL` set
- Returns: Configuration status

**Note:** QA tests check event logging, not actual email delivery (to avoid sending spam emails during tests).

### Browser Testing

**Smoke Test Checklist:**
1. Navigate to `/cases/report`
2. Submit a report with your real email
3. Check your inbox for confirmation email (within 1 minute)
4. Check admin inbox for alert email
5. Navigate to `/admin/cases`
6. Update case status to `ACTIVE_SEARCH`
7. Check inbox for status update email
8. Navigate to `/admin/health`
9. Verify `notification.*` events appear in Errors tab (if any failures)

---

## 12. Acceptance Criteria

### Functional Requirements

- [ ] **Email Infrastructure Audited**
  - Existing `sendEmail()` utility documented
  - Environment variables identified and documented
  - Test email endpoint verified working

- [ ] **Notification Helper Module Created**
  - `lib/notifications.js` created with 4 functions
  - Each function wraps `sendEmail()` with proper logging
  - All functions emit `notification.*` events

- [ ] **Public Report Notifications Working**
  - Contact receives confirmation email when submitting report
  - Admin receives alert email when report submitted
  - Emails sent within 1 minute of submission
  - API response not blocked by email failures

- [ ] **Status Change Notifications Working**
  - Contact receives email when status changes to `ACTIVE_SEARCH`
  - Contact receives email when status changes to `RESOLVED`
  - Contact receives email when status changes to `CLOSED_OTHER`
  - No email sent for other status transitions
  - No duplicate emails for same status

- [ ] **Admin Configuration**
  - `ADMIN_NOTIFICATION_EMAIL` environment variable documented
  - Admin can configure email via Render environment settings

- [ ] **Observability Complete**
  - All notification attempts emit `notification.*` events
  - Failures appear in `/admin/health` Errors tab
  - `notification.send_failed` added to `ERROR_IMPACT` mapping
  - Event metadata includes notification type, recipient, case number

- [ ] **QA Harness Integration**
  - 3 notification tests added to `/admin/qa`
  - Tests verify event logging (not actual email delivery)
  - Tests passing and visible in QA results

- [ ] **Documentation Updated**
  - Feature spec status updated to "✅ Fully Implemented"
  - `VISION.md` updated with Phase 25-26 entry
  - `VISION.md` marked as COMPLETE
  - `SETUP.md` updated with email configuration instructions

### Non-Functional Requirements

- [ ] **Privacy & Security**
  - No sensitive internal data in emails (notes, admin IDs)
  - Public links only in contact emails
  - Admin links only in admin emails

- [ ] **Error Handling**
  - Email failures don't break API responses
  - All errors logged with structured events
  - Graceful handling of missing email addresses

- [ ] **Performance**
  - Email sending doesn't significantly slow API responses (< 1s added latency)
  - No blocking waits for email delivery

---

## 13. Future Enhancements (Post-MVP)

### Phase 26+: Enhanced Notifications

**Subscription Management:**
- Add `NotificationPreferences` model
- User-level email preferences (opt-in/opt-out per notification type)
- Unsubscribe links with tokenized URLs
- Preference center UI

**Additional Channels:**
- SMS notifications via Twilio
- In-app notifications (browser push, badge counts)
- Webhook notifications for integrations

**Advanced Triggers:**
- New sighting reported on case
- Case comment added
- Case assigned to rescue squad
- Rescue squad member joins case
- Follow city/area subscriptions (notify on new cases in area)

**Rich Templates:**
- HTML email templates with branding
- Pet photos in emails (if available)
- Interactive buttons (CTA: "View Case", "Update Status")
- Digest emails (daily/weekly summaries)

**Analytics:**
- Email open rates (tracking pixels)
- Click-through rates (tracked links)
- Bounce rate monitoring
- Delivery rate by email provider

**Batch & Scheduling:**
- Queue-based email sending (e.g., BullMQ)
- Retry logic for failed sends
- Rate limiting to avoid SMTP throttling
- Scheduled digest emails

**Localization:**
- Multi-language email templates
- Timezone-aware timestamps
- Regional formatting (dates, phone numbers)

---

## Appendix: Email Environment Variables

### Required Variables

```bash
# Email Service Configuration
EMAIL_SERVICE=gmail                          # SMTP service provider
EMAIL_USER=petrecovery@gmail.com             # SMTP username
EMAIL_PASSWORD=your_app_specific_password    # SMTP password
EMAIL_FROM="PetRecovery.org <petrecovery@gmail.com>"  # Sender address

# Notification Recipients
ADMIN_NOTIFICATION_EMAIL=admin@petrecovery.org  # Admin alert recipient

# Base URL (for links in emails)
NEXT_PUBLIC_BASE_URL=https://petrecovery.org    # Production URL
```

### Setup Instructions

**Gmail (Development):**
1. Enable 2-factor authentication on Gmail account
2. Generate app-specific password: https://myaccount.google.com/apppasswords
3. Use app password as `EMAIL_PASSWORD`

**SendGrid (Production - Recommended):**
1. Sign up for SendGrid account
2. Create API key
3. Set `EMAIL_SERVICE=sendgrid`
4. Set `EMAIL_PASSWORD=<api_key>`

**Mailtrap (Testing):**
1. Sign up for Mailtrap account
2. Get SMTP credentials from inbox settings
3. Use Mailtrap SMTP host and credentials

---

**Status:** ❌ Not Started
**Next Step:** Create `docs/NOTIFICATIONS_TASKS.md` and begin TASK-N01
