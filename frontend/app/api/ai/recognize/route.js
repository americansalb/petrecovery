import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  extractPetFacialFeatures,
  comparePetFaces,
  analyzeVideo,
  detectDuplicateCases,
} from '@/app/lib/ai/petRecognition';

/**
 * POST /api/ai/recognize
 * Pet facial recognition and matching
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, imageUrl, videoUrl, embedding1, embedding2, species } = body;

    switch (action) {
      case 'extract_features':
        const features = await extractPetFacialFeatures(imageUrl, species);
        return NextResponse.json(features);

      case 'compare':
        const comparison = await comparePetFaces(embedding1, embedding2);
        return NextResponse.json(comparison);

      case 'analyze_video':
        const videoAnalysis = await analyzeVideo(videoUrl, body.targetPet);
        return NextResponse.json(videoAnalysis);

      case 'detect_duplicates':
        const duplicates = await detectDuplicateCases(
          body.newCaseImages,
          body.existingCases
        );
        return NextResponse.json({ duplicates });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('AI recognition error:', error);
    return NextResponse.json(
      { error: 'Recognition failed' },
      { status: 500 }
    );
  }
}
