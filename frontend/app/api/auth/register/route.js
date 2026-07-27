import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import bcrypt from 'bcryptjs';
import { withRateLimitAsync, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import { validateMedicationInput } from '@/app/lib/medicationValidation';
import { logEvent } from '@/lib/logging';
import { sendVerificationEmail } from '@/app/lib/email';
import crypto from 'crypto';
import { getEmailBaseUrl } from '@/app/lib/config';
import { TERMS_OF_SERVICE_DOC } from '@/prisma/legal/terms-of-service';

const BASE_URL = getEmailBaseUrl();

// Email validation regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation regex (US format, flexible)
const PHONE_REGEX = /^[\d\s\-\(\)\+\.]{7,20}$/;

// Password requirements
const PASSWORD_MIN_LENGTH = 8;

/**
 * The guest-first Health Book wizard (/care/start) sends the pet the
 * visitor already built so registration and "save my pet" are one
 * atomic step. Returns { data } or { error }; mirrors /api/pets rules.
 */
function validatePetDraft(pet) {
  if (typeof pet !== 'object' || pet === null) return { error: 'Invalid pet payload' };
  const name = (pet.name || '').trim();
  if (!name || name.length > 50) return { error: 'Pet name is required' };
  if (!['DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER'].includes(pet.species)) return { error: 'Invalid species' };
  const color = (pet.color || '').trim();
  if (!color || color.length > 60) return { error: 'Pet color is required' };
  if (!['TINY', 'SMALL', 'MEDIUM', 'LARGE', 'GIANT'].includes(pet.size)) return { error: 'Invalid size' };
  const age = pet.age == null || pet.age === '' ? null : Number(pet.age);
  if (age !== null && (!Number.isFinite(age) || age < 0 || age > 40)) return { error: 'Invalid age' };

  const meds = Array.isArray(pet.medications) ? pet.medications : [];
  if (meds.length > 10) return { error: 'Too many medications (max 10 during signup)' };
  const medications = [];
  for (const med of meds) {
    const { data, error } = validateMedicationInput({
      kind: 'MEDICATION',
      name: med?.name,
      scheduleType: 'DAILY',
      timesOfDay: Array.isArray(med?.timesOfDay) ? med.timesOfDay : [],
    });
    if (error) return { error: `Medication "${med?.name || ''}": ${error}` };
    medications.push(data);
  }

  return {
    data: {
      name,
      species: pet.species,
      breed: (pet.breed || '').trim().slice(0, 60) || null,
      age: age === null ? null : Math.round(age),
      color,
      size: pet.size,
      medications,
    },
  };
}

const SHELTER_TYPES = ['SHELTER', 'RESCUE', 'FOSTER_NETWORK'];
const SHELTER_ROLES = ['DIRECTOR', 'MANAGER', 'STAFF', 'VOLUNTEER', 'BOARD', 'OTHER'];

/**
 * The shelter onboarding wizard (/shelter/start) sends the application
 * the visitor already built so registration and "apply for a shelter
 * account" are one atomic step, exactly like the pet ride-along above.
 * Returns { data } or { error }.
 */
function validateShelterRequest(sr) {
  if (typeof sr !== 'object' || sr === null) return { error: 'Invalid shelter payload' };
  const name = (sr.shelterName || '').trim();
  if (!name || name.length > 120) return { error: 'Shelter name is required' };
  const city = (sr.city || '').trim();
  const state = (sr.state || '').trim().toUpperCase();
  if (!city || city.length > 80) return { error: 'City is required' };
  if (!/^[A-Z]{2}$/.test(state)) return { error: 'State is required' };
  const type = SHELTER_TYPES.includes(sr.shelterType) ? sr.shelterType : 'SHELTER';
  const role = SHELTER_ROLES.includes(sr.role) ? sr.role : 'OTHER';
  const lat = parseFloat(sr.latitude);
  const lng = parseFloat(sr.longitude);
  const existingShelterId =
    typeof sr.existingShelterId === 'string' && sr.existingShelterId.trim()
      ? sr.existingShelterId.trim()
      : null;
  return {
    data: {
      shelterName: name,
      city,
      state,
      shelterType: type,
      role,
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
      existingShelterId,
    },
  };
}

/**
 * Find-or-create the shelter and file the PENDING claim inside the
 * signup transaction. Shared shape with POST /api/shelter/request.
 */
async function createShelterClaimInTx(tx, userId, sr) {
  let shelter = null;
  if (sr.existingShelterId) {
    shelter = await tx.shelter.findUnique({ where: { id: sr.existingShelterId } });
    if (!shelter) throw Object.assign(new Error('That shelter no longer exists'), { status: 400 });
    const profile = await tx.shelterProfile.findUnique({ where: { shelterId: shelter.id } });
    if (profile?.claimedById) {
      throw Object.assign(
        new Error('That shelter is already managed on ReunitePets. Contact support@reunitepets.org if that seems wrong.'),
        { status: 409 }
      );
    }
  } else {
    shelter = await tx.shelter.findFirst({
      where: {
        name: { equals: sr.shelterName, mode: 'insensitive' },
        city: { equals: sr.city, mode: 'insensitive' },
        state: { equals: sr.state, mode: 'insensitive' },
      },
    });
  }
  if (!shelter) {
    shelter = await tx.shelter.create({
      data: {
        name: sr.shelterName,
        type: sr.shelterType,
        address: '',
        city: sr.city,
        state: sr.state,
        zipCode: '',
        latitude: sr.latitude,
        longitude: sr.longitude,
        source: 'SHELTER_REQUEST',
        isActive: false, // activated on approval
        isVerified: false,
      },
    });
  }
  await tx.shelterClaim.create({
    data: {
      shelterId: shelter.id,
      claimantId: userId,
      verificationMethod: 'ADMIN_REVIEW',
      verificationData: JSON.stringify({
        role: sr.role,
        via: 'shelter_start_wizard',
        requestedAt: new Date().toISOString(),
      }),
      status: 'PENDING',
    },
  });
  return shelter;
}

export async function POST(request) {
  const correlationId = crypto.randomUUID();

  // Apply rate limiting (strict for auth endpoints)
  const rateLimitResult = await withRateLimitAsync(request, RateLimitPresets.AUTH, 'auth:register');
  if (!rateLimitResult.success) {
    // Log without blocking response
    logEvent({
      event_type: 'auth.register_rate_limited',
      correlation_id: correlationId,
      resource_type: 'user',
      action: 'create',
      result: 'failure',
      error_code: 'RATE_LIMITED',
      error_message: 'Rate limit exceeded',
      metadata: { blocked: rateLimitResult.blocked }
    }).catch(() => {});
    return rateLimitResponse(rateLimitResult);
  }

  try {
    const { email, password, firstName, phone, acceptedTerms, pet, shelterRequest } = await request.json();

    // Validate any pet draft BEFORE creating the user, so a bad draft
    // can't produce an account with a half-saved Health Book.
    let petDraft = null;
    if (pet !== undefined && pet !== null) {
      const { data, error } = validatePetDraft(pet);
      if (error) {
        return NextResponse.json({ error }, { status: 400 });
      }
      petDraft = data;
    }

    // Same rule for a shelter application riding along from /shelter/start.
    let shelterDraft = null;
    if (shelterRequest !== undefined && shelterRequest !== null) {
      const { data, error } = validateShelterRequest(shelterRequest);
      if (error) {
        return NextResponse.json({ error }, { status: 400 });
      }
      shelterDraft = data;
    }

    // Validate required fields
    if (!email || !password || !firstName) {
      return NextResponse.json(
        { error: 'Email, password, and first name are required' },
        { status: 400 }
      );
    }

    // Normalize email (lowercase, trim)
    const normalizedEmail = email.toLowerCase().trim();

    // Validate email format
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < PASSWORD_MIN_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` },
        { status: 400 }
      );
    }

    // Validate firstName (basic XSS prevention)
    const sanitizedFirstName = firstName.trim().substring(0, 100);
    if (sanitizedFirstName.length < 1) {
      return NextResponse.json(
        { error: 'First name is required' },
        { status: 400 }
      );
    }

    // Validate phone if provided
    let sanitizedPhone = null;
    if (phone) {
      const trimmedPhone = phone.trim();
      if (trimmedPhone && !PHONE_REGEX.test(trimmedPhone)) {
        return NextResponse.json(
          { error: 'Please enter a valid phone number' },
          { status: 400 }
        );
      }
      sanitizedPhone = trimmedPhone || null;
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      // SECURITY: Return generic message to prevent email enumeration
      // Log without blocking response
      logEvent({
        event_type: 'auth.register_failed',
        correlation_id: correlationId,
        resource_type: 'user',
        action: 'create',
        result: 'failure',
        error_code: 'EMAIL_EXISTS',
        error_message: 'Email already registered',
        metadata: { email_prefix: normalizedEmail.substring(0, 3) }
      }).catch(() => {});

      return NextResponse.json(
        { error: 'Unable to create account. Please try again or use a different email.' },
        { status: 400 }
      );
    }

    // Hash password with strong salt rounds
    const passwordHash = await bcrypt.hash(password, 12);

    // The signup checkbox names BOTH documents, but historically only the
    // waiver was recorded. Record Terms acceptance too, pinned to the
    // versions actually live right now (falls back to the shipped Terms
    // version on a fresh database that hasn't synced legal docs yet).
    let tosVersion = TERMS_OF_SERVICE_DOC.version;
    let waiverVersion = '1.0';
    if (acceptedTerms) {
      const [tosDoc, waiverDoc] = await Promise.all([
        prisma.legalDocument?.findFirst({ where: { type: 'TERMS_OF_SERVICE', isActive: true }, select: { version: true } }),
        prisma.legalDocument?.findFirst({ where: { type: 'LIABILITY_WAIVER', isActive: true }, select: { version: true } }),
      ]).catch(() => [null, null]);
      if (tosDoc?.version) tosVersion = tosDoc.version;
      if (waiverDoc?.version) waiverVersion = waiverDoc.version;
    }

    // Generate email verification token (hash before storing, send raw in email)
    const rawVerifyToken = crypto.randomBytes(32).toString('hex');
    const emailVerifyToken = crypto.createHash('sha256').update(rawVerifyToken).digest('hex');
    const emailVerifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user - plus their Health Book pet when one rode along with
    // signup (/care/start) - in one transaction, so "register to save
    // your pet" can never half-succeed.
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          firstName: sanitizedFirstName,
          phone: sanitizedPhone,
          role: 'USER',
          emailVerified: null, // Requires email verification
          emailVerifyToken,
          emailVerifyExpiry,
          // Record BOTH acceptances the signup checkbox names
          ...(acceptedTerms && {
            waiverAcceptedAt: new Date(),
            waiverVersionAccepted: waiverVersion,
            tosAcceptedAt: new Date(),
            tosVersionAccepted: tosVersion,
          }),
        },
      });

      if (petDraft) {
        const { medications, ...petFields } = petDraft;
        const createdPet = await tx.pet.create({
          data: {
            ownerId: created.id,
            ...petFields,
            personality: JSON.stringify([]),
            photos: JSON.stringify([]),
            primaryPhotoUrl: '',
          },
        });
        for (const med of medications) {
          await tx.petMedication.create({ data: { petId: createdPet.id, ...med } });
        }
      }

      if (shelterDraft) {
        await createShelterClaimInTx(tx, created.id, shelterDraft);
      }

      return created;
    });

    // Send verification email (non-blocking)
    const verifyUrl = `${BASE_URL}/verify-email?token=${rawVerifyToken}`;
    sendVerificationEmail(normalizedEmail, sanitizedFirstName, verifyUrl).catch((err) => {
      console.error('Failed to send verification email:', err);
    });

    // Log success without blocking response
    logEvent({
      event_type: 'auth.register_succeeded',
      correlation_id: correlationId,
      resource_type: 'user',
      resource_id: user.id,
      action: 'create',
      result: 'success',
      metadata: { email_prefix: normalizedEmail.substring(0, 3) }
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Account created! Please check your email to verify your account.',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
      }
    });

  } catch (error) {
    console.error('Registration error:', error);

    // Log error without blocking response
    logEvent({
      event_type: 'auth.register_failed',
      correlation_id: correlationId,
      resource_type: 'user',
      action: 'create',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message || 'Unknown error'
    }).catch(() => {});

    // Shelter ride-along rejections (e.g. already-managed shelter) carry
    // their own status and safe message; the whole transaction rolled
    // back, so no half-created account exists.
    if (error?.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: 'Unable to create account. Please try again.' },
      { status: 500 }
    );
  }
}
