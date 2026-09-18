import { NextResponse } from 'next/server';
import { requestPhoneSignIn } from '@/app/lib/geo/server/phoneAuth';
import { subjectsFor } from '@/app/lib/geo/server/meterRequest';
import { withRateLimitAsync, rateLimitResponse } from '@/app/lib/geo/server/limiter';
import { phoneBody, phoneErrorResponse, phoneResponseOptions } from '@/app/lib/geo/server/phoneAuthRoute';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const limit = await withRateLimitAsync(request, { windowMs: 60000, maxRequests: 3, blockDurationMs: 600000 }, 'geo-phone-send');
  if (!limit.success) return rateLimitResponse(limit);
  try {
    const body = await phoneBody(request);
    const { profileId } = await subjectsFor(request);
    const result = await requestPhoneSignIn({ phone: body?.phone, profileId });
    return NextResponse.json({ ok: true, ...result }, phoneResponseOptions);
  } catch (error) { return phoneErrorResponse(error); }
}
