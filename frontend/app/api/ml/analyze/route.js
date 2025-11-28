import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { analyzePetImage, detectBreed, extractColors } from '@/app/lib/ml/imageAnalysis';

/**
 * POST /api/ml/analyze
 * Analyze a pet image for breed detection and color extraction
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageUrl, species = 'dog', analysisType = 'full' } = await request.json();

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL required' }, { status: 400 });
    }

    let result;

    switch (analysisType) {
      case 'breed':
        result = await detectBreed(imageUrl, species);
        break;
      case 'colors':
        result = { colors: await extractColors(imageUrl, 5) };
        break;
      case 'full':
      default:
        result = await analyzePetImage(imageUrl, species);
        break;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('ML analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed', details: error.message },
      { status: 500 }
    );
  }
}
