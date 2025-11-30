import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../../../lib/email';
import { getServerSession } from 'next-auth';
import { logEvent } from '@/lib/logging';
import crypto from 'crypto';

export async function POST(request) {
  const correlationId = crypto.randomUUID();

  try {
    const session = await getServerSession();
    const body = await request.json();
    let {
      email, phone, firstName,
      petName, breed, color, size, distinctiveMarks,
      lastSeenAddress, center, radiusMiles, timeElapsed, petType,
      photos, locationType, cityName
    } = body;

    // Default locationType to 'address' for backwards compatibility
    locationType = locationType || 'address';

    // If user is logged in, use their session data
    if (session?.user) {
      email = session.user.email;
      firstName = session.user.name || firstName;
    }

    // Validate required fields
    if (!email || !firstName || !petName || !color || !lastSeenAddress || !center) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if user exists by email
    let existingUser = await prisma.user.findUnique({
      where: { email }
    });

    // If user exists and phone wasn't provided, try to get it from their record
    if (existingUser && !phone) {
      phone = existingUser.phone;
    }

    // Check phone uniqueness only if phone is provided and user doesn't exist yet
    if (!existingUser && phone) {
      const phoneExists = await prisma.user.findFirst({
        where: { phone }
      });
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

    // Use transaction to ensure all related records are created atomically
    const result = await prisma.$transaction(async (tx) => {
      let user = existingUser;

      // Create account if doesn't exist
      if (!user) {
        tempPassword = crypto.randomBytes(12).toString('base64');
        const passwordHash = await bcrypt.hash(tempPassword, 12);

        user = await tx.user.create({
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

      // Create pet record
      const pet = await tx.pet.create({
        data: {
          ownerId: user.id,
          name: petName,
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

      // Create case
      const lastSeenAt = calculateLastSeenTime(timeElapsed);
      const caseNumber = `CASE-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      const report = await tx.case.create({
        data: {
          caseNumber,
          petId: pet.id,
          reporterId: user.id,
          reportType: 'LOST',
          petName,
          petSpecies: petType.toUpperCase(),
          petBreed: breed || 'Unknown',
          petColor: color,
          petSize: size,
          petPhotoUrl: photos && photos.length > 0 ? photos[0] : '',
          petDescription: distinctiveMarks || `${size} ${color} ${petType}${breed ? ` - ${breed}` : ''}`,
          ownerName: firstName,
          ownerPhone: phone || 'Not provided',
          ownerEmail: email,
          lastSeenAt,
          lastSeenLatitude: center[0],
          lastSeenLongitude: center[1],
          lastSeenAddress,
          searchRadius: radiusMiles,
          escapeScenario: 'unknown',
          status: 'ACTIVE',
          priority: timeElapsed === 'less_than_hour' ? 'URGENT' : 'NORMAL',
        }
      });

      return { user, pet, report };
    });

    const { user, report } = result;

    // Find nearby patrol members (outside transaction as it's read-only)
    const patrolMembers = await prisma.user.findMany({
      where: {
        patrolProfile: {
          isActive: true,
          isPaused: false,
        }
      },
      include: {
        profile: true,
        patrolProfile: true,
      }
    });

    // Filter by distance and create alerts
    const nearbyPatrol = patrolMembers.filter(member => {
      if (!member.profile?.latitude || !member.profile?.longitude) return false;
      const distance = calculateDistance(
        center[0], center[1],
        member.profile.latitude, member.profile.longitude
      );
      return distance <= member.patrolProfile.radiusMiles;
    });

    // Create alerts for nearby patrol members
    if (nearbyPatrol.length > 0) {
      await prisma.alert.createMany({
        data: nearbyPatrol.map(member => ({
          caseId: report.id,
          userId: member.id,
          method: member.patrolProfile.alertMethod,
        }))
      });
    }

    // Find and assign to rescue squads based on location type
    // - Exact address/pin: Notify squads within 2 miles
    // - Zip code: Notify squads in that town and neighboring towns within 2 miles of center
    let assignedSquad = null;
    let assignedSquads = [];
    const NOTIFICATION_RADIUS = 2; // 2 miles for all notification types

    try {
      const squads = await prisma.rescueSquad.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          city: true,
          centerLatitude: true,
          centerLongitude: true,
          radiusMiles: true,
        },
      });

      // Calculate distance for all squads
      const squadsWithDistance = squads
        .filter(squad => squad.centerLatitude && squad.centerLongitude)
        .map(squad => ({
          ...squad,
          distance: calculateDistance(
            center[0], center[1],
            squad.centerLatitude, squad.centerLongitude
          ),
        }));

      // Determine which squads to notify based on location type
      let squadsToNotify = [];

      if (locationType === 'zip') {
        // For zip code: notify squads in same city OR within 2 miles of center
        const normalizedCityName = (cityName || '').toLowerCase().trim();
        squadsToNotify = squadsWithDistance.filter(squad => {
          const squadCity = (squad.city || '').toLowerCase().trim();
          // Match by city name OR within 2 miles
          return squadCity === normalizedCityName || squad.distance <= NOTIFICATION_RADIUS;
        });
      } else {
        // For exact address or pin: notify squads within 2 miles
        squadsToNotify = squadsWithDistance.filter(squad => squad.distance <= NOTIFICATION_RADIUS);
      }

      // Sort by distance
      squadsToNotify.sort((a, b) => a.distance - b.distance);

      // Create assignments for all qualifying squads
      if (squadsToNotify.length > 0) {
        for (const squad of squadsToNotify) {
          await prisma.caseAssignment.create({
            data: {
              caseId: report.id,
              rescueSquadId: squad.id,
              status: 'PENDING',
              priority: timeElapsed === 'less_than_hour' ? 'URGENT' : 'NORMAL',
            },
          });

          assignedSquads.push({
            id: squad.id,
            name: squad.name,
            city: squad.city,
            distance: squad.distance,
          });
        }

        // Set the closest squad as the primary assigned squad
        const closestSquad = squadsToNotify[0];
        assignedSquad = {
          id: closestSquad.id,
          name: closestSquad.name,
          city: closestSquad.city,
        };

        // Log squad assignments
        await logEvent({
          event_type: 'case.assigned_to_squads',
          correlation_id: correlationId,
          resource_type: 'case_assignment',
          resource_id: report.id,
          action: 'create',
          result: 'success',
          metadata: {
            locationType,
            cityName: cityName || '',
            squadsNotified: squadsToNotify.length,
            primarySquadId: closestSquad.id,
            primarySquadName: closestSquad.name,
            squads: assignedSquads.map(s => ({ id: s.id, name: s.name, distance: s.distance.toFixed(2) })),
          },
        });
      }
    } catch (squadError) {
      // Non-fatal: log but continue - case still created successfully
      console.error('Squad assignment error:', squadError);
      await logEvent({
        event_type: 'case.squad_assignment_failed',
        correlation_id: correlationId,
        resource_type: 'case_assignment',
        action: 'create',
        result: 'failure',
        error_message: squadError.message,
      });
    }

    // Log success
    await logEvent({
      event_type: 'case.created',
      correlation_id: correlationId,
      resource_type: 'case',
      resource_id: report.id,
      actor_user_id: user.id,
      action: 'create',
      result: 'success',
      metadata: {
        petName,
        accountCreated,
        patrolAlerted: nearbyPatrol.length
      }
    });

    // Send email in background
    if (accountCreated && tempPassword) {
      sendEmail({
        to: email,
        subject: 'Your PetRecovery.org Account - Lost Pet Alert Created',
        html: buildWelcomeEmail(firstName, petName, email, tempPassword, nearbyPatrol.length)
      }).catch(err => {
        logEvent({
          event_type: 'email.send_failed',
          correlation_id: correlationId,
          resource_type: 'email',
          action: 'create',
          result: 'failure',
          error_message: err.message
        });
      });
    }

    return NextResponse.json({
      success: true,
      reportId: report.id,
      accountCreated,
      patrolAlerted: nearbyPatrol.length,
      assignedSquad,
      squadsNotified: assignedSquads.length,
      allAssignedSquads: assignedSquads,
    });

  } catch (error) {
    await logEvent({
      event_type: 'case.create_failed',
      correlation_id: correlationId,
      resource_type: 'case',
      action: 'create',
      result: 'failure',
      error_code: 'INTERNAL_ERROR',
      error_message: error.message
    });

    return NextResponse.json(
      { error: 'Failed to create report', details: error.message },
      { status: 500 }
    );
  }
}

function calculateLastSeenTime(timeElapsed) {
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
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function buildWelcomeEmail(firstName, petName, email, tempPassword, patrolCount) {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Lost Pet Alert Created</h2>
      <p>Hi ${firstName},</p>
      <p>Your lost pet alert for <strong>${petName}</strong> has been created and ${patrolCount} patrol member${patrolCount !== 1 ? 's' : ''} in your area ${patrolCount !== 1 ? 'have' : 'has'} been notified.</p>

      <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Your Account</h3>
        <p>We've created an account for you:</p>
        <p><strong>Email:</strong> ${email}<br/>
        <strong>Temporary Password:</strong> <code style="background: #fee2e2; padding: 2px 6px; border-radius: 3px;">${tempPassword}</code></p>
      </div>

      <p><a href="${baseUrl}/login" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Login to Dashboard</a></p>

      <p><small style="color: #6b7280;">We recommend changing your password after logging in.</small></p>
    </div>
  `;
}
