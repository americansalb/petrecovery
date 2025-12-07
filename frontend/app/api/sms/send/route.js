import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { sendSms, SMS_TEMPLATES } from '@/app/lib/twilio';

/**
 * POST /api/sms/send
 *
 * Send an SMS notification.
 * Admin-only or system use.
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    // Only admins or authenticated system calls can send SMS
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { to, template, templateData, message, userId, caseId } = body;

    // Validate recipient
    if (!to) {
      return NextResponse.json(
        { error: 'Recipient phone number is required' },
        { status: 400 }
      );
    }

    // Build message from template or use provided message
    let messageBody;
    if (template && SMS_TEMPLATES[template]) {
      const templateValues = Array.isArray(templateData) ? templateData : [templateData];
      messageBody = SMS_TEMPLATES[template](...templateValues);
    } else if (message) {
      messageBody = message;
    } else {
      return NextResponse.json(
        { error: 'Message or template is required' },
        { status: 400 }
      );
    }

    // Send SMS
    const result = await sendSms(to, messageBody);

    // Log the SMS
    await prisma.smsLog.create({
      data: {
        userId: userId || session.user.id,
        caseId: caseId || null,
        toNumber: to,
        message: messageBody,
        template: template || null,
        messageId: result.messageId || null,
        status: result.success ? 'SENT' : 'FAILED',
        errorMessage: result.error || null,
      },
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
      });
    }

    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  } catch (error) {
    console.error('SMS send error:', error);
    return NextResponse.json(
      { error: 'Failed to send SMS' },
      { status: 500 }
    );
  }
}
