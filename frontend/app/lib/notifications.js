// lib/notifications.js
// Email notification system for PetRecovery.org

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

/**
 * Extract city from address string
 */
function extractCity(address) {
  if (!address) return null;
  const match = address.match(/,\s*([A-Za-z\s]+),?\s*[A-Z]{2}/);
  return match ? match[1].trim() : null;
}

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
