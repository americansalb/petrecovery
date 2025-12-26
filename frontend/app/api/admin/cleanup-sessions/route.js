/**
 * Admin endpoint to cleanup all stuck search sessions
 * GET /api/admin/cleanup-sessions
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';

export async function GET(request) {
  try {
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // End ALL active sessions globally
    const result = await prisma.searchSession.updateMany({
      where: {
        status: { in: ['READY', 'ACTIVE'] },
      },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
        endReason: 'ADMIN_CLEANUP',
      },
    });

    console.log(`[Admin Cleanup] Ended ${result.count} stuck sessions`);

    return NextResponse.json({
      success: true,
      cleanedCount: result.count,
      message: `Cleaned up ${result.count} stuck sessions`,
    });
  } catch (error) {
    console.error('[Admin Cleanup] Error:', error);
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
