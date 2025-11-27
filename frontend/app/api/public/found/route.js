/**
 * Public Found Pet Report API - Phase 1.4
 *
 * POST /api/public/found - Submit a found pet report
 * GET /api/public/found - List found pet reports
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import { findMatches, calculateMatchScore } from '@/app/lib/matching';
import { sendFoundPetNotification } from '@/app/lib/notifications';
import { withRateLimit, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Phone validation regex
const PHONE_REGEX = /^[\d\s\-\(\)\+\.]{7,20}$/;
// Max description length
const MAX_DESCRIPTION_LENGTH = 2000;
// Max photo URLs
const MAX_PHOTO_URLS = 10;

// GET /api/public/found - List found pet reports
export async function GET(request) {
  // Apply rate limiting for public reads
  const rateLimitResult = withRateLimit(request, RateLimitPresets.PUBLIC_READ, 'public:found:list');
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const state = searchParams.get('state');
    const species = searchParams.get('species');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where = {
      reportType: 'FOUND',
      status: { in: ['OPEN', 'ACTIVE_SEARCH'] },
    };

    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (state) where.state = state.toUpperCase();
    if (species) where.petSpecies = species.toUpperCase();

    const [foundPets, total] = await Promise.all([
      prisma.lostPetCase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          caseNumber: true,
          petName: true,
          petSpecies: true,
          petBreed: true,
          petColor: true,
          petDescription: true,
          city: true,
          state: true,
          lastSeenAt: true,
          lastSeenLandmark: true,
          photoUrls: true,
          createdAt: true,
        }
      }),
      prisma.lostPetCase.count({ where })
    ]);

    return NextResponse.json({
      foundPets: foundPets.map(p => ({
        ...p,
        photoUrls: JSON.parse(p.photoUrls || '[]'),
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    console.error('[FOUND API] Error listing found pets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch found pets' },
      { status: 500 }
    );
  }
}

// POST /api/public/found - Submit found pet report
export async function POST(request) {
  // Apply stricter rate limiting for writes
  const rateLimitResult = withRateLimit(request, RateLimitPresets.PUBLIC_WRITE, 'public:found:create');
  if (!rateLimitResult.success) {
    await logEvent({
      event_type: 'found_pet.report_rate_limited',
      resource_type: 'found_case',
      action: 'create',
      result: 'failure',
      error_code: 'RATE_LIMITED',
      actor_role: 'public'
    });
    return rateLimitResponse(rateLimitResult);
  }

  try {
    const body = await request.json();
    const {
      petSpecies,
      petBreed,
      petColor,
      petDescription,
      city,
      state,
      zipCode,
      lastSeenLandmark,
      foundAt,
      latitude,
      longitude,
      contactName,
      contactPhone,
      contactEmail,
      photoUrls,
    } = body;

    // Validation
    if (!petSpecies) {
      return NextResponse.json({ error: 'Pet species is required' }, { status: 400 });
    }
    if (!city || !state) {
      return NextResponse.json({ error: 'City and state are required' }, { status: 400 });
    }
    if (!contactName) {
      return NextResponse.json({ error: 'Contact name is required' }, { status: 400 });
    }
    if (!contactEmail && !contactPhone) {
      return NextResponse.json({ error: 'Contact email or phone is required' }, { status: 400 });
    }

    // Email format validation
    if (contactEmail && !EMAIL_REGEX.test(contactEmail.trim())) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    // Phone format validation
    if (contactPhone && !PHONE_REGEX.test(contactPhone.trim())) {
      return NextResponse.json({ error: 'Please enter a valid phone number' }, { status: 400 });
    }

    // Description length validation
    if (petDescription && petDescription.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json({ error: `Description must be under ${MAX_DESCRIPTION_LENGTH} characters` }, { status: 400 });
    }

    // Photo URLs validation
    if (photoUrls && (!Array.isArray(photoUrls) || photoUrls.length > MAX_PHOTO_URLS)) {
      return NextResponse.json({ error: `Maximum ${MAX_PHOTO_URLS} photos allowed` }, { status: 400 });
    }

    // Generate case number
    const cityCode = city.substring(0, 3).toUpperCase();
    const year = new Date().getFullYear();
    const count = await prisma.lostPetCase.count({
      where: {
        caseNumber: { startsWith: `F-${cityCode}-${year}` }
      }
    });
    const caseNumber = `F-${cityCode}-${year}-${String(count + 1).padStart(4, '0')}`;

    // Create found pet report
    const foundCase = await prisma.lostPetCase.create({
      data: {
        caseNumber,
        reportType: 'FOUND',
        status: 'OPEN',
        petSpecies: petSpecies.toUpperCase(),
        petBreed: petBreed?.trim() || null,
        petColor: petColor?.trim() || null,
        petDescription: petDescription?.trim() || null,
        city: city.trim(),
        state: state.toUpperCase(),
        zipCode: zipCode?.trim() || null,
        lastSeenLandmark: lastSeenLandmark?.trim() || null,
        lastSeenAt: foundAt ? new Date(foundAt) : new Date(),
        latitude: latitude || null,
        longitude: longitude || null,
        contactName: contactName.trim(),
        contactPhone: contactPhone?.trim() || null,
        contactEmail: contactEmail?.trim() || null,
        photoUrls: JSON.stringify((photoUrls || []).slice(0, MAX_PHOTO_URLS)),
        // SECURITY: Found reports require admin approval too
        isPublic: false,
        publicContactOk: false,
        source: 'PUBLIC_FOUND_REPORT',
      }
    });

    await logEvent({
      type: 'FOUND_PET_REPORTED',
      metadata: {
        caseNumber,
        petSpecies,
        city,
        state,
      }
    });

    // Find potential matches (limit to prevent memory issues)
    const lostCases = await prisma.lostPetCase.findMany({
      where: {
        reportType: { in: ['LOST', null] }, // null = legacy lost cases
        status: { in: ['OPEN', 'ACTIVE_SEARCH'] },
        petSpecies: petSpecies.toUpperCase(),
      },
      select: {
        id: true,
        caseNumber: true,
        petName: true,
        petSpecies: true,
        petBreed: true,
        petColor: true,
        city: true,
        state: true,
        lastSeenAt: true,
        latitude: true,
        longitude: true,
        contactEmail: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500, // Limit to recent cases for performance
    });

    const matches = findMatches(
      {
        petSpecies,
        petBreed,
        petColor,
        city,
        state,
        latitude,
        longitude,
        foundAt: foundAt || new Date().toISOString(),
      },
      lostCases,
      { minScore: 35, maxResults: 5 }
    );

    // Notify owners of potential matches
    let notifiedCount = 0;
    for (const match of matches) {
      if (match.case.contactEmail) {
        try {
          await sendFoundPetNotification({
            to: match.case.contactEmail,
            lostPetName: match.case.petName || 'Your pet',
            lostCaseNumber: match.case.caseNumber,
            foundCaseNumber: caseNumber,
            matchScore: match.score,
            foundLocation: `${city}, ${state}`,
          });
          notifiedCount++;
        } catch (err) {
          console.error('[FOUND API] Failed to send notification:', err);
        }
      }
    }

    await logEvent({
      type: 'FOUND_PET_MATCHES_CHECKED',
      metadata: {
        foundCaseNumber: caseNumber,
        matchesFound: matches.length,
        notificationsSent: notifiedCount,
      }
    });

    return NextResponse.json({
      success: true,
      caseNumber,
      matches: matches.map(m => ({
        caseNumber: m.case.caseNumber,
        petName: m.case.petName,
        score: m.score,
        quality: m.score >= 60 ? 'good' : 'possible',
      })),
      matchesNotified: notifiedCount,
    }, { status: 201 });
  } catch (error) {
    console.error('[FOUND API] Error creating found pet report:', error);
    return NextResponse.json(
      { error: 'Failed to submit found pet report' },
      { status: 500 }
    );
  }
}
