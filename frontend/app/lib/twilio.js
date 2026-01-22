/**
 * Phase 6: Twilio SMS Service
 *
 * SMS notification service using Twilio for:
 * - Sighting alerts
 * - Case status updates
 * - Verification codes
 * - Emergency notifications
 */

import twilio from 'twilio';

// Twilio configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

// Initialize Twilio client
let twilioClient = null;

function getClient() {
  if (!twilioClient && accountSid && authToken) {
    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
}

/**
 * Check if SMS service is configured
 */
export function isSmsConfigured() {
  return !!(accountSid && authToken && (fromNumber || messagingServiceSid));
}

/**
 * Format phone number to E.164 format
 */
export function formatPhoneNumber(phone) {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');

  // Handle US numbers
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // Handle numbers with country code
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }

  // Already has + or assume international
  if (phone.startsWith('+')) {
    return phone;
  }

  return `+${cleaned}`;
}

/**
 * Validate phone number
 */
export function isValidPhoneNumber(phone) {
  const formatted = formatPhoneNumber(phone);
  // Basic E.164 validation
  return /^\+[1-9]\d{6,14}$/.test(formatted);
}

/**
 * Send an SMS message
 *
 * @param {string} to - Recipient phone number
 * @param {string} body - Message body
 * @param {Object} options - Additional options
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendSms(to, body, options = {}) {
  const client = getClient();

  if (!client) {
    console.warn('Twilio client not configured');
    return { success: false, error: 'SMS service not configured' };
  }

  try {
    const formattedTo = formatPhoneNumber(to);

    if (!isValidPhoneNumber(formattedTo)) {
      return { success: false, error: 'Invalid phone number format' };
    }

    const messageParams = {
      to: formattedTo,
      body: body.substring(0, 1600), // Twilio limit
    };

    // Use messaging service if available, otherwise use from number
    if (messagingServiceSid) {
      messageParams.messagingServiceSid = messagingServiceSid;
    } else {
      messageParams.from = fromNumber;
    }

    // Add status callback if provided
    if (options.statusCallback) {
      messageParams.statusCallback = options.statusCallback;
    }

    const message = await client.messages.create(messageParams);

    return {
      success: true,
      messageId: message.sid,
      status: message.status,
    };
  } catch (error) {
    console.error('Failed to send SMS:', error);

    // Map Twilio errors
    const errorMessages = {
      21211: 'Invalid phone number',
      21612: 'Phone number cannot receive SMS',
      21408: 'Account not authorized for destination',
      21610: 'Unverified phone number',
    };

    return {
      success: false,
      error: errorMessages[error.code] || 'Failed to send SMS',
      code: error.code,
    };
  }
}

/**
 * Send a verification code via SMS
 */
export async function sendVerificationCode(to, code) {
  const body = `Your ReunitePets verification code is: ${code}. This code expires in 10 minutes.`;
  return sendSms(to, body);
}

/**
 * Send a sighting alert
 */
export async function sendSightingAlert(to, petName, location, caseUrl) {
  const body = `🔔 ReunitePets Alert: Someone may have spotted ${petName}! Location: ${location}. View details: ${caseUrl}`;
  return sendSms(to, body);
}

/**
 * Send a case status update
 */
export async function sendCaseStatusUpdate(to, petName, status, caseUrl) {
  const statusMessages = {
    FOUND: `🎉 Great news! ${petName} has been marked as FOUND! View update: ${caseUrl}`,
    REUNITED: `🎊 Amazing news! ${petName} has been reunited with their family! View: ${caseUrl}`,
    CLOSED: `Your case for ${petName} has been closed. View: ${caseUrl}`,
    NEW_LEAD: `📍 New lead on ${petName}'s case! Check it out: ${caseUrl}`,
  };

  const body = statusMessages[status] || `Update on ${petName}'s case: ${status}. View: ${caseUrl}`;
  return sendSms(to, body);
}

/**
 * Send an emergency broadcast
 */
export async function sendEmergencyBroadcast(recipients, petName, description, location) {
  const body = `🚨 URGENT: Lost pet alert in your area!\n\n${petName} - ${description}\n\nLast seen: ${location}\n\nPlease keep an eye out and report any sightings.`;

  const results = await Promise.all(
    recipients.map(async (phone) => {
      const result = await sendSms(phone, body);
      return { phone, ...result };
    })
  );

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return {
    total: recipients.length,
    successful,
    failed,
    results,
  };
}

/**
 * SMS message templates
 */
export const SMS_TEMPLATES = {
  WELCOME: (name) =>
    `Welcome to ReunitePets, ${name}! You've enabled SMS alerts. Reply STOP to unsubscribe.`,

  VERIFICATION: (code) =>
    `Your ReunitePets verification code is: ${code}. This code expires in 10 minutes.`,

  SIGHTING_ALERT: (petName, location, url) =>
    `🔔 Possible sighting of ${petName} near ${location}! Details: ${url}`,

  CASE_CREATED: (petName, url) =>
    `Your lost pet report for ${petName} has been created. View: ${url}`,

  CASE_UPDATED: (petName, update, url) =>
    `Update on ${petName}: ${update}. View: ${url}`,

  CASE_FOUND: (petName) =>
    `🎉 Great news! ${petName} has been found! Check the app for details.`,

  CASE_REUNITED: (petName) =>
    `🎊 ${petName} has been reunited with their family! Thank you for helping!`,

  NEW_MESSAGE: (from, url) =>
    `You have a new message from ${from} about your lost pet. View: ${url}`,

  FORCE_ALERT: (forceName, message) =>
    `[${forceName}] ${message}`,

  NEARBY_LOST_PET: (petName, distance, url) =>
    `📍 Lost pet alert: ${petName} was reported missing ${distance} away. Help spread the word: ${url}`,
};

/**
 * Lookup phone number information
 */
export async function lookupPhoneNumber(phone) {
  const client = getClient();

  if (!client) {
    return { success: false, error: 'SMS service not configured' };
  }

  try {
    const formattedPhone = formatPhoneNumber(phone);
    const lookup = await client.lookups.v2.phoneNumbers(formattedPhone).fetch();

    return {
      success: true,
      valid: lookup.valid,
      countryCode: lookup.countryCode,
      nationalFormat: lookup.nationalFormat,
      carrier: lookup.carrier,
    };
  } catch (error) {
    console.error('Phone lookup failed:', error);
    return { success: false, error: 'Phone lookup failed' };
  }
}

/**
 * Get message status
 */
export async function getMessageStatus(messageSid) {
  const client = getClient();

  if (!client) {
    return { success: false, error: 'SMS service not configured' };
  }

  try {
    const message = await client.messages(messageSid).fetch();

    return {
      success: true,
      status: message.status,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage,
      dateSent: message.dateSent,
      dateUpdated: message.dateUpdated,
    };
  } catch (error) {
    console.error('Failed to get message status:', error);
    return { success: false, error: 'Failed to get message status' };
  }
}

export default {
  isSmsConfigured,
  formatPhoneNumber,
  isValidPhoneNumber,
  sendSms,
  sendVerificationCode,
  sendSightingAlert,
  sendCaseStatusUpdate,
  sendEmergencyBroadcast,
  lookupPhoneNumber,
  getMessageStatus,
  SMS_TEMPLATES,
};
