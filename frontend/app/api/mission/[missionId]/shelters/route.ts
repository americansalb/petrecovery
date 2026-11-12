/**
 * Shelter Contacts API Routes
 *
 * GET /api/mission/[missionId]/shelters - List shelters with contact status
 * POST /api/mission/[missionId]/shelters - Add a shelter to track
 *
 * See docs/Actions_Guide.md for full specification.
 *
 * For the people a search's own lists are for (`mayKnowThePeople`,
 * app/lib/missionControl/guard.js): the owner, an active member of a force
 * looking for the pet, and staff. It used to answer any account, for any
 * pet, and any account could add a "shelter" with a name, phone number and
 * email address of its own choosing to someone else's search. What is added
 * is checked, and whoever made a call is a first name.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { mayKnowThePeople, cleanPlace } from '@/app/lib/missionControl/guard';
import { onlyText, cut, firstWord } from '@/app/lib/searchText';
import { withRateLimitAsync, rateLimitResponse, RateLimitPresets } from '@/app/lib/rateLimit';

const REFUSAL = { error: 'Only the owner and the forces looking for this pet can see this.', code: 'NOT_ALLOWED' };
const WRITE_LIMIT = { windowMs: 60 * 1000, maxRequests: 20, blockDurationMs: 60 * 1000 };
const TYPES = ['SHELTER', 'VET', 'ANIMAL_CONTROL'];
// ShelterContactStatus in prisma/schema.prisma.
const STATUSES = ['NOT_CONTACTED', 'CONTACTED', 'AWAITING_RESPONSE', 'NO_MATCH', 'POSSIBLE_MATCH', 'MATCH_FOUND'];

/** One line of text held to a length, or '' for anything that is not text. */
const line = (value: unknown, max: number): string => (typeof value === 'string' ? cut(onlyText(value).replace(/\s+/g, ' ').trim(), max) : '');
/** A phone number as digits and the marks people write between them, or null. */
const phoneOf = (value: unknown): string | null => {
  const text = line(value, 30);
  return /^[+()\d\s.x-]{7,30}$/i.test(text) && (text.match(/\d/g) || []).length >= 7 ? text : null;
};
/** An email address by its shape, or null. */
const emailOf = (value: unknown): string | null => {
  const text = line(value, 120);
  return /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i.test(text) ? text : null;
};

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * GET /api/mission/[missionId]/shelters
 *
 * List all tracked shelters for this case with their contact status
 *
 * Query params:
 * - status: Filter by status (NOT_CONTACTED, CONTACTED, etc.)
 * - type: Filter by type (SHELTER, VET, ANIMAL_CONTROL)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await withRateLimitAsync(request, RateLimitPresets.SEARCH_READ, 'case:shelters-read');
    if (!limited.success) return rateLimitResponse(limited) as NextResponse;

    const { missionId } = await params;
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const typeFilter = (searchParams.get('type') || '').toUpperCase();

    // Verify case exists
    const missionRecord = await prisma.case.findUnique({
      where: { id: missionId },
      select: { id: true },
    });

    if (!missionRecord) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    const who = await mayKnowThePeople(request, missionRecord.id);
    if (!who.allowed) return NextResponse.json(REFUSAL, { status: who.status });

    // Build query. A filter nobody knows is no filter, not a failure.
    const where: any = { missionId };
    if (statusFilter && STATUSES.includes(statusFilter)) {
      where.status = statusFilter;
    }
    if (TYPES.includes(typeFilter)) {
      where.shelterType = typeFilter;
    }

    // Get shelters with latest attempt
    const shelters = await prisma.shelterContact.findMany({
      where,
      include: {
        attempts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            user: {
              select: { firstName: true },
            },
          },
        },
        _count: {
          select: { attempts: true },
        },
      },
      orderBy: [
        { status: 'asc' }, // NOT_CONTACTED first
        { updatedAt: 'desc' },
      ],
    });

    // Format response
    const formattedShelters = shelters.map((shelter) => ({
      id: shelter.id,
      placeId: shelter.placeId,
      name: shelter.shelterName,
      address: shelter.shelterAddress,
      phone: shelter.shelterPhone,
      email: shelter.shelterEmail,
      type: shelter.shelterType,
      location: {
        lat: shelter.latitude,
        lng: shelter.longitude,
      },
      status: shelter.status,
      lastContactedAt: shelter.lastContactedAt,
      lastContactMethod: shelter.lastContactMethod,
      attemptCount: shelter._count.attempts,
      latestAttempt: shelter.attempts[0]
        ? {
            id: shelter.attempts[0].id,
            method: shelter.attempts[0].method,
            createdAt: shelter.attempts[0].createdAt,
            contactedBy: { firstName: firstWord(shelter.attempts[0].user?.firstName) || 'A helper' },
            callOutcome: shelter.attempts[0].callOutcome,
            staffResponse: shelter.attempts[0].staffResponse,
          }
        : null,
      notes: shelter.notes,
    }));

    // Count by status
    const statusCounts = await prisma.shelterContact.groupBy({
      by: ['status'],
      where: { missionId },
      _count: true,
    });

    return NextResponse.json({
      shelters: formattedShelters,
      total: shelters.length,
      statusCounts: Object.fromEntries(
        statusCounts.map((s) => [s.status, s._count])
      ),
    });
  } catch (error) {
    console.error('Shelters GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mission/[missionId]/shelters
 *
 * Add a shelter to track for this case
 *
 * Body: {
 *   placeId: string,
 *   name: string,
 *   address: string,
 *   phone?: string,
 *   email?: string,
 *   type: 'SHELTER' | 'VET' | 'ANIMAL_CONTROL',
 *   latitude: number,
 *   longitude: number,
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await withRateLimitAsync(request, WRITE_LIMIT, 'case:shelters-write');
    if (!limited.success) return rateLimitResponse(limited) as NextResponse;

    const { missionId } = await params;
    const sent = await request.json().catch(() => null);
    const body = sent && typeof sent === 'object' && !Array.isArray(sent) ? sent : {};

    // What a shelter's row holds: short lines of text, a number a phone can dial, an address by its shape,
    // one of the three kinds, and a place on the globe.
    const placeId = line(body.placeId, 200);
    const name = line(body.name, 120);
    const address = line(body.address, 200);
    const phone = phoneOf(body.phone);
    const email = emailOf(body.email);
    const type = typeof body.type === 'string' && TYPES.includes(body.type.toUpperCase()) ? body.type.toUpperCase() : '';
    const place = cleanPlace({ lat: body.latitude, lng: body.longitude });

    // Validate required fields
    if (!placeId || !name || !address || !type || !place) {
      return NextResponse.json(
        { error: 'Missing required fields: placeId, name, address, type, latitude, longitude' },
        { status: 400 }
      );
    }
    const { lat: latitude, lng: longitude } = place;

    // Verify case exists
    const missionRecord = await prisma.case.findUnique({
      where: { id: missionId },
      select: { id: true },
    });

    if (!missionRecord) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    const who = await mayKnowThePeople(request, missionRecord.id);
    if (!who.allowed) return NextResponse.json(REFUSAL, { status: who.status });

    // Check if shelter already exists for this case
    const existing = await prisma.shelterContact.findUnique({
      where: { missionId_placeId: { missionId, placeId } },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        shelter: existing,
        alreadyExists: true,
      });
    }

    // Create shelter contact
    const shelter = await prisma.shelterContact.create({
      data: {
        missionId,
        placeId,
        shelterName: name,
        shelterAddress: address,
        shelterPhone: phone,
        shelterEmail: email,
        shelterType: type,
        latitude,
        longitude,
        status: 'NOT_CONTACTED',
      },
    });

    return NextResponse.json({
      success: true,
      shelter,
      alreadyExists: false,
    });
  } catch (error) {
    console.error('Shelters POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
