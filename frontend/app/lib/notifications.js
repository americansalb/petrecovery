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

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_ALERT_EMAIL;

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

/**
 * Extract city from address string
 */
function extractCity(address) {
  if (!address) return null;
  const match = address.match(/,\s*([A-Za-z\s]+),?\s*[A-Z]{2}/);
  return match ? match[1].trim() : null;
}

/**
 * Send confirmation email to contact when public report is submitted
 */
export async function sendCaseReportConfirmation(caseData, options = {}) {
  const startTime = Date.now();
  const notificationType = 'case_report_confirmation';

  if (!isNotificationsEnabled()) {
    return { skipped: true, reason: 'notifications_disabled' };
  }

  // Use contactEmail (LostPetCase) or ownerEmail (legacy fallback)
  const recipientEmail = caseData.contactEmail || caseData.ownerEmail;
  const recipientName = caseData.contactName || caseData.ownerName || 'there';

  if (!recipientEmail) {
    return { skipped: true, reason: 'no_email' };
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
        recipient: recipientEmail,
        case_number: caseData.caseNumber
      }
    });

    // Build email HTML
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">✅ Report Received</h1>
        </div>

        <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p>Hi ${recipientName},</p>

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

          <p style="margin-top: 20px;">
            <a href="${BASE_URL}/cases/${caseData.caseNumber}"
               style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Your Case
            </a>
          </p>

          ${getEmailFooter()}
        </div>
      </div>
    `;

    // Send email
    const result = await sendEmail({
      to: recipientEmail,
      subject: `✅ We received your lost pet report: ${caseData.petName || caseData.caseNumber}`,
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
          recipient: recipientEmail,
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
          recipient: recipientEmail,
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
        recipient: recipientEmail,
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

  if (!isAdminAlertsEnabled() || !ADMIN_EMAIL) {
    return { skipped: true, reason: 'admin_alerts_disabled_or_no_email' };
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
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
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
              <li><strong>Name:</strong> ${caseData.contactName || caseData.ownerName}</li>
              <li><strong>Email:</strong> ${caseData.contactEmail || caseData.ownerEmail}</li>
              <li><strong>Phone:</strong> ${caseData.contactPhone || caseData.ownerPhone || 'N/A'}</li>
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
      </div>
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
 */
export async function sendCaseStatusUpdate(caseData, previousStatus, newStatus) {
  const startTime = Date.now();
  const notificationType = 'status_update';

  if (!isNotificationsEnabled()) {
    return { skipped: true, reason: 'notifications_disabled' };
  }

  const recipientEmail = caseData.contactEmail || caseData.ownerEmail;
  const recipientName = caseData.contactName || caseData.ownerName || 'there';

  if (!recipientEmail) {
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
        recipient: recipientEmail,
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
      'SIGHTING_REPORTED': {
        title: 'Sighting Reported',
        icon: '👀',
        message: `Someone has reported a possible sighting of your pet. Check your case page for details.`,
        color: '#3b82f6'
      },
      'RESOLVED': {
        title: 'Case Resolved',
        icon: '🎉',
        message: `Great news! Your lost pet case has been marked as RESOLVED. ${caseData.statusReason || 'We hope your pet is safe!'}`,
        color: '#10b981'
      },
      'REUNITED': {
        title: 'Reunited!',
        icon: '🏠',
        message: `We're thrilled to share that ${caseData.petName} has been marked as reunited!`,
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
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <div style="background: ${content.color}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">${content.icon} ${content.title}</h1>
        </div>

        <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p>Hi ${recipientName},</p>

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

          <div style="text-align: center; margin: 30px 0;">
            <a href="${BASE_URL}/cases/${caseData.caseNumber}"
               style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Your Case Online →
            </a>
          </div>

          <p>We'll notify you of any further updates.</p>

          ${getEmailFooter()}
        </div>
      </div>
    `;

    // Send email
    const result = await sendEmail({
      to: recipientEmail,
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
          recipient: recipientEmail,
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
          recipient: recipientEmail,
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
        recipient: recipientEmail,
        case_number: caseData.caseNumber,
        previous_status: previousStatus,
        new_status: newStatus
      }
    });

    return { success: false, error: error.message };
  }
}

/**
 * Send notification to coordinator when assigned to case
 */
export async function sendCoordinatorAssignmentNotification(caseData, coordinator) {
  const startTime = Date.now();
  const notificationType = 'coordinator_assignment';

  if (!isNotificationsEnabled()) {
    return { skipped: true, reason: 'notifications_disabled' };
  }

  if (!coordinator.email) {
    return { skipped: true, reason: 'no_coordinator_email' };
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
        recipient: coordinator.email,
        case_number: caseData.caseNumber
      }
    });

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
            <p style="margin: 5px 0;"><strong>Location:</strong> ${caseData.city}, ${caseData.state}</p>
          </div>

          <p>As coordinator, you'll be responsible for:</p>
          <ul>
            <li>Coordinating search efforts with rescue squads</li>
            <li>Keeping the pet owner informed of progress</li>
            <li>Managing case status and updates</li>
          </ul>

          <p style="margin-top: 20px;">
            <a href="${BASE_URL}/admin/cases/${caseData.id}"
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
      await logEvent({
        event_type: 'notification.send_succeeded',
        resource_type: 'notification',
        resource_id: caseData.caseNumber,
        action: 'create',
        result: 'success',
        metadata: {
          notification_type: notificationType,
          recipient: coordinator.email,
          case_number: caseData.caseNumber,
          response_time_ms: Date.now() - startTime
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
          recipient: coordinator.email,
          case_number: caseData.caseNumber,
          response_time_ms: Date.now() - startTime
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
        recipient: coordinator.email,
        case_number: caseData.caseNumber
      }
    });

    return { success: false, error: error.message };
  }
}
