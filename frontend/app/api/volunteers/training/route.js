import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// Training modules
const TRAINING_MODULES = [
  {
    id: 'intro-101',
    title: 'Introduction to Pet Search & Rescue',
    description: 'Learn the basics of organized pet search operations',
    duration: 30, // minutes
    type: 'video',
    requiredFor: ['BASIC_SEARCH'],
    order: 1,
  },
  {
    id: 'safety-101',
    title: 'Search Safety Fundamentals',
    description: 'Essential safety protocols for search volunteers',
    duration: 20,
    type: 'video',
    requiredFor: ['BASIC_SEARCH'],
    order: 2,
  },
  {
    id: 'animal-behavior',
    title: 'Understanding Lost Pet Behavior',
    description: 'How dogs and cats behave when lost',
    duration: 45,
    type: 'video',
    requiredFor: ['BASIC_SEARCH', 'ADVANCED_SEARCH'],
    order: 3,
  },
  {
    id: 'search-patterns',
    title: 'Search Patterns & Techniques',
    description: 'Effective grid search and area coverage methods',
    duration: 40,
    type: 'interactive',
    requiredFor: ['BASIC_SEARCH'],
    order: 4,
  },
  {
    id: 'communication',
    title: 'Team Communication',
    description: 'Using the app and coordinating with your team',
    duration: 25,
    type: 'video',
    requiredFor: ['BASIC_SEARCH'],
    order: 5,
  },
  {
    id: 'advanced-tracking',
    title: 'Advanced Tracking Techniques',
    description: 'Sign cutting, tracking, and trail following',
    duration: 60,
    type: 'video',
    requiredFor: ['ADVANCED_SEARCH'],
    order: 6,
  },
  {
    id: 'night-search',
    title: 'Night Search Operations',
    description: 'Safe and effective nighttime search procedures',
    duration: 45,
    type: 'video',
    requiredFor: ['NIGHT_SEARCH'],
    order: 7,
  },
  {
    id: 'trap-basics',
    title: 'Humane Trap Setup & Monitoring',
    description: 'Proper use of humane traps for pet recovery',
    duration: 50,
    type: 'video',
    requiredFor: ['TRAP_HANDLING'],
    order: 8,
  },
  {
    id: 'pet-first-aid',
    title: 'Pet First Aid Basics',
    description: 'Emergency care for recovered pets',
    duration: 90,
    type: 'video',
    requiredFor: ['FIRST_AID_PET'],
    order: 9,
  },
  {
    id: 'leadership',
    title: 'Force Leadership Training',
    description: 'Leading and coordinating search teams',
    duration: 60,
    type: 'interactive',
    requiredFor: ['SQUAD_LEADER'],
    order: 10,
  },
];

/**
 * GET /api/volunteers/training
 * Get training modules and user progress
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const certification = searchParams.get('certification');

    let modules = [...TRAINING_MODULES];

    // Filter by certification requirement
    if (certification) {
      modules = modules.filter(m => m.requiredFor.includes(certification));
    }

    // Add user progress if authenticated
    if (session?.user?.id) {
      const progress = await prisma.trainingProgress.findMany({
        where: { userId: session.user.id },
      });

      const progressMap = new Map(progress.map(p => [p.moduleId, p]));

      modules = modules.map(module => ({
        ...module,
        progress: progressMap.get(module.id) || null,
        completed: progressMap.get(module.id)?.completedAt != null,
        percentComplete: progressMap.get(module.id)?.percentComplete || 0,
      }));
    }

    // Calculate overall progress
    const completedCount = modules.filter(m => m.completed).length;
    const overallProgress = modules.length > 0
      ? Math.round((completedCount / modules.length) * 100)
      : 0;

    return NextResponse.json({
      modules,
      stats: {
        total: modules.length,
        completed: completedCount,
        overallProgress,
      },
    });
  } catch (error) {
    console.error('Get training error:', error);
    return NextResponse.json({ error: 'Failed to get training' }, { status: 500 });
  }
}

/**
 * POST /api/volunteers/training
 * Update training progress
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { moduleId, percentComplete, action } = await request.json();

    if (!moduleId) {
      return NextResponse.json({ error: 'Module ID required' }, { status: 400 });
    }

    const module = TRAINING_MODULES.find(m => m.id === moduleId);
    if (!module) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    if (action === 'start') {
      // Start or resume module
      const progress = await prisma.trainingProgress.upsert({
        where: {
          userId_moduleId: {
            userId: session.user.id,
            moduleId,
          },
        },
        update: {
          lastAccessedAt: new Date(),
        },
        create: {
          userId: session.user.id,
          moduleId,
          percentComplete: 0,
          startedAt: new Date(),
        },
      });

      return NextResponse.json({ progress });
    }

    if (action === 'progress') {
      // Update progress
      const progress = await prisma.trainingProgress.upsert({
        where: {
          userId_moduleId: {
            userId: session.user.id,
            moduleId,
          },
        },
        update: {
          percentComplete: Math.min(100, percentComplete || 0),
          lastAccessedAt: new Date(),
        },
        create: {
          userId: session.user.id,
          moduleId,
          percentComplete: Math.min(100, percentComplete || 0),
          startedAt: new Date(),
        },
      });

      return NextResponse.json({ progress });
    }

    if (action === 'complete') {
      // Mark as complete
      const progress = await prisma.trainingProgress.upsert({
        where: {
          userId_moduleId: {
            userId: session.user.id,
            moduleId,
          },
        },
        update: {
          percentComplete: 100,
          completedAt: new Date(),
          lastAccessedAt: new Date(),
        },
        create: {
          userId: session.user.id,
          moduleId,
          percentComplete: 100,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });

      // Check if user completed all required modules for any certification
      const completedModules = await prisma.trainingProgress.findMany({
        where: {
          userId: session.user.id,
          completedAt: { not: null },
        },
        select: { moduleId: true },
      });

      const completedIds = new Set(completedModules.map(m => m.moduleId));
      const earnedCertifications = [];

      // Check each certification
      const certTypes = ['BASIC_SEARCH', 'ADVANCED_SEARCH', 'NIGHT_SEARCH', 'TRAP_HANDLING', 'FIRST_AID_PET', 'SQUAD_LEADER'];

      for (const certType of certTypes) {
        const requiredModules = TRAINING_MODULES.filter(m => m.requiredFor.includes(certType));
        const allCompleted = requiredModules.every(m => completedIds.has(m.id));

        if (allCompleted) {
          // Check if already has this certification
          const existing = await prisma.volunteerCertification.findFirst({
            where: {
              userId: session.user.id,
              type: certType,
              status: 'ACTIVE',
            },
          });

          if (!existing) {
            earnedCertifications.push(certType);
          }
        }
      }

      return NextResponse.json({
        progress,
        earnedCertifications,
        message: earnedCertifications.length > 0
          ? `Congratulations! You've earned: ${earnedCertifications.join(', ')}`
          : 'Module completed!',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Update training error:', error);
    return NextResponse.json({ error: 'Failed to update training' }, { status: 500 });
  }
}
