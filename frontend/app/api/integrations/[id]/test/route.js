import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { testIntegration } from '@/app/lib/integrations';

// POST - Test integration
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const integration = await prisma.integration.findUnique({
      where: { id: params.id },
    });

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    // Check ownership
    if (integration.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const result = await testIntegration(prisma, params.id);

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? 'Test message sent successfully'
        : 'Failed to send test message',
    });
  } catch (error) {
    console.error('Test integration error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to test integration' },
      { status: 500 }
    );
  }
}
