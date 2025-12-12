import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import {
  initARSession,
  generateARMarkers,
  generate3DPetModel,
  scanPoster,
  detectAnimalsInFrame,
  generateARPoster,
} from '@/app/lib/ar/visualization';

/**
 * POST /api/ar/session
 * AR session management and features
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
      case 'init':
        const arSession = await initARSession({
          missionId: body.missionId,
          userId: session.user.id,
          enablePosterRecognition: body.enablePosterRecognition,
          enableAnimalDetection: body.enableAnimalDetection,
        });
        return NextResponse.json(arSession);

      case 'markers':
        const markers = await generateARMarkers(body.missionData);
        return NextResponse.json({ markers });

      case 'model':
        const model = await generate3DPetModel(body.petData);
        return NextResponse.json(model);

      case 'scan_poster':
        const posterResult = await scanPoster(body.imageData);
        return NextResponse.json(posterResult);

      case 'detect':
        const detections = await detectAnimalsInFrame(
          body.frameData,
          body.targetPet
        );
        return NextResponse.json(detections);

      case 'generate_poster':
        const poster = await generateARPoster(body.missionData);
        return NextResponse.json(poster);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('AR error:', error);
    return NextResponse.json(
      { error: 'AR action failed' },
      { status: 500 }
    );
  }
}
