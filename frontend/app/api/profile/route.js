import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { getServerSession } from 'next-auth';

// GET endpoint to fetch user profile and settings
export async function GET(request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        profile: true,
        patrolProfile: true,
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      },
      profile: user.profile ? {
        latitude: user.profile.latitude,
        longitude: user.profile.longitude,
        address: user.profile.address,
        city: user.profile.city,
        state: user.profile.state,
        zip: user.profile.zip,
        country: user.profile.country,
        timezone: user.profile.timezone,
        notificationsEnabled: user.profile.notificationsEnabled,
      } : null,
      patrolProfile: user.patrolProfile ? {
        isActive: user.patrolProfile.isActive,
        isPaused: user.patrolProfile.isPaused,
        radiusMiles: user.patrolProfile.radiusMiles,
        alertMethod: user.patrolProfile.alertMethod,
        instantAlerts: user.patrolProfile.instantAlerts,
        searchesDogs: user.patrolProfile.searchesDogs,
        searchesCats: user.patrolProfile.searchesCats,
        searchesBirds: user.patrolProfile.searchesBirds,
        searchesOther: user.patrolProfile.searchesOther,
        joinedAt: user.patrolProfile.joinedAt,
        searchCount: user.patrolProfile.searchCount,
        recoveryCount: user.patrolProfile.recoveryCount,
        points: user.patrolProfile.points,
        level: user.patrolProfile.level,
      } : null,
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// PATCH endpoint to update user profile
export async function PATCH(request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { firstName, lastName, phone } = body;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Update user fields
    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        phone: updatedUser.phone,
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
