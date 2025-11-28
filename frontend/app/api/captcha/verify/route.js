import { NextResponse } from 'next/server';
import { verifyCaptchaV2, verifyCaptchaV3 } from '@/app/lib/captcha';

/**
 * POST /api/captcha/verify
 *
 * Verify a reCAPTCHA token.
 * Used for client-side verification before form submission.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { token, version = 'v3', action = 'verify' } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    // Get remote IP
    const forwardedFor = request.headers.get('x-forwarded-for');
    const remoteIp = forwardedFor ? forwardedFor.split(',')[0].trim() : null;

    let result;
    if (version === 'v2') {
      result = await verifyCaptchaV2(token, remoteIp);
    } else {
      result = await verifyCaptchaV3(token, action, remoteIp);
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        score: result.score,
        action: result.action,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: result.error,
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('CAPTCHA verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Verification failed' },
      { status: 500 }
    );
  }
}
