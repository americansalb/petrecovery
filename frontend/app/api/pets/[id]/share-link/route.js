/**
 * Pet view-link API (owner only)
 *
 * GET    /api/pets/[id]/share-link - current public view URL (or null)
 * POST   /api/pets/[id]/share-link - enable link sharing / rotate the token
 * DELETE /api/pets/[id]/share-link - disable link sharing
 *
 * The token grants READ-ONLY viewing of the pet's care page to anyone
 * holding the URL. Rotating or disabling kills every previously shared
 * link instantly.
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/app/lib/prisma';
import { requirePetOwner } from '@/app/lib/petOwnership';

function viewUrl(token) {
  return token ? `/pets/view/${token}` : null;
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requirePetOwner(id);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    // requirePetOwner returns a narrow pet shape; the token needs its own read
    const pet = await prisma.pet.findUnique({ where: { id }, select: { publicViewToken: true } });
    return NextResponse.json({ url: viewUrl(pet?.publicViewToken) });
  } catch (error) {
    console.error('[SHARE-LINK] GET failed:', error);
    return NextResponse.json({ error: 'Failed to load link' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requirePetOwner(id);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const token = crypto.randomBytes(24).toString('base64url');
    await prisma.pet.update({ where: { id }, data: { publicViewToken: token } });
    return NextResponse.json({ url: viewUrl(token) });
  } catch (error) {
    console.error('[SHARE-LINK] POST failed:', error);
    return NextResponse.json({ error: 'Failed to create link' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const auth = await requirePetOwner(id);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    await prisma.pet.update({ where: { id }, data: { publicViewToken: null } });
    return NextResponse.json({ url: null, message: 'Link sharing is off. Old links no longer work.' });
  } catch (error) {
    console.error('[SHARE-LINK] DELETE failed:', error);
    return NextResponse.json({ error: 'Failed to disable link' }, { status: 500 });
  }
}
