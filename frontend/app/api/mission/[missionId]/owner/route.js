/**
 * Owner Hub API
 * GET: Get owner view
 * POST: Update status, call mode, thank you
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import {
  getOwnerView,
  updateOwnerStatus,
  uploadVoiceClip,
  triggerCallMode,
  stopCallMode,
  sendThankYou,
  getFilteredSightings,
} from '@/app/lib/missionControl/ownerHub';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { missionId } = params;
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view');

    const mission = await prisma.missionControl.findUnique({
      where: { caseId: missionId },
      select: { id: true }
    });

    if (!mission) {
      return NextResponse.json(
        { error: 'Mission not found' },
        { status: 404 }
      );
    }

    if (view === 'sightings') {
      const result = await getFilteredSightings(mission.id, session.user.id);
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 403 });
      }
      return NextResponse.json(result);
    }

    const ownerView = await getOwnerView(mission.id, session.user.id);

    if (ownerView.error) {
      return NextResponse.json(
        { error: ownerView.error },
        { status: ownerView.error === 'Unauthorized' ? 403 : 404 }
      );
    }

    return NextResponse.json(ownerView);
  } catch (error) {
    console.error('Error getting owner view:', error);
    return NextResponse.json(
      { error: 'Failed to get owner view' },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { missionId } = params;
    const body = await request.json();
    const { action, ...data } = body;

    const mission = await prisma.missionControl.findUnique({
      where: { caseId: missionId },
      select: { id: true }
    });

    if (!mission) {
      return NextResponse.json(
        { error: 'Mission not found' },
        { status: 404 }
      );
    }

    let result;

    switch (action) {
      case 'UPDATE_STATUS':
        result = await updateOwnerStatus(mission.id, session.user.id, {
          location: data.location,
          activity: data.activity,
          broadcast: data.broadcast,
        });
        break;

      case 'UPLOAD_VOICE':
        result = await uploadVoiceClip(mission.id, session.user.id, data.audioUrl);
        break;

      case 'TRIGGER_CALL_MODE':
        result = await triggerCallMode(mission.id, session.user.id);
        break;

      case 'STOP_CALL_MODE':
        result = await stopCallMode(mission.id);
        break;

      case 'SEND_THANK_YOU':
        result = await sendThankYou(
          mission.id,
          session.user.id,
          data.message,
          data.photoUrl
        );
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error with owner action:', error);
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    );
  }
}
