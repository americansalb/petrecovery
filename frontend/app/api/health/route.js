import { NextResponse } from 'next/server';

/**
 * Health check endpoint for load balancers and monitoring
 * IMPORTANT: This must be FAST - no database checks on basic health
 * Deployment health checks need instant responses
 */
export async function GET(request) {
  // Fast path: Basic health check for deployment/load balancers
  // No database check - just confirm the app is running
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}

/**
 * Detailed health check with database (requires explicit POST)
 */
export async function POST(request) {
  const startTime = Date.now();
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV,
    checks: {},
  };

  // Only check database on explicit POST request
  try {
    const prisma = (await import('@/app/lib/prisma')).default;
    await prisma.$queryRaw`SELECT 1`;
    checks.checks.database = { status: 'healthy', latency: Date.now() - startTime };
  } catch (error) {
    checks.checks.database = { status: 'unhealthy', error: error.message };
    checks.status = 'degraded';
  }

  // Memory usage
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const memory = process.memoryUsage();
    checks.checks.memory = {
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + 'MB',
    };
  }

  checks.responseTime = Date.now() - startTime + 'ms';

  return NextResponse.json(checks, {
    status: checks.status === 'healthy' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
