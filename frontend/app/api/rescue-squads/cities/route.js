import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

// GET /api/rescue-squads/cities - Autocomplete city names
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ cities: [] });
    }

    // Search for rescue squads with city names matching the query
    const squads = await prisma.rescueSquad.findMany({
      where: {
        city: {
          contains: query.trim(),
          mode: 'insensitive'
        },
        isActive: true
      },
      select: {
        city: true,
        state: true,
        _count: {
          select: { members: true }
        }
      },
      distinct: ['city', 'state'],
      take: 10
    });

    const cities = squads.map(squad => ({
      name: squad.city,
      state: squad.state,
      memberCount: squad._count.members
    }));

    return NextResponse.json({ cities });
  } catch (error) {
    console.error('Error fetching city suggestions:', error);
    return NextResponse.json({ cities: [] });
  }
}
