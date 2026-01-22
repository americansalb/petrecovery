import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../../../lib/email';
import { getServerSession } from 'next-auth';
import { logEvent } from '@/lib/logging';
import crypto from 'crypto';
import { getEmailBaseUrl } from '@/app/lib/config';

// Allow large body for base64 image uploads and longer timeout
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const correlationId = crypto.randomUUID();

  try {
    const session = await getServerSession();
    const body = await request.json();
    let {
      email, phone, firstName,
      petName, breed, color, size, distinctiveMarks,
      lastSeenAddress, center, radiusMiles, timeElapsed, petType,
      petSize, isIndoorCat, // New fields for probability zones
      photos, locationType, cityName, selectedPetId,
      createAccount, password // Account creation consent fields
    } = body;

    // For dogs, use petSize if provided (more specific than generic size)
    if (petType?.toUpperCase() === 'DOG' && petSize) {
      size = petSize;
    }

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

      // Create account if doesn't exist (always need user record for pets/cases)
      if (!user) {
        let passwordHash;

        if (password && createAccount) {
          // User explicitly opted in with password
          passwordHash = await bcrypt.hash(password, 12);
          accountCreated = true;
        } else if (session?.user) {
          // Logged in via session
          tempPassword = crypto.randomBytes(12).toString('base64');
          passwordHash = await bcrypt.hash(tempPassword, 12);
          accountCreated = true;
        } else {
          // Guest report - create account but user didn't opt in for full access
          tempPassword = crypto.randomBytes(12).toString('base64');
          passwordHash = await bcrypt.hash(tempPassword, 12);
          // accountCreated stays false - they didn't explicitly create account
        }

        user = await tx.user.create({
          data: {
            email,
            phone,
            firstName,
            passwordHash,
            role: 'USER',
            emailVerified: null, // Email not verified yet
          }
        });
      }

      // Use existing pet if selectedPetId provided, otherwise create new
      let pet;
      if (selectedPetId) {
        // Verify the pet belongs to this user
        pet = await tx.pet.findFirst({
          where: {
            id: selectedPetId,
            ownerId: user.id,
            isDeleted: false,
          }
        });

        if (!pet) {
          throw new Error('Selected pet not found or does not belong to you');
        }

        // Update pet details if they've changed
        pet = await tx.pet.update({
          where: { id: selectedPetId },
          data: {
            name: petName || pet.name,
            color: color || pet.color,
            breed: breed || pet.breed,
            size: size || pet.size,
            distinctiveMarks: distinctiveMarks || pet.distinctiveMarks,
            primaryPhotoUrl: photos && photos.length > 0 ? photos[0] : pet.primaryPhotoUrl,
            photos: photos && photos.length > 0 ? JSON.stringify(photos) : pet.photos,
          }
        });
      } else {
        // Create new pet record
        pet = await tx.pet.create({
          data: {
            ownerId: user.id,
            name: petName,
            species: (petType || 'OTHER').toUpperCase(),
            breed: breed || '',
            color,
            size: size || 'MEDIUM', // Default to medium if not provided
            distinctiveMarks: distinctiveMarks || '',
            primaryPhotoUrl: photos && photos.length > 0 ? photos[0] : '',
            photos: JSON.stringify(photos || []),
            personality: "[]",
          }
        });
      }

      // Create case
      const lastSeenAt = calculateLastSeenTime(timeElapsed);
      const caseNumber = `CASE-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const petSizeValue = size || 'MEDIUM';

      // Build pet description including indoor/outdoor status for cats
      const petTypeNormalized = (petType || 'OTHER').toUpperCase();
      let petDescription = distinctiveMarks || `${color} ${petType || 'pet'}${breed ? ` - ${breed}` : ''}`;
      if (petTypeNormalized === 'CAT' && isIndoorCat !== undefined && isIndoorCat !== null) {
        const indoorStatus = isIndoorCat ? 'Indoor cat' : 'Outdoor access cat';
        petDescription = `${indoorStatus}. ${petDescription}`;
      }

      const report = await tx.case.create({
        data: {
          caseNumber,
          petId: pet.id,
          reporterId: user.id,
          reportType: 'LOST',
          petName,
          petSpecies: petTypeNormalized,
          petBreed: breed || 'Unknown',
          petColor: color,
          petSize: petSizeValue,
          petPhotoUrl: photos && photos.length > 0 ? photos[0] : '',
          petDescription,
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
          missionId: report.id,
          userId: member.id,
          method: member.patrolProfile.alertMethod,
        }))
      });
    }

    // Find and assign to rescue forces based on location type
    // Use force's coverage area (radiusMiles) + 1 mile buffer for all location types
    let assignedForce = null;
    let assignedForces = [];
    const COVERAGE_BUFFER = 1; // Add 1 mile to force's coverage radius

    try {
      const forces = await prisma.rescueForce.findMany({
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

      console.log('[Report Debug] Found', forces.length, 'active forces');
      console.log('[Report Debug] Case center:', center);
      console.log('[Report Debug] Location type:', locationType, 'City name:', cityName);

      // Calculate distance for all forces
      const squadsWithDistance = forces
        .filter(force => force.centerLatitude && force.centerLongitude)
        .map(force => ({
          ...force,
          distance: calculateDistance(
            center[0], center[1],
            force.centerLatitude, force.centerLongitude
          ),
          effectiveRadius: force.radiusMiles + COVERAGE_BUFFER, // Force coverage + buffer
        }));

      console.log('[Report Debug] Forces with valid coordinates:', squadsWithDistance.length);
      // Log a few closest forces with their coverage
      const closestSquads = [...squadsWithDistance].sort((a, b) => a.distance - b.distance).slice(0, 5);
      console.log('[Report Debug] 5 closest forces:', closestSquads.map(s => ({
        name: s.name,
        city: s.city,
        distance: s.distance.toFixed(2),
        coverageRadius: s.effectiveRadius,
        withinCoverage: s.distance <= s.effectiveRadius
      })));

      // Determine which forces to notify - use force's actual coverage area
      // A force is notified if the report location falls within their coverage radius
      let squadsToNotify = [];

      // Check if report falls within each force's coverage area (distance <= force.radiusMiles + buffer)
      squadsToNotify = squadsWithDistance.filter(force => {
        const withinCoverage = force.distance <= force.effectiveRadius;

        if (withinCoverage) {
          console.log('[Report Debug] Report within force coverage:', {
            name: force.name,
            city: force.city,
            distance: force.distance.toFixed(2),
            squadRadius: force.radiusMiles,
            effectiveRadius: force.effectiveRadius,
          });
        }
        return withinCoverage;
      });

      // Also check for city name match as fallback (for forces without coordinates)
      if (cityName) {
        const normalizedCityName = cityName.toLowerCase().trim();
        const cityMatchSquads = squadsWithDistance.filter(force => {
          const squadCity = (force.city || '').toLowerCase().trim();
          const sameCity = squadCity === normalizedCityName;
          const alreadyIncluded = squadsToNotify.some(s => s.id === force.id);
          return sameCity && !alreadyIncluded;
        });

        if (cityMatchSquads.length > 0) {
          console.log('[Report Debug] Adding city-matched forces:', cityMatchSquads.map(s => s.name));
          squadsToNotify.push(...cityMatchSquads);
        }
      }

      console.log('[Report Debug] Forces to notify:', squadsToNotify.length);

      // If no forces cover this location, auto-create one for this city AND find nearby forces
      if (squadsToNotify.length === 0 && cityName) {
        console.log('[Report Debug] No local forces found - auto-creating force for:', cityName);

        // Auto-create a rescue force for this city
        const newSquad = await prisma.rescueForce.create({
          data: {
            name: `${cityName} Pet Rescue`,
            city: cityName,
            country: 'US',
            centerLatitude: center[0],
            centerLongitude: center[1],
            radiusMiles: 5, // Default 5 mile coverage
            isActive: true,
            description: `🆕 Community rescue force for ${cityName}. Auto-created to help reunite pets with their families. Join to help coordinate local pet searches!`,
          },
        });

        console.log('[Report Debug] Auto-created force:', { id: newSquad.id, name: newSquad.name });

        // Add the auto-created force to the list
        squadsToNotify.push({
          ...newSquad,
          distance: 0,
          effectiveRadius: newSquad.radiusMiles + COVERAGE_BUFFER,
          isAutoCreated: true,
        });

        // Also find forces within 10 miles as "nearby assist" forces
        // These are forces whose coverage doesn't reach the report, but are close enough to help
        const NEARBY_ASSIST_RADIUS = 10; // miles
        const nearbyAssistSquads = squadsWithDistance.filter(force =>
          force.distance <= NEARBY_ASSIST_RADIUS && force.distance > force.effectiveRadius
        );

        if (nearbyAssistSquads.length > 0) {
          console.log('[Report Debug] Found', nearbyAssistSquads.length, 'nearby assist forces within 10 miles');
          nearbyAssistSquads.forEach(force => {
            force.isNearbyAssist = true;
            squadsToNotify.push(force);
          });
        }
      }

      // Sort by distance (closest first)
      squadsToNotify.sort((a, b) => a.distance - b.distance);

      // Create assignments for all qualifying forces (unlimited)
      if (squadsToNotify.length > 0) {
        console.log('[Report Debug] Creating assignments for', squadsToNotify.length, 'forces');
        for (const force of squadsToNotify) {
          console.log('[Report Debug] Creating assignment for force:', { id: force.id, name: force.name, city: force.city, distance: force.distance });
          const assignment = await prisma.caseAssignment.create({
            data: {
              missionId: report.id,
              rescueForceId: force.id,
              status: 'ACCEPTED',
              acceptedById: user.id, // Required field - use reporter as initial accepter
            },
          });
          console.log('[Report Debug] Created assignment:', { id: assignment.id, missionId: assignment.missionId, rescueForceId: assignment.rescueForceId });

          // Auto-join reporter to rescue force (Phase 1.2)
          // Only add if this is the primary force (first one) and user exists
          if (force === squadsToNotify[0] && user) {
            try {
              // Check if user is already a member
              const existingMember = await prisma.rescueForceMember.findFirst({
                where: {
                  rescueForceId: force.id,
                  userId: user.id
                }
              });

              if (!existingMember) {
                // Auto-add user as member
                await prisma.rescueForceMember.create({
                  data: {
                    rescueForceId: force.id,
                    userId: user.id,
                    role: 'MEMBER',
                    isActive: true,
                    joinedAt: new Date()
                  }
                });
                console.log('[Report Debug] Auto-joined reporter to force:', force.name);
              } else {
                console.log('[Report Debug] Reporter already member of force:', force.name);
              }
            } catch (memberError) {
              // Non-fatal: log but continue
              console.error('[Report Debug] Failed to auto-join reporter to force:', memberError);
            }
          }

          // Create automatic mascot post about the new case
          try {
            const isNearbyAssist = force.isNearbyAssist;
            const distanceText = force.distance ? `~${force.distance.toFixed(1)} miles away` : '';

            let postContent;
            const petTypeDisplay = petType || 'pet';
            if (force.isAutoCreated) {
              // Welcome post for newly auto-created force
              postContent = `🎉 **Welcome to ${force.name}!** 🎉\n\nThis force was just created to help find ${petName}!\n\n🚨 **First Case:** ${petName}, a ${color} ${petTypeDisplay}${breed ? ` (${breed})` : ''}, was last seen near ${lastSeenAddress}.\n\n📍 Case #${caseNumber}\n⏰ ${timeElapsed === 'less_than_hour' ? 'URGENT - Lost within the last hour!' : 'Recently reported'}\n\nJoin this force to help reunite pets with their families in your community! 🐾`;
            } else if (isNearbyAssist) {
              // Nearby assist post
              postContent = `🆘 **Nearby Assist Request!** 🆘\n\n${petName}, a ${color} ${petTypeDisplay}${breed ? ` (${breed})` : ''}, went missing ${distanceText} from your coverage area.\n\n📍 Location: ${lastSeenAddress}\n📋 Case #${caseNumber}\n⏰ ${timeElapsed === 'less_than_hour' ? 'URGENT - Lost within the last hour!' : 'Recently reported'}\n\nNo local force in that area yet - your help could make the difference! 🙏`;
            } else {
              // Regular case alert
              postContent = `🚨 **New Case Alert!** 🚨\n\n${petName}, a ${color} ${petTypeDisplay}${breed ? ` (${breed})` : ''}, was last seen near ${lastSeenAddress}.\n\n📍 Case #${caseNumber}\n⏰ ${timeElapsed === 'less_than_hour' ? 'URGENT - Lost within the last hour!' : 'Recently reported'}\n\nIf you're in the area, please keep an eye out and report any sightings. Every pair of eyes helps! 👀`;
            }

            await prisma.squadPost.create({
              data: {
                rescueForceId: force.id,
                authorId: user.id,
                content: postContent,
                isSystemPost: true,
                isPinned: force.isAutoCreated, // Pin the welcome post for new forces
              }
            });
            console.log('[Report Debug] Created mascot post for force:', force.name, isNearbyAssist ? '(nearby assist)' : '');
          } catch (postError) {
            // Non-fatal: log but continue
            console.error('[Report Debug] Failed to create mascot post:', postError);
          }

          assignedForces.push({
            id: force.id,
            name: force.name,
            city: force.city,
            distance: force.distance,
          });
        }

        // Set the closest force as the primary assigned force
        const closestSquad = squadsToNotify[0];
        assignedForce = {
          id: closestSquad.id,
          name: closestSquad.name,
          city: closestSquad.city,
        };

        // Log force assignments
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
            primaryForceId: closestSquad.id,
            primarySquadName: closestSquad.name,
            forces: assignedForces.map(s => ({ id: s.id, name: s.name, distance: s.distance.toFixed(2) })),
          },
        });
      }
    } catch (squadError) {
      // Non-fatal: log but continue - case still created successfully
      console.error('Force assignment error:', squadError);
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
      resource_type: 'mission',
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
    if (accountCreated) {
      if (tempPassword) {
        // Legacy flow: send welcome email with temp password
        sendEmail({
          to: email,
          subject: 'Your ReunitePets.org Account - Lost Pet Alert Created',
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
      } else if (createAccount && password) {
        // New flow: user chose to create account with their own password
        // Send verification email (will be implemented in Phase 3.1)
        sendEmail({
          to: email,
          subject: 'Welcome to ReunitePets.org - Verify Your Email',
          html: `
            <h2>Welcome to ReunitePets.org, ${firstName}!</h2>
            <p>Thank you for creating an account. Your lost pet report for <strong>${petName}</strong> has been submitted successfully.</p>
            <p><strong>Case Number:</strong> ${report.caseNumber}</p>
            <p>You can now log in with your email (${email}) and the password you created.</p>
            <p><strong>Next steps:</strong></p>
            <ul>
              <li>Log in to view your case dashboard</li>
              <li>Coordinate with your assigned rescue force</li>
              <li>Update information as needed</li>
            </ul>
            <p>We'll send you updates when volunteers report sightings.</p>
            <p>Email verification link will be sent separately (coming soon).</p>
          `
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
    }

    // Send guest report email if account was not explicitly created
    if (!accountCreated && !session?.user) {
      // Guest report: user exists in DB but didn't opt in for account
      // Send "claim your report" email (will be fully implemented in Phase 3.3)
      sendEmail({
        to: email,
        subject: 'Lost Pet Report Submitted - Track Your Case',
        html: `
          <h2>Lost Pet Report Submitted</h2>
          <p>Hi ${firstName},</p>
          <p>Your lost pet report for <strong>${petName}</strong> has been submitted.</p>
          <p><strong>Case Number:</strong> ${report.caseNumber}</p>
          <p>We'll notify you by email if anyone spots your pet.</p>
          <p><strong>Want to track progress and coordinate with volunteers?</strong></p>
          <p>Create an account to access your case dashboard and work with your rescue force.</p>
          <p>[Claim Report button will be added in Phase 3.3]</p>
        `
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
      caseNumber: report.caseNumber,
      petName: report.petName,
      accountCreated,
      patrolAlerted: nearbyPatrol.length,
      assignedForce,
      squadsNotified: assignedForces.length,
      allAssignedSquads: assignedForces,
    });

  } catch (error) {
    await logEvent({
      event_type: 'case.create_failed',
      correlation_id: correlationId,
      resource_type: 'mission',
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
  const baseUrl = getEmailBaseUrl();
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
