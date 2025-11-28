import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

/**
 * Health check endpoint for load balancers and monitoring
 */
export async function GET(request) {
  const startTime = Date.now();
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV,
    checks: {},
  };

  // Database check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.checks.database = { status: 'healthy', latency: Date.now() - startTime };
  } catch (error) {
    checks.checks.database = { status: 'unhealthy', error: error.message };
    checks.status = 'degraded';
  }

  // Redis check (if configured)
  if (process.env.REDIS_URL) {
    try {
      const { createClient } = await import('redis');
      const client = createClient({ url: process.env.REDIS_URL });
      await client.connect();
      await client.ping();
      await client.quit();
      checks.checks.redis = { status: 'healthy' };
    } catch (error) {
      checks.checks.redis = { status: 'unhealthy', error: error.message };
      // Redis failure is non-critical
    }
  }

  // Memory usage
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const memory = process.memoryUsage();
    checks.checks.memory = {
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(memory.rss / 1024 / 1024) + 'MB',
    };
  }

  checks.responseTime = Date.now() - startTime + 'ms';

  const httpStatus = checks.status === 'healthy' ? 200 : 503;

  return NextResponse.json(checks, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * Detailed health check (requires admin)
 */
export async function POST(request) {
  const startTime = Date.now();

  // Basic checks
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV,
    uptime: process.uptime ? `${Math.floor(process.uptime())}s` : 'unknown',
    checks: {},
    metrics: {},
  };

  // Database detailed check
  try {
    const dbStart = Date.now();
    const result = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "User"`;
    checks.checks.database = {
      status: 'healthy',
      latency: Date.now() - dbStart + 'ms',
      userCount: Number(result[0]?.count || 0),
    };
  } catch (error) {
    checks.checks.database = { status: 'unhealthy', error: error.message };
    checks.status = 'degraded';
  }

  // Active cases count
  try {
    const activeCases = await prisma.case.count({
      where: { status: { in: ['ACTIVE', 'IN_PROGRESS'] } },
    });
    checks.metrics.activeCases = activeCases;
  } catch (error) {
    checks.metrics.activeCases = 'error';
  }

  // Today's activity
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [newCases, newUsers, sightings] = await Promise.all([
      prisma.case.count({ where: { createdAt: { gte: today } } }),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.sighting.count({ where: { createdAt: { gte: today } } }),
    ]);

    checks.metrics.today = {
      newCases,
      newUsers,
      sightings,
    };
  } catch (error) {
    checks.metrics.today = 'error';
  }

  // System resources
  if (typeof process !== 'undefined') {
    const memory = process.memoryUsage();
    checks.system = {
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
        rssMB: Math.round(memory.rss / 1024 / 1024),
      },
      uptime: Math.floor(process.uptime()) + 's',
    };
  }

  checks.responseTime = Date.now() - startTime + 'ms';

  return NextResponse.json(checks, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
