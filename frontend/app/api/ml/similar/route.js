import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { findSimilarPets, generateImageEmbedding } from '@/app/lib/ml/imageAnalysis';

/**
 * POST /api/ml/similar
 * Find similar pets based on image
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageUrl, species, limit = 10, minSimilarity = 0.5 } = await request.json();

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL required' }, { status: 400 });
    }

    const similarPets = await findSimilarPets(prisma, imageUrl, {
      species,
      limit,
      minSimilarity,
    });

    return NextResponse.json({
      matches: similarPets,
      count: similarPets.length,
    });
  } catch (error) {
    console.error('Similar pets search error:', error);
    return NextResponse.json(
      { error: 'Search failed', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/ml/similar
 * Update/generate embedding for a case
 */
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { caseId } = await request.json();

    if (!caseId) {
      return NextResponse.json({ error: 'Case ID required' }, { status: 400 });
    }

    // Get case
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, petPhotoUrl: true, reporterId: true },
    });

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Check ownership or admin
    if (caseData.reporterId !== session.user.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });
      if (user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Generate embedding
    const embedding = await generateImageEmbedding(caseData.petPhotoUrl);

    if (!embedding) {
      return NextResponse.json({ error: 'Failed to generate embedding' }, { status: 500 });
    }

    // Note: Would need to add imageEmbedding field to Case model
    // For now, store in metadata or separate table

    return NextResponse.json({
      success: true,
      caseId,
      embeddingSize: embedding.length,
    });
  } catch (error) {
    console.error('Embedding generation error:', error);
    return NextResponse.json(
      { error: 'Failed to update embedding', details: error.message },
      { status: 500 }
    );
  }
}
