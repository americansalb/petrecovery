import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/user/linked-accounts
 *
 * Get the current user's linked OAuth accounts.
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const accounts = await prisma.account.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        provider: true,
        providerAccountId: true,
        createdAt: true,
      },
    });

    // Map to frontend-friendly format
    const linkedProviders = accounts.map((account) => ({
      id: account.id,
      provider: account.provider,
      linkedAt: account.createdAt,
    }));

    return NextResponse.json({ accounts: linkedProviders });
  } catch (error) {
    console.error('Error fetching linked accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch linked accounts' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/linked-accounts
 *
 * Unlink an OAuth account from the current user.
 */
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      );
    }

    // Check if user has a password set (can still log in after unlinking)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { accounts: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const hasPassword = !!user.passwordHash;
    const otherAccounts = user.accounts.filter((acc) => acc.provider !== provider);

    // Prevent unlinking if it's the only auth method
    if (!hasPassword && otherAccounts.length === 0) {
      return NextResponse.json(
        {
          error: 'Cannot unlink account',
          message: 'This is your only login method. Please set a password first.',
        },
        { status: 400 }
      );
    }

    // Delete the account link
    await prisma.account.deleteMany({
      where: {
        userId: session.user.id,
        provider,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${provider} account unlinked successfully`,
    });
  } catch (error) {
    console.error('Error unlinking account:', error);
    return NextResponse.json(
      { error: 'Failed to unlink account' },
      { status: 500 }
    );
  }
}
