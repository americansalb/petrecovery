# Notifications Tasks (Phase 25–26)

**Feature Spec:** [docs/features/notifications-mvp.md](features/notifications-mvp.md)
**Status:** IN PROGRESS
**Last Updated:** 2025-11-25

---

## Task Overview

| Task ID | Description | Status | Priority |
|---------|-------------|--------|----------|
| TASK-N01 | Create notifications helper module | TODO | HIGH |
| TASK-N02 | sendCaseReportConfirmation function | TODO | HIGH |
| TASK-N03 | sendAdminPublicReportAlert function | TODO | HIGH |
| TASK-N04 | sendCaseStatusUpdate function | TODO | HIGH |
| TASK-N05 | Integrate notifications into POST /api/public/cases | TODO | HIGH |
| TASK-N06 | Create case status update API | TODO | MEDIUM |
| TASK-N07 | Integrate notifications into status changes | TODO | MEDIUM |
| TASK-N08 | sendCoordinatorAssignmentNotification function | TODO | MEDIUM |
| TASK-N09 | QA harness tests for notifications | TODO | MEDIUM |
| TASK-N10 | ERROR_IMPACT health dashboard entries | TODO | MEDIUM |
| TASK-N11 | Update VISION.md with completion status | TODO | LOW |

---

## TASK-N01: Create Notifications Helper Module

**Goal:** Create the notifications module structure with logging integration.

**Files:**
- `frontend/app/lib/notifications.js` (new)

**Implementation:**

```javascript
// lib/notifications.js
import { sendEmail } from './email';
import { logEvent } from './logging';

/**
 * Check if notifications are enabled
 */
function isNotificationsEnabled() {
  return process.env.NOTIFICATIONS_ENABLED !== 'false';
}

/**
 * Check if admin alerts are enabled
 */
function isAdminAlertsEnabled() {
  return process.env.ADMIN_ALERT_ENABLED !== 'false';
}

/**
 * Get admin email from environment
 */
function getAdminEmail() {
  return process.env.ADMIN_ALERT_EMAIL;
}

/**
 * Get base URL for links
 */
function getBaseUrl() {
  return process.env.NEXTAUTH_URL || 'http://localhost:3000';
}

/**
 * Standard email footer
 */
function getEmailFooter() {
  return `
    <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
    <p style="font-size: 12px; color: #666; margin-top: 20px;">
      PetRecovery.org - Helping lost pets find their way home
      <br><br>
      You're receiving this email because you have an active case or recently submitted a report.
    </p>
  `;
}

// Export notification functions (implemented in subsequent tasks)
export {
  isNotificationsEnabled,
  isAdminAlertsEnabled,
  getAdminEmail,
  getBaseUrl,
  getEmailFooter,
};
```

**Acceptance Criteria:**
- [ ] notifications.js module created
- [ ] Helper functions for config checks
- [ ] Email footer template defined

---

## TASK-N02: sendCaseReportConfirmation Function

**Goal:** Create function to send confirmation email to reporter.

**Files:**
- `frontend/app/lib/notifications.js` (add function)

**Implementation:**

```javascript
/**
 * Send case report confirmation to reporter
 * @param {object} caseData - Case data including ownerEmail, petName, caseNumber
 * @returns {Promise<{success: boolean, skipped?: boolean, reason?: string, error?: string}>}
 */
export async function sendCaseReportConfirmation(caseData) {
  if (!isNotificationsEnabled()) {
    return { skipped: true, reason: 'notifications_disabled' };
  }

  if (!caseData.ownerEmail) {
    return { skipped: true, reason: 'no_email' };
  }

  logEvent('notification.send_attempted', {
    type: 'case_report_confirmation',
    caseNumber: caseData.caseNumber,
    to: caseData.ownerEmail,
  });

  try {
    const result = await sendEmail({
      to: caseData.ownerEmail,
      subject: `Lost Pet Report Received - Case #${caseData.caseNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #dc2626;">Your Lost Pet Report Has Been Received</h2>

          <p>Hi ${caseData.ownerName || 'there'},</p>

          <p>We've received your report for <strong>${caseData.petName}</strong>.</p>

          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Case Number:</strong> ${caseData.caseNumber}</p>
            <p style="margin: 5px 0;"><strong>Pet:</strong> ${caseData.petName}</p>
            <p style="margin: 5px 0;"><strong>Status:</strong> Active - Visible to the community</p>
          </div>

          <h3>What Happens Next?</h3>
          <ul>
            <li>Your case is now visible on our public lost pets page</li>
            <li>Local rescue squads in your area will be notified</li>
            <li>You'll receive email updates when there's activity on your case</li>
          </ul>

          <p style="margin-top: 20px;">
            <a href="${getBaseUrl()}/cases/${caseData.caseNumber}"
               style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Your Case
            </a>
          </p>

          <p style="margin-top: 20px;">
            We're here to help bring ${caseData.petName} home!
          </p>

          <p>- The PetRecovery Team</p>

          ${getEmailFooter()}
        </div>
      `,
    });

    if (result.success) {
      logEvent('notification.send_succeeded', {
        type: 'case_report_confirmation',
        caseNumber: caseData.caseNumber,
      });
    } else {
      logEvent('notification.send_failed', {
        type: 'case_report_confirmation',
        caseNumber: caseData.caseNumber,
        error: result.error,
      });
    }

    return result;
  } catch (error) {
    logEvent('notification.send_failed', {
      type: 'case_report_confirmation',
      caseNumber: caseData.caseNumber,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
}
```

**Acceptance Criteria:**
- [ ] Function sends email to reporter
- [ ] Returns skipped if notifications disabled
- [ ] Logs send_attempted, send_succeeded, or send_failed
- [ ] Email includes case number, pet name, link to case

---

## TASK-N03: sendAdminPublicReportAlert Function

**Goal:** Create function to alert admins about new public reports.

**Files:**
- `frontend/app/lib/notifications.js` (add function)

**Implementation:**

```javascript
/**
 * Send alert to admin(s) about new public case
 * @param {object} caseData - Case data
 * @returns {Promise<{success: boolean, skipped?: boolean, reason?: string, error?: string}>}
 */
export async function sendAdminPublicReportAlert(caseData) {
  if (!isAdminAlertsEnabled()) {
    return { skipped: true, reason: 'admin_alerts_disabled' };
  }

  const adminEmail = getAdminEmail();
  if (!adminEmail) {
    return { skipped: true, reason: 'no_admin_email_configured' };
  }

  logEvent('notification.send_attempted', {
    type: 'admin_public_report_alert',
    caseNumber: caseData.caseNumber,
    to: adminEmail,
  });

  try {
    // Extract city from address if not provided
    const city = caseData.city || extractCity(caseData.lastSeenAddress) || 'Unknown Location';

    const result = await sendEmail({
      to: adminEmail,
      subject: `[NEW CASE] ${caseData.petName} - ${caseData.petSpecies} lost in ${city}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #dc2626;">New Public Lost Pet Report</h2>

          <div style="background: #fef2f2; padding: 15px; border-radius: 8px; border-left: 4px solid #dc2626;">
            <p style="margin: 5px 0;"><strong>Case Number:</strong> ${caseData.caseNumber}</p>
            <p style="margin: 5px 0;"><strong>Pet:</strong> ${caseData.petName} (${caseData.petSpecies})</p>
            <p style="margin: 5px 0;"><strong>Location:</strong> ${caseData.lastSeenAddress}</p>
            <p style="margin: 5px 0;"><strong>Reporter:</strong> ${caseData.ownerName} (${caseData.ownerEmail})</p>
            <p style="margin: 5px 0;"><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
          </div>

          <p style="margin-top: 20px;">
            <a href="${getBaseUrl()}/admin/cases/${caseData.id}"
               style="background: #1f2937; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View in Admin
            </a>
          </p>

          <p style="font-size: 12px; color: #666; margin-top: 20px;">
            This is an automated admin alert from PetRecovery.org
          </p>
        </div>
      `,
    });

    if (result.success) {
      logEvent('notification.send_succeeded', {
        type: 'admin_public_report_alert',
        caseNumber: caseData.caseNumber,
      });
    } else {
      logEvent('notification.send_failed', {
        type: 'admin_public_report_alert',
        caseNumber: caseData.caseNumber,
        error: result.error,
      });
    }

    return result;
  } catch (error) {
    logEvent('notification.send_failed', {
      type: 'admin_public_report_alert',
      caseNumber: caseData.caseNumber,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
}

/**
 * Extract city from address string
 */
function extractCity(address) {
  if (!address) return null;
  const match = address.match(/,\s*([A-Za-z\s]+),?\s*[A-Z]{2}/);
  return match ? match[1].trim() : null;
}
```

**Acceptance Criteria:**
- [ ] Function sends email to ADMIN_ALERT_EMAIL
- [ ] Returns skipped if admin alerts disabled
- [ ] Returns skipped if no admin email configured
- [ ] Logs appropriate events
- [ ] Email includes all case details and admin link

---

## TASK-N04: sendCaseStatusUpdate Function

**Goal:** Create function to notify owner of status changes.

**Files:**
- `frontend/app/lib/notifications.js` (add function)

**Implementation:**

```javascript
/**
 * Send case status update notification to owner
 * @param {object} caseData - Case data including ownerEmail
 * @param {string} oldStatus - Previous status
 * @param {string} newStatus - New status
 * @returns {Promise<{success: boolean, skipped?: boolean, reason?: string, error?: string}>}
 */
export async function sendCaseStatusUpdate(caseData, oldStatus, newStatus) {
  if (!isNotificationsEnabled()) {
    return { skipped: true, reason: 'notifications_disabled' };
  }

  // Only notify for significant status changes
  const notifiableStatuses = ['IN_PROGRESS', 'SIGHTING_REPORTED', 'REUNITED'];
  if (!notifiableStatuses.includes(newStatus)) {
    return { skipped: true, reason: 'status_not_notifiable' };
  }

  if (!caseData.ownerEmail) {
    return { skipped: true, reason: 'no_email' };
  }

  logEvent('notification.send_attempted', {
    type: 'case_status_update',
    caseNumber: caseData.caseNumber,
    oldStatus,
    newStatus,
    to: caseData.ownerEmail,
  });

  const statusConfig = {
    IN_PROGRESS: {
      subject: `Good News! Search Started for ${caseData.petName}`,
      headline: 'A Rescue Squad is On the Case!',
      message: 'A local rescue squad has started actively searching for your pet. Our volunteers are coordinating search efforts in your area.',
      color: '#f59e0b',
    },
    SIGHTING_REPORTED: {
      subject: `SIGHTING REPORTED - ${caseData.petName} May Have Been Seen!`,
      headline: 'Possible Sighting Reported!',
      message: 'Someone has reported a possible sighting of your pet. Check your case page for details including location and photos.',
      color: '#3b82f6',
    },
    REUNITED: {
      subject: `Wonderful News! ${caseData.petName} Has Been Found!`,
      headline: 'Welcome Home!',
      message: `We're thrilled to share that ${caseData.petName} has been marked as reunited. We hope you're enjoying being back together!`,
      color: '#10b981',
    },
  };

  const config = statusConfig[newStatus];

  try {
    const result = await sendEmail({
      to: caseData.ownerEmail,
      subject: config.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: ${config.color};">${config.headline}</h2>

          <p>Hi ${caseData.ownerName || 'there'},</p>

          <p>${config.message}</p>

          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Case:</strong> ${caseData.caseNumber}</p>
            <p style="margin: 5px 0;"><strong>Pet:</strong> ${caseData.petName}</p>
            <p style="margin: 5px 0;"><strong>New Status:</strong> ${newStatus.replace(/_/g, ' ')}</p>
          </div>

          <p style="margin-top: 20px;">
            <a href="${getBaseUrl()}/cases/${caseData.caseNumber}"
               style="background: ${config.color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Case Details
            </a>
          </p>

          <p>- The PetRecovery Team</p>

          ${getEmailFooter()}
        </div>
      `,
    });

    if (result.success) {
      logEvent('notification.send_succeeded', {
        type: 'case_status_update',
        caseNumber: caseData.caseNumber,
        newStatus,
      });
    } else {
      logEvent('notification.send_failed', {
        type: 'case_status_update',
        caseNumber: caseData.caseNumber,
        newStatus,
        error: result.error,
      });
    }

    return result;
  } catch (error) {
    logEvent('notification.send_failed', {
      type: 'case_status_update',
      caseNumber: caseData.caseNumber,
      newStatus,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
}
```

**Acceptance Criteria:**
- [ ] Only sends for IN_PROGRESS, SIGHTING_REPORTED, REUNITED
- [ ] Different subject and styling per status
- [ ] Logs appropriate events
- [ ] Skips non-notifiable statuses

---

## TASK-N05: Integrate Notifications into POST /api/public/cases

**Goal:** Wire notification functions into public case submission.

**Files:**
- `frontend/app/api/public/cases/route.js`

**Implementation:**

Add after successful case creation:

```javascript
import {
  sendCaseReportConfirmation,
  sendAdminPublicReportAlert,
} from '@/app/lib/notifications';

// ... in POST handler, after case creation ...

// Prepare notification data
const notificationData = {
  id: newCase.id,
  caseNumber: newCase.caseNumber,
  petName: newCase.petName,
  petSpecies: newCase.petSpecies,
  ownerName: newCase.ownerName,
  ownerEmail: newCase.ownerEmail,
  lastSeenAddress: newCase.lastSeenAddress,
};

// Fire notifications (non-blocking)
sendCaseReportConfirmation(notificationData).catch((err) => {
  console.error('Failed to send confirmation:', err);
});

sendAdminPublicReportAlert(notificationData).catch((err) => {
  console.error('Failed to send admin alert:', err);
});

// Return success immediately (don't wait for emails)
return NextResponse.json({
  success: true,
  caseNumber: newCase.caseNumber,
  message: 'Your lost pet report has been submitted.',
}, { status: 201 });
```

**Acceptance Criteria:**
- [ ] Confirmation email sent on public report
- [ ] Admin alert sent on public report
- [ ] API returns success even if emails fail
- [ ] Errors logged but not thrown

---

## TASK-N06: Create Case Status Update API

**Goal:** Create API endpoint to update case status.

**Files:**
- `frontend/app/api/cases/[id]/status/route.js` (new)

**Implementation:**

```javascript
import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { requireStaff, PermissionError } from '@/app/lib/permissions';
import { logEvent } from '@/app/lib/logging';
import prisma from '@/app/lib/prisma';

export async function POST(request, { params }) {
  try {
    const session = await getSession();
    requireStaff(session, 'update case status');

    const { id } = params;
    const { status } = await request.json();

    const validStatuses = ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED', 'REUNITED', 'CLOSED_OTHER'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const existingCase = await prisma.case.findUnique({
      where: { id },
      select: { id: true, caseNumber: true, status: true, ownerEmail: true, ownerName: true, petName: true },
    });

    if (!existingCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const oldStatus = existingCase.status;

    const updatedCase = await prisma.case.update({
      where: { id },
      data: {
        status,
        resolvedAt: ['REUNITED', 'CLOSED_OTHER'].includes(status) ? new Date() : null,
      },
    });

    logEvent('case.status_changed', {
      caseId: id,
      caseNumber: existingCase.caseNumber,
      oldStatus,
      newStatus: status,
      changedBy: session.user.id,
    });

    return NextResponse.json({
      success: true,
      case: {
        id: updatedCase.id,
        caseNumber: updatedCase.caseNumber,
        status: updatedCase.status,
        oldStatus,
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    logEvent('case.status_change_failed', { error: error.message });
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
```

**Acceptance Criteria:**
- [ ] Requires MODERATOR+ role
- [ ] Validates status is valid
- [ ] Logs status change event
- [ ] Sets resolvedAt for terminal statuses

---

## TASK-N07: Integrate Notifications into Status Changes

**Goal:** Wire status notifications into status update API.

**Files:**
- `frontend/app/api/cases/[id]/status/route.js`

**Implementation:**

Add after successful status update:

```javascript
import { sendCaseStatusUpdate } from '@/app/lib/notifications';

// ... after status update ...

if (oldStatus !== status) {
  const notificationData = {
    caseNumber: existingCase.caseNumber,
    petName: existingCase.petName,
    ownerName: existingCase.ownerName,
    ownerEmail: existingCase.ownerEmail,
  };

  // Non-blocking notification
  sendCaseStatusUpdate(notificationData, oldStatus, status).catch((err) => {
    console.error('Failed to send status update notification:', err);
  });
}
```

**Acceptance Criteria:**
- [ ] Status update triggers notification
- [ ] Only sends for significant status changes
- [ ] Non-blocking (API succeeds regardless)

---

## TASK-N08: sendCoordinatorAssignmentNotification Function

**Goal:** Create function to notify coordinators when assigned.

**Files:**
- `frontend/app/lib/notifications.js` (add function)

**Implementation:**

```javascript
/**
 * Send notification to coordinator when assigned to case
 * @param {object} caseData - Case data
 * @param {object} coordinator - Coordinator user data
 * @returns {Promise<{success: boolean, skipped?: boolean, reason?: string, error?: string}>}
 */
export async function sendCoordinatorAssignmentNotification(caseData, coordinator) {
  if (!isNotificationsEnabled()) {
    return { skipped: true, reason: 'notifications_disabled' };
  }

  if (!coordinator.email) {
    return { skipped: true, reason: 'no_coordinator_email' };
  }

  logEvent('notification.send_attempted', {
    type: 'coordinator_assignment',
    caseNumber: caseData.caseNumber,
    to: coordinator.email,
  });

  try {
    const result = await sendEmail({
      to: coordinator.email,
      subject: `You've Been Assigned to Case #${caseData.caseNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #1f2937;">New Case Assignment</h2>

          <p>Hi ${coordinator.firstName},</p>

          <p>You've been assigned as coordinator for the following lost pet case:</p>

          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Case Number:</strong> ${caseData.caseNumber}</p>
            <p style="margin: 5px 0;"><strong>Pet:</strong> ${caseData.petName} (${caseData.petSpecies})</p>
            <p style="margin: 5px 0;"><strong>Location:</strong> ${caseData.lastSeenAddress}</p>
          </div>

          <p>As coordinator, you'll be responsible for:</p>
          <ul>
            <li>Coordinating search efforts with rescue squads</li>
            <li>Keeping the pet owner informed of progress</li>
            <li>Managing case status and updates</li>
          </ul>

          <p style="margin-top: 20px;">
            <a href="${getBaseUrl()}/admin/cases/${caseData.id}"
               style="background: #1f2937; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Case
            </a>
          </p>

          <p>- The PetRecovery Team</p>

          ${getEmailFooter()}
        </div>
      `,
    });

    if (result.success) {
      logEvent('notification.send_succeeded', {
        type: 'coordinator_assignment',
        caseNumber: caseData.caseNumber,
      });
    } else {
      logEvent('notification.send_failed', {
        type: 'coordinator_assignment',
        caseNumber: caseData.caseNumber,
        error: result.error,
      });
    }

    return result;
  } catch (error) {
    logEvent('notification.send_failed', {
      type: 'coordinator_assignment',
      caseNumber: caseData.caseNumber,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
}
```

**Acceptance Criteria:**
- [ ] Sends email to newly assigned coordinator
- [ ] Includes case details and link
- [ ] Logs appropriate events

---

## TASK-N09: QA Harness Tests for Notifications

**Goal:** Add notification tests to QA page.

**Files:**
- `frontend/app/admin/qa/page.js`

**Tests to Add:**

```javascript
const notificationTests = [
  {
    name: 'Confirmation email respects disabled flag',
    test: async () => {
      const originalValue = process.env.NOTIFICATIONS_ENABLED;
      process.env.NOTIFICATIONS_ENABLED = 'false';
      const result = await sendCaseReportConfirmation({
        caseNumber: 'TEST-001',
        petName: 'Test Pet',
        ownerEmail: 'test@example.com',
      });
      process.env.NOTIFICATIONS_ENABLED = originalValue;
      return result.skipped && result.reason === 'notifications_disabled';
    },
  },
  {
    name: 'Admin alert skips without admin email',
    test: async () => {
      const originalValue = process.env.ADMIN_ALERT_EMAIL;
      delete process.env.ADMIN_ALERT_EMAIL;
      const result = await sendAdminPublicReportAlert({
        caseNumber: 'TEST-001',
        petName: 'Test Pet',
      });
      process.env.ADMIN_ALERT_EMAIL = originalValue;
      return result.skipped && result.reason === 'no_admin_email_configured';
    },
  },
  {
    name: 'Status update skips non-notifiable status',
    test: async () => {
      const result = await sendCaseStatusUpdate(
        { caseNumber: 'TEST-001', ownerEmail: 'test@example.com' },
        'ACTIVE',
        'CLOSED_OTHER'
      );
      return result.skipped && result.reason === 'status_not_notifiable';
    },
  },
];
```

**Acceptance Criteria:**
- [ ] Tests defined for all notification functions
- [ ] Tests verify skip conditions
- [ ] Results displayed in QA page

---

## TASK-N10: ERROR_IMPACT Health Dashboard Entries

**Goal:** Add notification events to health dashboard.

**Files:**
- `frontend/app/admin/health/page.js`

**ERROR_IMPACT Entries:**

```javascript
const ERROR_IMPACT = {
  // ... existing entries ...

  // Notifications (Phase 25-26)
  'notification.send_failed': {
    level: 'LOW',
    description: 'Email notification failed to send',
    action: 'Check email configuration and SMTP credentials',
  },
  'email.send_failed': {
    level: 'LOW',
    description: 'Email transport error',
    action: 'Verify EMAIL_* environment variables',
  },
};
```

**Note:** Notification failures are LOW impact because they don't affect core functionality.

**Acceptance Criteria:**
- [ ] ERROR_IMPACT entries added
- [ ] Health dashboard displays notification events
- [ ] Impact levels are LOW (non-critical)

---

## TASK-N11: Update VISION.md

**Goal:** Update VISION.md to mark Phase 25-26 as complete.

**Files:**
- `VISION.md`

**Changes:**
- Change Phase 25-26 status from "IN PROGRESS" to "COMPLETE"
- Add completion date

**Acceptance Criteria:**
- [ ] Status updated
- [ ] Date added

---

## Dependencies

```
TASK-N01 (module) → TASK-N02, TASK-N03, TASK-N04, TASK-N08
TASK-N02, TASK-N03 → TASK-N05
TASK-N04 → TASK-N06, TASK-N07
TASK-N06 → TASK-N07
All tasks → TASK-N09, TASK-N10
```

---

*Last Updated: 2025-11-25*
