import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// POST /api/cases - Create a new case (lost/found pet report)
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    const {
      petName,
      petSpecies,
      petColor,
      petSize,
      petPhotoUrl,
      petDescription,
      lastSeenAt,
      lastSeenLatitude,
      lastSeenLongitude,
      lastSeenAddress,
      escapeScenario,
      ownerPhone,
      ownerEmail,
      // Optional fields
      petBreed,
      searchRadius,
      escapeDetails,
      hasReward,
      rewardAmount,
      reportType,
      priority,
    } = body;

    // Validation
    if (!petName || !petSpecies || !petColor || !petSize || !petPhotoUrl || !petDescription) {
      return NextResponse.json(
        { error: 'Missing required pet information' },
        { status: 400 }
      );
    }

    if (!lastSeenAt || !lastSeenLatitude || !lastSeenLongitude || !lastSeenAddress) {
      return NextResponse.json(
        { error: 'Missing required location information' },
        { status: 400 }
      );
    }

    if (!escapeScenario || !ownerPhone || !ownerEmail) {
      return NextResponse.json(
        { error: 'Missing required case details' },
        { status: 400 }
      );
    }

    // Generate unique case number
    const caseNumber = await generateCaseNumber(lastSeenAddress);

    // Create the case
    const newCase = await prisma.case.create({
      data: {
        caseNumber,

        // Pet Information
        petName,
        petSpecies,
        petBreed: petBreed || null,
        petColor,
        petSize,
        petPhotoUrl,
        petDescription,

        // Reporter/Owner
        reporterId: session.user.id,
        ownerName: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Pet Owner',
        ownerPhone,
        ownerEmail,

        // Case Details
        reportType: reportType || 'LOST',
        status: 'ACTIVE',
        priority: priority || 'NORMAL',

        // Location
        lastSeenAt: new Date(lastSeenAt),
        lastSeenLatitude: parseFloat(lastSeenLatitude),
        lastSeenLongitude: parseFloat(lastSeenLongitude),
        lastSeenAddress,
        searchRadius: searchRadius ? parseFloat(searchRadius) : 5,

        // Incident
        escapeScenario,
        escapeDetails: escapeDetails || null,

        // Reward
        hasReward: hasReward || false,
        rewardAmount: hasReward && rewardAmount ? parseFloat(rewardAmount) : null,
      },
    });

    // Update user's rescue level if this is their first case
    const userCaseCount = await prisma.case.count({
      where: { reporterId: session.user.id },
    });

    if (userCaseCount === 1) {
      // First case - promote to PET_OWNER level
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          rescueLevel: 'PET_OWNER',
        },
      });
    }

    return NextResponse.json({
      case: newCase,
      message: 'Case created successfully',
    });
  } catch (error) {
    console.error('Error creating case:', error);
    return NextResponse.json(
      { error: 'Failed to create case' },
      { status: 500 }
    );
  }
}

// Generate unique case number in format: "CHI-2024-001847"
async function generateCaseNumber(address) {
  // Extract city code from address (first 3 letters of city, uppercase)
  const cityMatch = address.match(/,\s*([A-Za-z]+)/);
  const cityCode = cityMatch
    ? cityMatch[1].substring(0, 3).toUpperCase()
    : 'USA';

  const year = new Date().getFullYear();

  // Find the highest case number for this city/year combination
  const latestCase = await prisma.case.findFirst({
    where: {
      caseNumber: {
        startsWith: `${cityCode}-${year}-`,
      },
    },
    orderBy: {
      caseNumber: 'desc',
    },
  });

  let nextNumber = 1;
  if (latestCase) {
    const lastNumber = parseInt(latestCase.caseNumber.split('-')[2]);
    nextNumber = lastNumber + 1;
  }

  // Format: CHI-2024-001847
  const caseNumber = `${cityCode}-${year}-${String(nextNumber).padStart(6, '0')}`;

  return caseNumber;
}
