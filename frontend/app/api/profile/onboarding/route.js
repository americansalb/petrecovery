/**
 * POST /api/profile/onboarding
 *
 * Backs the onboarding form. Updates only fields the OAuth profile
 * typically can't supply (lastName, phone). Email and firstName are
 * intentionally not editable here — a separate profile page handles those.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

const PHONE_REGEX = /^[\d\s\-\(\)\+\.]{7,20}$/;

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const data = {};
  if (typeof body.lastName === 'string' && body.lastName.trim()) {
    data.lastName = body.lastName.trim().substring(0, 100);
  }
  if (typeof body.phone === 'string' && body.phone.trim()) {
    const phone = body.phone.trim();
    if (!PHONE_REGEX.test(phone)) {
      return NextResponse.json(
        { error: 'Please enter a valid phone number' },
        { status: 400 }
      );
    }
    data.phone = phone;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: true, updated: false });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data,
  });

  return NextResponse.json({ success: true, updated: true });
}
