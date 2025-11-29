import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  DEVICE_PROVIDERS,
  connectDeviceAccount,
  getPetLocation,
  getLocationHistory,
  createGeofence,
  startLiveTracking,
} from '@/app/lib/iot/devices';

/**
 * GET /api/iot/devices
 * Get device information or location data
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const deviceId = searchParams.get('deviceId');
    const provider = searchParams.get('provider');

    switch (action) {
      case 'list':
        return NextResponse.json({ providers: DEVICE_PROVIDERS });

      case 'location':
        if (!deviceId || !provider) {
          return NextResponse.json(
            { error: 'Device ID and provider required' },
            { status: 400 }
          );
        }
        const location = await getPetLocation(deviceId, provider);
        return NextResponse.json(location);

      case 'history':
        if (!deviceId || !provider) {
          return NextResponse.json(
            { error: 'Device ID and provider required' },
            { status: 400 }
          );
        }
        const history = await getLocationHistory(deviceId, provider, {
          startDate: searchParams.get('startDate'),
          endDate: searchParams.get('endDate'),
        });
        return NextResponse.json(history);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('IoT device error:', error);
    return NextResponse.json(
      { error: 'Failed to get device data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/iot/devices
 * Connect device, create geofence, or start tracking
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
      case 'connect':
        const connection = await connectDeviceAccount(
          session.user.id,
          body.provider,
          body.credentials
        );
        return NextResponse.json(connection);

      case 'geofence':
        const geofence = await createGeofence(
          body.deviceId,
          body.provider,
          body.geofenceData
        );
        return NextResponse.json(geofence);

      case 'live_tracking':
        const tracking = await startLiveTracking(
          body.deviceId,
          body.provider,
          body.caseId
        );
        return NextResponse.json(tracking);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('IoT action error:', error);
    return NextResponse.json(
      { error: 'IoT action failed' },
      { status: 500 }
    );
  }
}
