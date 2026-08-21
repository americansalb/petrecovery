/**
 * SMS Service using Twilio
 *
 * Handles SMS sending, verification, and rate limiting
 */

import twilio from 'twilio';
import prisma from '@/app/lib/prisma';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

// Initialize Twilio client only if credentials are available
let twilioClient = null;
if (accountSid && authToken) {
  twilioClient = twilio(accountSid, authToken);
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
      ...options,
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
      });
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
 * Send sighting notification SMS
 */
export async function sendSightingAlert(userId, phoneNumber, { petName, location, confidence }) {
  const alertMessage = `ReunitePets: Someone reported seeing ${petName} near ${location}. Confidence: ${confidence}/10. Check your notifications for details.`;

  return sendSms(phoneNumber, alertMessage, {
    userId,
    messageType: 'SIGHTING',
  });
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
