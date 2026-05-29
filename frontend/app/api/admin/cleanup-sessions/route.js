/**
 * Admin endpoint to cleanup all stuck search sessions
 * GET /api/admin/cleanup-sessions
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { isAdmin } from '@/app/lib/authz';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Force-completes ALL active searches globally → admin-only (fresh role).
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
