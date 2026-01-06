import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import {
  createPetIdentity,
  verifyOwnership,
  getPetIdentity,
  registerMicrochip,
  reportLostOnChain,
  generatePetNFT,
} from '@/app/lib/blockchain/petIdentity';

/**
 * GET /api/blockchain/identity
 * Get pet identity from blockchain
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get('tokenId');

    if (!tokenId) {
      return NextResponse.json(
        { error: 'Token ID required' },
        { status: 400 }
      );
    }

    const identity = await getPetIdentity(tokenId);

    if (!identity) {
      return NextResponse.json(
        { error: 'Pet identity not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(identity);
  } catch (error) {
    console.error('Blockchain fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch identity' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/blockchain/identity
 * Create or update pet identity on blockchain
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create':
        const identity = await createPetIdentity(body.petData, body.walletAddress);
        return NextResponse.json(identity);

      case 'verify':
        const verification = await verifyOwnership(body.tokenId, body.claimedOwner);
        return NextResponse.json(verification);

      case 'register_microchip':
        const microchipResult = await registerMicrochip(body.tokenId, body.microchipData);
        return NextResponse.json(microchipResult);

      case 'report_lost':
        const lostReport = await reportLostOnChain(body.tokenId, body.reportData);
        return NextResponse.json(lostReport);

      case 'generate_nft':
        const nft = await generatePetNFT(body.tokenId);
        return NextResponse.json(nft);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Blockchain action error:', error);
    return NextResponse.json(
      { error: 'Blockchain action failed' },
      { status: 500 }
    );
  }
}
