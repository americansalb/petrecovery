# Feature Spec: Notifications MVP (Phase 25–26)

**Status:** ✅ Fully Implemented
**Owner:** Product + Engineering
**Last Updated:** November 25, 2025
**Phase:** 25–26 (Notifications MVP - Mission Alerts & Admin Signals)

---

## 0. Summary

We're building a **transactional notifications layer** that automatically sends email alerts for key mission lifecycle events. This MVP focuses on:

- **Owner/contact notifications**: Email confirmations when public reports are submitted, and updates when mission status changes.
- **Admin notifications**: Immediate alerts when public reports are submitted for review.
- **Full observability**: All notification attempts emit structured events visible in `/admin/health`.

This is a **minimal, safe, transactional-only** implementation:
- No SMS (email only for MVP)
- No subscriptions or preferences UI (hard-coded triggers)
- No marketing or newsletters
- Built entirely on existing infrastructure (nodemailer, event logging, mission system)

**Key Principles:**

- **Transactional only**: Critical mission lifecycle events, not marketing
- **Privacy-respecting**: Only send to mission contact emails, no third parties
- **Observable**: Every send attempt logged with structured events
- **Non-blocking**: Email failures don't break API responses
- **Simple**: Minimal new models, leverage existing email utility

This phase builds directly on:
- **Phase 0**: Observability + event logging
- **Phase 13–14**: Internal mission management system
- **Phase 15–16**: Public mission portal (public reports)
- **Phase 20–21**: QA harness for testing

Future phases will add: SMS, subscription preferences, in-app notifications, and advanced templates.

---

## 1. Problem / Why

### Current State

After Phase 15–16, we have a **public lost pet mission portal** where:
- The public can submit lost pet reports via `/missions/report`
- Admins can create and manage missions via `/admin/missions`
- Missions can transition through statuses: OPEN → ACTIVE_SEARCH → RESOLVED

However:
- **Reporters get no confirmation** when they submit a public report
- **Pet owners get no updates** when their mission status changes
- **Admins must poll `/admin/missions`** to discover new public reports
- **No way to proactively inform stakeholders** of critical mission events

### Problems Solved

**For Pet Owners/Reporters:**
- "I submitted a report but don't know if it went through"
- "My mission status changed but I had no idea"
- "I want updates without checking the website every day"

**For Admins:**
- "I don't know when new public reports arrive"
- "I have to refresh the admin page constantly"
- "I miss urgent missions because I'm not always logged in"

**For Platform Operations:**
- "Email delivery failures go unnoticed"
- "We have no metrics on notification health"
- "Can't debug why users say they didn't receive emails"

---

## 2. Goals / Non-goals

### Goals

**MVP Notification Triggers (Email Only):**

1. **Public Report Submitted** (when `POST /api/public/missions` succeeds):
   - Send confirmation email to mission contact
   - Send admin alert email to configured admin address

2. **Mission Status Changed** (when `POST /api/missions/[id]/status` succeeds):
   - If status transitions to `ACTIVE_SEARCH`, `RESOLVED`, or `CLOSED_OTHER`:
     - Send status update email to mission contact (if `contactEmail` present)

3. **Mission Made Public** (optional for MVP, if easy):
   - When admin toggles `isPublic` from false → true:
     - Send notification to mission contact that their mission is now visible

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
- ❌ **No "follow city" or area subscriptions** - Only mission-specific notifications
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
- Email contains mission number, pet name, and review timeline
- Email is sent even if mission is not yet public (isPublic=false)

**Story 2: Status Update Notifications**
> As a pet owner whose mission is being managed,
> I want to receive email updates when the mission status changes,
> So I know when volunteers start searching or when my pet is found.

**Acceptance:**
- Email sent when status changes to ACTIVE_SEARCH, RESOLVED, or CLOSED_OTHER
- Email explains what the new status means
- Email includes mission number and link to public mission page (if public)

### Admin

**Story 3: Public Report Alerts**
> As an admin,
> I want to receive an email immediately when a public report is submitted,
> So I can review and approve it quickly without constantly checking the admin dashboard.

**Acceptance:**
- Email arrives within 1 minute of public report submission
- Email includes pet details, location, and direct link to `/admin/missions/[id]`
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

For this MVP, we support **only email notifications**. All notifications are **transactional** (critical mission lifecycle events).

### Trigger 1: Public Report Submitted

**Event:** `POST /api/public/missions` succeeds

**Notification 1A: Owner/Contact Confirmation**
- **To:** `contactEmail` from request body
- **Subject:** `"✅ We received your lost pet report: {PetName or MissionNumber}"`
- **Body:**
  ```
  Hi {ContactName},

  Thank you for submitting a lost pet report to ReunitePets.org.

  Mission Details:
  - Mission Number: {MissionNumber}
  - Pet: {PetName} ({PetSpecies})
  - Location: {City}, {State}
  - Submitted: {Timestamp}

  What happens next:
  1. Our admin team will review your report within 24-48 hours.
  2. Once approved, your mission will be visible on the public portal.
  3. You'll receive email updates when the status changes.

  Important: Your contact information is NOT publicly visible by default.

  If you have questions, please reply to this email.

  ReunitePets.org Team
  ```

**Notification 1B: Admin Alert**
- **To:** Configured admin email (from settings or env var `ADMIN_NOTIFICATION_EMAIL`)
- **Subject:** `"🚨 New Public Report: {City}, {State} – {PetName}"`
- **Body:**
  ```
  A new public lost pet report requires review:

  Mission Number: {MissionNumber}
  Pet: {PetName} ({PetSpecies}, {PetBreed})
  Location: {City}, {State} ({ZipCode})
  Landmark: {LastSeenLandmark}
  Contact: {ContactName} ({ContactEmail}, {ContactPhone})
  Submitted: {Timestamp}

  Review and approve this mission:
  {BASE_URL}/admin/missions/{MissionId}

  This mission is currently NOT public (requires approval).
  ```

### Trigger 2: Mission Status Changed

**Event:** `POST /api/missions/[id]/status` succeeds **AND** new status is one of:
- `ACTIVE_SEARCH`
- `RESOLVED`
- `CLOSED_OTHER`

**Notification 2: Status Update to Contact**
- **To:** `contactEmail` from mission record (if present)
- **Subject:** `"📢 Update on your lost pet mission {MissionNumber}: {NewStatus}"`
- **Body (example for ACTIVE_SEARCH):**
  ```
  Hi {ContactName},

  Your lost pet mission has been updated:

  Mission Number: {MissionNumber}
  Pet: {PetName}
  New Status: ACTIVE SEARCH

  This means:
  Rescue squad volunteers are actively searching for {PetName} in {City}.

  You can view your mission online:
  {BASE_URL}/missions/{MissionNumber}

  We'll notify you of any further updates.

  ReunitePets.org Team
  ```

- **Body (example for RESOLVED):**
  ```
  Hi {ContactName},

  Great news! Your lost pet mission has been marked as RESOLVED:

  Mission Number: {MissionNumber}
  Pet: {PetName}
  Status: RESOLVED
  Reason: {StatusReason}

  We're so glad {PetName} is safe!

  Thank you for using ReunitePets.org.
  ```

### Trigger 3 (Optional): Mission Made Public

**Event:** Admin toggles `isPublic` from `false` → `true` (via future admin UI or manual DB update)

**Notification 3: Mission Now Public**
- **To:** `contactEmail` from mission record
- **Subject:** `"✅ Your lost pet mission is now visible: {MissionNumber}"`
- **Body:**
  ```
  Hi {ContactName},

  Your lost pet mission has been approved and is now visible on the public portal:

  View your mission: {BASE_URL}/missions/{MissionNumber}

  Community members can now see your mission and help search for {PetName}.

  Your contact information is {ContactPrivacyMessage}.

  ReunitePets.org Team
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
- Email addresses come directly from mission records (`contactEmail` field)
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
| Status changed | Contact | `mission.contactEmail` from DB |
| Mission made public | Contact | `mission.contactEmail` from DB |

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
      from: process.env.EMAIL_FROM || `ReunitePets <${process.env.EMAIL_USER}>`,
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
export async function sendMissionReportConfirmation(missionData, options = {}) {
  // missionData: { missionNumber, petName, petSpecies, city, state, contactName, contactEmail, createdAt }
  // options: { isPublicReport: true/false }
}

/**
 * Send alert to admin when public report is submitted
 */
export async function sendAdminPublicReportAlert(missionData) {
  // missionData: { missionNumber, petName, petSpecies, petBreed, city, state, zipCode, lastSeenLandmark, contactName, contactEmail, contactPhone, createdAt, id }
}

/**
 * Send status update to contact when mission status changes
 */
export async function sendMissionStatusUpdate(missionData, previousStatus, newStatus) {
  // missionData: { missionNumber, petName, contactName, contactEmail, city, statusReason, isPublic }
  // previousStatus: "OPEN", "ACTIVE_SEARCH", etc.
  // newStatus: "ACTIVE_SEARCH", "RESOLVED", "CLOSED_OTHER"
}

/**
 * Send notification when mission becomes public (optional for MVP)
 */
export async function sendMissionNowPublicNotification(missionData) {
  // missionData: { missionNumber, petName, contactName, contactEmail, publicContactOk }
}
```

**Logging Pattern (inside each function):**

```javascript
// Before sending
await logEvent({
  event_type: 'notification.send_attempted',
  resource_type: 'notification',
  resource_id: missionData.missionNumber,
  action: 'create',
  result: 'success',
  metadata: {
    notification_type: 'mission_report_confirmation',
    recipient: missionData.contactEmail,
    mission_number: missionData.missionNumber
  }
});

// After sending (success)
await logEvent({
  event_type: 'notification.send_succeeded',
  resource_type: 'notification',
  resource_id: missionData.missionNumber,
  action: 'create',
  result: 'success',
  metadata: {
    notification_type: 'mission_report_confirmation',
    recipient: missionData.contactEmail,
    mission_number: missionData.missionNumber,
    response_time_ms: responseTime
  }
});

// After sending (failure)
await logEvent({
  event_type: 'notification.send_failed',
  resource_type: 'notification',
  resource_id: missionData.missionNumber,
  action: 'create',
  result: 'failure',
  error_code: 'EMAIL_SEND_FAILED',
  error_message: error.message,
  metadata: {
    notification_type: 'mission_report_confirmation',
    recipient: missionData.contactEmail,
    mission_number: missionData.missionNumber
  }
});
```

---

## 7. API & Event Integration

### Integration Point 1: Public Report Submission

**File:** `frontend/app/api/public/missions/route.js`
**Endpoint:** `POST /api/public/missions`

**Current Behavior (Phase 15-16):**
- Validates input
- Creates mission with `isPublic=false`, `source=PUBLIC_REPORT`
- Emits `public_mission.report_submitted` event
- Returns success with mission number

**New Behavior (Phase 25-26):**

After successful mission creation:

```javascript
// Existing code creates newMission...

const responseTime = Date.now() - startTime;

// Existing event logging...
await logEvent({ event_type: 'public_mission.report_submitted', ... });

// NEW: Send notifications (non-blocking)
try {
  // 1. Send confirmation to contact
  if (newMission.contactEmail) {
    await sendMissionReportConfirmation({
      missionNumber: newMission.missionNumber,
      petName: newMission.petName,
      petSpecies: newMission.petSpecies,
      city: newMission.city,
      state: newMission.state,
      contactName: newMission.contactName,
      contactEmail: newMission.contactEmail,
      createdAt: newMission.createdAt
    }, { isPublicReport: true });
  }

  // 2. Send alert to admin
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (adminEmail) {
    await sendAdminPublicReportAlert({
      id: newMission.id,
      missionNumber: newMission.missionNumber,
      petName: newMission.petName,
      petSpecies: newMission.petSpecies,
      petBreed: newMission.petBreed,
      city: newMission.city,
      state: newMission.state,
      zipCode: newMission.zipCode,
      lastSeenLandmark: newMission.lastSeenLandmark,
      contactName: newMission.contactName,
      contactEmail: newMission.contactEmail,
      contactPhone: newMission.contactPhone,
      createdAt: newMission.createdAt
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
    metadata: { mission_number: newMission.missionNumber }
  });
}

// Return the original successful response
return NextResponse.json({ success: true, missionNumber: newMission.missionNumber, ... });
```

**Error Handling:**
- Email failures are caught and logged
- API still returns 201 Created if mission creation succeeded
- Failures visible in `/admin/health` Errors tab

### Integration Point 2: Mission Status Update

**File:** `frontend/app/api/missions/[id]/status/route.js`
**Endpoint:** `POST /api/missions/[id]/status`

**Current Behavior (Phase 13-14):**
- Validates status transition
- Updates mission status
- Creates status change note
- Emits `mission.status_changed` event
- Returns updated mission

**New Behavior (Phase 25-26):**

After successful status update:

```javascript
// Existing code updates mission status...

const responseTime = Date.now() - startTime;

// Existing event logging...
await logEvent({ event_type: 'mission.status_changed', ... });

// NEW: Send notification if relevant status
const notifiableStatuses = ['ACTIVE_SEARCH', 'RESOLVED', 'CLOSED_OTHER'];
if (notifiableStatuses.includes(newStatus) && updatedMission.contactEmail) {
  try {
    await sendMissionStatusUpdate({
      missionNumber: updatedMission.missionNumber,
      petName: updatedMission.petName,
      contactName: updatedMission.contactName,
      contactEmail: updatedMission.contactEmail,
      city: updatedMission.city,
      statusReason: updatedMission.statusReason,
      isPublic: updatedMission.isPublic
    }, previousStatus, newStatus);
  } catch (notificationError) {
    console.error('Status notification error:', notificationError);
    // Don't break the API response
  }
}

// Return the original successful response
return NextResponse.json({ mission: updatedMission });
```

**Important:**
- Only send if new status is `ACTIVE_SEARCH`, `RESOLVED`, or `CLOSED_OTHER`
- Only send if `contactEmail` is present
- Don't send duplicate emails if status is updated to same value repeatedly
  - (Can add simple check: `if (previousStatus !== newStatus)`)

### Integration Point 3 (Optional): Mission Made Public

**File:** Future admin UI or manual process
**Trigger:** `isPublic` toggled from `false` → `true`

This can be deferred to a later task or phase if admin doesn't have a UI for toggling `isPublic` yet.

If implemented:
```javascript
// When admin approves mission and sets isPublic=true
if (previousIsPublic === false && newIsPublic === true && missionData.contactEmail) {
  await sendMissionNowPublicNotification(missionData);
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
- `notification.mission_report_confirmation_sent`
- `notification.admin_alert_sent`
- `notification.status_update_sent`

**Metadata Fields:**

All notification events should include:
```javascript
{
  notification_type: 'mission_report_confirmation' | 'admin_alert' | 'status_update' | 'mission_now_public',
  recipient: 'email@example.com',
  mission_number: 'CHI-2025-0001',
  mission_id: 'cuid123',
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
- **medium** for `send_failed` - Notifications are important but not as critical as core mission creation
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
    "notification_type": "mission_report_confirmation",
    "recipient": "owner@example.com",
    "mission_number": "CHI-2025-0042",
    "mission_id": "cuid456",
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
    "recipient": "admin@reunitepets.org",
    "mission_number": "CHI-2025-0042"
  }
}
```

---

## 10. Legal & Privacy Considerations

### Transactional Communications

All notifications in this MVP are **transactional** (not marketing):
- Report confirmations: Acknowledge user-initiated action
- Status updates: Service-related updates about user's mission
- Admin alerts: Operational notifications for platform management

**Legal Classification:** Transactional emails are **exempt from CAN-SPAM unsubscribe requirements** when they facilitate a transaction or provide information about an account/service.

### Data Used in Emails

**Personal Data Included:**
- Contact name (`contactName`)
- Contact email (`contactEmail`)
- Pet name (`petName`)
- Location (city, state, landmark)
- Mission details (species, breed, color)

**Data NOT Included:**
- Internal mission notes (from `LostPetMissionNote`)
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
- Emails to contacts include public-safe links only: `/missions/[missionNumber]`
- Emails to admins include authenticated admin links: `/admin/missions/[id]`
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
   EMAIL_FROM="ReunitePets Test <test@gmail.com>"
   ADMIN_NOTIFICATION_EMAIL=admin@reunitepets.org
   ```

2. Use a test email service (Gmail with app password or Mailtrap for dev)

**Test Scenarios:**

**Test 1: Public Report Confirmation**
- Submit a lost pet report via `/missions/report`
- Verify two emails are sent:
  - [ ] Contact receives confirmation email with mission number
  - [ ] Admin receives alert email with mission details
- Check `/admin/health` for `notification.*` events

**Test 2: Status Change Notification**
- Create a mission with `contactEmail` in `/admin/missions`
- Update status to `ACTIVE_SEARCH`
- Verify contact receives status update email
- Update status to `RESOLVED`
- Verify contact receives resolved email
- Check `/admin/health` for events

**Test 3: Email Failure Handling**
- Configure invalid SMTP credentials
- Submit public report
- Verify:
  - [ ] API still returns success (mission created)
  - [ ] `notification.send_failed` event logged
  - [ ] Error appears in `/admin/health` Errors tab

**Test 4: Missing Contact Email**
- Submit public report with no email
- Verify:
  - [ ] Mission created successfully
  - [ ] No contact email sent (gracefully skipped)
  - [ ] Admin email still sent
  - [ ] No errors logged

### QA Harness Tests (TASK-N06)

Add to `/admin/qa` page:

**Test Suite: "Notification Tests"**

**Test 1: Public Report Notification Events**
- Calls `POST /api/public/missions` with test data
- Verifies API returns success
- Checks event logs for:
  - [ ] `notification.send_attempted` (2x: contact + admin)
  - [ ] `notification.send_succeeded` OR `notification.send_failed`
- Returns: Event counts, success rate

**Test 2: Status Change Notification Events**
- Creates a test mission with contact email
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
1. Navigate to `/missions/report`
2. Submit a report with your real email
3. Check your inbox for confirmation email (within 1 minute)
4. Check admin inbox for alert email
5. Navigate to `/admin/missions`
6. Update mission status to `ACTIVE_SEARCH`
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
  - Event metadata includes notification type, recipient, mission number

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
- New sighting reported on mission
- Mission comment added
- Mission assigned to rescue force
- Rescue squad member joins mission
- Follow city/area subscriptions (notify on new missions in area)

**Rich Templates:**
- HTML email templates with branding
- Pet photos in emails (if available)
- Interactive buttons (CTA: "View Mission", "Update Status")
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
EMAIL_USER=reunitepets@gmail.com             # SMTP username
EMAIL_PASSWORD=your_app_specific_password    # SMTP password
EMAIL_FROM="ReunitePets.org <reunitepets@gmail.com>"  # Sender address

# Notification Recipients
ADMIN_NOTIFICATION_EMAIL=admin@reunitepets.org  # Admin alert recipient

# Base URL (for links in emails)
NEXT_PUBLIC_BASE_URL=https://reunitepets.org    # Production URL
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
