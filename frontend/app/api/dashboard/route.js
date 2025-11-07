import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { getServerSession } from 'next-auth';

// NOTE: Requires Prisma to be set up (see SETUP.md)

export async function GET(request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        patrolProfile: true,
        lostReports: {
          where: { status: 'ACTIVE' },
          include: {
            pet: true,
            sightings: true,
          }
        },
        profile: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Format reports for display - show REAL count (0 if none)
    const reports = user.lostReports.map(report => ({
      id: report.id,
      petName: report.pet.name,
      species: report.pet.species.toLowerCase(),
      lastSeen: formatTime(report.lastSeenAt),
      sightings: report.sightings.length, // REAL count
      status: report.status,
    }));

    // If patrol member, find nearby alerts
    let nearbyAlerts = [];
    if (user.patrolProfile && user.profile) {
      const { latitude, longitude } = user.profile;
      const { radiusMiles } = user.patrolProfile;

      // Get all active reports (REAL data from database)
      const allReports = await prisma.lostReport.findMany({
        where: {
          status: 'ACTIVE',
          reporterId: { not: user.id }, // Don't show own reports
        },
        include: {
          pet: true,
        },
      });

      // Filter by distance - show REAL count (0 if none nearby)
      nearbyAlerts = allReports
        .map(report => {
          const distance = calculateDistance(
            latitude, longitude,
            report.lastSeenLatitude, report.lastSeenLongitude
          );
          return { ...report, distance };
        })
        .filter(report => report.distance <= radiusMiles)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10)
        .map(report => ({
          id: report.id,
          petName: report.pet.name,
          species: report.pet.species.toLowerCase(),
          lastSeen: formatTime(report.lastSeenAt),
          distance: `${report.distance.toFixed(1)} miles`,
        }));
    }

    return NextResponse.json({
      mode: user.patrolProfile ? 'patrol' : 'owner',
      reports, // Will be [] if no reports - NOT fake data
      nearbyAlerts, // Will be [] if no nearby alerts - NOT fake data
    });

  } catch (error) {
    console.error('❌ Dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to load dashboard', details: error.message },
      { status: 500 }
    );
  }
}

function formatTime(date) {
  const now = new Date();
  const diff = now - new Date(date);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return 'Less than an hour ago';
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return `${days} day${days > 1 ? 's' : ''} ago`;
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
