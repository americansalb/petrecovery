import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/admin/shelters
 *
 * List all shelters in database with filtering and pagination.
 * Admin only.
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const search = searchParams.get('search');
    const type = searchParams.get('type');
    const state = searchParams.get('state');
    const city = searchParams.get('city');

    // Build where clause
    const where = { isActive: true };

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (type) {
      where.type = type;
    }
    if (state) {
      where.state = state.toUpperCase();
    }
    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }

    // Get shelters with pagination
    const [shelters, total] = await Promise.all([
      prisma.shelter.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ state: 'asc' }, { city: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          type: true,
          address: true,
          city: true,
          state: true,
          zipCode: true,
          phone: true,
          email: true,
          website: true,
          hours: true,
          latitude: true,
          longitude: true,
          source: true,
          fetchedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.shelter.count({ where }),
    ]);

    // Get stats
    const [totalAll, withPhone, withEmail, withWebsite, withHours, citiesCount] = await Promise.all([
      prisma.shelter.count({ where: { isActive: true } }),
      prisma.shelter.count({ where: { isActive: true, AND: [{ phone: { not: null } }, { phone: { not: '' } }] } }),
      prisma.shelter.count({ where: { isActive: true, AND: [{ email: { not: null } }, { email: { not: '' } }] } }),
      prisma.shelter.count({ where: { isActive: true, AND: [{ website: { not: null } }, { website: { not: '' } }] } }),
      prisma.shelter.count({ where: { isActive: true, hours: { not: null } } }),
      prisma.shelter.groupBy({
        by: ['city', 'state'],
        where: { isActive: true },
      }),
    ]);

    return NextResponse.json({
      shelters,
      total,
      page,
      limit,
      stats: {
        total: totalAll,
        withPhone,
        withEmail,
        withWebsite,
        withHours,
        cities: citiesCount.length,
      },
    });
  } catch (error) {
    console.error('Admin shelters error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shelters', details: error.message },
      { status: 500 }
    );
  }
}
