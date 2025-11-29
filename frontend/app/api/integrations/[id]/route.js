import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { testIntegration, deactivateIntegration, deleteIntegration } from '@/app/lib/integrations';

// GET - Get integration details
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const integration = await prisma.integration.findUnique({
      where: { id: params.id },
      include: {
        case: {
          select: { id: true, petName: true, caseNumber: true },
        },
        rescueSquad: {
          select: { id: true, name: true },
        },
      },
    });

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    // Check ownership
    if (integration.createdById !== session.user.id) {
      // Check if admin
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });

      if (user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Remove webhook URL from response for security
    const config = integration.config ? JSON.parse(integration.config) : {};
    const safeConfig = {
      ...config,
      webhookUrl: config.webhookUrl ? '***configured***' : null,
    };

    return NextResponse.json({
      integration: {
        ...integration,
        config: JSON.stringify(safeConfig),
      },
    });
  } catch (error) {
    console.error('Get integration error:', error);
    return NextResponse.json({ error: 'Failed to get integration' }, { status: 500 });
  }
}

// PATCH - Update integration
export async function PATCH(request, { params }) {
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

    const { name, isActive } = await request.json();

    const updated = await prisma.integration.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ integration: updated });
  } catch (error) {
    console.error('Update integration error:', error);
    return NextResponse.json({ error: 'Failed to update integration' }, { status: 500 });
  }
}

// DELETE - Delete integration
export async function DELETE(request, { params }) {
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
      // Check if admin
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });

      if (user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    await deleteIntegration(prisma, params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete integration error:', error);
    return NextResponse.json({ error: 'Failed to delete integration' }, { status: 500 });
  }
}
