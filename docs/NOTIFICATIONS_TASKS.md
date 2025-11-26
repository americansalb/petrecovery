<<<<<<< HEAD
# Notifications MVP - Task Breakdown (Phase 25-26)

**Feature Spec:** `docs/features/notifications-mvp.md`
**Status:** Ready for Implementation
**Goal:** Build transactional email notifications for case lifecycle events

---

## Overview

This document breaks down Phase 25-26 (Notifications MVP) into 6 focused tasks:

- **TASK-N01**: Audit existing email infrastructure
- **TASK-N02**: Create notification helper module
- **TASK-N03**: Wire public report notifications
- **TASK-N04**: Wire case status change notifications
- **TASK-N05**: Admin notifications settings
- **TASK-N06**: QA integration, ERROR_IMPACT, and documentation

Each task is designed to be:
- **Small enough** to complete in one focused session
- **Testable** via manual testing or QA harness
- **Committable** with clear acceptance criteria

---

## Email Infrastructure Notes (TASK-N01 Output)

### Current Email Utility

**File:** `frontend/app/lib/email.js`

**Implementation:**
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
    console.log(`✅ Email sent to ${to}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Email error:', error);
    return { success: false, error: error.message };
  }
}
```

**Environment Variables:**
- `EMAIL_SERVICE` - SMTP service provider (default: "gmail")
- `EMAIL_USER` - SMTP username/email
- `EMAIL_PASSWORD` - SMTP password or app-specific password
- `EMAIL_FROM` - Sender display name and email (optional, defaults to EMAIL_USER)

**Test Endpoint:** `POST /api/admin/health/test-email`
- Sends test email to logged-in admin
- Emits `admin.test_email_sent` event with success/failure
- Demonstrates proper logging pattern

**Existing Event Types:**
- `admin.test_email_sent` (result: success/failure)

**Dependencies:**
- `nodemailer` package (already installed)
- `@/lib/logging` for `logEvent()`

### Findings

✅ **Reusable email utility exists** - `sendEmail()` function is ready to use
✅ **Environment variables documented** - Standard nodemailer configuration
✅ **Test endpoint exists** - Can verify email configuration works
✅ **Logging pattern established** - Test endpoint shows proper event emission

**Recommendation:** Use existing `sendEmail()` utility as-is. Build notification helper on top of it.

---

## TASK-N01: Audit Existing Email Infrastructure

**Goal:** Understand and document current email sending capabilities.

**Status:** ✅ COMPLETE (see "Email Infrastructure Notes" above)

**Steps Taken:**
1. Located email utility: `frontend/app/lib/email.js`
2. Reviewed test endpoint: `frontend/app/api/admin/health/test-email/route.js`
3. Identified environment variables and configuration
4. Confirmed event logging pattern

**Acceptance Criteria:**
- [x] Email utility function located and documented
- [x] Environment variables identified
- [x] Test endpoint verified
- [x] Logging pattern understood

**Commit Message:**
```
[Phase 25-26] TASK-N01: Audit email infrastructure

- Documented existing sendEmail() utility in lib/email.js
- Identified environment variables: EMAIL_SERVICE, EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM
- Reviewed test email endpoint for logging pattern
- Ready to build notification helper module
```

---

## TASK-N02: Create Notification Helper Module

**Goal:** Build a dedicated notification module that wraps email sending with proper logging.

**File to Create:**
- `frontend/app/lib/notifications.js`
=======
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
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz

**Implementation:**

```javascript
/**
<<<<<<< HEAD
 * Notification Helper Module
 * Phase 25-26: Notifications MVP
 *
 * Provides high-level notification functions that:
 * - Call sendEmail() utility
 * - Emit structured notification.* events
 * - Handle errors gracefully
 */

import { sendEmail } from '@/app/lib/email';
import { logEvent } from '@/lib/logging';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL;

/**
 * Send confirmation email to contact when public report is submitted
 *
 * @param {Object} caseData - Case details
 * @param {string} caseData.caseNumber - Case number (e.g., "CHI-2025-0001")
 * @param {string} caseData.petName - Pet name
 * @param {string} caseData.petSpecies - Pet species (DOG, CAT, etc.)
 * @param {string} caseData.city - City
 * @param {string} caseData.state - State
 * @param {string} caseData.contactName - Contact name
 * @param {string} caseData.contactEmail - Contact email
 * @param {Date} caseData.createdAt - Submission timestamp
 * @param {Object} options - Additional options
 * @param {boolean} options.isPublicReport - Whether this is a public report
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendCaseReportConfirmation(caseData, options = {}) {
  const startTime = Date.now();
  const notificationType = 'case_report_confirmation';

  try {
    // Log attempt
    await logEvent({
      event_type: 'notification.send_attempted',
      resource_type: 'notification',
      resource_id: caseData.caseNumber,
      action: 'create',
      result: 'success',
      metadata: {
        notification_type: notificationType,
        recipient: caseData.contactEmail,
        case_number: caseData.caseNumber
      }
    });

    // Build email HTML
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
          <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">✅ Report Received</h1>
          </div>

          <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Hi ${caseData.contactName || 'there'},</p>

            <p>Thank you for submitting a lost pet report to PetRecovery.org.</p>

            <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1f2937;">Case Details:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Case Number:</strong> ${caseData.caseNumber}</li>
                <li><strong>Pet:</strong> ${caseData.petName || 'Unknown'} (${caseData.petSpecies})</li>
                <li><strong>Location:</strong> ${caseData.city}, ${caseData.state}</li>
                <li><strong>Submitted:</strong> ${new Date(caseData.createdAt).toLocaleString()}</li>
              </ul>
            </div>

            <h3 style="color: #1f2937;">What happens next:</h3>
            <ol style="padding-left: 20px;">
              <li>Our admin team will review your report within 24-48 hours.</li>
              <li>Once approved, your case will be visible on the public portal.</li>
              <li>You'll receive email updates when the status changes.</li>
            </ol>

            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Privacy Note:</strong> Your contact information is NOT publicly visible by default. An admin will configure privacy settings during review.</p>
            </div>

            <p>If you have questions, please reply to this email.</p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">

            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              <strong>PetRecovery.org</strong> - Reuniting Lost Pets with Their Families
            </p>
          </div>
        </body>
      </html>
    `;

    // Send email
    const result = await sendEmail({
      to: caseData.contactEmail,
      subject: `✅ We received your lost pet report: ${caseData.petName || caseData.caseNumber}`,
      html
    });

    const responseTime = Date.now() - startTime;

    if (result.success) {
      // Log success
      await logEvent({
        event_type: 'notification.send_succeeded',
        resource_type: 'notification',
        resource_id: caseData.caseNumber,
        action: 'create',
        result: 'success',
        metadata: {
          notification_type: notificationType,
          recipient: caseData.contactEmail,
          case_number: caseData.caseNumber,
          response_time_ms: responseTime
        }
      });
    } else {
      // Log failure
      await logEvent({
        event_type: 'notification.send_failed',
        resource_type: 'notification',
        resource_id: caseData.caseNumber,
        action: 'create',
        result: 'failure',
        error_code: 'EMAIL_SEND_FAILED',
        error_message: result.error,
        metadata: {
          notification_type: notificationType,
          recipient: caseData.contactEmail,
          case_number: caseData.caseNumber,
          response_time_ms: responseTime
        }
=======
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
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz
      });
    }

    return result;
<<<<<<< HEAD

  } catch (error) {
    // Log exception
    await logEvent({
      event_type: 'notification.send_failed',
      resource_type: 'notification',
      resource_id: caseData.caseNumber,
      action: 'create',
      result: 'failure',
      error_code: 'NOTIFICATION_ERROR',
      error_message: error.message,
      metadata: {
        notification_type: notificationType,
        recipient: caseData.contactEmail,
        case_number: caseData.caseNumber
      }
    });

    return { success: false, error: error.message };
  }
}

/**
 * Send alert to admin when public report is submitted
 */
export async function sendAdminPublicReportAlert(caseData) {
  const startTime = Date.now();
  const notificationType = 'admin_alert';

  if (!ADMIN_EMAIL) {
    console.log('⚠️  ADMIN_NOTIFICATION_EMAIL not configured, skipping admin alert');
    return { success: false, error: 'Admin email not configured' };
  }

  try {
    // Log attempt
    await logEvent({
      event_type: 'notification.send_attempted',
      resource_type: 'notification',
      resource_id: caseData.caseNumber,
      action: 'create',
      result: 'success',
      metadata: {
        notification_type: notificationType,
        recipient: ADMIN_EMAIL,
        case_number: caseData.caseNumber
      }
    });

    // Build email HTML
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
          <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">🚨 New Public Report</h1>
          </div>

          <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; margin-top: 0;"><strong>A new public lost pet report requires review:</strong></p>

            <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1f2937;">Case Information:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Case Number:</strong> ${caseData.caseNumber}</li>
                <li><strong>Pet:</strong> ${caseData.petName || 'Unknown'} (${caseData.petSpecies}${caseData.petBreed ? ', ' + caseData.petBreed : ''})</li>
                <li><strong>Location:</strong> ${caseData.city}, ${caseData.state} ${caseData.zipCode ? '(' + caseData.zipCode + ')' : ''}</li>
                ${caseData.lastSeenLandmark ? `<li><strong>Landmark:</strong> ${caseData.lastSeenLandmark}</li>` : ''}
                <li><strong>Submitted:</strong> ${new Date(caseData.createdAt).toLocaleString()}</li>
              </ul>
            </div>

            <div style="background: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1f2937;">Contact Information:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Name:</strong> ${caseData.contactName}</li>
                ${caseData.contactEmail ? `<li><strong>Email:</strong> ${caseData.contactEmail}</li>` : ''}
                ${caseData.contactPhone ? `<li><strong>Phone:</strong> ${caseData.contactPhone}</li>` : ''}
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${BASE_URL}/admin/cases/${caseData.id}"
                 style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Review Case in Admin Panel →
              </a>
            </div>

            <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px;">
              <p style="margin: 0;"><strong>Action Required:</strong> This case is currently <strong>NOT public</strong> (requires approval). Review the report and set <code>isPublic=true</code> to make it visible.</p>
            </div>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">

            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              <strong>PetRecovery.org</strong> - Admin Notification System
            </p>
          </div>
        </body>
      </html>
    `;

    // Send email
    const result = await sendEmail({
      to: ADMIN_EMAIL,
      subject: `🚨 New Public Report: ${caseData.city}, ${caseData.state} – ${caseData.petName || caseData.caseNumber}`,
      html
    });

    const responseTime = Date.now() - startTime;

    if (result.success) {
      await logEvent({
        event_type: 'notification.send_succeeded',
        resource_type: 'notification',
        resource_id: caseData.caseNumber,
        action: 'create',
        result: 'success',
        metadata: {
          notification_type: notificationType,
          recipient: ADMIN_EMAIL,
          case_number: caseData.caseNumber,
          response_time_ms: responseTime
        }
      });
    } else {
      await logEvent({
        event_type: 'notification.send_failed',
        resource_type: 'notification',
        resource_id: caseData.caseNumber,
        action: 'create',
        result: 'failure',
        error_code: 'EMAIL_SEND_FAILED',
        error_message: result.error,
        metadata: {
          notification_type: notificationType,
          recipient: ADMIN_EMAIL,
          case_number: caseData.caseNumber,
          response_time_ms: responseTime
        }
=======
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
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz
      });
    }

    return result;
<<<<<<< HEAD

  } catch (error) {
    await logEvent({
      event_type: 'notification.send_failed',
      resource_type: 'notification',
      resource_id: caseData.caseNumber,
      action: 'create',
      result: 'failure',
      error_code: 'NOTIFICATION_ERROR',
      error_message: error.message,
      metadata: {
        notification_type: notificationType,
        recipient: ADMIN_EMAIL,
        case_number: caseData.caseNumber
      }
    });

=======
  } catch (error) {
    logEvent('notification.send_failed', {
      type: 'admin_public_report_alert',
      caseNumber: caseData.caseNumber,
      error: error.message,
    });
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz
    return { success: false, error: error.message };
  }
}

/**
<<<<<<< HEAD
 * Send status update to contact when case status changes
 */
export async function sendCaseStatusUpdate(caseData, previousStatus, newStatus) {
  const startTime = Date.now();
  const notificationType = 'status_update';

  if (!caseData.contactEmail) {
    return { success: false, error: 'No contact email provided' };
  }

  try {
    // Log attempt
    await logEvent({
      event_type: 'notification.send_attempted',
      resource_type: 'notification',
      resource_id: caseData.caseNumber,
      action: 'create',
      result: 'success',
      metadata: {
        notification_type: notificationType,
        recipient: caseData.contactEmail,
        case_number: caseData.caseNumber,
        previous_status: previousStatus,
        new_status: newStatus
      }
    });

    // Status-specific content
    const statusContent = {
      'ACTIVE_SEARCH': {
        title: 'Active Search Started',
        icon: '🔍',
        message: `Rescue squad volunteers are actively searching for ${caseData.petName || 'your pet'} in ${caseData.city}.`,
        color: '#f59e0b'
      },
      'RESOLVED': {
        title: 'Case Resolved',
        icon: '🎉',
        message: `Great news! Your lost pet case has been marked as RESOLVED. ${caseData.statusReason || 'We hope your pet is safe!'}`,
        color: '#10b981'
      },
      'CLOSED_OTHER': {
        title: 'Case Closed',
        icon: 'ℹ️',
        message: `Your case has been closed. ${caseData.statusReason || 'If you need further assistance, please contact us.'}`,
        color: '#6b7280'
      }
    };

    const content = statusContent[newStatus] || {
      title: 'Status Updated',
      icon: '📢',
      message: `Your case status has been updated to ${newStatus}.`,
      color: '#2563eb'
    };

    // Build email HTML
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
          <div style="background: ${content.color}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">${content.icon} ${content.title}</h1>
          </div>

          <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Hi ${caseData.contactName || 'there'},</p>

            <p>${content.message}</p>

            <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1f2937;">Case Information:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Case Number:</strong> ${caseData.caseNumber}</li>
                <li><strong>Pet:</strong> ${caseData.petName || 'Unknown'}</li>
                <li><strong>Previous Status:</strong> ${previousStatus}</li>
                <li><strong>New Status:</strong> <strong>${newStatus}</strong></li>
                <li><strong>Updated:</strong> ${new Date().toLocaleString()}</li>
              </ul>
            </div>

            ${caseData.isPublic ? `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${BASE_URL}/cases/${caseData.caseNumber}"
                 style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                View Your Case Online →
              </a>
            </div>
            ` : ''}

            <p>We'll notify you of any further updates.</p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">

            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              <strong>PetRecovery.org</strong> - Reuniting Lost Pets with Their Families
            </p>
          </div>
        </body>
      </html>
    `;

    // Send email
    const result = await sendEmail({
      to: caseData.contactEmail,
      subject: `📢 Update on your lost pet case ${caseData.caseNumber}: ${content.title}`,
      html
    });

    const responseTime = Date.now() - startTime;

    if (result.success) {
      await logEvent({
        event_type: 'notification.send_succeeded',
        resource_type: 'notification',
        resource_id: caseData.caseNumber,
        action: 'create',
        result: 'success',
        metadata: {
          notification_type: notificationType,
          recipient: caseData.contactEmail,
          case_number: caseData.caseNumber,
          previous_status: previousStatus,
          new_status: newStatus,
          response_time_ms: responseTime
        }
      });
    } else {
      await logEvent({
        event_type: 'notification.send_failed',
        resource_type: 'notification',
        resource_id: caseData.caseNumber,
        action: 'create',
        result: 'failure',
        error_code: 'EMAIL_SEND_FAILED',
        error_message: result.error,
        metadata: {
          notification_type: notificationType,
          recipient: caseData.contactEmail,
          case_number: caseData.caseNumber,
          previous_status: previousStatus,
          new_status: newStatus,
          response_time_ms: responseTime
        }
=======
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
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz
      });
    }

    return result;
<<<<<<< HEAD

  } catch (error) {
    await logEvent({
      event_type: 'notification.send_failed',
      resource_type: 'notification',
      resource_id: caseData.caseNumber,
      action: 'create',
      result: 'failure',
      error_code: 'NOTIFICATION_ERROR',
      error_message: error.message,
      metadata: {
        notification_type: notificationType,
        recipient: caseData.contactEmail,
        case_number: caseData.caseNumber,
        previous_status: previousStatus,
        new_status: newStatus
      }
    });

=======
  } catch (error) {
    logEvent('notification.send_failed', {
      type: 'case_status_update',
      caseNumber: caseData.caseNumber,
      newStatus,
      error: error.message,
    });
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz
    return { success: false, error: error.message };
  }
}
```

**Acceptance Criteria:**
<<<<<<< HEAD
- [ ] File created at `frontend/app/lib/notifications.js`
- [ ] Three notification functions implemented:
  - `sendCaseReportConfirmation()`
  - `sendAdminPublicReportAlert()`
  - `sendCaseStatusUpdate()`
- [ ] Each function emits proper `notification.*` events
- [ ] Each function handles errors gracefully
- [ ] Email templates are clear and well-formatted
- [ ] No Prisma client coupling (accepts plain objects)

**Testing:**
- Manual: Import and call each function with test data
- Verify emails send successfully
- Check `/admin/health` for event logs

**Commit Message:**
```
[Phase 25-26] TASK-N02: Create notification helper module

- Created lib/notifications.js with 3 notification functions
- sendCaseReportConfirmation(): Owner confirmation for public reports
- sendAdminPublicReportAlert(): Admin alert for new public reports
- sendCaseStatusUpdate(): Status change notifications
- All functions emit notification.* events
- HTML email templates with branding
- Graceful error handling
```

---

## TASK-N03: Wire Public Report Notifications

**Goal:** Hook notification sending into the public report submission endpoint.

**File to Modify:**
- `frontend/app/api/public/cases/route.js`

**Current Flow (Phase 15-16):**
1. Validate request
2. Create case with `isPublic=false`, `source=PUBLIC_REPORT`
3. Emit `public_case.report_submitted` event
4. Return success response

**New Flow (Phase 25-26):**
1. Validate request
2. Create case
3. Emit `public_case.report_submitted` event
4. **NEW:** Send notifications (non-blocking)
   - Send confirmation to contact (if email provided)
   - Send alert to admin (if configured)
5. Return success response

**Implementation:**

Add imports at top of file:
```javascript
import { sendCaseReportConfirmation, sendAdminPublicReportAlert } from '@/app/lib/notifications';
```

Add after `public_case.report_submitted` event (around line 375):

```javascript
// Existing event logging...
await logEvent({
  event_type: 'public_case.report_submitted',
  resource_type: 'public_case',
  resource_id: newCase.id,
  action: 'create',
  result: 'success',
  // ... existing metadata
});

// NEW: Send notifications (non-blocking - errors logged but don't break API response)
try {
  // 1. Send confirmation to contact (if email provided)
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

  // 2. Send alert to admin (if configured)
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
  // Log error but don't break the API response
  console.error('❌ Notification error:', notificationError);

  // Individual notification functions already log their own failures,
  // but log this top-level exception as well
  await logEvent({
    event_type: 'notification.send_failed',
    resource_type: 'notification',
    action: 'create',
    result: 'failure',
    error_code: 'NOTIFICATION_EXCEPTION',
    error_message: notificationError.message,
    metadata: {
      case_number: newCase.caseNumber,
      error_stack: notificationError.stack?.substring(0, 500)
    }
  });
}

// Return the original successful response (unchanged)
return NextResponse.json({
  success: true,
  caseNumber: newCase.caseNumber,
  message: 'Your lost pet report has been submitted and is pending admin approval.',
  case: {
    caseNumber: newCase.caseNumber,
    city: newCase.city,
    state: newCase.state,
    petName: newCase.petName,
    petSpecies: newCase.petSpecies,
    createdAt: newCase.createdAt
  }
}, { status: 201 });
```

**Key Points:**
- Notification sending is wrapped in try/catch
- Email failures don't break the API response (case creation still succeeds)
- Individual notification functions handle their own logging
- Top-level catch provides safety net for unexpected exceptions

**Acceptance Criteria:**
- [ ] Public report endpoint modified
- [ ] Contact receives confirmation email when submitting report
- [ ] Admin receives alert email when report submitted
- [ ] API response still returns 201 even if emails fail
- [ ] Email failures logged with `notification.send_failed` events
- [ ] No regressions to existing public report flow

**Testing:**
1. Submit public report via `/cases/report` with your email
2. Verify you receive confirmation email
3. Verify admin receives alert email (if ADMIN_NOTIFICATION_EMAIL configured)
4. Check `/admin/health` for `notification.*` events
5. Test with invalid SMTP credentials to verify graceful failure handling

**Commit Message:**
```
[Phase 25-26] TASK-N03: Wire public report notifications

- Modified POST /api/public/cases to send notifications after case creation
- Contact receives confirmation email with case number and next steps
- Admin receives alert email with case details and review link
- Notifications are non-blocking (errors don't break API response)
- All notification attempts logged via notification.* events
- No regressions to Phase 15-16 public report flow
```

---

## TASK-N04: Wire Case Status Change Notifications

**Goal:** Hook notification sending into the case status update endpoint.

**File to Modify:**
- `frontend/app/api/cases/[id]/status/route.js`

**Current Flow (Phase 13-14):**
1. Validate status transition
2. Update case status in database
3. Create status change note
4. Emit `case.status_changed` event
5. Return updated case

**New Flow (Phase 25-26):**
1. Validate status transition
2. Update case status
3. Create status change note
4. Emit `case.status_changed` event
5. **NEW:** Send status update notification (if applicable)
6. Return updated case

**Implementation:**

Add import at top of file:
```javascript
import { sendCaseStatusUpdate } from '@/app/lib/notifications';
```

Add after `case.status_changed` event:

```javascript
// Existing event logging...
await logEvent({
  event_type: 'case.status_changed',
  resource_type: 'case',
  resource_id: updatedCase.id,
  action: 'update',
  result: 'success',
  // ... existing metadata
});

// NEW: Send status update notification (if relevant status change)
const notifiableStatuses = ['ACTIVE_SEARCH', 'RESOLVED', 'CLOSED_OTHER'];
const shouldNotify = notifiableStatuses.includes(newStatus)
                     && updatedCase.contactEmail
                     && previousStatus !== newStatus; // Avoid duplicate sends

if (shouldNotify) {
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
    // Log error but don't break the API response
    console.error('❌ Status notification error:', notificationError);

    // sendCaseStatusUpdate already logs its own failures,
    // but log this exception as well
    await logEvent({
      event_type: 'notification.send_failed',
      resource_type: 'notification',
      action: 'create',
      result: 'failure',
      error_code: 'STATUS_NOTIFICATION_EXCEPTION',
      error_message: notificationError.message,
      metadata: {
        case_number: updatedCase.caseNumber,
        previous_status: previousStatus,
        new_status: newStatus
      }
    });
  }
}

// Return the original successful response (unchanged)
return NextResponse.json({
  case: updatedCase
}, { status: 200 });
```

**Logic for When to Send:**
- Only send if new status is one of: `ACTIVE_SEARCH`, `RESOLVED`, `CLOSED_OTHER`
- Only send if `contactEmail` is present
- Only send if status actually changed (prevent duplicates)

**Acceptance Criteria:**
- [ ] Status update endpoint modified
- [ ] Contact receives email when status changes to `ACTIVE_SEARCH`
- [ ] Contact receives email when status changes to `RESOLVED`
- [ ] Contact receives email when status changes to `CLOSED_OTHER`
- [ ] No email sent for status changes to `OPEN` (or other statuses)
- [ ] No email sent if `contactEmail` is missing
- [ ] No duplicate emails if status set to same value twice
- [ ] API response still returns 200 even if email fails
- [ ] No regressions to Phase 13-14 status change flow

**Testing:**
1. Create a case with `contactEmail` via `/admin/cases`
2. Change status to `ACTIVE_SEARCH`
3. Verify you receive email
4. Change status to `RESOLVED`
5. Verify you receive email with different content
6. Change status to `RESOLVED` again (same value)
7. Verify NO duplicate email sent
8. Check `/admin/health` for `notification.*` events

**Commit Message:**
```
[Phase 25-26] TASK-N04: Wire case status change notifications

- Modified POST /api/cases/[id]/status to send status update emails
- Notifications sent for ACTIVE_SEARCH, RESOLVED, CLOSED_OTHER transitions
- Email content customized per status type
- Duplicate prevention (don't send if status unchanged)
- Non-blocking error handling
- All attempts logged via notification.* events
- No regressions to Phase 13-14 status update flow
```

---

## TASK-N05: Admin Notifications Settings

**Goal:** Provide a way for admins to configure notification email address.

**Approach for MVP: Environment Variable Only**

For this MVP, we'll use a simple environment variable approach rather than building a full settings UI. This keeps the scope minimal while still providing the necessary functionality.

**File to Modify:**
- `SETUP.md` (or create if doesn't exist)
- `.env.example` (if exists)

**Documentation Update:**

Add to `SETUP.md`:

```markdown
### Notifications Configuration (Phase 25-26)

PetRecovery.org sends transactional email notifications for key case lifecycle events.

#### Email Service Setup

Configure your SMTP email service using these environment variables:

```bash
# Required: SMTP Configuration
EMAIL_SERVICE=gmail                                    # SMTP service (e.g., gmail, sendgrid)
EMAIL_USER=your-email@gmail.com                       # SMTP username
EMAIL_PASSWORD=your-app-specific-password             # SMTP password or API key
EMAIL_FROM="PetRecovery.org <your-email@gmail.com>"  # Sender display name

# Required: Admin Notification Email
ADMIN_NOTIFICATION_EMAIL=admin@petrecovery.org        # Email for admin alerts
```

**Gmail Setup (Development):**
1. Enable 2-factor authentication on your Gmail account
2. Generate an app-specific password: https://myaccount.google.com/apppasswords
3. Use the app password as `EMAIL_PASSWORD`

**SendGrid Setup (Production - Recommended):**
1. Create a SendGrid account and API key
2. Set `EMAIL_SERVICE=sendgrid`
3. Set `EMAIL_PASSWORD=<your-api-key>`

**Notification Types:**

The system sends these automatic emails:

1. **Public Report Confirmation** - To the contact email when a public report is submitted
2. **Admin Alert** - To `ADMIN_NOTIFICATION_EMAIL` when a public report is submitted
3. **Status Updates** - To the contact email when case status changes to ACTIVE_SEARCH, RESOLVED, or CLOSED_OTHER

All notification attempts are logged and visible in the Admin Health Dashboard.
```

**Render.com Environment Variables:**

When deploying to Render, configure these variables in the Render dashboard:
1. Navigate to your service → Environment
2. Add each variable (EMAIL_SERVICE, EMAIL_USER, etc.)
3. Click "Save Changes" and redeploy

**Future Enhancement (Phase 26+):**

Document in feature spec that a future phase will add:
- `/admin/settings/notifications` page
- UI to configure notification email
- Toggle switches for notification types
- Test notification button
- Persist settings to database

**Acceptance Criteria:**
- [ ] `SETUP.md` updated with notification configuration instructions
- [ ] Environment variables documented clearly
- [ ] Gmail and SendGrid setup instructions provided
- [ ] `ADMIN_NOTIFICATION_EMAIL` variable usage documented
- [ ] Future enhancement noted in feature spec

**Testing:**
1. Set `ADMIN_NOTIFICATION_EMAIL` in local `.env.local`
2. Submit a public report
3. Verify admin receives email at configured address
4. Test with different email addresses to verify it's dynamic

**Commit Message:**
```
[Phase 25-26] TASK-N05: Admin notifications settings (env var approach)

- Documented ADMIN_NOTIFICATION_EMAIL environment variable
- Updated SETUP.md with notification configuration guide
- Gmail and SendGrid setup instructions provided
- Environment variable approach chosen for MVP (no UI yet)
- Future enhancement: Admin settings page (Phase 26+)
```

---

## TASK-N06: QA Integration, ERROR_IMPACT, and Documentation

**Goal:** Ensure observability, testing, and documentation are complete.

### Part 1: QA Harness Integration

**File to Modify:**
- `frontend/app/admin/qa/page.js`

**Add notification test functions** (before `TestsPanel` component):

```javascript
// ============================================================================
// NOTIFICATION TEST CASES (Phase 25-26)
// ============================================================================

async function testPublicReportNotificationEvents() {
  // Test that public report triggers notification events (check logs, not actual email delivery)

  const timestamp = Date.now();
  const res = await fetch('/api/public/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      petSpecies: 'DOG',
      petName: `[NOTIF QA TEST] ${timestamp}`,
      petBreed: 'Labrador',
      petColor: 'Black',
      contactName: 'QA Notification Test',
      contactEmail: 'qa-notif-test@example.com',
      contactPhone: '512-555-0199',
      agreeToTerms: true
    })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Public report failed: ${error.message || error.error}`);
  }

  const data = await res.json();

  if (!data.caseNumber) {
    throw new Error('Missing caseNumber in response');
  }

  // Wait a moment for events to be logged
  await new Promise(resolve => setTimeout(resolve, 500));

  // Fetch recent events to verify notification events were emitted
  const eventsRes = await fetch('/api/admin/health/events?limit=20');
  const eventsData = await eventsRes.json();

  const notificationEvents = eventsData.events?.filter(e =>
    e.event_type.startsWith('notification.') &&
    e.metadata?.case_number === data.caseNumber
  ) || [];

  const attemptedEvents = notificationEvents.filter(e => e.event_type === 'notification.send_attempted');
  const succeededEvents = notificationEvents.filter(e => e.event_type === 'notification.send_succeeded');
  const failedEvents = notificationEvents.filter(e => e.event_type === 'notification.send_failed');

  return {
    case_number: data.caseNumber,
    notification_attempts: attemptedEvents.length,
    notification_successes: succeededEvents.length,
    notification_failures: failedEvents.length,
    events_checked: notificationEvents.length
  };
}

async function testStatusChangeNotificationEvents() {
  // Test that status change triggers notification events

  // First create a case with contact email
  const createRes = await fetch('/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      petSpecies: 'CAT',
      petName: '[NOTIF QA TEST] Status Change Test',
      contactName: 'QA Test',
      contactEmail: 'qa-status-test@example.com'
    })
  });

  if (!createRes.ok) {
    throw new Error('Failed to create test case');
  }

  const { case: testCase } = await createRes.json();

  // Update status to ACTIVE_SEARCH
  const statusRes = await fetch(`/api/cases/${testCase.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'ACTIVE_SEARCH',
      statusReason: 'QA test - triggering notification'
    })
  });

  if (!statusRes.ok) {
    throw new Error('Failed to update status');
  }

  // Wait for events
  await new Promise(resolve => setTimeout(resolve, 500));

  // Check for notification events
  const eventsRes = await fetch('/api/admin/health/events?limit=20');
  const eventsData = await eventsRes.json();

  const notificationEvents = eventsData.events?.filter(e =>
    e.event_type.startsWith('notification.') &&
    e.metadata?.case_number === testCase.caseNumber &&
    e.metadata?.notification_type === 'status_update'
  ) || [];

  return {
    case_number: testCase.caseNumber,
    status_updated_to: 'ACTIVE_SEARCH',
    notification_events: notificationEvents.length,
    has_attempt: notificationEvents.some(e => e.event_type === 'notification.send_attempted'),
    has_result: notificationEvents.some(e =>
      e.event_type === 'notification.send_succeeded' ||
      e.event_type === 'notification.send_failed'
    )
  };
}

async function testEmailConfiguration() {
  // Check if email environment variables are configured

  // This test just verifies configuration exists (doesn't send emails)
  const checks = {
    email_user: !!process.env.EMAIL_USER,
    email_password: !!process.env.EMAIL_PASSWORD,
    email_service: !!process.env.EMAIL_SERVICE,
    admin_email: !!process.env.ADMIN_NOTIFICATION_EMAIL
  };

  const configuredCount = Object.values(checks).filter(Boolean).length;
  const totalChecks = Object.keys(checks).length;

  if (configuredCount < totalChecks) {
    throw new Error(`Email not fully configured: ${configuredCount}/${totalChecks} variables set`);
  }

  return {
    configuration: checks,
    configured: `${configuredCount}/${totalChecks}`,
    ready: configuredCount === totalChecks
  };
}
```

**Add notification tests to state** (in `TestsPanel` component):

```javascript
// After existing caseTests state, add:

// Notification tests state (Phase 25-26)
const [notificationTests, setNotificationTests] = useState([
  { id: 'notif-events-report', name: 'Public Report Notification Events', status: 'idle', fn: testPublicReportNotificationEvents },
  { id: 'notif-events-status', name: 'Status Change Notification Events', status: 'idle', fn: testStatusChangeNotificationEvents },
  { id: 'notif-config', name: 'Email Configuration Check', status: 'idle', fn: testEmailConfiguration },
]);
const [runningNotification, setRunningNotification] = useState(false);
```

**Add runner function:**

```javascript
const runNotificationTests = async () => {
  setRunningNotification(true);

  for (let i = 0; i < notificationTests.length; i++) {
    const test = notificationTests[i];

    setNotificationTests(prev => prev.map(t =>
      t.id === test.id ? { ...t, status: 'running' } : t
    ));

    const result = await runTest(test.name, test.fn);

    setNotificationTests(prev => prev.map(t =>
      t.id === test.id ? { ...t, ...result } : t
    ));

    onTestComplete(result);
  }

  setRunningNotification(false);
};
```

**Update `runAllTests` and `isAnyRunning`:**

```javascript
const runAllTests = async () => {
  await runLegalTests();
  await runSquadTests();
  await runCaseTests();
  await runPublicCaseTests();
  await runNotificationTests(); // NEW
};

const isAnyRunning = runningLegal || runningSquad || runningCase || runningPublicCase || runningNotification; // Add runningNotification
```

**Add TestSuite component for notifications** (in render):

```javascript
{/* After Public Case Test Suite */}

{/* Notification Test Suite (Phase 25-26) */}
<TestSuite
  title="Notification Tests"
  tests={notificationTests}
  onRun={runNotificationTests}
  running={runningNotification}
/>
```

### Part 2: ERROR_IMPACT Updates

**File to Modify:**
- `frontend/app/admin/health/page.jsx`

**Add to ERROR_IMPACT object:**

```javascript
const ERROR_IMPACT = {
  // ... existing mappings ...

  // Notifications (Phase 25-26)
  'notification.send_failed': { label: 'Notification Delivery', severity: 'medium' },
  'notification.send_attempted': { label: 'Notification Attempts', severity: 'low' },
  'notification.send_succeeded': { label: 'Notification Success', severity: 'low' },
};
```

### Part 3: Documentation Updates

**Update Feature Spec:**
- File: `docs/features/notifications-mvp.md`
- Change status from "❌ Not Started" to "✅ Fully Implemented"

**Update VISION.md:**

Add Phase 25-26 entry after Phase 20-21:

```markdown
- **🎉 Phase 25-26: Notifications MVP (Case Alerts & Admin Signals)** ✅ **COMPLETE** (Nov 25, 2025)
  - **Notification Types:** 3 transactional email types (report confirmation, admin alert, status update)
  - **Notification Helper:** `lib/notifications.js` with structured event logging
  - **Public Report Integration:** Contact and admin emails sent on public report submission
  - **Status Update Integration:** Emails sent when case status changes to ACTIVE_SEARCH, RESOLVED, CLOSED_OTHER
  - **Configuration:** Environment variable approach (`ADMIN_NOTIFICATION_EMAIL`)
  - **Observability:** All notification attempts logged via `notification.*` events
  - **QA Integration:** 3 new tests in QA harness (event verification, config check)
  - **Non-blocking:** Email failures don't break API responses
  - **See:** `docs/features/notifications-mvp.md`
```

Update "Next Tactical Priorities":

```markdown
1. **Identify and implement next phase cluster from roadmap**
   - Build on Phase 0 (observability), Phase 13-14 (cases), Phase 15-16 (public portal), Phase 20-21 (QA), Phase 25-26 (notifications) foundations
   - Continue 108-phase roadmap with same discipline
   - All features must emit structured events and respect legal gating
   - Candidate phases: SMS notifications, role/permission refinement, pet matching algorithm, sighting reports
```

**Acceptance Criteria:**
- [ ] 3 notification tests added to `/admin/qa`
- [ ] Tests verify event logging (not actual email delivery)
- [ ] `notification.send_failed` added to ERROR_IMPACT
- [ ] Feature spec updated to "✅ Fully Implemented"
- [ ] VISION.md updated with Phase 25-26 entry marked COMPLETE
- [ ] VISION.md Next Tactical Priorities updated to include Phase 25-26

**Testing:**
1. Navigate to `/admin/qa`
2. Run "Notification Tests" suite
3. Verify all 3 tests pass
4. Check results show event counts
5. Navigate to `/admin/health`
6. Verify notification events appear in recent events
7. If any emails failed, verify they appear in Errors tab

**Commit Message:**
```
[Phase 25-26] TASK-N06: QA integration & documentation updates

QA Harness:
- Added 3 notification tests (event verification, config check)
- Tests check event logs, not actual email delivery (avoids spam)
- Integrated into "Run All Tests" workflow

ERROR_IMPACT:
- Added notification.send_failed (medium severity)
- Added notification.send_attempted/succeeded (low severity)

Documentation:
- Updated feature spec to "Fully Implemented"
- Added Phase 25-26 to VISION.md as COMPLETE
- Updated Next Tactical Priorities
=======
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
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz
```

---

<<<<<<< HEAD
## Implementation Summary

**Total Tasks:** 6

**Estimated Effort:** 3-4 hours total

**Order of Implementation:**
1. TASK-N01: Audit (15 minutes) - ✅ COMPLETE
2. TASK-N02: Notification helper (60 minutes)
3. TASK-N03: Public report integration (30 minutes)
4. TASK-N04: Status change integration (30 minutes)
5. TASK-N05: Admin settings docs (15 minutes)
6. TASK-N06: QA & docs (45 minutes)

**Dependencies:**
- N02 depends on N01 (need to understand email infra)
- N03 and N04 depend on N02 (need notification functions)
- N06 depends on N03 and N04 (need features to test)

**Risks & Mitigations:**
- **Risk:** Email credentials not configured in dev/prod
  - **Mitigation:** Document clearly in SETUP.md, provide test endpoint
- **Risk:** Email sending slow, delays API responses
  - **Mitigation:** Non-blocking error handling, accept async failures
- **Risk:** Spam filters block automated emails
  - **Mitigation:** Use proper sender address, recommend SendGrid for production

**Success Criteria:**
- All 6 tasks completed and committed
- Public reports trigger 2 emails (contact + admin)
- Status changes trigger 1 email (contact)
- All notification attempts logged with structured events
- QA tests pass
- Documentation updated
- No regressions to existing functionality
=======
*Last Updated: 2025-11-25*
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz
