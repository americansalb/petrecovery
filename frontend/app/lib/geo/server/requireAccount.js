import { NextResponse } from 'next/server';
import { accountFromRequest } from './identity';
import { prismaRoomStore } from './roomStore';

/** Require a live, verified account before creating or joining a room. */
export async function requireAccount(request) {
  const { accountId } = accountFromRequest(request);
  const headers = { 'Cache-Control': 'no-store' };
  if (!accountId) return NextResponse.json({ code: 'sign_in_required', error: 'Create your free player account to play with friends.' }, { status: 401, headers });
  try {
    const account = await prismaRoomStore.getAccountById(accountId);
    if (!account) return NextResponse.json({ code: 'sign_in_required', error: 'Sign in to continue.' }, { status: 401, headers });
    if (account.suspendedAt) return NextResponse.json({ code: 'suspended', error: 'This account has been suspended.' }, { status: 403, headers });
    return null;
  } catch {
    return NextResponse.json({ code: 'unavailable', error: 'Could not check your account. Please try again.' }, { status: 503, headers });
  }
}
