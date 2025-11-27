import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import twilio from 'twilio';
import prisma from '@/app/lib/prisma';

const webhookUrl = process.env.TWILIO_WEBHOOK_URL;
const authToken = process.env.TWILIO_AUTH_TOKEN;

/**
 * Verify Twilio webhook signature
 */
function verifyTwilioSignature(request, body) {
  if (!authToken || !webhookUrl) {
    console.warn('Twilio webhook verification not configured');
    return true; // Skip verification if not configured
  }

  const signature = headers().get('x-twilio-signature');
  if (!signature) {
    return false;
  }

  return twilio.validateRequest(authToken, signature, webhookUrl, body);
}

/**
 * POST /api/webhooks/twilio
 *
 * Handle Twilio webhooks for:
 * - Message status updates
 * - Incoming messages (replies, STOP requests)
 */
export async function POST(request) {
  try {
    const formData = await request.formData();
    const body = Object.fromEntries(formData.entries());

    // Verify signature
    if (!verifyTwilioSignature(request, body)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 403 }
      );
    }

    // Handle different webhook types
    const messageSid = body.MessageSid || body.SmsSid;
    const messageStatus = body.MessageStatus || body.SmsStatus;
    const from = body.From;
    const to = body.To;
    const messageBody = body.Body;

    // Status callback
    if (messageStatus) {
      await handleStatusCallback(messageSid, messageStatus, body);
    }

    // Incoming message
    if (from && messageBody) {
      await handleIncomingMessage(from, to, messageBody, messageSid);
    }

    // Return TwiML response for incoming messages
    if (messageBody) {
      const response = generateTwiMLResponse(messageBody);
      return new NextResponse(response, {
        headers: { 'Content-Type': 'application/xml' },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Twilio webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle message status updates
 */
async function handleStatusCallback(messageSid, status, body) {
  try {
    // Update SMS log with new status
    await prisma.smsLog.updateMany({
      where: { messageId: messageSid },
      data: {
        status: mapTwilioStatus(status),
        errorCode: body.ErrorCode || null,
        errorMessage: body.ErrorMessage || null,
        updatedAt: new Date(),
      },
    });

    // Handle failed messages
    if (['failed', 'undelivered'].includes(status)) {
      console.error(`SMS ${messageSid} failed: ${body.ErrorCode} - ${body.ErrorMessage}`);

      // Could trigger retry logic or notifications here
    }
  } catch (error) {
    console.error('Error handling status callback:', error);
  }
}

/**
 * Handle incoming SMS messages
 */
async function handleIncomingMessage(from, to, body, messageSid) {
  try {
    const normalizedBody = body.trim().toUpperCase();

    // Handle opt-out keywords
    if (['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(normalizedBody)) {
      await handleOptOut(from);
      return;
    }

    // Handle opt-in keywords
    if (['START', 'YES', 'UNSTOP'].includes(normalizedBody)) {
      await handleOptIn(from);
      return;
    }

    // Handle help keyword
    if (['HELP', 'INFO'].includes(normalizedBody)) {
      // Log for help response
      return;
    }

    // Log incoming message
    await prisma.smsLog.create({
      data: {
        messageId: messageSid,
        toNumber: to,
        fromNumber: from,
        message: body,
        status: 'RECEIVED',
        direction: 'INBOUND',
      },
    });

    // Could trigger auto-responses or notifications here
  } catch (error) {
    console.error('Error handling incoming message:', error);
  }
}

/**
 * Handle STOP/opt-out requests
 */
async function handleOptOut(phoneNumber) {
  try {
    // Find user by phone number and disable SMS
    const preference = await prisma.smsPreference.findFirst({
      where: { phoneNumber },
    });

    if (preference) {
      await prisma.smsPreference.update({
        where: { id: preference.id },
        data: {
          enabled: false,
          optedOutAt: new Date(),
        },
      });

      console.log(`User opted out of SMS: ${phoneNumber}`);
    }
  } catch (error) {
    console.error('Error handling opt-out:', error);
  }
}

/**
 * Handle START/opt-in requests
 */
async function handleOptIn(phoneNumber) {
  try {
    const preference = await prisma.smsPreference.findFirst({
      where: { phoneNumber },
    });

    if (preference) {
      await prisma.smsPreference.update({
        where: { id: preference.id },
        data: {
          enabled: true,
          optedOutAt: null,
        },
      });

      console.log(`User opted back in to SMS: ${phoneNumber}`);
    }
  } catch (error) {
    console.error('Error handling opt-in:', error);
  }
}

/**
 * Map Twilio status to our status
 */
function mapTwilioStatus(twilioStatus) {
  const statusMap = {
    queued: 'QUEUED',
    sending: 'SENDING',
    sent: 'SENT',
    delivered: 'DELIVERED',
    undelivered: 'UNDELIVERED',
    failed: 'FAILED',
    received: 'RECEIVED',
  };

  return statusMap[twilioStatus] || twilioStatus.toUpperCase();
}

/**
 * Generate TwiML response for incoming messages
 */
function generateTwiMLResponse(incomingBody) {
  const normalizedBody = incomingBody.trim().toUpperCase();
  let responseMessage = '';

  if (['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(normalizedBody)) {
    responseMessage = 'You have been unsubscribed from PetRecovery SMS alerts. Reply START to re-subscribe.';
  } else if (['START', 'YES', 'UNSTOP'].includes(normalizedBody)) {
    responseMessage = 'Welcome back to PetRecovery SMS alerts! You will now receive notifications again.';
  } else if (['HELP', 'INFO'].includes(normalizedBody)) {
    responseMessage = 'PetRecovery SMS: Reply STOP to unsubscribe. For help, visit petrecovery.org or email support@petrecovery.org';
  }

  if (responseMessage) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${responseMessage}</Message>
</Response>`;
  }

  // Empty response for other messages
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`;
}
