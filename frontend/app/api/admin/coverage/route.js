import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/admin/coverage
 *
 * Everything the coverage map plots: areas that have active community groups
 * (one point per swept city, with its group count) and every active shelter
 * with coordinates. The gaps between the points ARE the finding; the map
 * makes unfilled regions visible so admins know where to pre-warm the group
 * directory or recruit shelters. Admin only.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const [groupRows, shelters, forces] = await Promise.all([
      prisma.communityGroup.findMany({
        where: { status: 'ACTIVE' },
        select: { city: true, state: true, areaLat: true, areaLng: true, category: true, name: true },
      }),
      prisma.shelter.findMany({
        where: { isActive: true, latitude: { not: null }, longitude: { not: null } },
        select: { id: true, name: true, city: true, state: true, latitude: true, longitude: true, type: true },
        take: 3000,
      }),
      prisma.rescueForce.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          city: true,
          state: true,
          coverageType: true,
          centerLatitude: true,
          centerLongitude: true,
          radiusMiles: true,
          customBoundary: true,
        },
        take: 1000,
      }),
    ]);

    // One point per swept area; groups without coordinates are counted
    // separately so the page can say "N areas not mappable yet".
    const areaByKey = new Map();
    let unmappedGroups = 0;
    for (const g of groupRows) {
      if (!Number.isFinite(g.areaLat) || !Number.isFinite(g.areaLng)) {
        unmappedGroups += 1;
        continue;
      }
      const key = `${g.city}|${g.state}`;
      const area = areaByKey.get(key) || {
        city: g.city,
        state: g.state,
        lat: g.areaLat,
        lng: g.areaLng,
        groups: 0,
        lostPet: 0,
        community: 0,
        names: [],
      };
      area.groups += 1;
      if (g.category === 'COMMUNITY') area.community += 1;
      else area.lostPet += 1;
      if (area.names.length < 10) area.names.push(g.name);
      areaByKey.set(key, area);
    }

    // A force is drawable with either its exact custom polygon or a
    // center + radius circle; anything with neither is skipped.
    const drawableForces = forces
      .filter(
        (f) =>
          Boolean(f.customBoundary) ||
          (Number.isFinite(f.centerLatitude) && Number.isFinite(f.centerLongitude))
      )
      .map((f) => ({
        id: f.id,
        name: f.name,
        city: f.city,
        state: f.state,
        lat: f.centerLatitude,
        lng: f.centerLongitude,
        radiusMiles: f.radiusMiles,
        boundary: f.customBoundary || null,
      }));

    return NextResponse.json(
      {
        areas: [...areaByKey.values()],
        unmappedGroups,
        shelters,
        forces: drawableForces,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Admin coverage error:', error);
    return NextResponse.json({ error: 'Failed to load coverage', details: error.message }, { status: 500 });
  }
}
