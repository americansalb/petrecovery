import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { sendEmail } from '../../../lib/email';
import { getServerSession } from 'next-auth';
import { findMatches, getMatchQuality } from '@/app/lib/matching';
import { getEmailBaseUrl } from '@/app/lib/config';
import { createUser } from '@/app/lib/userService';

export async function POST(request) {
  try {
    const session = await getServerSession();
    const body = await request.json();
    let {
      email, phone, firstName,
      petName, breed, color, size, distinctiveMarks,
      foundAddress, center, radiusMiles, timeElapsed, petType,
      photos
    } = body;

    // If user is logged in, use their session data
    if (session?.user) {
      email = session.user.email;
      firstName = session.user.name || firstName;
      // Phone will be fetched from their profile if they have one
    }

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

    // 2. Create account if doesn't exist. Routed through userService so this
    // path uses the same bcrypt cost (12), audit logging, and verification
    // email as `/api/auth/register`. The user receives a verification email
    // and must click the link before they can log in.
    if (!user) {
      const result = await createUser({
        source: 'foundPet',
        email,
        phone,
        firstName,
      });
      user = result.user;
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
        primaryPhotoUrl: photos && photos.length > 0 ? photos[0] : '',
        photos: JSON.stringify(photos || []),
        personality: "[]",
      }
    });

    // 4. Create found report
    const foundAt = calculateFoundTime(timeElapsed);
    const caseNumber = `FOUND-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const report = await prisma.case.create({
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
    });

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
      minScore: 30, // Show all reasonable matches
      maxResults: 20,
    });

    // Format matches for response
    const formattedMatches = matches.map(match => {
      const quality = getMatchQuality(match.score);
      const c = match.case;

      return {
        reportId: c.id,
        petName: c.pet?.name || c.petName || 'Unknown',
        petSpecies: c.petSpecies,
        petBreed: c.petBreed,
        petColor: c.petColor,
        petPhoto: c.pet?.primaryPhotoUrl || c.petPhotoUrl,
        ownerName: c.reporter?.firstName || c.ownerName,
        lastSeenAddress: c.lastSeenAddress,
        lastSeenAt: c.lastSeenAt,
        matchScore: match.score,
        matchQuality: quality,
        distance: match.details?.distance,
      };
    });

    // Filter to high-quality matches for notifications
    const nearbyMatches = matches.filter(m => m.score >= 50).map(m => m.case);

    // Create alerts for potential matches
    if (nearbyMatches.length > 0) {
      await Promise.all(
        nearbyMatches.map(match =>
          prisma.alert.create({
            data: {
              missionId: match.id,
              userId: match.reporterId,
              method: 'EMAIL',
            }
          })
        )
      );
    }

    // 6. Send a thank-you email in the background. The verification email
    // (with the link to activate the account) is sent separately by
    // userService — we don't include credentials here so this email is safe
    // to forward, save, or auto-archive.
    if (accountCreated) {
      sendEmail({
        to: email,
        subject: 'Thank You for Reporting a Found Pet - PetRecovery.org',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">Thank You for Helping!</h2>
            <p>Hi ${firstName},</p>
            <p>Thank you for reporting a found ${petType}. Your kindness helps reunite pets with their families.</p>

            <p>We've notified <strong>${nearbyMatches.length} nearby owner${nearbyMatches.length !== 1 ? 's' : ''}</strong> who reported a lost ${petType} matching this description.</p>

            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Verify your email</h3>
              <p>We've created an account for you so you can stay updated on this case. Please check your inbox for a verification email and click the link inside to activate your account.</p>
              <p style="margin: 0;"><small>Didn't get it? You can request a new verification email any time from the login page.</small></p>
            </div>

            <div style="background: #dbeafe; border-left: 4px solid #0ea5e9; padding: 15px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #0c4a6e;">Welcome to the Patrol</h3>
              <p>Once verified, you'll be able to:</p>
              <ul style="margin: 10px 0;">
                <li>View all lost &amp; found pets in your area</li>
                <li>Access the searchable pet database</li>
                <li>Receive alerts about missing pets nearby</li>
                <li>Help reunite more pets with their families</li>
              </ul>
            </div>

            <p><small style="color: #6b7280;">Please keep the pet safe until the owner contacts you. If no one claims the pet, consider local animal shelters or rescue organizations.</small></p>
          </div>
        `,
      }).catch((err) => console.error('Email send failed:', err));
    }

    // Return immediately without waiting for email
    return NextResponse.json({
      success: true,
      reportId: report.id,
      accountCreated,
      matchesNotified: nearbyMatches.length,
      potentialMatches: formattedMatches, // Include detailed matches for display
    });

  } catch (error) {
    console.error('❌ Found pet report creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create report', details: error.message },
      { status: 500 }
    );
  }
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

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
