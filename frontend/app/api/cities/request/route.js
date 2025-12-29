import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

// Rate limiting: max 5 requests per IP per hour
const rateLimitMap = new Map();
const RATE_LIMIT = 5;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now - record.firstRequest > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, firstRequest: now });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

// POST /api/cities/request - Submit a city request
export async function POST(request) {
  try {
    const body = await request.json();
    const { cityName } = body;

    if (!cityName || cityName.trim().length < 2) {
      return NextResponse.json(
        { error: 'City name is required (min 2 characters)' },
        { status: 400 }
      );
    }

    // Get user IP for rate limiting
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown';

    // Check rate limit
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Get user if logged in
    let userId = null;
    try {
      const session = await getServerSession(authOptions);
      userId = session?.user?.id || null;
    } catch {
      // Not logged in, that's fine
    }

    const trimmedCity = cityName.trim();

    // Check for duplicate pending requests (same city name)
    const existing = await prisma.cityRequest.findFirst({
      where: {
        cityName: { equals: trimmedCity, mode: 'insensitive' },
        status: 'PENDING',
      },
    });

    if (existing) {
      // Still return success - don't reveal if already requested
      return NextResponse.json({
        success: true,
        message: 'Request submitted for review',
      });
    }

    // Create the city request
    await prisma.cityRequest.create({
      data: {
        cityName: trimmedCity,
        userIp: ip,
        userId,
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Request submitted for review',
    });
  } catch (error) {
    console.error('City request error:', error);
    return NextResponse.json(
      { error: 'Failed to submit request' },
      { status: 500 }
    );
  }
}

// GET /api/cities/request - Admin endpoint to list pending requests
export async function GET(request) {
  try {
    // Check for admin auth
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';
    const limit = parseInt(searchParams.get('limit')) || 50;

    const requests = await prisma.cityRequest.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Group by city name for easier review
    const grouped = {};
    for (const req of requests) {
      const key = req.cityName.toLowerCase();
      if (!grouped[key]) {
        grouped[key] = {
          cityName: req.cityName,
          count: 0,
          requests: [],
        };
      }
      grouped[key].count++;
      grouped[key].requests.push(req);
    }

    return NextResponse.json({
      requests: Object.values(grouped).sort((a, b) => b.count - a.count),
      total: requests.length,
    });
  } catch (error) {
    console.error('City request list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    );
  }
}
