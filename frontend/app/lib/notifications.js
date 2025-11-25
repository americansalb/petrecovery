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
      });
    }

    return result;

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
 *
 * @param {Object} caseData - Case details
 * @returns {Promise<{success: boolean, error?: string}>}
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
      });
    }

    return result;

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

    return { success: false, error: error.message };
  }
}

/**
 * Send status update to contact when case status changes
 *
 * @param {Object} caseData - Case details
 * @param {string} previousStatus - Previous status
 * @param {string} newStatus - New status
 * @returns {Promise<{success: boolean, error?: string}>}
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
      });
    }

    return result;

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

    return { success: false, error: error.message };
  }
}
