import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * POST /api/admin/prisma-generate
 *
 * Regenerates Prisma client after schema changes
 * Admin-only endpoint for emergency Prisma client regeneration
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    // Only allow authenticated users
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('[PRISMA-GENERATE] Starting Prisma client generation...');
    console.log('[PRISMA-GENERATE] User:', session.user.email);

    try {
      // Run prisma generate
      const { stdout, stderr } = await execAsync('npx prisma generate', {
        cwd: process.cwd(),
        timeout: 60000, // 60 second timeout
      });

      console.log('[PRISMA-GENERATE] stdout:', stdout);
      if (stderr) {
        console.log('[PRISMA-GENERATE] stderr:', stderr);
      }

      console.log('[PRISMA-GENERATE] Prisma client regenerated successfully!');

      return NextResponse.json({
        success: true,
        message: 'Prisma client regenerated successfully',
        output: stdout,
      });

    } catch (execError) {
      console.error('[PRISMA-GENERATE] Execution error:', execError);

      return NextResponse.json(
        {
          error: 'Prisma generation failed',
          details: execError.message,
          stdout: execError.stdout,
          stderr: execError.stderr,
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[PRISMA-GENERATE] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to regenerate Prisma client',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
