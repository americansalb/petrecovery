# Notifications MVP - Task Breakdown (Phase 25-26)

**Feature Spec:** `docs/features/notifications-mvp.md`
**Status:** Ready for Implementation
**Goal:** Build transactional email notifications for mission lifecycle events

---

## Overview

This document breaks down Phase 25-26 (Notifications MVP) into 6 focused tasks:

- **TASK-N01**: Audit existing email infrastructure
- **TASK-N02**: Create notification helper module
- **TASK-N03**: Wire public report notifications
- **TASK-N04**: Wire mission status change notifications
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

**Implementation:**

```javascript
/**
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
 * @param {Object} missionData - Mission details
 * @param {string} missionData.missionNumber - Mission number (e.g., "CHI-2025-0001")
 * @param {string} missionData.petName - Pet name
 * @param {string} missionData.petSpecies - Pet species (DOG, CAT, etc.)
 * @param {string} missionData.city - City
 * @param {string} missionData.state - State
 * @param {string} missionData.contactName - Contact name
 * @param {string} missionData.contactEmail - Contact email
 * @param {Date} missionData.createdAt - Submission timestamp
 * @param {Object} options - Additional options
 * @param {boolean} options.isPublicReport - Whether this is a public report
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendMissionReportConfirmation(missionData, options = {}) {
  const startTime = Date.now();
  const notificationType = 'mission_report_confirmation';

  try {
    // Log attempt
    await logEvent({
      event_type: 'notification.send_attempted',
      resource_type: 'notification',
      resource_id: missionData.missionNumber,
      action: 'create',
      result: 'success',
      metadata: {
        notification_type: notificationType,
        recipient: missionData.contactEmail,
        mission_number: missionData.missionNumber
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
            <p>Hi ${missionData.contactName || 'there'},</p>

            <p>Thank you for submitting a lost pet report to PetRecovery.org.</p>

            <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1f2937;">Mission Details:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Mission Number:</strong> ${missionData.missionNumber}</li>
                <li><strong>Pet:</strong> ${missionData.petName || 'Unknown'} (${missionData.petSpecies})</li>
                <li><strong>Location:</strong> ${missionData.city}, ${missionData.state}</li>
                <li><strong>Submitted:</strong> ${new Date(missionData.createdAt).toLocaleString()}</li>
              </ul>
            </div>

            <h3 style="color: #1f2937;">What happens next:</h3>
            <ol style="padding-left: 20px;">
              <li>Our admin team will review your report within 24-48 hours.</li>
              <li>Once approved, your mission will be visible on the public portal.</li>
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
      to: missionData.contactEmail,
      subject: `✅ We received your lost pet report: ${missionData.petName || missionData.missionNumber}`,
      html
    });

    const responseTime = Date.now() - startTime;

    if (result.success) {
      // Log success
      await logEvent({
        event_type: 'notification.send_succeeded',
        resource_type: 'notification',
        resource_id: missionData.missionNumber,
        action: 'create',
        result: 'success',
        metadata: {
          notification_type: notificationType,
          recipient: missionData.contactEmail,
          mission_number: missionData.missionNumber,
          response_time_ms: responseTime
        }
      });
    } else {
      // Log failure
      await logEvent({
        event_type: 'notification.send_failed',
        resource_type: 'notification',
        resource_id: missionData.missionNumber,
        action: 'create',
        result: 'failure',
        error_code: 'EMAIL_SEND_FAILED',
        error_message: result.error,
        metadata: {
          notification_type: notificationType,
          recipient: missionData.contactEmail,
          mission_number: missionData.missionNumber,
          response_time_ms: responseTime
        }
      });
    }

    return result;

  } catch (error) {
    // Log exception
    await logEvent({
      event_type: 'notification.send_failed',
      resource_type: 'notification',
      resource_id: missionData.missionNumber,
      action: 'create',
      result: 'failure',
      error_code: 'NOTIFICATION_ERROR',
      error_message: error.message,
      metadata: {
        notification_type: notificationType,
        recipient: missionData.contactEmail,
        mission_number: missionData.missionNumber
      }
    });

    return { success: false, error: error.message };
  }
}

/**
 * Send alert to admin when public report is submitted
 */
export async function sendAdminPublicReportAlert(missionData) {
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
      resource_id: missionData.missionNumber,
      action: 'create',
      result: 'success',
      metadata: {
        notification_type: notificationType,
        recipient: ADMIN_EMAIL,
        mission_number: missionData.missionNumber
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
              <h3 style="margin-top: 0; color: #1f2937;">Mission Information:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Mission Number:</strong> ${missionData.missionNumber}</li>
                <li><strong>Pet:</strong> ${missionData.petName || 'Unknown'} (${missionData.petSpecies}${missionData.petBreed ? ', ' + missionData.petBreed : ''})</li>
                <li><strong>Location:</strong> ${missionData.city}, ${missionData.state} ${missionData.zipCode ? '(' + missionData.zipCode + ')' : ''}</li>
                ${missionData.lastSeenLandmark ? `<li><strong>Landmark:</strong> ${missionData.lastSeenLandmark}</li>` : ''}
                <li><strong>Submitted:</strong> ${new Date(missionData.createdAt).toLocaleString()}</li>
              </ul>
            </div>

            <div style="background: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1f2937;">Contact Information:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Name:</strong> ${missionData.contactName}</li>
                ${missionData.contactEmail ? `<li><strong>Email:</strong> ${missionData.contactEmail}</li>` : ''}
                ${missionData.contactPhone ? `<li><strong>Phone:</strong> ${missionData.contactPhone}</li>` : ''}
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${BASE_URL}/admin/missions/${missionData.id}"
                 style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Review Mission in Admin Panel →
              </a>
            </div>

            <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px;">
              <p style="margin: 0;"><strong>Action Required:</strong> This mission is currently <strong>NOT public</strong> (requires approval). Review the report and set <code>isPublic=true</code> to make it visible.</p>
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
      subject: `🚨 New Public Report: ${missionData.city}, ${missionData.state} – ${missionData.petName || missionData.missionNumber}`,
      html
    });

    const responseTime = Date.now() - startTime;

    if (result.success) {
      await logEvent({
        event_type: 'notification.send_succeeded',
        resource_type: 'notification',
        resource_id: missionData.missionNumber,
        action: 'create',
        result: 'success',
        metadata: {
          notification_type: notificationType,
          recipient: ADMIN_EMAIL,
          mission_number: missionData.missionNumber,
          response_time_ms: responseTime
        }
      });
    } else {
      await logEvent({
        event_type: 'notification.send_failed',
        resource_type: 'notification',
        resource_id: missionData.missionNumber,
        action: 'create',
        result: 'failure',
        error_code: 'EMAIL_SEND_FAILED',
        error_message: result.error,
        metadata: {
          notification_type: notificationType,
          recipient: ADMIN_EMAIL,
          mission_number: missionData.missionNumber,
          response_time_ms: responseTime
        }
      });
    }

    return result;

  } catch (error) {
    await logEvent({
      event_type: 'notification.send_failed',
      resource_type: 'notification',
      resource_id: missionData.missionNumber,
      action: 'create',
      result: 'failure',
      error_code: 'NOTIFICATION_ERROR',
      error_message: error.message,
      metadata: {
        notification_type: notificationType,
        recipient: ADMIN_EMAIL,
        mission_number: missionData.missionNumber
      }
    });

    return { success: false, error: error.message };
  }
}

/**
 * Send status update to contact when mission status changes
 */
export async function sendMissionStatusUpdate(missionData, previousStatus, newStatus) {
  const startTime = Date.now();
  const notificationType = 'status_update';

  if (!missionData.contactEmail) {
    return { success: false, error: 'No contact email provided' };
  }

  try {
    // Log attempt
    await logEvent({
      event_type: 'notification.send_attempted',
      resource_type: 'notification',
      resource_id: missionData.missionNumber,
      action: 'create',
      result: 'success',
      metadata: {
        notification_type: notificationType,
        recipient: missionData.contactEmail,
        mission_number: missionData.missionNumber,
        previous_status: previousStatus,
        new_status: newStatus
      }
    });

    // Status-specific content
    const statusContent = {
      'ACTIVE_SEARCH': {
        title: 'Active Search Started',
        icon: '🔍',
        message: `Rescue squad volunteers are actively searching for ${missionData.petName || 'your pet'} in ${missionData.city}.`,
        color: '#f59e0b'
      },
      'RESOLVED': {
        title: 'Mission Resolved',
        icon: '🎉',
        message: `Great news! Your lost pet mission has been marked as RESOLVED. ${missionData.statusReason || 'We hope your pet is safe!'}`,
        color: '#10b981'
      },
      'CLOSED_OTHER': {
        title: 'Mission Closed',
        icon: 'ℹ️',
        message: `Your mission has been closed. ${missionData.statusReason || 'If you need further assistance, please contact us.'}`,
        color: '#6b7280'
      }
    };

    const content = statusContent[newStatus] || {
      title: 'Status Updated',
      icon: '📢',
      message: `Your mission status has been updated to ${newStatus}.`,
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
            <p>Hi ${missionData.contactName || 'there'},</p>

            <p>${content.message}</p>

            <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1f2937;">Mission Information:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Mission Number:</strong> ${missionData.missionNumber}</li>
                <li><strong>Pet:</strong> ${missionData.petName || 'Unknown'}</li>
                <li><strong>Previous Status:</strong> ${previousStatus}</li>
                <li><strong>New Status:</strong> <strong>${newStatus}</strong></li>
                <li><strong>Updated:</strong> ${new Date().toLocaleString()}</li>
              </ul>
            </div>

            ${missionData.isPublic ? `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${BASE_URL}/missions/${missionData.missionNumber}"
                 style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                View Your Mission Online →
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
      to: missionData.contactEmail,
      subject: `📢 Update on your lost pet mission ${missionData.missionNumber}: ${content.title}`,
      html
    });

    const responseTime = Date.now() - startTime;

    if (result.success) {
      await logEvent({
        event_type: 'notification.send_succeeded',
        resource_type: 'notification',
        resource_id: missionData.missionNumber,
        action: 'create',
        result: 'success',
        metadata: {
          notification_type: notificationType,
          recipient: missionData.contactEmail,
          mission_number: missionData.missionNumber,
          previous_status: previousStatus,
          new_status: newStatus,
          response_time_ms: responseTime
        }
      });
    } else {
      await logEvent({
        event_type: 'notification.send_failed',
        resource_type: 'notification',
        resource_id: missionData.missionNumber,
        action: 'create',
        result: 'failure',
        error_code: 'EMAIL_SEND_FAILED',
        error_message: result.error,
        metadata: {
          notification_type: notificationType,
          recipient: missionData.contactEmail,
          mission_number: missionData.missionNumber,
          previous_status: previousStatus,
          new_status: newStatus,
          response_time_ms: responseTime
        }
      });
    }

    return result;

  } catch (error) {
    await logEvent({
      event_type: 'notification.send_failed',
      resource_type: 'notification',
      resource_id: missionData.missionNumber,
      action: 'create',
      result: 'failure',
      error_code: 'NOTIFICATION_ERROR',
      error_message: error.message,
      metadata: {
        notification_type: notificationType,
        recipient: missionData.contactEmail,
        mission_number: missionData.missionNumber,
        previous_status: previousStatus,
        new_status: newStatus
      }
    });

    return { success: false, error: error.message };
  }
}
```

**Acceptance Criteria:**
- [ ] File created at `frontend/app/lib/notifications.js`
- [ ] Three notification functions implemented:
  - `sendMissionReportConfirmation()`
  - `sendAdminPublicReportAlert()`
  - `sendMissionStatusUpdate()`
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
- sendMissionReportConfirmation(): Owner confirmation for public reports
- sendAdminPublicReportAlert(): Admin alert for new public reports
- sendMissionStatusUpdate(): Status change notifications
- All functions emit notification.* events
- HTML email templates with branding
- Graceful error handling
```

---

## TASK-N03: Wire Public Report Notifications

**Goal:** Hook notification sending into the public report submission endpoint.

**File to Modify:**
- `frontend/app/api/public/missions/route.js`

**Current Flow (Phase 15-16):**
1. Validate request
2. Create mission with `isPublic=false`, `source=PUBLIC_REPORT`
3. Emit `public_mission.report_submitted` event
4. Return success response

**New Flow (Phase 25-26):**
1. Validate request
2. Create mission
3. Emit `public_mission.report_submitted` event
4. **NEW:** Send notifications (non-blocking)
   - Send confirmation to contact (if email provided)
   - Send alert to admin (if configured)
5. Return success response

**Implementation:**

Add imports at top of file:
```javascript
import { sendMissionReportConfirmation, sendAdminPublicReportAlert } from '@/app/lib/notifications';
```

Add after `public_mission.report_submitted` event (around line 375):

```javascript
// Existing event logging...
await logEvent({
  event_type: 'public_mission.report_submitted',
  resource_type: 'public_mission',
  resource_id: newMission.id,
  action: 'create',
  result: 'success',
  // ... existing metadata
});

// NEW: Send notifications (non-blocking - errors logged but don't break API response)
try {
  // 1. Send confirmation to contact (if email provided)
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

  // 2. Send alert to admin (if configured)
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
      mission_number: newMission.missionNumber,
      error_stack: notificationError.stack?.substring(0, 500)
    }
  });
}

// Return the original successful response (unchanged)
return NextResponse.json({
  success: true,
  missionNumber: newMission.missionNumber,
  message: 'Your lost pet report has been submitted and is pending admin approval.',
  mission: {
    missionNumber: newMission.missionNumber,
    city: newMission.city,
    state: newMission.state,
    petName: newMission.petName,
    petSpecies: newMission.petSpecies,
    createdAt: newMission.createdAt
  }
}, { status: 201 });
```

**Key Points:**
- Notification sending is wrapped in try/catch
- Email failures don't break the API response (mission creation still succeeds)
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
1. Submit public report via `/missions/report` with your email
2. Verify you receive confirmation email
3. Verify admin receives alert email (if ADMIN_NOTIFICATION_EMAIL configured)
4. Check `/admin/health` for `notification.*` events
5. Test with invalid SMTP credentials to verify graceful failure handling

**Commit Message:**
```
[Phase 25-26] TASK-N03: Wire public report notifications

- Modified POST /api/public/missions to send notifications after mission creation
- Contact receives confirmation email with mission number and next steps
- Admin receives alert email with mission details and review link
- Notifications are non-blocking (errors don't break API response)
- All notification attempts logged via notification.* events
- No regressions to Phase 15-16 public report flow
```

---

## TASK-N04: Wire Mission Status Change Notifications

**Goal:** Hook notification sending into the mission status update endpoint.

**File to Modify:**
- `frontend/app/api/missions/[id]/status/route.js`

**Current Flow (Phase 13-14):**
1. Validate status transition
2. Update mission status in database
3. Create status change note
4. Emit `mission.status_changed` event
5. Return updated mission

**New Flow (Phase 25-26):**
1. Validate status transition
2. Update mission status
3. Create status change note
4. Emit `mission.status_changed` event
5. **NEW:** Send status update notification (if applicable)
6. Return updated mission

**Implementation:**

Add import at top of file:
```javascript
import { sendMissionStatusUpdate } from '@/app/lib/notifications';
```

Add after `mission.status_changed` event:

```javascript
// Existing event logging...
await logEvent({
  event_type: 'mission.status_changed',
  resource_type: 'mission',
  resource_id: updatedMission.id,
  action: 'update',
  result: 'success',
  // ... existing metadata
});

// NEW: Send status update notification (if relevant status change)
const notifiableStatuses = ['ACTIVE_SEARCH', 'RESOLVED', 'CLOSED_OTHER'];
const shouldNotify = notifiableStatuses.includes(newStatus)
                     && updatedMission.contactEmail
                     && previousStatus !== newStatus; // Avoid duplicate sends

if (shouldNotify) {
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
    // Log error but don't break the API response
    console.error('❌ Status notification error:', notificationError);

    // sendMissionStatusUpdate already logs its own failures,
    // but log this exception as well
    await logEvent({
      event_type: 'notification.send_failed',
      resource_type: 'notification',
      action: 'create',
      result: 'failure',
      error_code: 'STATUS_NOTIFICATION_EXCEPTION',
      error_message: notificationError.message,
      metadata: {
        mission_number: updatedMission.missionNumber,
        previous_status: previousStatus,
        new_status: newStatus
      }
    });
  }
}

// Return the original successful response (unchanged)
return NextResponse.json({
  mission: updatedMission
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
1. Create a mission with `contactEmail` via `/admin/missions`
2. Change status to `ACTIVE_SEARCH`
3. Verify you receive email
4. Change status to `RESOLVED`
5. Verify you receive email with different content
6. Change status to `RESOLVED` again (same value)
7. Verify NO duplicate email sent
8. Check `/admin/health` for `notification.*` events

**Commit Message:**
```
[Phase 25-26] TASK-N04: Wire mission status change notifications

- Modified POST /api/missions/[id]/status to send status update emails
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

PetRecovery.org sends transactional email notifications for key mission lifecycle events.

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
3. **Status Updates** - To the contact email when mission status changes to ACTIVE_SEARCH, RESOLVED, or CLOSED_OTHER

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
  const res = await fetch('/api/public/missions', {
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

  if (!data.missionNumber) {
    throw new Error('Missing missionNumber in response');
  }

  // Wait a moment for events to be logged
  await new Promise(resolve => setTimeout(resolve, 500));

  // Fetch recent events to verify notification events were emitted
  const eventsRes = await fetch('/api/admin/health/events?limit=20');
  const eventsData = await eventsRes.json();

  const notificationEvents = eventsData.events?.filter(e =>
    e.event_type.startsWith('notification.') &&
    e.metadata?.mission_number === data.missionNumber
  ) || [];

  const attemptedEvents = notificationEvents.filter(e => e.event_type === 'notification.send_attempted');
  const succeededEvents = notificationEvents.filter(e => e.event_type === 'notification.send_succeeded');
  const failedEvents = notificationEvents.filter(e => e.event_type === 'notification.send_failed');

  return {
    mission_number: data.missionNumber,
    notification_attempts: attemptedEvents.length,
    notification_successes: succeededEvents.length,
    notification_failures: failedEvents.length,
    events_checked: notificationEvents.length
  };
}

async function testStatusChangeNotificationEvents() {
  // Test that status change triggers notification events

  // First create a mission with contact email
  const createRes = await fetch('/api/missions', {
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
    throw new Error('Failed to create test mission');
  }

  const { mission: testMission } = await createRes.json();

  // Update status to ACTIVE_SEARCH
  const statusRes = await fetch(`/api/missions/${testMission.id}/status`, {
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
    e.metadata?.mission_number === testMission.missionNumber &&
    e.metadata?.notification_type === 'status_update'
  ) || [];

  return {
    mission_number: testMission.missionNumber,
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
// After existing missionTests state, add:

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
  await runMissionTests();
  await runPublicMissionTests();
  await runNotificationTests(); // NEW
};

const isAnyRunning = runningLegal || runningSquad || runningMission || runningPublicMission || runningNotification; // Add runningNotification
```

**Add TestSuite component for notifications** (in render):

```javascript
{/* After Public Mission Test Suite */}

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
- **🎉 Phase 25-26: Notifications MVP (Mission Alerts & Admin Signals)** ✅ **COMPLETE** (Nov 25, 2025)
  - **Notification Types:** 3 transactional email types (report confirmation, admin alert, status update)
  - **Notification Helper:** `lib/notifications.js` with structured event logging
  - **Public Report Integration:** Contact and admin emails sent on public report submission
  - **Status Update Integration:** Emails sent when mission status changes to ACTIVE_SEARCH, RESOLVED, CLOSED_OTHER
  - **Configuration:** Environment variable approach (`ADMIN_NOTIFICATION_EMAIL`)
  - **Observability:** All notification attempts logged via `notification.*` events
  - **QA Integration:** 3 new tests in QA harness (event verification, config check)
  - **Non-blocking:** Email failures don't break API responses
  - **See:** `docs/features/notifications-mvp.md`
```

Update "Next Tactical Priorities":

```markdown
1. **Identify and implement next phase cluster from roadmap**
   - Build on Phase 0 (observability), Phase 13-14 (missions), Phase 15-16 (public portal), Phase 20-21 (QA), Phase 25-26 (notifications) foundations
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
```

---

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
