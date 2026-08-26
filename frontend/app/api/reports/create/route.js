import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import bcrypt from 'bcryptjs';
import { sendEmail, sendVerificationEmail, renderBrandedEmail, escapeHtml } from '../../../lib/email';
import { placeholderEmailForPhone } from '@/app/lib/placeholderEmail';
import { sendSms } from '@/app/lib/sms';
import { seedActivation, enqueueCascade } from '@/app/lib/cascade/runCascade';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { logEvent } from '@/lib/logging';
import { describePet } from '@/app/lib/species';
import { looksLikeCoordinates, reverseGeocodeLabel } from '@/app/lib/maps/reverseLabel';
import crypto from 'crypto';
import { getEmailBaseUrl } from '@/app/lib/config';
import { withRateLimitAsync, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import { withCaseNumberRetry } from '@/app/lib/caseNumber';

// Allow large body for base64 image uploads and longer timeout
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const correlationId = crypto.randomUUID();

  // This route mints accounts and fans out verification email + SMS + the
  // whole cascade, so it must be throttled - otherwise it's an account-flood
  // and Twilio/email cost-DoS vector. Per-IP moderate public-write limit.
  const rl = await withRateLimitAsync(request, RateLimitPresets.PUBLIC_WRITE, 'reports:create');
  if (!rl.success) {
    logEvent({
      event_type: 'report.create.rate_limited',
      correlation_id: correlationId,
      resource_type: 'case',
      action: 'create',
      result: 'blocked',
      error_code: 'RATE_LIMITED',
    }).catch(() => {});
    return rateLimitResponse(rl);
  }

  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    let {
      email, phone, firstName,
      petName, breed, color, size, distinctiveMarks,
      lastSeenAddress, center, radiusMiles, timeElapsed, petType,
      petSize, isIndoorCat, // New fields for probability zones
      photos, locationType, cityName, selectedPetId,
      createAccount, password, // Account creation consent fields
      reporterLocation, // Reporter's auto-detected GPS [lat, lng]
      escapeScenario, // How the pet got out (wizard details step)
      collarInfo, microchipId // Optional identifiers, stored on the Pet
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

    // Normalize email like /api/auth/register does - a mixed-case email here
    // would create an account that credentials login (which lowercases) can
    // never find, and a duplicate once the user registers properly.
    email = email?.toLowerCase().trim() || null;

    // Phone-only reporters: User.email is required + unique, so synthesize a
    // deterministic placeholder from the phone digits (same phone → same
    // account next time). Placeholder addresses are undeliverable by design;
    // every email send below is skipped for them.
    let phoneOnly = false;
    if (!email && phone) {
      email = placeholderEmailForPhone(phone);
      phoneOnly = true;
    }

    // Validate required fields - need at least email OR phone for contact
    if ((!email && !phone) || !firstName || !petName || !color || !lastSeenAddress || !center) {
      return NextResponse.json(
        { error: 'Missing required fields. Please provide at least an email or phone number.' },
        { status: 400 }
      );
    }

    // A pin-only report arrives with raw "lat, lng" as its address: all
    // three client geocoders failed, or the reporter tapped "use my
    // location" with no network for the reverse lookup. Resolve a human
    // label for it, overlapped with the bcrypt hash below so a slow
    // geocoder never adds its full timeout to the post; if it fails the
    // coordinates stay stored, and the display layer knows not to print
    // them.
    const reverseLabelPromise =
      looksLikeCoordinates(lastSeenAddress) && Array.isArray(center)
        ? reverseGeocodeLabel(Number(center[0]), Number(center[1]))
        : Promise.resolve(null);

    let accountCreated = false;
    let tempPassword = null;

    // Password hashing happens BEFORE the transaction opens. bcrypt at cost 12
    // is ~250-500ms of CPU and blocks the event loop, and it used to run inside
    // the interactive transaction below - which takes Prisma's default 5000ms
    // budget. Under any concurrency the budget expired mid-write and the report
    // failed with "Transaction already closed ... 7483ms passed". That is the
    // most important write in the product, failing for the person whose pet has
    // just gone missing.
    //
    // Neither input depends on the lookup inside the transaction, so both can be
    // computed up front. When the user already exists the hash is simply unused;
    // one wasted hash off the transaction's clock is the right trade.
    const optedInWithPassword = Boolean(password && createAccount);
    const candidateTempPassword = optedInWithPassword ? null : crypto.randomBytes(12).toString('base64');
    const [precomputedPasswordHash, reverseLabel] = await Promise.all([
      bcrypt.hash(optedInWithPassword ? password : candidateTempPassword, 12),
      reverseLabelPromise,
    ]);
    const resolvedLastSeenAddress = reverseLabel || lastSeenAddress;

    // Use transaction to ensure all related records are created atomically
    // User lookup is inside the transaction to prevent race conditions (Fix 5)
    //
    // Wrapped in withCaseNumberRetry: the case number is generated per attempt
    // and Case.caseNumber is @unique, so a genuine collision retries with a new
    // number instead of 500ing the report. Only a caseNumber unique violation
    // retries; everything else propagates.
    const result = await withCaseNumberRetry((caseNumber) => prisma.$transaction(async (tx) => {
      // Check if user exists by email (inside transaction for serialized access)
      let existingUser = await tx.user.findUnique({
        where: { email }
      });

      // An anonymous caller must not be able to post as somebody else. Typing a
      // stranger's address used to attach the case to THEIR account, publish it
      // under their name, and copy their stored phone onto a public record.
      //
      // The test is emailVerified, NOT passwordHash: this endpoint gives every
      // guest a hashed temp password, so a password proves nothing about who
      // owns the address. A verified account means that person clicked a link
      // in that inbox - posting as them anonymously is impersonation. An
      // unverified row is either a guest shell this endpoint minted on an
      // earlier report or a signup that never confirmed, and in both cases
      // nobody has proven ownership, so a repeat guest report still goes
      // through. Mirrors the PHONE_CONFLICT contract just below.
      //
      // Residual, deliberately: an account registered but not yet verified can
      // still be reported against anonymously. Closing that needs verification
      // to be enforced at signup, which is a separate change.
      if (existingUser?.emailVerified && !session?.user) {
        throw new Error('ACCOUNT_EXISTS');
      }

      // If user exists and phone wasn't provided, try to get it from their record
      if (existingUser && !phone) {
        phone = existingUser.phone;
      }

      // Check phone uniqueness only if phone is provided and user doesn't exist yet
      if (!existingUser && phone) {
        const phoneExists = await tx.user.findFirst({
          where: { phone }
        });
        if (phoneExists && phoneExists.email !== email) {
          throw new Error('PHONE_CONFLICT:' + phoneExists.email.substring(0, 3) + '***@' + phoneExists.email.split('@')[1]);
        }
      }

      let user = existingUser;

      // Create account if doesn't exist (always need user record for pets/cases)
      if (!user) {
        // Hashed above, outside the transaction - see the note there.
        const passwordHash = precomputedPasswordHash;

        if (optedInWithPassword) {
          // User explicitly opted in with password
          accountCreated = true;
        } else if (session?.user) {
          // Logged in via session
          tempPassword = candidateTempPassword;
          accountCreated = true;
        } else {
          // Guest report - create account but user didn't opt in for full access
          // accountCreated stays false - they didn't explicitly create account
          tempPassword = candidateTempPassword;
        }

        user = await tx.user.create({
          data: {
            email,
            phone,
            firstName,
            passwordHash,
            role: 'USER',
            emailVerified: (password && createAccount) ? new Date() : null,
          }
        });
      }

      // Use existing pet if selectedPetId provided, otherwise create new
      let pet;
      if (selectedPetId) {
        // Verify the pet belongs to this user PERSONALLY. Roster animals are
        // excluded on purpose: the picker no longer offers them, and the
        // update below would overwrite shelter intake data (name, microchip,
        // primary photo) with whatever the report form carried. A shelter
        // animal that goes missing is a shelter workflow, not a personal
        // lost-pet report.
        pet = await tx.pet.findFirst({
          where: {
            id: selectedPetId,
            ownerId: user.id,
            isDeleted: false,
            managedByShelterId: null,
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
            collarInfo: collarInfo || pet.collarInfo,
            microchipId: microchipId || pet.microchipId,
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
            collarInfo: collarInfo || null,
            microchipId: microchipId || null,
            primaryPhotoUrl: photos && photos.length > 0 ? photos[0] : '',
            photos: JSON.stringify(photos || []),
            personality: "[]",
          }
        });
      }

      // Create case
      const lastSeenAt = calculateLastSeenTime(timeElapsed);
      const petSizeValue = size || 'MEDIUM';

      // Build pet description including indoor/outdoor status for cats.
      // describePet keeps the enum out of prose ("Dark Brown Dog", never
      // "Dark Brown DOG"), and a breed recorded as 'Unknown' is not a word
      // for a poster.
      const petTypeNormalized = (petType || 'OTHER').toUpperCase();
      const knownBreed = breed && breed.toLowerCase() !== 'unknown' ? breed : null;
      let petDescription =
        distinctiveMarks ||
        describePet({ species: petTypeNormalized, breed: knownBreed, color });
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
          ownerEmail: phoneOnly ? 'Not provided' : email,
          lastSeenAt,
          lastSeenLatitude: center[0],
          lastSeenLongitude: center[1],
          lastSeenAddress: resolvedLastSeenAddress,
          searchRadius: radiusMiles,
          // Guard on null, not truthiness: a valid 0.0 coordinate (equator /
          // prime meridian) is falsy and `0 || null` would drop it.
          reporterLatitude: reporterLocation?.[0] != null ? reporterLocation[0] : null,
          reporterLongitude: reporterLocation?.[1] != null ? reporterLocation[1] : null,
          escapeScenario: escapeScenario || 'unknown',
          status: 'ACTIVE',
          priority: timeElapsed === 'less_than_hour' ? 'URGENT' : 'NORMAL',
        }
      });

      return { user, pet, report, isNewUser: !existingUser };
    }, {
      // Defence in depth: the hashing that used to blow this budget is gone,
      // but this callback still does ~10 writes and prod runs against a
      // network-attached database. 15s is generous for that and still bounded.
      timeout: 15000,
      maxWait: 10000,
    }), { cityName, lastSeenAddress });

    const { user, report, isNewUser } = result;

    // Seed the durable cascade activation now (cheap, awaited) so the success
    // screen can read/poll it immediately and the response can carry a
    // snapshot. The heavy work is ENQUEUED later (just before the response),
    // after the patrol Alert + rescue-force assignment rows exist - those are
    // inputs the cascade's neighbor_alert / rescue_force actions read.
    let activationSnapshot = null;
    try {
      const activation = await seedActivation(report, correlationId);
      activationSnapshot = { caseNumber: report.caseNumber, status: activation.status };
    } catch (cascadeErr) {
      logEvent({
        event_type: 'cascade.seed_failed',
        correlation_id: correlationId,
        resource_type: 'case',
        resource_id: report.id,
        action: 'create',
        result: 'failure',
        error_message: String(cascadeErr?.message || cascadeErr).slice(0, 300),
      }).catch(() => {});
    }

    // Send verification email for ALL new users (Fix 4: unified for guest + createAccount paths)
    if (isNewUser && !session?.user) {
      // Case expiry applies to every unverified reporter - including
      // phone-only ones, who can never verify an email.
      const caseExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      await prisma.case.update({
        where: { id: report.id },
        data: { expiresAt: caseExpiry }
      });

      // Placeholder addresses (phone-only reporters) are undeliverable -
      // skip the token + send entirely.
      if (!phoneOnly) {
        const rawVerifyToken = crypto.randomBytes(32).toString('hex');
        const hashedVerifyToken = crypto.createHash('sha256').update(rawVerifyToken).digest('hex');
        const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerifyToken: hashedVerifyToken,
            emailVerifyExpiry: verifyExpiry,
          }
        });

        const BASE_URL = getEmailBaseUrl();
        const verifyUrl = `${BASE_URL}/verify-email?token=${rawVerifyToken}`;
        sendVerificationEmail(email, firstName, verifyUrl).catch((err) => {
          console.error('Failed to send verification email:', err);
        });
      }
    }

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
      if (member.profile?.latitude == null || member.profile?.longitude == null) return false;
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

    // Find and assign to rescue forces based on location type
    // Use squad's coverage area (radiusMiles) + 1 mile buffer for all location types
    let assignedSquad = null;
    let assignedSquads = [];
    const COVERAGE_BUFFER = 1; // Add 1 mile to squad's coverage radius

    try {
      const squads = await prisma.rescueForce.findMany({
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

      console.log('[Report Debug] Found', squads.length, 'active squads');
      console.log('[Report Debug] Case center:', center);
      console.log('[Report Debug] Location type:', locationType, 'City name:', cityName);

      // Calculate distance for all squads
      const squadsWithDistance = squads
        .filter(squad => squad.centerLatitude && squad.centerLongitude)
        .map(squad => ({
          ...squad,
          distance: calculateDistance(
            center[0], center[1],
            squad.centerLatitude, squad.centerLongitude
          ),
          effectiveRadius: squad.radiusMiles + COVERAGE_BUFFER, // Squad coverage + buffer
        }));

      console.log('[Report Debug] Squads with valid coordinates:', squadsWithDistance.length);
      // Log a few closest squads with their coverage
      const closestSquads = [...squadsWithDistance].sort((a, b) => a.distance - b.distance).slice(0, 5);
      console.log('[Report Debug] 5 closest squads:', closestSquads.map(s => ({
        name: s.name,
        city: s.city,
        distance: s.distance.toFixed(2),
        coverageRadius: s.effectiveRadius,
        withinCoverage: s.distance <= s.effectiveRadius
      })));

      // Determine which squads to notify - use squad's actual coverage area
      // A squad is notified if the report location falls within their coverage radius
      let squadsToNotify = [];

      // Check if report falls within each squad's coverage area (distance <= squad.radiusMiles + buffer)
      squadsToNotify = squadsWithDistance.filter(squad => {
        const withinCoverage = squad.distance <= squad.effectiveRadius;

        if (withinCoverage) {
          console.log('[Report Debug] Report within squad coverage:', {
            name: squad.name,
            city: squad.city,
            distance: squad.distance.toFixed(2),
            squadRadius: squad.radiusMiles,
            effectiveRadius: squad.effectiveRadius,
          });
        }
        return withinCoverage;
      });

      // Also check for city name match as fallback (for squads without coordinates)
      if (cityName) {
        const normalizedCityName = cityName.toLowerCase().trim();
        const cityMatchSquads = squadsWithDistance.filter(squad => {
          const squadCity = (squad.city || '').toLowerCase().trim();
          const sameCity = squadCity === normalizedCityName;
          const alreadyIncluded = squadsToNotify.some(s => s.id === squad.id);
          return sameCity && !alreadyIncluded;
        });

        if (cityMatchSquads.length > 0) {
          console.log('[Report Debug] Adding city-matched squads:', cityMatchSquads.map(s => s.name));
          squadsToNotify.push(...cityMatchSquads);
        }
      }

      console.log('[Report Debug] Squads to notify:', squadsToNotify.length);

      // If no squads cover this location, auto-create one for this city AND find nearby squads
      if (squadsToNotify.length === 0 && cityName) {
        console.log('[Report Debug] No local squads found - auto-creating squad for:', cityName);

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

        console.log('[Report Debug] Auto-created squad:', { id: newSquad.id, name: newSquad.name });

        // Add the auto-created squad to the list
        squadsToNotify.push({
          ...newSquad,
          distance: 0,
          effectiveRadius: newSquad.radiusMiles + COVERAGE_BUFFER,
          isAutoCreated: true,
        });

        // Also find squads within 10 miles as "nearby assist" squads
        // These are squads whose coverage doesn't reach the report, but are close enough to help
        const NEARBY_ASSIST_RADIUS = 10; // miles
        const nearbyAssistSquads = squadsWithDistance.filter(squad =>
          squad.distance <= NEARBY_ASSIST_RADIUS && squad.distance > squad.effectiveRadius
        );

        if (nearbyAssistSquads.length > 0) {
          console.log('[Report Debug] Found', nearbyAssistSquads.length, 'nearby assist squads within 10 miles');
          nearbyAssistSquads.forEach(squad => {
            squad.isNearbyAssist = true;
            squadsToNotify.push(squad);
          });
        }
      }

      // Sort by distance (closest first)
      squadsToNotify.sort((a, b) => a.distance - b.distance);

      // Create assignments for all qualifying squads (unlimited)
      if (squadsToNotify.length > 0) {
        console.log('[Report Debug] Creating assignments for', squadsToNotify.length, 'squads');
        for (const squad of squadsToNotify) {
          console.log('[Report Debug] Creating assignment for squad:', { id: squad.id, name: squad.name, city: squad.city, distance: squad.distance });
          const assignment = await prisma.caseAssignment.create({
            data: {
              missionId: report.id,
              rescueSquadId: squad.id,
              status: 'ACCEPTED',
              acceptedById: user.id, // Required field - use reporter as initial accepter
            },
          });
          console.log('[Report Debug] Created assignment:', { id: assignment.id, missionId: assignment.missionId, rescueSquadId: assignment.rescueSquadId });

          // Auto-join reporter to rescue force (Phase 1.2)
          // Only add if this is the primary squad (first one) and user exists
          if (squad === squadsToNotify[0] && user) {
            try {
              // Check if user is already a member
              const existingMember = await prisma.rescueForceMember.findFirst({
                where: {
                  rescueSquadId: squad.id,
                  userId: user.id
                }
              });

              if (!existingMember) {
                // Auto-add user as member
                await prisma.rescueForceMember.create({
                  data: {
                    rescueSquadId: squad.id,
                    userId: user.id,
                    role: 'MEMBER',
                    isActive: true,
                    joinedAt: new Date()
                  }
                });
                console.log('[Report Debug] Auto-joined reporter to squad:', squad.name);
              } else {
                console.log('[Report Debug] Reporter already member of squad:', squad.name);
              }
            } catch (memberError) {
              // Non-fatal: log but continue
              console.error('[Report Debug] Failed to auto-join reporter to squad:', memberError);
            }
          }

          // Create automatic mascot post about the new case
          try {
            const isNearbyAssist = squad.isNearbyAssist;
            const distanceText = squad.distance ? `~${squad.distance.toFixed(1)} miles away` : '';

            let postContent;
            const petTypeDisplay = petType || 'pet';
            if (squad.isAutoCreated) {
              // Welcome post for newly auto-created squad
              postContent = `🎉 **Welcome to ${squad.name}!** 🎉\n\nThis rescue force was just created to help find ${petName}!\n\n🚨 **First Case:** ${petName}, a ${color} ${petTypeDisplay}${breed ? ` (${breed})` : ''}, was last seen near ${lastSeenAddress}.\n\n📍 Case #${report.caseNumber}\n⏰ ${timeElapsed === 'less_than_hour' ? 'URGENT - Lost within the last hour!' : 'Recently reported'}\n\nJoin this rescue force to help reunite pets with their families in your community! 🐾`;
            } else if (isNearbyAssist) {
              // Nearby assist post
              postContent = `🆘 **Nearby Assist Request!** 🆘\n\n${petName}, a ${color} ${petTypeDisplay}${breed ? ` (${breed})` : ''}, went missing ${distanceText} from your coverage area.\n\n📍 Location: ${lastSeenAddress}\n📋 Case #${report.caseNumber}\n⏰ ${timeElapsed === 'less_than_hour' ? 'URGENT - Lost within the last hour!' : 'Recently reported'}\n\nNo local rescue force in that area yet - your help could make the difference! 🙏`;
            } else {
              // Regular case alert
              postContent = `🚨 **New Case Alert!** 🚨\n\n${petName}, a ${color} ${petTypeDisplay}${breed ? ` (${breed})` : ''}, was last seen near ${lastSeenAddress}.\n\n📍 Case #${report.caseNumber}\n⏰ ${timeElapsed === 'less_than_hour' ? 'URGENT - Lost within the last hour!' : 'Recently reported'}\n\nIf you're in the area, please keep an eye out and report any sightings. Every pair of eyes helps! 👀`;
            }

            await prisma.squadPost.create({
              data: {
                rescueSquadId: squad.id,
                authorId: user.id,
                content: postContent,
                // isSystemPost / isPinned are NOT columns on SquadPost -
                // confirmed against both prisma/schema.prisma and the raw DDL in
                // app/api/admin/migrate. Passing them made this create throw,
                // which the catch below swallowed.
              }
            });
            console.log('[Report Debug] Created mascot post for squad:', squad.name, isNearbyAssist ? '(nearby assist)' : '');
          } catch (postError) {
            // Non-fatal: log but continue
            console.error('[Report Debug] Failed to create mascot post:', postError);
          }

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

    // Calculate distance between reporter and last-seen location (if both available)
    let reporterToLastSeenMiles = null;
    if (reporterLocation?.[0] != null && reporterLocation?.[1] != null && center?.[0] != null && center?.[1] != null) {
      reporterToLastSeenMiles = calculateDistance(
        reporterLocation[0], reporterLocation[1],
        center[0], center[1]
      );
    }

    // Log success with both location data points
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
        patrolAlerted: nearbyPatrol.length,
        lastSeenLocation: { lat: center[0], lng: center[1], address: lastSeenAddress },
        reporterLocation: reporterLocation ? { lat: reporterLocation[0], lng: reporterLocation[1] } : null,
        reporterToLastSeenMiles: reporterToLastSeenMiles !== null ? parseFloat(reporterToLastSeenMiles.toFixed(2)) : null,
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
    // (skipped for phone-only reporters - their address is a placeholder)
    if (!accountCreated && !session?.user && !phoneOnly) {
      // Guest report: the user row exists but has no usable password, so give
      // them (1) a direct link back to their live case and (2) a way to set a
      // password so they can log in and manage it (mark reunited, coordinate).
      const baseUrl = getEmailBaseUrl();
      const caseUrl = `${baseUrl}/cases/${report.caseNumber}`;
      const setPasswordUrl = `${baseUrl}/forgot-password?email=${encodeURIComponent(email)}`;
      // These values are user-supplied (the reporter's own name, pet name,
      // email). bodyHtml is raw HTML, so escape them; the set-password link
      // lives here in the body because footnote is escaped as plain text.
      const firstNameSafe = escapeHtml(firstName);
      const petNameSafe = escapeHtml(petName);
      const emailSafe = escapeHtml(email);
      const caseNumberSafe = escapeHtml(report.caseNumber);
      sendEmail({
        to: email,
        subject: `${petName}'s lost-pet report is live - here's your link`,
        html: renderBrandedEmail({
          preheader: `Track sightings and manage ${petName}'s case.`,
          heading: `${petName}'s report is live`,
          bodyHtml: `
            <p>Hi ${firstNameSafe},</p>
            <p>Your lost-pet report for <strong>${petNameSafe}</strong> is now live, and your neighborhood rescue force can see it. We'll email you the moment anyone reports a sighting.</p>
            <p style="margin:20px 0 8px;"><strong>Your case:</strong> ${caseNumberSafe}</p>
            <p style="color:#64748b; font-size:14px;">Open your case page any time to see sightings, share it, and print flyers. To mark ${petNameSafe} found or coordinate with volunteers, set a password and log in with ${emailSafe}.</p>
            <p style="margin:16px 0 0; font-size:14px;"><a href="${setPasswordUrl}" style="color:#0f172a; font-weight:600;">Set your password</a></p>
          `,
          ctaLabel: `Open ${petName}'s case`,
          ctaUrl: caseUrl,
          footnote: "You're receiving this because you reported a lost pet on ReunitePets.",
        }),
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

    // Phone-only reporters get no email at all - text them the case link so
    // they have a way back to their report after closing the tab. Best-effort
    // (sendSms no-ops gracefully when Twilio isn't configured).
    if (phoneOnly && phone) {
      const caseUrl = `${getEmailBaseUrl()}/cases/${report.caseNumber}`;
      sendSms(
        phone,
        `ReunitePets: your lost-pet report for ${petName} is live. Track sightings and manage it here: ${caseUrl}`
      ).then(res => {
        if (!res?.success) {
          logEvent({
            event_type: 'sms.send_failed',
            correlation_id: correlationId,
            resource_type: 'sms',
            action: 'create',
            result: 'failure',
            error_message: res?.error || 'unknown'
          });
        }
      }).catch(err => {
        logEvent({
          event_type: 'sms.send_failed',
          correlation_id: correlationId,
          resource_type: 'sms',
          action: 'create',
          result: 'failure',
          error_message: err.message
        });
      });
    }

    // Fire the report-time action cascade FIRE-AND-FORGET, now that the patrol
    // Alert rows and rescue-force CaseAssignment rows exist. The reporter's
    // response is never blocked - the cascade runs on the next tick.
    enqueueCascade(report.id, { correlationId });

    return NextResponse.json({
      success: true,
      reportId: report.id,
      caseNumber: report.caseNumber,
      petName: report.petName,
      petSpecies: report.petSpecies,
      petBreed: report.petBreed,
      petColor: report.petColor,
      petPhotoUrl: report.petPhotoUrl,
      activation: activationSnapshot,
      accountCreated,
      patrolAlerted: nearbyPatrol.length,
      assignedSquad,
      squadsNotified: assignedSquads.length,
      allAssignedSquads: assignedSquads,
      locations: {
        lastSeen: { lat: center[0], lng: center[1] },
        reporter: reporterLocation ? { lat: reporterLocation[0], lng: reporterLocation[1] } : null,
        distanceMiles: reporterToLastSeenMiles !== null ? parseFloat(reporterToLastSeenMiles.toFixed(2)) : null,
      },
    });

  } catch (error) {
    // Handle phone conflict thrown from inside transaction
    // An anonymous submission naming a real account. Say so plainly and point
    // at the one action that resolves it; never hint at whether the report
    // would otherwise have succeeded.
    if (error.message === 'ACCOUNT_EXISTS') {
      return NextResponse.json(
        {
          error: 'That email already has a ReunitePets account. Sign in and your report will be filed to it, or use a different email.',
          code: 'ACCOUNT_EXISTS',
          signInUrl: '/login?callbackUrl=%2Freport%2Fnew'
        },
        { status: 409 }
      );
    }

    if (error.message?.startsWith('PHONE_CONFLICT:')) {
      const maskedEmail = error.message.split('PHONE_CONFLICT:')[1];
      return NextResponse.json(
        {
          error: 'Phone number already registered with a different email. Please login or use the email associated with this phone number.',
          existingEmail: maskedEmail
        },
        { status: 400 }
      );
    }

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
