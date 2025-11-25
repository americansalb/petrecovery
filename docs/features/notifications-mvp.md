# Feature Spec: Notifications MVP

**Phase:** 25–26
**Status:** IN PROGRESS
**Author:** Claude
**Date:** 2025-11-25

---

## 0. Summary

The Notifications MVP establishes a standardized email notification system for case events. It sends confirmation emails to reporters, alerts to admins for new cases, and status update notifications to stakeholders. The system is designed to be non-blocking (API calls succeed even if email fails).

---

## 1. Problem / Why

**Current State:**
- Basic email.js module exists but isn't used systematically
- No confirmation email when someone reports a lost pet
- Admins don't know when new public reports come in
- Owners aren't notified when case status changes
- No standardized notification patterns

**Impact:**
- Poor user experience (did my report go through?)
- Admins miss urgent cases
- Owners feel out of the loop
- No audit trail for notifications

**Goal:**
Establish reliable notification infrastructure with consistent patterns and logging.

---

## 2. Goals / Non-goals

### Goals
- Send confirmation email to reporter on public case submission
- Send alert to admin(s) when new public case is created
- Send status update emails to case owner on significant status changes
- Make all notifications non-blocking (API succeeds even if email fails)
- Log all notification attempts for debugging
- Support configuration via environment variables

### Non-goals
- SMS notifications (Phase 18)
- Push notifications (Phase 17)
- User notification preferences UI (Phase 30+)
- Notification templates admin UI
- Real-time in-app notifications
- Batched/digest notifications

---

## 3. Triggers & Channels

### Notification Triggers

| Trigger | Recipients | Channel | Priority |
|---------|------------|---------|----------|
| Public case created | Reporter | Email | HIGH |
| Public case created | Admins | Email | HIGH |
| Case status → IN_PROGRESS | Owner | Email | MEDIUM |
| Case status → SIGHTING_REPORTED | Owner | Email | HIGH |
| Case status → REUNITED | Owner | Email | HIGH |
| Coordinator assigned | Coordinator | Email | MEDIUM |

### MVP Scope

For MVP, we implement:
1. **Reporter confirmation** — When public report submitted
2. **Admin alert** — When public report submitted
3. **Status updates** — For IN_PROGRESS, SIGHTING_REPORTED, REUNITED

### Channels

MVP is email-only. Future phases add:
- Phase 17: Push notifications
- Phase 18: SMS alerts
- Phase 30+: In-app notifications

---

## 4. Email Infrastructure

### Existing Module (lib/email.js)

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
    console.log(`Email sent to ${to}`);
    return { success: true };
  } catch (error) {
    console.error('Email error:', error);
    return { success: false, error: error.message };
  }
}
```

### Environment Variables

```bash
# Email SMTP Configuration
EMAIL_SERVICE=gmail              # Or: smtp, sendgrid, mailgun
EMAIL_USER=alerts@petrecovery.org
EMAIL_PASSWORD=app-specific-password
EMAIL_FROM=PetRecovery <alerts@petrecovery.org>

# Admin Notifications
ADMIN_ALERT_EMAIL=admin@petrecovery.org
ADMIN_ALERT_ENABLED=true         # Set to false to disable

# Feature Flags
NOTIFICATIONS_ENABLED=true       # Master switch
```

### SMTP Providers

| Provider | Pros | Cons | Cost |
|----------|------|------|------|
| Gmail | Easy setup | 500/day limit | Free |
| SendGrid | Reliable, analytics | API complexity | Free tier: 100/day |
| Mailgun | Developer-friendly | Sandbox mode | Free tier: 5000/month |
| AWS SES | Scalable | Setup complexity | $0.10/1000 |

**Recommendation:** Start with Gmail for MVP, migrate to SendGrid when volume increases.

---

## 5. Notification Helper Module

### lib/notifications.js

```javascript
import { sendEmail } from './email';
import { logEvent } from './logging';

/**
 * Send case report confirmation to reporter
 */
export async function sendCaseReportConfirmation(caseData) {
  if (process.env.NOTIFICATIONS_ENABLED === 'false') {
    return { skipped: true, reason: 'notifications_disabled' };
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
        <h2>Your Lost Pet Report Has Been Received</h2>
        <p>Hi ${caseData.ownerName},</p>
        <p>We've received your report for <strong>${caseData.petName}</strong>.</p>
        <p><strong>Case Number:</strong> ${caseData.caseNumber}</p>
        <p><strong>Status:</strong> Active - Visible to the community</p>
        <h3>What Happens Next?</h3>
        <ul>
          <li>Your case is now visible on our public lost pets page</li>
          <li>Local rescue squads will be notified</li>
          <li>You'll receive updates when there's activity on your case</li>
        </ul>
        <p><a href="${process.env.NEXTAUTH_URL}/cases/${caseData.caseNumber}">View Your Case</a></p>
        <p>We're here to help bring ${caseData.petName} home!</p>
        <p>- The PetRecovery Team</p>
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

/**
 * Send alert to admin(s) about new public case
 */
export async function sendAdminPublicReportAlert(caseData) {
  if (process.env.ADMIN_ALERT_ENABLED === 'false') {
    return { skipped: true, reason: 'admin_alerts_disabled' };
  }

  const adminEmail = process.env.ADMIN_ALERT_EMAIL;
  if (!adminEmail) {
    return { skipped: true, reason: 'no_admin_email' };
  }

  logEvent('notification.send_attempted', {
    type: 'admin_public_report_alert',
    caseNumber: caseData.caseNumber,
    to: adminEmail,
  });

  try {
    const result = await sendEmail({
      to: adminEmail,
      subject: `[NEW CASE] ${caseData.petName} - ${caseData.petSpecies} lost in ${caseData.city || 'Unknown'}`,
      html: `
        <h2>New Public Lost Pet Report</h2>
        <p><strong>Case Number:</strong> ${caseData.caseNumber}</p>
        <p><strong>Pet:</strong> ${caseData.petName} (${caseData.petSpecies})</p>
        <p><strong>Location:</strong> ${caseData.lastSeenAddress}</p>
        <p><strong>Reporter:</strong> ${caseData.ownerName} (${caseData.ownerEmail})</p>
        <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
        <p><a href="${process.env.NEXTAUTH_URL}/admin/cases/${caseData.id}">View in Admin</a></p>
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
 * Send case status update to owner
 */
export async function sendCaseStatusUpdate(caseData, oldStatus, newStatus) {
  if (process.env.NOTIFICATIONS_ENABLED === 'false') {
    return { skipped: true, reason: 'notifications_disabled' };
  }

  // Only notify for significant status changes
  const notifiableStatuses = ['IN_PROGRESS', 'SIGHTING_REPORTED', 'REUNITED'];
  if (!notifiableStatuses.includes(newStatus)) {
    return { skipped: true, reason: 'status_not_notifiable' };
  }

  logEvent('notification.send_attempted', {
    type: 'case_status_update',
    caseNumber: caseData.caseNumber,
    oldStatus,
    newStatus,
    to: caseData.ownerEmail,
  });

  const statusMessages = {
    IN_PROGRESS: {
      subject: `Good News! Search Started for ${caseData.petName}`,
      message: 'A rescue squad has started actively searching for your pet!',
    },
    SIGHTING_REPORTED: {
      subject: `SIGHTING REPORTED - ${caseData.petName} May Have Been Seen!`,
      message: 'Someone has reported a possible sighting of your pet. Check your case for details.',
    },
    REUNITED: {
      subject: `Wonderful News! ${caseData.petName} Has Been Found!`,
      message: 'Your pet has been marked as reunited. Welcome home!',
    },
  };

  const statusInfo = statusMessages[newStatus];

  try {
    const result = await sendEmail({
      to: caseData.ownerEmail,
      subject: statusInfo.subject,
      html: `
        <h2>${statusInfo.subject}</h2>
        <p>Hi ${caseData.ownerName},</p>
        <p>${statusInfo.message}</p>
        <p><strong>Case:</strong> ${caseData.caseNumber}</p>
        <p><strong>Pet:</strong> ${caseData.petName}</p>
        <p><strong>New Status:</strong> ${newStatus.replace(/_/g, ' ')}</p>
        <p><a href="${process.env.NEXTAUTH_URL}/cases/${caseData.caseNumber}">View Case Details</a></p>
        <p>- The PetRecovery Team</p>
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

/**
 * Send coordinator assignment notification
 */
export async function sendCoordinatorAssignmentNotification(caseData, coordinator) {
  if (process.env.NOTIFICATIONS_ENABLED === 'false') {
    return { skipped: true, reason: 'notifications_disabled' };
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
        <h2>New Case Assignment</h2>
        <p>Hi ${coordinator.firstName},</p>
        <p>You've been assigned as coordinator for the following case:</p>
        <p><strong>Case Number:</strong> ${caseData.caseNumber}</p>
        <p><strong>Pet:</strong> ${caseData.petName} (${caseData.petSpecies})</p>
        <p><strong>Location:</strong> ${caseData.lastSeenAddress}</p>
        <p><a href="${process.env.NEXTAUTH_URL}/admin/cases/${caseData.id}">View Case</a></p>
        <p>- The PetRecovery Team</p>
      `,
    });

    if (result.success) {
      logEvent('notification.send_succeeded', {
        type: 'coordinator_assignment',
        caseNumber: caseData.caseNumber,
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

---

## 6. Integration Points

### POST /api/public/cases

Add notification calls after successful case creation:

```javascript
// After case is created successfully
const caseData = {
  id: newCase.id,
  caseNumber: newCase.caseNumber,
  petName: newCase.petName,
  petSpecies: newCase.petSpecies,
  ownerName: newCase.ownerName,
  ownerEmail: newCase.ownerEmail,
  lastSeenAddress: newCase.lastSeenAddress,
  city: extractCity(newCase.lastSeenAddress),
};

// Non-blocking: don't await, don't fail if email fails
sendCaseReportConfirmation(caseData).catch(console.error);
sendAdminPublicReportAlert(caseData).catch(console.error);

return Response.json({ success: true, caseNumber: newCase.caseNumber });
```

### POST /api/cases/[id]/status

Add notification call when status changes:

```javascript
// After status update
if (oldStatus !== newStatus) {
  const caseData = {
    caseNumber: updatedCase.caseNumber,
    petName: updatedCase.petName,
    ownerName: updatedCase.ownerName,
    ownerEmail: updatedCase.ownerEmail,
  };

  // Non-blocking
  sendCaseStatusUpdate(caseData, oldStatus, newStatus).catch(console.error);
}
```

### POST /api/cases/[id]/assign-coordinator

Add notification call when coordinator assigned:

```javascript
// After coordinator assigned
if (coordinator) {
  sendCoordinatorAssignmentNotification(updatedCase, coordinator).catch(console.error);
}
```

---

## 7. Error Handling

### Non-blocking Pattern

Notifications must never cause API failures:

```javascript
// CORRECT: Non-blocking notification
try {
  const newCase = await prisma.case.create({ ... });

  // Fire and forget - API succeeds regardless of email
  sendCaseReportConfirmation(newCase).catch(err => {
    console.error('Notification failed:', err);
    // Error is logged but API continues
  });

  return Response.json({ success: true });
} catch (error) {
  // Only database errors cause failure
  return Response.json({ error: 'Failed to create case' }, { status: 500 });
}

// WRONG: Blocking notification
try {
  const newCase = await prisma.case.create({ ... });
  await sendCaseReportConfirmation(newCase); // Blocks! May timeout!
  return Response.json({ success: true });
} catch (error) {
  // Email failure causes API failure - BAD!
  return Response.json({ error }, { status: 500 });
}
```

### Retry Strategy (Future)

For MVP, no retry. Future enhancement:
- Queue failed notifications
- Retry with exponential backoff
- Dead letter queue for persistent failures

---

## 8. Legal & Privacy

### CAN-SPAM Compliance

All emails must include:
- Clear sender identification
- Physical address (in footer)
- Unsubscribe link (future: /unsubscribe?token=xxx)
- Honest subject lines

### GDPR Considerations

- Only email addresses provided by user
- Include link to privacy policy
- Don't share email with third parties
- Provide way to delete data (future: /account/delete)

### Email Templates

Add standard footer to all emails:

```html
<hr>
<p style="font-size: 12px; color: #666;">
  PetRecovery.org | 123 Main St, Chicago IL 60601
  <br>
  You're receiving this because you reported a lost pet or have an active case.
  <br>
  <a href="${process.env.NEXTAUTH_URL}/unsubscribe">Unsubscribe</a> |
  <a href="${process.env.NEXTAUTH_URL}/privacy">Privacy Policy</a>
</p>
```

---

## 9. Testing / QA

### Unit Tests

| Test | Description |
|------|-------------|
| `notifications.confirmation.test` | Sends email with correct content |
| `notifications.admin-alert.test` | Sends to admin email from env |
| `notifications.status-update.test` | Only sends for notifiable statuses |
| `notifications.disabled.test` | Returns skipped when disabled |

### QA Harness Tests (/admin/qa)

```javascript
// Notification Tests
{
  name: 'Notification sends confirmation email',
  test: async () => {
    const result = await sendCaseReportConfirmation({
      caseNumber: 'TEST-001',
      petName: 'Test Pet',
      ownerName: 'Test Owner',
      ownerEmail: 'test@example.com',
    });
    return result.success || result.skipped;
  }
},
{
  name: 'Notification respects disabled flag',
  test: async () => {
    process.env.NOTIFICATIONS_ENABLED = 'false';
    const result = await sendCaseReportConfirmation({ ... });
    process.env.NOTIFICATIONS_ENABLED = 'true';
    return result.skipped && result.reason === 'notifications_disabled';
  }
}
```

### ERROR_IMPACT Entries

| Event | Impact Level | Description |
|-------|--------------|-------------|
| `notification.send_failed` | LOW | Non-critical: notification failed |
| `email.send_failed` | LOW | Email transport error |

**Note:** Notification failures are LOW impact because they don't affect core functionality.

---

## 10. Acceptance Criteria

### Must Have
- [ ] lib/notifications.js module with all helper functions
- [ ] sendCaseReportConfirmation sends email to reporter
- [ ] sendAdminPublicReportAlert sends email to admin
- [ ] sendCaseStatusUpdate sends for IN_PROGRESS, SIGHTING_REPORTED, REUNITED
- [ ] All notifications log send_attempted, send_succeeded, send_failed
- [ ] Notifications are non-blocking (API succeeds even if email fails)
- [ ] Environment variables control notification behavior
- [ ] POST /api/public/cases calls notification functions
- [ ] ERROR_IMPACT entries in health dashboard

### Should Have
- [ ] sendCoordinatorAssignmentNotification function
- [ ] Status change API calls notification
- [ ] Email templates include legal footer

### Nice to Have
- [ ] HTML email templates with styling
- [ ] Unsubscribe link handling
- [ ] Notification preferences per user

---

*Spec version: 1.0*
*Last updated: 2025-11-25*
