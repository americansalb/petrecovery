// /api/public/cases/route.js
// Public API for listing and submitting lost pet cases

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/app/lib/logging';
import {
  sendCaseReportConfirmation,
  sendAdminPublicReportAlert,
} from '@/app/lib/notifications';

/**
 * GET /api/public/cases
 * List public lost pet cases
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const city = searchParams.get('city');
  const state = searchParams.get('state');
  const species = searchParams.get('species');
  const status = searchParams.get('status') || 'ACTIVE';
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    const where = {
      isPublic: true,
      reportType: 'LOST',
    };

    // Status filter
    if (status && status !== 'ALL') {
      where.status = status;
    }

    // Species filter
    if (species) {
      where.petSpecies = species;
    }

    // City/state filter (search in lastSeenAddress)
    if (city || state) {
      const addressFilters = [];
      if (city) {
        addressFilters.push({ lastSeenAddress: { contains: city, mode: 'insensitive' } });
      }
      if (state) {
        addressFilters.push({ lastSeenAddress: { contains: state, mode: 'insensitive' } });
      }
      if (addressFilters.length > 0) {
        where.AND = addressFilters;
      }
    }

    const [cases, total] = await Promise.all([
      prisma.case.findMany({
        where,
        select: {
          caseNumber: true,
          petName: true,
          petSpecies: true,
          petBreed: true,
          petColor: true,
          petPhotoUrl: true,
          lastSeenAddress: true,
          lastSeenAt: true,
          status: true,
          hasReward: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.case.count({ where }),
    ]);

    logEvent('public_case.list_viewed', {
      filters: { city, state, species, status },
      resultCount: cases.length,
      total,
    });

    return NextResponse.json({ cases, total, limit, offset });
  } catch (error) {
    logEvent('public_case.list_failed', { error: error.message });
    return NextResponse.json(
      { error: 'Failed to load cases' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/public/cases
 * Submit a public lost pet report
 */
export async function POST(request) {
  logEvent('public_case.report_attempted', {});

  try {
    const body = await request.json();

    // Validate required fields
    const errors = validatePublicReport(body);
    if (Object.keys(errors).length > 0) {
      logEvent('public_case.report_failed', { error: 'validation', details: errors });
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }

    const { reporter, pet, incident, visibility, reward } = body;

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: reporter.email.toLowerCase() },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: reporter.email.toLowerCase(),
          firstName: reporter.firstName,
          lastName: reporter.lastName || null,
          phone: reporter.phone || null,
          role: 'USER',
        },
      });
    }

    // Generate case number
    const caseNumber = await generateCaseNumber(incident.lastSeenAddress);

    // Create case
    const newCase = await prisma.case.create({
      data: {
        caseNumber,
        reporterId: user.id,
        petName: pet.name,
        petSpecies: pet.species,
        petBreed: pet.breed || null,
        petColor: pet.color,
        petSize: pet.size,
        petPhotoUrl: pet.photoUrl,
        petDescription: pet.description || '',
        ownerName: `${reporter.firstName} ${reporter.lastName || ''}`.trim(),
        ownerPhone: reporter.phone || '',
        ownerEmail: reporter.email.toLowerCase(),
        lastSeenAt: new Date(incident.lastSeenAt),
        lastSeenAddress: incident.lastSeenAddress,
        lastSeenLatitude: incident.lastSeenLatitude,
        lastSeenLongitude: incident.lastSeenLongitude,
        escapeScenario: incident.escapeScenario,
        escapeDetails: incident.escapeDetails || null,
        isPublic: visibility?.isPublic ?? true,
        publicContactOk: visibility?.publicContactOk ?? true,
        publicPhoneVisible: visibility?.publicPhoneVisible ?? false,
        publicEmailVisible: visibility?.publicEmailVisible ?? false,
        hasReward: reward?.hasReward ?? false,
        rewardAmount: reward?.rewardAmount || null,
        reportType: 'LOST',
        status: 'ACTIVE',
      },
    });

    logEvent('public_case.report_submitted', {
      caseNumber: newCase.caseNumber,
      species: pet.species,
      city: extractCity(incident.lastSeenAddress),
    });

    // Prepare notification data
    const notificationData = {
      id: newCase.id,
      caseNumber: newCase.caseNumber,
      petName: newCase.petName,
      petSpecies: newCase.petSpecies,
      ownerName: newCase.ownerName,
      ownerEmail: newCase.ownerEmail,
      lastSeenAddress: newCase.lastSeenAddress,
    };

    // Fire notifications (non-blocking)
    sendCaseReportConfirmation(notificationData).catch((err) => {
      console.error('Failed to send confirmation:', err);
    });

    sendAdminPublicReportAlert(notificationData).catch((err) => {
      console.error('Failed to send admin alert:', err);
    });

    return NextResponse.json(
      {
        success: true,
        caseNumber: newCase.caseNumber,
        message: 'Your lost pet report has been submitted. Check your email for confirmation.',
      },
      { status: 201 }
    );
  } catch (error) {
    logEvent('public_case.report_failed', { error: error.message });
    console.error('Public case submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit report' },
      { status: 500 }
    );
  }
}

/**
 * Validate public report submission
 */
function validatePublicReport(body) {
  const errors = {};

  // Reporter validation
  if (!body.reporter?.email) {
    errors['reporter.email'] = 'Email is required';
  } else if (!isValidEmail(body.reporter.email)) {
    errors['reporter.email'] = 'Valid email is required';
  }
  if (!body.reporter?.firstName) {
    errors['reporter.firstName'] = 'First name is required';
  }

  // Pet validation
  if (!body.pet?.name) {
    errors['pet.name'] = 'Pet name is required';
  }
  if (!body.pet?.species) {
    errors['pet.species'] = 'Species is required';
  } else if (!['DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER'].includes(body.pet.species)) {
    errors['pet.species'] = 'Invalid species';
  }
  if (!body.pet?.color) {
    errors['pet.color'] = 'Color is required';
  }
  if (!body.pet?.size) {
    errors['pet.size'] = 'Size is required';
  } else if (!['TINY', 'SMALL', 'MEDIUM', 'LARGE', 'GIANT'].includes(body.pet.size)) {
    errors['pet.size'] = 'Invalid size';
  }
  if (!body.pet?.photoUrl) {
    errors['pet.photoUrl'] = 'Photo is required';
  }

  // Incident validation
  if (!body.incident?.lastSeenAt) {
    errors['incident.lastSeenAt'] = 'Date/time last seen is required';
  }
  if (!body.incident?.lastSeenAddress) {
    errors['incident.lastSeenAddress'] = 'Address is required';
  }
  if (body.incident?.lastSeenLatitude === undefined || body.incident?.lastSeenLatitude === null) {
    errors['incident.lastSeenLatitude'] = 'Location coordinates required';
  }
  if (body.incident?.lastSeenLongitude === undefined || body.incident?.lastSeenLongitude === null) {
    errors['incident.lastSeenLongitude'] = 'Location coordinates required';
  }
  if (!body.incident?.escapeScenario) {
    errors['incident.escapeScenario'] = 'How pet got out is required';
  }

  return errors;
}

/**
 * Simple email validation
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Extract city from address string
 */
function extractCity(address) {
  if (!address) return null;
  const match = address.match(/,\s*([A-Za-z\s]+),?\s*[A-Z]{2}/);
  return match ? match[1].trim() : null;
}

/**
 * Generate unique case number
 */
async function generateCaseNumber(address) {
  // Extract city code from address (first 3 letters of city)
  const cityMatch = address?.match(/,\s*([A-Za-z\s]+),?\s*[A-Z]{2}/);
  const city = cityMatch ? cityMatch[1].trim() : 'UNK';
  const cityCode = city.substring(0, 3).toUpperCase();

  const year = new Date().getFullYear();

  // Count existing cases with this prefix
  const count = await prisma.case.count({
    where: {
      caseNumber: { startsWith: `${cityCode}-${year}` },
    },
  });

  return `${cityCode}-${year}-${String(count + 1).padStart(6, '0')}`;
}
