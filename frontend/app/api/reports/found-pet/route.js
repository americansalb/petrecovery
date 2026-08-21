import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../../../lib/email';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { findMatches } from '@/app/lib/matching';
import { getEmailBaseUrl } from '@/app/lib/config';
import { createInAppNotification } from '@/app/lib/notifications-inapp';
import { withCaseNumberRetry } from '@/app/lib/caseNumber';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    let {
      email, phone, firstName,
      petName, breed, color, size, distinctiveMarks, microchipId,
      foundAddress, center, radiusMiles, timeElapsed, petType,
      photos
    } = body;

    // If user is logged in, use their session data
    if (session?.user) {
      email = session.user.email;
      firstName = session.user.name || firstName;
      // Phone will be fetched from their profile if they have one
    }

    // Normalize email like /api/auth/register does - a mixed-case email here
    // would create an account that credentials login (which lowercases) can
    // never find, and a duplicate once the user registers properly.
    email = email?.toLowerCase().trim() || null;

    // Validate required fields (phone not required for logged-in users)
    if (!email || !firstName || !color || !foundAddress || !center) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 1. Check if user exists by email
    let user = await prisma.user.findUnique({
      where: { email }
    });

    // If user exists and phone wasn't provided, try to get it from their record
    if (user && !phone) {
      phone = user.phone;
    }

    // Check phone uniqueness only if phone is provided and user doesn't exist yet
    if (!user && phone) {
      const phoneExists = await prisma.user.findFirst({
        where: { phone }
      });
      // If phone exists with different email, suggest they login
      if (phoneExists && phoneExists.email !== email) {
        return NextResponse.json(
          {
            error: 'Phone number already registered with a different email. Please login or use the email associated with this phone number.',
            existingEmail: phoneExists.email.substring(0, 3) + '***@' + phoneExists.email.split('@')[1]
          },
          { status: 400 }
        );
      }
    }

    let accountCreated = false;
    let tempPassword = null;

    // 2. Create account if doesn't exist
    if (!user) {
      tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      user = await prisma.user.create({
        data: {
          email,
          phone,
          firstName,
          passwordHash,
          role: 'USER',
        }
      });

      accountCreated = true;
    }

    // Auto-create patrol profile for found pet reporters (their entry point to the community)
    const existingPatrolProfile = await prisma.patrolProfile.findUnique({
      where: { userId: user.id }
    });

    if (!existingPatrolProfile) {
      // Create user profile with location from where they found the pet
      const existingProfile = await prisma.userProfile.findUnique({
        where: { userId: user.id }
      });

      if (!existingProfile) {
        await prisma.userProfile.create({
          data: {
            userId: user.id,
            latitude: center[0],
            longitude: center[1],
            address: foundAddress,
            // Extract city/state/zip from address if possible (simple approach)
            city: foundAddress.split(',')[0]?.trim() || '',
          }
        });
      }

      // Create patrol profile with 10 mile radius (default for found pet reporters)
      await prisma.patrolProfile.create({
        data: {
          userId: user.id,
          radiusMiles: 10,
          alertMethod: 'EMAIL',
          instantAlerts: true,
          isActive: true,
        }
      });
    }

    // 3. Create pet record (finder is temporary owner until matched)
    // Generate smart fallback name if pet name is unknown
    let displayName = petName;
    if (!displayName || displayName.trim() === '' || displayName.toLowerCase() === 'unknown') {
      // Build name from breed/color/size
      const parts = [];
      if (color) parts.push(color);
      if (size) parts.push(size);
      if (breed) parts.push(breed);
      if (petType) parts.push(petType.charAt(0).toUpperCase() + petType.slice(1).toLowerCase());

      displayName = parts.length > 0 ? parts.join(' ') : 'Unknown Pet';
    }

    const pet = await prisma.pet.create({
      data: {
        ownerId: user.id, // Finder is temporary owner
        name: displayName,
        species: petType.toUpperCase(),
        breed: breed || '',
        color,
        size,
        distinctiveMarks: distinctiveMarks || '',
        microchipId: microchipId?.trim() || null,
        primaryPhotoUrl: photos && photos.length > 0 ? photos[0] : '',
        photos: JSON.stringify(photos || []),
        personality: "[]",
      }
    });

    // 4. Create found report
    const foundAt = calculateFoundTime(timeElapsed);
    // Retried on collision, like the lost-pet intake. The suffix is random,
    // so a clash is unlikely rather than impossible, and a 500 here loses
    // a found animal someone is standing next to.
    const report = await withCaseNumberRetry((caseNumber) => prisma.case.create({
      data: {
        caseNumber,
        petId: pet.id,
        reporterId: user.id,
        reportType: 'FOUND',
        petName: displayName,
        petSpecies: petType.toUpperCase(),
        petBreed: breed || 'Unknown',
        petColor: color,
        petSize: size || 'MEDIUM',
        petPhotoUrl: photos && photos.length > 0 ? photos[0] : '',
        petDescription: distinctiveMarks || `Found ${color} ${petType}`,
        ownerName: firstName,
        ownerPhone: phone || 'Not provided',
        ownerEmail: email,
        lastSeenAt: foundAt,
        lastSeenLatitude: center[0],
        lastSeenLongitude: center[1],
        lastSeenAddress: foundAddress,
        searchRadius: radiusMiles || 5,
        escapeScenario: 'found_by_community',
        status: 'ACTIVE',
        priority: timeElapsed === 'less_than_hour' ? 'URGENT' : 'HIGH',
      }
    }), { kind: 'FOUND' });

    // 5. Find potential matches - look for LOST pets that match this FOUND pet
    const lostPetCases = await prisma.case.findMany({
      where: {
        reportType: 'LOST',
        status: 'ACTIVE',
        petSpecies: petType.toUpperCase(),
      },
      include: {
        pet: true,
        reporter: true,
      }
    });

    // Use the matching algorithm to find and score potential matches
    const foundData = {
      petSpecies: petType.toUpperCase(),
      petBreed: breed || '',
      petColor: color,
      latitude: center[0],
      longitude: center[1],
      city: foundAddress.split(',')[0]?.trim() || '',
      state: foundAddress.split(',')[1]?.trim()?.substring(0, 2) || '',
      lastSeenAt: foundAt,
      createdAt: new Date(),
    };

    // Transform lost cases into format expected by matching algorithm
    const candidates = lostPetCases.map(c => ({
      id: c.id,
      missionNumber: c.caseNumber,
      caseNumber: c.caseNumber,        // self-documenting; used for the owner's match link
      petName: c.petName,
      petPhotoUrl: c.petPhotoUrl,
      lastSeenAddress: c.lastSeenAddress, // so coarseArea() yields the real region, not "Nearby area"
      petSpecies: c.petSpecies,
      petBreed: c.petBreed || '',
      petColor: c.petColor,
      city: c.lastSeenAddress?.split(',')[0]?.trim() || '',
      state: c.lastSeenAddress?.split(',')[1]?.trim()?.substring(0, 2) || '',
      latitude: c.lastSeenLatitude,
      longitude: c.lastSeenLongitude,
      lastSeenAt: c.lastSeenAt,
      createdAt: c.createdAt,
      // Include extra data for notification
      pet: c.pet,
      reporter: c.reporter,
      reporterId: c.reporterId,
    }));

    // Run matching algorithm
    const matches = findMatches(foundData, candidates, {
      minScore: 30,
      maxResults: 20,
    });

    // Format matches for response - §4d no-PII shape (this payload can reach an
    // unauthenticated finder). NO owner name, exact address, or raw coords; only
    // pet fields + coarseArea + the calibrated band/confidence. Drop 'suppress'.
    const formattedMatches = matches
      .filter(match => match.band !== 'suppress')
      .map(match => {
        const c = match.case;
        return {
          reportId: c.id,
          petName: c.pet?.name || c.petName || 'Unknown',
          petSpecies: c.petSpecies,
          petBreed: c.petBreed,
          petColor: c.petColor,
          petPhoto: c.pet?.primaryPhotoUrl || c.petPhotoUrl,
          coarseArea: coarseArea(c.lastSeenAddress, match.details?.distance),
          pTrueMatch: match.pTrueMatch,
          matchSource: match.matchSource,
          band: match.band,
          canConnect: match.band === 'actionable',
        };
      });

    // CRUELTY GATE (CORR-3): only notify the owner for 'actionable'-band matches
    // (pTrueMatch >= PUSH_FLOOR), NOT every shown match. Previously we showed
    // matches down to score 30 but the UI claimed "owners notified" for all of
    // them while only score>=50 actually got an alert - false hope on the worst
    // day. The notify set must equal what we claim to have notified.
    // CORE LOOP (CRIT-A/B): actually DELIVER to the owner (in-app + email),
    // not just write a dead Alert row, and use the correct Alert.caseId (the
    // prior missionId field doesn't exist → it 500'd the whole report on the
    // exact high-confidence match that matters). Each recipient is isolated so
    // one failure can't fail the report save or truncate the rest; notifiedCount
    // counts only owners actually notified (honest copy).
    const actionableMatches = matches.filter(m => m.band === 'actionable').map(m => m.case);
    let notifiedCount = 0;

    await Promise.all(actionableMatches.map(async (match) => {
      try {
        const ownerPetName = match.pet?.name || 'your pet';

        await createInAppNotification({
          userId: match.reporterId,
          type: 'FOUND_MATCH',
          title: `Possible match for ${ownerPetName}`,
          message: `Someone just reported a found ${petType} that may match your lost pet. Tap to review and connect.`,
          actionUrl: match.caseNumber ? `/cases/${match.caseNumber}` : null,
          data: { foundCaseId: report.id },
        });

        if (match.reporter?.email) {
          await sendEmail({
            to: match.reporter.email,
            subject: `Possible match for your lost ${petType} - ReunitePets.org`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #10b981;">A possible match for ${ownerPetName}</h2>
                <p>Good news - someone in your area just reported a found ${petType} that may match your lost pet.</p>
                <p><a href="${getEmailBaseUrl()}${match.caseNumber ? `/cases/${match.caseNumber}` : '/dashboard'}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">Review the match</a></p>
                <p><small style="color:#6b7280;">ReunitePets never asks for payment to reconnect you with your pet. Review the match safely through the site.</small></p>
              </div>
            `,
          });
        }

        await prisma.alert.create({
          data: {
            caseId: match.id,
            userId: match.reporterId,
            method: 'EMAIL',
            deliveredAt: new Date(),
          },
        });

        notifiedCount++;
      } catch (err) {
        console.error('Owner match-notify failed for case', match.id, err?.message);
        // Isolated - never fail the report save or block other recipients.
      }
    }));

    // 6. Send email in background (don't wait for it)
    if (accountCreated && tempPassword) {
      // Send email asynchronously - don't block the response
      sendEmail({
        to: email,
        subject: 'Thank You for Reporting a Found Pet - ReunitePets.org',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">🎉 Thank You for Helping!</h2>
            <p>Hi ${firstName},</p>
            <p>Thank you for reporting a found ${petType}! Your kindness helps reunite pets with their families.</p>

            <p>We've notified <strong>${notifiedCount} nearby owner${notifiedCount !== 1 ? 's' : ''}</strong> who reported a lost ${petType} matching this description.</p>

            <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Your Account</h3>
              <p>We've created an account for you:</p>
              <p><strong>Email:</strong> ${email}<br/>
              <strong>Temporary Password:</strong> <code style="background: #d1fae5; padding: 2px 6px; border-radius: 3px;">${tempPassword}</code></p>
            </div>

            <div style="background: #dbeafe; border-left: 4px solid #0ea5e9; padding: 15px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #0c4a6e;">🦸 Welcome to the Patrol!</h3>
              <p>You've been automatically added to our community patrol. You can now:</p>
              <ul style="margin: 10px 0;">
                <li>View all lost & found pets in your area</li>
                <li>Access the searchable pet database</li>
                <li>Receive alerts about missing pets nearby</li>
                <li>Help reunite more pets with their families</li>
              </ul>
            </div>

            <p><a href="${getEmailBaseUrl()}/login" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Login to Dashboard</a></p>

            <p><small style="color: #6b7280;">Please keep the pet safe until the owner contacts you. If no one claims the pet, consider local animal shelters or rescue organizations.</small></p>
          </div>
        `
      }).catch(err => console.error('Email send failed:', err));
    }

    // Return immediately without waiting for email
    return NextResponse.json({
      success: true,
      reportId: report.id,
      accountCreated,
      matchesNotified: notifiedCount,
      potentialMatches: formattedMatches, // §4d no-PII shape
    });

  } catch (error) {
    console.error('❌ Found pet report creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create report' },
      { status: 500 }
    );
  }
}

/**
 * Privacy-preserving coarse area for a match (mirrors reports/[id]): drop the
 * street-level address segment and bucket distance so an unauthenticated finder
 * never sees the exact missing location.
 */
function coarseArea(address, distanceMiles) {
  let region = 'Nearby area';
  if (typeof address === 'string' && address.includes(',')) {
    const rest = address.split(',').slice(1).join(',').trim();
    if (rest) region = rest;
  }
  let proximity = '';
  if (typeof distanceMiles === 'number' && Number.isFinite(distanceMiles)) {
    const bucket =
      distanceMiles <= 1 ? '~1 mi' :
      distanceMiles <= 3 ? '~3 mi' :
      distanceMiles <= 6 ? '~6 mi' : '~10+ mi';
    proximity = ` · within ${bucket}`;
  }
  return `${region}${proximity}`;
}

function calculateFoundTime(timeElapsed) {
  const now = new Date();
  const hours = {
    'less_than_hour': 0.5,
    '1_to_6_hours': 3,
    '6_to_24_hours': 12,
    '1_to_3_days': 48,
    '3_to_7_days': 120,
    '1_to_2_weeks': 240,
    'more_than_2_weeks': 360,
  };
  const hoursAgo = hours[timeElapsed] || 12;
  return new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
}
