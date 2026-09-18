import { NextResponse } from 'next/server';
import { verifyPhoneSignIn } from '@/app/lib/geo/server/phoneAuth';
import { prismaRoomStore } from '@/app/lib/geo/server/roomStore';
import { applySession } from '@/app/lib/geo/server/identity';
import { accountView } from '@/app/lib/geo/server/roles';
import { withRateLimitAsync, rateLimitResponse } from '@/app/lib/geo/server/limiter';
import { phoneBody, phoneErrorResponse, phoneResponseOptions } from '@/app/lib/geo/server/phoneAuthRoute';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const limit = await withRateLimitAsync(request, { windowMs: 600000, maxRequests: 5, blockDurationMs: 600000 }, 'geo-phone-verify');
  if (!limit.success) return rateLimitResponse(limit);
  try {
    const body = await phoneBody(request);
    const { account } = await verifyPhoneSignIn(prismaRoomStore, { challenge: body?.challenge, code: body?.code });
    const response = NextResponse.json({ ok: true, signedIn: true, email: account.email || null, account: accountView(account) }, phoneResponseOptions);
    applySession(response, { accountId: account.id, email: account.email });
    return response;
  } catch (error) { return phoneErrorResponse(error); }
}
