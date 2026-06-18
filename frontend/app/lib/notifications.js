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
import prisma from '@/app/lib/prisma';

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
export async function sendCaseReportConfirmation(missionData, options = {}) {
  const startTime = Date.now();
  const notificationType = 'case_report_confirmation';

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
        case_number: missionData.missionNumber
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
              <h3 style="margin-top: 0; color: #1f2937;">Case Details:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Case Number:</strong> ${missionData.missionNumber}</li>
                <li><strong>Pet:</strong> ${missionData.petName || 'Unknown'} (${missionData.petSpecies})</li>
                <li><strong>Location:</strong> ${missionData.city}, ${missionData.state}</li>
                <li><strong>Submitted:</strong> ${new Date(missionData.createdAt).toLocaleString()}</li>
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
          case_number: missionData.missionNumber,
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
          case_number: missionData.missionNumber,
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
        case_number: missionData.missionNumber
      }
    });

    return { success: false, error: error.message };
  }
}

/**
 * Send alert to admin when public report is submitted
 *
 * @param {Object} missionData - Mission details
 * @returns {Promise<{success: boolean, error?: string}>}
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
        case_number: missionData.missionNumber
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
                <li><strong>Case Number:</strong> ${missionData.missionNumber}</li>
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
          case_number: missionData.missionNumber,
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
          case_number: missionData.missionNumber,
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
        case_number: missionData.missionNumber
      }
    });

    return { success: false, error: error.message };
  }
}

/**
 * Send status update to contact when case status changes
 *
 * @param {Object} missionData - Mission details
 * @param {string} previousStatus - Previous status
 * @param {string} newStatus - New status
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendCaseStatusUpdate(missionData, previousStatus, newStatus) {
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
        case_number: missionData.missionNumber,
        previous_status: previousStatus,
        new_status: newStatus
      }
    });

    // Status-specific content
    const statusContent = {
      'ACTIVE_SEARCH': {
        title: 'Active Search Started',
        icon: '🔍',
        message: `Rescue force volunteers are actively searching for ${missionData.petName || 'your pet'} in ${missionData.city}.`,
        color: '#f59e0b'
      },
      'RESOLVED': {
        title: 'Case Resolved',
        icon: '🎉',
        message: `Great news! Your lost pet case has been marked as RESOLVED. ${missionData.statusReason || 'We hope your pet is safe!'}`,
        color: '#10b981'
      },
      'CLOSED_OTHER': {
        title: 'Mission Closed',
        icon: 'ℹ️',
        message: `Your case has been closed. ${missionData.statusReason || 'If you need further assistance, please contact us.'}`,
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
            <p>Hi ${missionData.contactName || 'there'},</p>

            <p>${content.message}</p>

            <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1f2937;">Case Information:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Case Number:</strong> ${missionData.missionNumber}</li>
                <li><strong>Pet:</strong> ${missionData.petName || 'Unknown'}</li>
                <li><strong>Previous Status:</strong> ${previousStatus}</li>
                <li><strong>New Status:</strong> <strong>${newStatus}</strong></li>
                <li><strong>Updated:</strong> ${new Date().toLocaleString()}</li>
              </ul>
            </div>

            ${missionData.isPublic ? `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${BASE_URL}/cases/${missionData.missionNumber}"
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
      to: missionData.contactEmail,
      subject: `📢 Update on your lost pet case ${missionData.missionNumber}: ${content.title}`,
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
          case_number: missionData.missionNumber,
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
          case_number: missionData.missionNumber,
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
        case_number: missionData.missionNumber,
        previous_status: previousStatus,
        new_status: newStatus
      }
    });

    return { success: false, error: error.message };
  }
}

/**
 * Send notification to lost pet owner when a potential match is found
 * Phase 1.4: Lost/Found Matching
 *
 * @param {Object} data - Notification data
 * @param {string} data.to - Owner's email
 * @param {string} data.lostPetName - Name of the lost pet
 * @param {string} data.lostCaseNumber - Lost pet case number
 * @param {string} data.foundCaseNumber - Found pet case number
 * @param {number} data.matchScore - Match score (0-100)
 * @param {string} data.foundLocation - Where found pet was seen
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendFoundPetNotification(data) {
  const startTime = Date.now();
  const notificationType = 'potential_match';

  const {
    to,
    lostPetName,
    lostCaseNumber,
    foundCaseNumber,
    matchScore,
    foundLocation,
  } = data;

  if (!to) {
    return { success: false, error: 'No email provided' };
  }

  try {
    await logEvent({
      event_type: 'notification.send_attempted',
      resource_type: 'notification',
      resource_id: lostCaseNumber,
      action: 'create',
      result: 'success',
      metadata: {
        notification_type: notificationType,
        recipient: to,
        lost_case: lostCaseNumber,
        found_case: foundCaseNumber,
        match_score: matchScore,
      }
    });

    const matchQuality = matchScore >= 60 ? 'Good' : 'Possible';
    const urgencyColor = matchScore >= 60 ? '#10b981' : '#f59e0b';

    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
          <div style="background: ${urgencyColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Potential Match Found!</h1>
          </div>

          <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="font-size: 18px; margin-top: 0;">
              Great news! A pet matching <strong>${lostPetName}</strong> was found!
            </p>

            <div style="background: ${urgencyColor}22; border: 2px solid ${urgencyColor}; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #666;">How strong is this match?</p>
              <p style="margin: 10px 0 0 0; font-size: 30px; font-weight: bold; color: ${urgencyColor};">
                ${matchQuality} match
              </p>
              <p style="margin: 8px 0 0 0; color: #666; font-size: 13px;">
                Based on species, location, breed, color and timing. Please look closely at the photos and decide for yourself.
              </p>
            </div>

            <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1f2937;">Details:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Your Case:</strong> ${lostCaseNumber}</li>
                <li><strong>Found Pet Report:</strong> ${foundCaseNumber}</li>
                <li><strong>Found Location:</strong> ${foundLocation}</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${BASE_URL}/cases/${lostCaseNumber}"
                 style="display: inline-block; background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                View Match Details
              </a>
            </div>

            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px;">
              <p style="margin: 0;"><strong>Act quickly!</strong> If this looks like your pet, contact the finder as soon as possible. The case detail page will show you how to reach them.</p>
            </div>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">

            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              <strong>PetRecovery.org</strong> - Reuniting Lost Pets with Their Families
            </p>
          </div>
        </body>
      </html>
    `;

    const result = await sendEmail({
      to,
      subject: `${matchQuality} match found for ${lostPetName}!`,
      html
    });

    const responseTime = Date.now() - startTime;

    if (result.success) {
      await logEvent({
        event_type: 'notification.send_succeeded',
        resource_type: 'notification',
        resource_id: lostCaseNumber,
        action: 'create',
        result: 'success',
        metadata: {
          notification_type: notificationType,
          recipient: to,
          lost_case: lostCaseNumber,
          found_case: foundCaseNumber,
          match_score: matchScore,
          response_time_ms: responseTime,
        }
      });
    } else {
      await logEvent({
        event_type: 'notification.send_failed',
        resource_type: 'notification',
        resource_id: lostCaseNumber,
        action: 'create',
        result: 'failure',
        error_code: 'EMAIL_SEND_FAILED',
        error_message: result.error,
        metadata: {
          notification_type: notificationType,
          recipient: to,
          lost_case: lostCaseNumber,
          found_case: foundCaseNumber,
        }
      });
    }

    return result;

  } catch (error) {
    await logEvent({
      event_type: 'notification.send_failed',
      resource_type: 'notification',
      resource_id: lostCaseNumber,
      action: 'create',
      result: 'failure',
      error_code: 'NOTIFICATION_ERROR',
      error_message: error.message,
      metadata: {
        notification_type: notificationType,
        recipient: to,
        lost_case: lostCaseNumber,
        found_case: foundCaseNumber,
      }
    });

    return { success: false, error: error.message };
  }
}

/**
 * Send urgent notification to pet owner when a sighting is reported
 *
 * @param {Object} data - Notification data
 * @param {string} data.ownerEmail - Pet owner's email
 * @param {string} data.ownerName - Pet owner's name
 * @param {string} data.petName - Name of the pet
 * @param {string} data.missionNumber - Mission number
 * @param {string} data.sightingLocation - Where the pet was sighted
 * @param {string} data.sightingTime - When the pet was sighted
 * @param {string} data.sightingDescription - Description of the sighting
 * @param {number} data.confidenceLevel - Confidence level (1-5 or 1-10)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendSightingNotification(data) {
  const startTime = Date.now();
  const notificationType = 'sighting_alert';

  const {
    ownerEmail,
    ownerName,
    petName,
    missionNumber,
    sightingLocation,
    sightingTime,
    sightingDescription,
    confidenceLevel = 3
  } = data;

  if (!ownerEmail) {
    return { success: false, error: 'No owner email provided' };
  }

  try {
    await logEvent({
      event_type: 'notification.send_attempted',
      resource_type: 'notification',
      resource_id: missionNumber,
      action: 'create',
      result: 'success',
      metadata: {
        notification_type: notificationType,
        recipient: ownerEmail,
        case_number: missionNumber
      }
    });

    const urgencyColor = confidenceLevel >= 4 ? '#dc2626' : '#f59e0b';
    const urgencyText = confidenceLevel >= 4 ? 'HIGH CONFIDENCE' : 'POTENTIAL';

    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
          <div style="background: ${urgencyColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">New Sighting Reported!</h1>
          </div>

          <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Hi ${ownerName || 'there'},</p>

            <div style="background: ${urgencyColor}22; border: 2px solid ${urgencyColor}; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <p style="margin: 0; font-weight: bold; color: ${urgencyColor}; font-size: 18px;">
                ${urgencyText} SIGHTING
              </p>
              <p style="margin: 10px 0 0 0; font-size: 16px;">
                Someone may have spotted <strong>${petName || 'your pet'}</strong>!
              </p>
            </div>

            <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1f2937;">Sighting Details:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Location:</strong> ${sightingLocation}</li>
                <li><strong>Time:</strong> ${sightingTime}</li>
                ${sightingDescription ? `<li><strong>Description:</strong> ${sightingDescription}</li>` : ''}
                <li><strong>Confidence:</strong> ${confidenceLevel}/10</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${BASE_URL}/cases/${missionNumber}"
                 style="display: inline-block; background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                View Sighting on Map
              </a>
            </div>

            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px;">
              <p style="margin: 0;"><strong>Act quickly!</strong> If you're able to, head to this location immediately. Time is critical when a pet has been spotted.</p>
            </div>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">

            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              <strong>PetRecovery.org</strong> - Reuniting Lost Pets with Their Families
            </p>
          </div>
        </body>
      </html>
    `;

    const result = await sendEmail({
      to: ownerEmail,
      subject: `New Sighting of ${petName || 'your pet'}! Check immediately`,
      html
    });

    const responseTime = Date.now() - startTime;

    if (result.success) {
      await logEvent({
        event_type: 'notification.send_succeeded',
        resource_type: 'notification',
        resource_id: missionNumber,
        action: 'create',
        result: 'success',
        metadata: {
          notification_type: notificationType,
          recipient: ownerEmail,
          case_number: missionNumber,
          response_time_ms: responseTime
        }
      });
    }

    return result;

  } catch (error) {
    await logEvent({
      event_type: 'notification.send_failed',
      resource_type: 'notification',
      resource_id: missionNumber,
      action: 'create',
      result: 'failure',
      error_code: 'NOTIFICATION_ERROR',
      error_message: error.message,
      metadata: {
        notification_type: notificationType,
        recipient: ownerEmail,
        case_number: missionNumber
      }
    });

    return { success: false, error: error.message };
  }
}

/**
 * Send notification to squad members when a case is assigned
 *
 * @param {Object} data - Notification data
 * @param {Array} data.memberEmails - Array of member emails
 * @param {string} data.squadName - Name of the rescue force
 * @param {string} data.petName - Name of the pet
 * @param {string} data.petSpecies - Species of the pet
 * @param {string} data.missionNumber - Mission number
 * @param {string} data.location - Location of the lost pet
 * @returns {Promise<{success: boolean, sent: number, failed: number}>}
 */
export async function sendCaseAssignmentNotification(data) {
  const {
    memberEmails,
    squadName,
    petName,
    petSpecies,
    missionNumber,
    location
  } = data;

  if (!memberEmails || memberEmails.length === 0) {
    return { success: false, sent: 0, failed: 0, error: 'No member emails provided' };
  }

  let sent = 0;
  let failed = 0;

  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">New Case Assigned!</h1>
        </div>

        <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; margin-top: 0;">
            <strong>${squadName}</strong> has accepted a new case!
          </p>

          <div style="background: #dbeafe; border: 2px solid #2563eb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #1e40af;">Case Details:</h3>
            <ul style="margin: 0; padding-left: 20px;">
              <li><strong>Pet:</strong> ${petName || 'Unknown'} (${petSpecies})</li>
              <li><strong>Case Number:</strong> ${missionNumber}</li>
              <li><strong>Location:</strong> ${location}</li>
            </ul>
          </div>

          <p>As a member of ${squadName}, you can join this search effort!</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${BASE_URL}/cases/${missionNumber}/coordinate"
               style="display: inline-block; background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
              Join the Search
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px;">
            You're receiving this because you're a member of ${squadName}.
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">

          <p style="color: #6b7280; font-size: 14px; margin: 0;">
            <strong>PetRecovery.org</strong> - Organized Rescue Forces
          </p>
        </div>
      </body>
    </html>
  `;

  // Send to all members (non-blocking)
  const sendPromises = memberEmails.map(async (email) => {
    try {
      const result = await sendEmail({
        to: email,
        subject: `${squadName}: New case assigned - ${petName || petSpecies} in ${location}`,
        html
      });
      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    } catch (err) {
      failed++;
    }
  });

  await Promise.all(sendPromises);

  await logEvent({
    event_type: 'notification.batch_sent',
    resource_type: 'notification',
    resource_id: missionNumber,
    action: 'create',
    result: sent > 0 ? 'success' : 'failure',
    metadata: {
      notification_type: 'case_assignment',
      squad_name: squadName,
      total_recipients: memberEmails.length,
      sent,
      failed
    }
  });

  return { success: sent > 0, sent, failed };
}

/**
 * Send notification when community request status changes
 *
 * @param {Object} data - Notification data
 * @param {string} data.email - Requester's email
 * @param {string} data.name - Requester's name
 * @param {string} data.communityName - Community name
 * @param {string} data.status - New status (APPROVED or REJECTED)
 * @param {string} data.reason - Reason for rejection (optional)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendCommunityRequestNotification(data) {
  const { email, name, communityName, status, reason } = data;

  if (!email) {
    return { success: false, error: 'No email provided' };
  }

  const isApproved = status === 'APPROVED';
  const statusColor = isApproved ? '#10b981' : '#dc2626';
  const statusIcon = isApproved ? '' : '';
  const statusText = isApproved ? 'Approved' : 'Rejected';

  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="background: ${statusColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Community Request ${statusText}</h1>
        </div>

        <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p>Hi ${name || 'there'},</p>

          ${isApproved ? `
            <p>Great news! Your request for the <strong>${communityName}</strong> community has been approved.</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${BASE_URL}/communities"
                 style="display: inline-block; background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Visit Your Community
              </a>
            </div>
          ` : `
            <p>Unfortunately, your request for the <strong>${communityName}</strong> community was not approved.</p>

            ${reason ? `
            <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Reason:</strong> ${reason}</p>
            </div>
            ` : ''}

            <p>If you have questions, please contact our support team.</p>
          `}

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">

          <p style="color: #6b7280; font-size: 14px; margin: 0;">
            <strong>PetRecovery.org</strong> - Reuniting Lost Pets with Their Families
          </p>
        </div>
      </body>
    </html>
  `;

  try {
    const result = await sendEmail({
      to: email,
      subject: `Community Request ${statusText}: ${communityName}`,
      html
    });

    await logEvent({
      event_type: `notification.community_request_${status.toLowerCase()}`,
      resource_type: 'notification',
      action: 'create',
      result: result.success ? 'success' : 'failure',
      metadata: {
        recipient: email,
        community_name: communityName,
        status
      }
    });

    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// IN-APP NOTIFICATIONS
// ============================================================================

/**
 * Create an in-app notification for a user
 *
 * @param {Object} params - Notification parameters
 * @param {string} params.userId - User ID to notify
 * @param {string} params.type - Notification type (CASE_UPDATE, SIGHTING, SQUAD_MESSAGE, SYSTEM)
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {Object} params.data - Additional data (will be JSON stringified)
 * @param {string} params.actionUrl - URL to navigate to when clicked
 * @param {Date} params.expiresAt - Optional expiration date
 * @returns {Promise<{success: boolean, notification?: Object, error?: string}>}
 */
// Re-export in-app notification functions for backward compatibility
export {
  createInAppNotification,
  createBulkNotifications,
  notifyUserCaseUpdate,
  notifyUserSighting,
  notifySquadCaseAssignment,
  notifySquadJoinRequest,
  notifyUserRoleChange,
  notifyUserSystem,
} from '@/app/lib/notifications-inapp';
