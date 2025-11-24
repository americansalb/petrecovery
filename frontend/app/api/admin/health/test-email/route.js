/**
 * Admin Health - Test Email Endpoint
 * TASK-005: Send test email to admin's email address
 *
 * Per admin-health-dashboard.md:
 * - Sends test email to current logged-in admin
 * - Returns success/failure status
 * - Logs test execution event
 * - Admin-only access
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { sendEmail } from '@/app/lib/email';
import { logEvent } from '@/lib/logging';

/**
 * POST /api/admin/health/test-email
 * Sends a test email to the logged-in admin's email address
 */
export async function POST(request) {
  const startTime = Date.now();

  try {
    // ============================================================================
    // AUTHENTICATION CHECK
    // ============================================================================
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      logEvent({
        event_type: 'admin.test_email_unauthorized',
        resource_type: 'system',
        action: 'create',
        result: 'failure',
        error_code: 'UNAUTHORIZED',
        error_message: 'User attempted to send test email without admin role',
        metadata: {
          user_id: session?.user?.id || 'anonymous',
          user_role: session?.user?.role || 'none'
        }
      });

      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminEmail = session.user.email;

    if (!adminEmail) {
      logEvent({
        event_type: 'admin.test_email_sent',
        resource_type: 'system',
        action: 'create',
        result: 'failure',
        error_code: 'NO_EMAIL',
        error_message: 'Admin user has no email address',
        actor_user_id: session.user.id,
        actor_role: 'ADMIN'
      });

      return NextResponse.json({
        error: 'No email address',
        message: 'Your user account does not have an email address configured'
      }, { status: 400 });
    }

    console.log(`📧 [Admin Test Email] Sending test email to: ${adminEmail}`);

    // ============================================================================
    // CHECK EMAIL CONFIGURATION
    // ============================================================================

    const isEmailConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);

    if (!isEmailConfigured) {
      console.log('   ⚠️  Email service not configured (missing EMAIL_USER or EMAIL_PASSWORD)');

      logEvent({
        event_type: 'admin.test_email_sent',
        resource_type: 'system',
        action: 'create',
        result: 'failure',
        error_code: 'EMAIL_NOT_CONFIGURED',
        error_message: 'Email service requires EMAIL_USER and EMAIL_PASSWORD environment variables',
        actor_user_id: session.user.id,
        actor_role: 'ADMIN',
        metadata: {
          recipient: adminEmail
        }
      });

      return NextResponse.json({
        success: false,
        error: 'Email service not configured',
        message: 'EMAIL_USER and EMAIL_PASSWORD environment variables must be set',
        details: {
          email_user_set: !!process.env.EMAIL_USER,
          email_password_set: !!process.env.EMAIL_PASSWORD,
          email_service: process.env.EMAIL_SERVICE || 'not set'
        }
      }, { status: 503 });
    }

    // ============================================================================
    // SEND TEST EMAIL
    // ============================================================================

    const testEmailHtml = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #2563eb;">✅ Test Email Successful</h2>
            <p>This is a test email from the <strong>PetRecovery.org Admin Health Dashboard</strong>.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p><strong>Sent to:</strong> ${adminEmail}</p>
            <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
            <p><strong>Service:</strong> ${process.env.EMAIL_SERVICE || 'default'}</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #666; font-size: 0.9em;">
              If you received this email, your email service is configured correctly and working.
            </p>
            <p style="color: #666; font-size: 0.9em;">
              <strong>PetRecovery.org</strong> | Admin Health Dashboard
            </p>
          </div>
        </body>
      </html>
    `;

    const emailResult = await sendEmail({
      to: adminEmail,
      subject: '🧪 PetRecovery.org - Test Email from Admin Dashboard',
      html: testEmailHtml
    });

    const responseTime = Date.now() - startTime;

    // ============================================================================
    // EVENT LOGGING
    // ============================================================================
    logEvent({
      event_type: 'admin.test_email_sent',
      resource_type: 'system',
      action: 'create',
      result: emailResult.success ? 'success' : 'failure',
      actor_user_id: session.user.id,
      actor_role: 'ADMIN',
      error_code: emailResult.success ? null : 'EMAIL_SEND_FAILED',
      error_message: emailResult.success ? null : emailResult.error,
      metadata: {
        recipient: adminEmail,
        response_time_ms: responseTime
      }
    });

    if (emailResult.success) {
      console.log(`   ✅ Test email sent successfully in ${responseTime}ms`);

      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully',
        recipient: adminEmail,
        response_time_ms: responseTime
      });
    } else {
      console.error(`   ❌ Failed to send test email: ${emailResult.error}`);

      return NextResponse.json({
        success: false,
        error: 'Failed to send email',
        message: emailResult.error,
        recipient: adminEmail,
        response_time_ms: responseTime
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ [Admin Test Email] Unexpected error:', error);

    logEvent({
      event_type: 'admin.test_email_sent',
      resource_type: 'system',
      action: 'create',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      actor_role: 'ADMIN',
      metadata: {
        error_stack: error.stack?.substring(0, 500)
      }
    });

    return NextResponse.json({
      error: 'Test email failed',
      message: error.message
    }, { status: 500 });
  }
}
