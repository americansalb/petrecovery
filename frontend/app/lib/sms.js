/**
 * SMS Service using Twilio
 *
 * Handles SMS sending, verification, and rate limiting
 */

import twilio from 'twilio';
import prisma from '@/app/lib/prisma';
import { isDeliverableEmail } from '@/app/lib/placeholderEmail';
import { getEmailBaseUrl } from '@/app/lib/config';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

// Initialize Twilio client only if credentials are available
let twilioClient = null;
if (accountSid && authToken) {
  twilioClient = twilio(accountSid, authToken);
}

/** True when a text can be sent at all: an account, its token and a number to send from. */
export function smsConfigured() {
  return Boolean(twilioClient && twilioPhone);
}

/**
 * Send an SMS message
 *
 * @param {string} to - Phone number in E.164 format (+1XXXXXXXXXX)
 * @param {string} message - Message content (max 160 chars for single SMS)
 * @param {Object} options - Optional settings
 * @returns {Promise<{success: boolean, sid?: string, error?: string}>}
 */
export async function sendSms(to, message, options = {}) {
  if (!twilioClient) {
    console.warn('Twilio not configured - SMS not sent');
    return { success: false, error: 'SMS service not configured' };
  }

  // userId and messageType are for the log below, not for Twilio: they used to be sent to it as message fields.
  const { userId, messageType, ...twilioOptions } = options;

  try {
    // Format phone number if needed
    const formattedPhone = formatPhoneNumber(to);
    if (!formattedPhone) {
      return { success: false, error: 'Invalid phone number format' };
    }

    const result = await twilioClient.messages.create({
      body: message,
      from: twilioPhone,
      to: formattedPhone,
      ...twilioOptions,
    });

    // Log the SMS
    if (options.userId) {
      await prisma.smsLog.create({
        data: {
          userId: options.userId,
          phoneNumber: formattedPhone,
          messageType: options.messageType || 'GENERAL',
          message: message.substring(0, 500), // Truncate for storage
          status: 'SENT',
          twilioSid: result.sid,
        },
      }).catch(() => {}); // the text went: a log that could not be written does not make it a failure
    }

    return { success: true, sid: result.sid };
  } catch (error) {
    console.error('SMS send error:', error);

    // Log failed attempt
    if (options.userId) {
      await prisma.smsLog.create({
        data: {
          userId: options.userId,
          phoneNumber: to,
          messageType: options.messageType || 'GENERAL',
          message: message.substring(0, 500),
          status: 'FAILED',
          errorCode: error.code?.toString(),
        },
      }).catch(() => {});
    }

    return { success: false, error: error.message };
  }
}

/**
 * Send verification code to phone number
 *
 * @param {string} userId - User ID
 * @param {string} phoneNumber - Phone number to verify
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendVerificationCode(userId, phoneNumber) {
  const formattedPhone = formatPhoneNumber(phoneNumber);
  if (!formattedPhone) {
    return { success: false, error: 'Invalid phone number format' };
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    // Upsert verification record
    await prisma.phoneVerification.upsert({
      where: {
        userId_phoneNumber: {
          userId,
          phoneNumber: formattedPhone,
        },
      },
      update: {
        code,
        expiresAt,
        verified: false,
        attempts: 0,
      },
      create: {
        userId,
        phoneNumber: formattedPhone,
        code,
        expiresAt,
      },
    });

    // Send SMS
    const result = await sendSms(
      formattedPhone,
      `Your ReunitePets verification code is: ${code}. It expires in 10 minutes.`,
      { userId, messageType: 'VERIFICATION' }
    );

    return result;
  } catch (error) {
    console.error('Verification send error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Verify a phone number with code
 *
 * @param {string} userId - User ID
 * @param {string} phoneNumber - Phone number being verified
 * @param {string} code - Verification code
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function verifyPhoneNumber(userId, phoneNumber, code) {
  const formattedPhone = formatPhoneNumber(phoneNumber);
  if (!formattedPhone) {
    return { success: false, error: 'Invalid phone number format' };
  }

  try {
    const verification = await prisma.phoneVerification.findUnique({
      where: {
        userId_phoneNumber: {
          userId,
          phoneNumber: formattedPhone,
        },
      },
    });

    if (!verification) {
      return { success: false, error: 'No verification pending for this number' };
    }

    if (verification.verified) {
      return { success: false, error: 'Phone already verified' };
    }

    if (verification.attempts >= 5) {
      return { success: false, error: 'Too many attempts. Please request a new code.' };
    }

    if (new Date() > verification.expiresAt) {
      return { success: false, error: 'Verification code expired' };
    }

    // Increment attempts
    await prisma.phoneVerification.update({
      where: { id: verification.id },
      data: { attempts: verification.attempts + 1 },
    });

    if (verification.code !== code) {
      return { success: false, error: 'Invalid verification code' };
    }

    // Mark as verified
    await prisma.phoneVerification.update({
      where: { id: verification.id },
      data: {
        verified: true,
        verifiedAt: new Date(),
      },
    });

    // Update user's phone
    await prisma.user.update({
      where: { id: userId },
      data: {
        phone: formattedPhone,
        phoneVerified: true,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Phone verification error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send urgent alert SMS
 */
export async function sendUrgentAlert(userId, phoneNumber, { petName, missionNumber, location, message }) {
  const alertMessage = `URGENT ReunitePets Alert: ${petName} (Case #${missionNumber}) spotted near ${location}. ${message || 'Check app for details.'}`;

  return sendSms(phoneNumber, alertMessage, {
    userId,
    messageType: 'URGENT_ALERT',
  });
}

/**
 * The words of a sighting text: what the owner's bell says, where, and the
 * link to the map. `title` is "Max was just seen" or "Max was seen 2 hours
 * ago"; `place` a corner or a landmark, never a house number.
 */
export function sightingText({ title, place, link }) {
  return `ReunitePets: ${title}${place ? ` near ${place}` : ''}. See where on the map: ${link}`;
}

/**
 * Send sighting notification SMS
 */
export async function sendSightingAlert(userId, phoneNumber, { title, place, link }) {
  return sendSms(phoneNumber, sightingText({ title, place, link }), {
    userId,
    messageType: 'SIGHTING',
  });
}

/* ------------------------------------------------- texts to the owner */

/**
 * How many texts of one kind (a sighting, a found pet that may be theirs)
 * an owner gets in an hour. Each text costs money and a busy hour can bring
 * many sightings; the bell, the push and the email still carry every one
 * (app/lib/sightingLimits.js caps the email).
 */
export const OWNER_TEXTS_PER_HOUR = 4;

/**
 * The number to text the owner of a lost report on, or null when they did
 * not ask for texts. Pure.
 *
 * An owner asks for texts in one of two ways: they reported with "Text me"
 * (the wizard's default), which leaves the report with a phone and no email
 * that mail can reach; or they turned on sighting texts for a phone they
 * confirmed in their settings (SmsPreference). `c` is the case with its
 * reporter and the reporter's smsPreferences.
 */
export function ownerTextNumber(c, { kind = 'SIGHTING' } = {}) {
  if (!c) return null;
  const reporter = c.reporter || {};
  const pref = reporter.smsPreferences;
  if (pref?.verified && formatPhoneNumber(pref.phoneNumber)) {
    const wants = kind === 'SIGHTING' ? pref.sightingAlerts : pref.urgentAlerts;
    if (wants) return formatPhoneNumber(pref.phoneNumber);
  }
  const choseText = !isDeliverableEmail(c.ownerEmail) && !isDeliverableEmail(reporter.email);
  if (!choseText) return null;
  return formatPhoneNumber(c.ownerPhone) || formatPhoneNumber(reporter.phone) || null;
}

/**
 * Text the owner of a case, when they asked for texts and a text can go.
 * Returns { sent: true } only when Twilio took the message; otherwise
 * { sent: false, reason }. Never throws.
 *
 * kind: 'SIGHTING' or 'FOUND_MATCH', the SmsLog messageType, which is what
 * the hourly count is kept by.
 */
export async function textCaseOwner({ caseId, body, kind = 'SIGHTING', now = new Date() }) {
  try {
    if (!smsConfigured()) return { sent: false, reason: 'SMS_NOT_CONFIGURED' };
    const c = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        ownerEmail: true,
        ownerPhone: true,
        reporter: { select: { id: true, email: true, phone: true, smsPreferences: { select: { phoneNumber: true, verified: true, sightingAlerts: true, urgentAlerts: true } } } },
      },
    });
    const to = ownerTextNumber(c, { kind });
    if (!to) return { sent: false, reason: 'NOT_ASKED' };
    const userId = c.reporter?.id;
    const lastHour = await prisma.smsLog.count({
      where: { userId, messageType: kind, status: 'SENT', createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) } },
    });
    if (lastHour >= OWNER_TEXTS_PER_HOUR) return { sent: false, reason: 'HOURLY_LIMIT' };
    const res = await sendSms(to, body, { userId, messageType: kind });
    return res?.success ? { sent: true } : { sent: false, reason: res?.error || 'SEND_FAILED' };
  } catch (error) {
    console.error('[sms] owner text failed:', error?.message);
    return { sent: false, reason: 'ERROR' };
  }
}

/**
 * A sighting, texted to the owner who asked for texts. For the routes that
 * tell the owner about a sighting (app/lib/witness.js), beside the bell, the
 * push and the email. `url` is the site path the bell links to.
 */
export async function textOwnerAboutSighting({ caseId, title, place = null, url, now = new Date() }) {
  if (!smsConfigured()) return { sent: false, reason: 'SMS_NOT_CONFIGURED' };
  const link = `${getEmailBaseUrl()}${url || ''}`;
  return textCaseOwner({ caseId, kind: 'SIGHTING', body: sightingText({ title, place, link }), now });
}

/**
 * Send case update SMS
 */
export async function sendCaseUpdateSms(userId, phoneNumber, { missionNumber, updateType, summary }) {
  const alertMessage = `ReunitePets Case ${missionNumber}: ${updateType}. ${summary}`;

  return sendSms(phoneNumber, alertMessage, {
    userId,
    messageType: 'CASE_UPDATE',
  });
}

/**
 * Check if user can receive SMS (rate limiting)
 */
export async function canSendSms(userId) {
  try {
    const prefs = await prisma.smsPreference.findUnique({
      where: { userId },
    });

    if (!prefs || !prefs.verified) {
      return { allowed: false, reason: 'SMS not configured or verified' };
    }

    // Reset daily counter if needed
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (prefs.lastResetDate < today) {
      await prisma.smsPreference.update({
        where: { userId },
        data: {
          sentToday: 0,
          lastResetDate: today,
        },
      });
      return { allowed: true, remaining: prefs.dailyLimit };
    }

    if (prefs.sentToday >= prefs.dailyLimit) {
      return { allowed: false, reason: 'Daily SMS limit reached' };
    }

    return { allowed: true, remaining: prefs.dailyLimit - prefs.sentToday };
  } catch (error) {
    return { allowed: false, reason: error.message };
  }
}

/**
 * Format phone number to E.164 format
 */
function formatPhoneNumber(phone) {
  if (!phone) return null;

  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // Handle US numbers
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // Already has country code
  if (phone.startsWith('+') && digits.length >= 10) {
    return `+${digits}`;
  }

  return null;
}

export { formatPhoneNumber };
