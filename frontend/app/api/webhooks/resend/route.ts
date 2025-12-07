/**
 * Resend Webhook Handler
 *
 * Handles email events from Resend:
 * - email.sent: Email was accepted by recipient's mail server
 * - email.delivered: Email was delivered to recipient
 * - email.opened: Recipient opened the email
 * - email.clicked: Recipient clicked a link
 * - email.bounced: Email bounced
 * - email.complained: Recipient marked as spam
 *
 * See docs/Actions_Guide.md for full specification.
 *
 * @version 1.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import prisma from '@/app/lib/prisma';
import { getVerificationService } from '@/lib/actions/verificationService';

// =============================================================================
// TYPES
// =============================================================================

interface ResendWebhookPayload {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    // Additional fields vary by event type
    [key: string]: unknown;
  };
}

// =============================================================================
// WEBHOOK VERIFICATION
// =============================================================================

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

/**
 * Verify Resend webhook signature
 *
 * Resend uses HMAC SHA256 signature in the 'svix-signature' header.
 * The signature is computed over: `${svix-id}.${svix-timestamp}.${body}`
 */
function verifyResendSignature(
  payload: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignature: string | null
): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn('RESEND_WEBHOOK_SECRET not configured, skipping verification');
    return true; // Skip verification if not configured (dev mode)
  }

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error('Missing Svix headers for webhook verification');
    return false;
  }

  // Check timestamp is within 5 minutes to prevent replay attacks
  const timestampSeconds = parseInt(svixTimestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampSeconds) > 300) {
    console.error('Webhook timestamp too old or in the future');
    return false;
  }

  // Compute expected signature
  const signedPayload = `${svixId}.${svixTimestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(signedPayload)
    .digest('base64');

  // Svix signature format: "v1,<base64signature>"
  // There may be multiple signatures, so we split by space and check each
  const signatures = svixSignature.split(' ');
  for (const sig of signatures) {
    const [version, signature] = sig.split(',');
    if (version === 'v1' && signature === expectedSignature) {
      return true;
    }
  }

  console.error('Invalid webhook signature');
  return false;
}

// =============================================================================
// WEBHOOK HANDLERS
// =============================================================================

/**
 * Handle email.opened event
 */
async function handleEmailOpened(emailId: string): Promise<void> {
  console.log(`Email opened: ${emailId}`);

  const verificationService = getVerificationService(prisma);
  await verificationService.handleEmailOpened(emailId);
}

/**
 * Handle email.clicked event
 */
async function handleEmailClicked(emailId: string, link: string): Promise<void> {
  console.log(`Email clicked: ${emailId}, link: ${link}`);

  // Update the verified action with click data
  await prisma.verifiedAction.updateMany({
    where: { emailId },
    data: {
      // Store click info in metadata
      metadata: {
        path: ['lastClickedLink'],
        set: link,
      },
    } as any,
  });
}

/**
 * Handle email.delivered event
 */
async function handleEmailDelivered(emailId: string): Promise<void> {
  console.log(`Email delivered: ${emailId}`);

  // Could update a delivery status field if needed
  // For now, we just log it
}

/**
 * Handle email.bounced event
 */
async function handleEmailBounced(emailId: string, bounceType: string): Promise<void> {
  console.log(`Email bounced: ${emailId}, type: ${bounceType}`);

  // Update shelter contact attempt to reflect bounce
  await prisma.shelterContactAttempt.updateMany({
    where: { emailId },
    data: {
      notes: `Email bounced (${bounceType})`,
    },
  });

  // Update shelter contact status
  const attempt = await prisma.shelterContactAttempt.findFirst({
    where: { emailId },
    select: { shelterContactId: true },
  });

  if (attempt) {
    await prisma.shelterContact.update({
      where: { id: attempt.shelterContactId },
      data: {
        status: 'NOT_CONTACTED', // Reset status since email didn't reach them
        notes: `Email bounced on ${new Date().toISOString()}`,
      },
    });
  }
}

/**
 * Handle email.complained (spam) event
 */
async function handleEmailComplained(emailId: string): Promise<void> {
  console.log(`Email marked as spam: ${emailId}`);

  // This is serious - we should probably stop emailing this recipient
  const attempt = await prisma.shelterContactAttempt.findFirst({
    where: { emailId },
    select: { shelterContactId: true },
  });

  if (attempt) {
    const contact = await prisma.shelterContact.findUnique({
      where: { id: attempt.shelterContactId },
      select: { shelterEmail: true },
    });

    if (contact?.shelterEmail) {
      // Log this for manual review - in production you'd want a suppression list
      console.error(`SPAM COMPLAINT: Do not email ${contact.shelterEmail} again`);
    }
  }
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/**
 * POST /api/webhooks/resend
 *
 * Handle Resend webhook events for email tracking
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get raw body for signature verification
    const body = await request.text();

    // Get Svix headers for verification
    const headersList = await headers();
    const svixId = headersList.get('svix-id');
    const svixTimestamp = headersList.get('svix-timestamp');
    const svixSignature = headersList.get('svix-signature');

    // Verify signature
    if (!verifyResendSignature(body, svixId, svixTimestamp, svixSignature)) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 403 }
      );
    }

    // Parse payload
    const payload: ResendWebhookPayload = JSON.parse(body);
    const { type, data } = payload;
    const emailId = data.email_id;

    if (!emailId) {
      return NextResponse.json(
        { error: 'Missing email_id in payload' },
        { status: 400 }
      );
    }

    // Route to appropriate handler based on event type
    switch (type) {
      case 'email.sent':
        console.log(`Email sent: ${emailId}`);
        break;

      case 'email.delivered':
        await handleEmailDelivered(emailId);
        break;

      case 'email.opened':
        await handleEmailOpened(emailId);
        break;

      case 'email.clicked':
        await handleEmailClicked(emailId, (data.link as string) || '');
        break;

      case 'email.bounced':
        await handleEmailBounced(emailId, (data.bounce_type as string) || 'unknown');
        break;

      case 'email.complained':
        await handleEmailComplained(emailId);
        break;

      default:
        console.log(`Unhandled Resend event type: ${type}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Resend webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/resend
 *
 * Health check endpoint for the webhook
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    configured: !!WEBHOOK_SECRET,
    timestamp: new Date().toISOString(),
  });
}
