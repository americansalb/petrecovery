import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../../../lib/email';
import { getServerSession } from 'next-auth';

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

    // 3. Create pet record (finder is temporary owner until matched)
    const pet = await prisma.pet.create({
      data: {
        ownerId: user.id, // Finder is temporary owner
        name: petName || 'Unknown',
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

    const report = await prisma.lostReport.create({
      data: {
        petId: pet.id,
        reporterId: user.id,
        reportType: 'FOUND', // This is a FOUND pet report
        lastSeenAt: foundAt,
        lastSeenLatitude: center[0],
        lastSeenLongitude: center[1],
        lastSeenAddress: foundAddress,
        escapeScenario: 'found_by_community',
        searchRadius: radiusMiles,
        status: 'ACTIVE',
        priority: timeElapsed === 'less_than_hour' ? 'URGENT' : 'HIGH',
      }
    });

    // 5. Find nearby users who reported LOST pets of the same species
    const lostPetReports = await prisma.lostReport.findMany({
      where: {
        reportType: 'LOST',
        status: 'ACTIVE',
      },
      include: {
        pet: true,
        reporter: true,
      }
    });

    // Filter by species and distance
    const nearbyMatches = lostPetReports.filter(lostReport => {
      // Check species match
      if (lostReport.pet.species !== petType.toUpperCase()) return false;

      // Check distance
      const distance = calculateDistance(
        center[0], center[1],
        lostReport.lastSeenLatitude, lostReport.lastSeenLongitude
      );
      return distance <= (radiusMiles + lostReport.searchRadius);
    });

    // Create alerts for potential matches
    await Promise.all(
      nearbyMatches.map(lostReport =>
        prisma.alert.create({
          data: {
            reportId: lostReport.id,
            userId: lostReport.reporterId,
            method: 'EMAIL',
          }
        })
      )
    );

    // 6. Send email in background (don't wait for it)
    if (accountCreated && tempPassword) {
      // Send email asynchronously - don't block the response
      sendEmail({
        to: email,
        subject: 'Thank You for Reporting a Found Pet - PetRecovery.org',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">🎉 Thank You for Helping!</h2>
            <p>Hi ${firstName},</p>
            <p>Thank you for reporting a found ${petType}! Your kindness helps reunite pets with their families.</p>

            <p>We've notified <strong>${nearbyMatches.length} nearby owner${nearbyMatches.length !== 1 ? 's' : ''}</strong> who reported a lost ${petType} matching this description.</p>

            <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Your Account</h3>
              <p>We've created an account for you:</p>
              <p><strong>Email:</strong> ${email}<br/>
              <strong>Temporary Password:</strong> <code style="background: #d1fae5; padding: 2px 6px; border-radius: 3px;">${tempPassword}</code></p>
            </div>

            <p><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Login to Dashboard</a></p>

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
      matchesNotified: nearbyMatches.length,
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
