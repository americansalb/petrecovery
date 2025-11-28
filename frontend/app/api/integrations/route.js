import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { createIntegration, getUserIntegrations } from '@/app/lib/integrations';

// GET - List user's integrations
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const integrations = await getUserIntegrations(prisma, session.user.id);

    return NextResponse.json({ integrations });
  } catch (error) {
    console.error('List integrations error:', error);
    return NextResponse.json({ error: 'Failed to list integrations' }, { status: 500 });
  }
}

// POST - Create new integration
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, webhookUrl, caseId, squadId, name } = await request.json();

    if (!type || !webhookUrl) {
      return NextResponse.json(
        { error: 'Type and webhook URL required' },
        { status: 400 }
      );
    }

    if (!['SLACK', 'DISCORD'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid integration type' },
        { status: 400 }
      );
    }

    // Verify user has access to the case or squad
    if (caseId) {
      const caseAccess = await prisma.case.findFirst({
        where: {
          id: caseId,
          OR: [
            { reporterId: session.user.id },
            { participants: { some: { userId: session.user.id } } },
          ],
        },
      });

      if (!caseAccess) {
        return NextResponse.json(
          { error: 'No access to this case' },
          { status: 403 }
        );
      }
    }

    if (squadId) {
      const squadAccess = await prisma.rescueSquadMember.findFirst({
        where: {
          userId: session.user.id,
          rescueSquadId: squadId,
          role: { in: ['LEADER', 'COORDINATOR'] },
        },
      });

      if (!squadAccess) {
        return NextResponse.json(
          { error: 'Must be squad leader or coordinator' },
          { status: 403 }
        );
      }
    }

    const integration = await createIntegration(prisma, {
      userId: session.user.id,
      type,
      webhookUrl,
      caseId,
      squadId,
      name,
    });

    return NextResponse.json({ integration }, { status: 201 });
  } catch (error) {
    console.error('Create integration error:', error);

    if (error.message === 'Webhook verification failed') {
      return NextResponse.json(
        { error: 'Could not verify webhook URL' },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to create integration' }, { status: 500 });
  }
}
