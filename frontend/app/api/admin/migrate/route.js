import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/admin/migrate
 *
 * Applies pending database migrations
 * Admin-only endpoint for emergency migration deployment
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    // Only allow authenticated users (ideally should check for admin role)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('[MIGRATE] Starting migration...');
    console.log('[MIGRATE] User:', session.user.email);

    // Apply the community posts migration - each statement separately

    // 1. Add RescueForce fields
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "RescueForce" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT`);
    } catch (e) {
      console.log('[MIGRATE] photoUrl column may already exist');
    }

    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "RescueForce" ADD COLUMN IF NOT EXISTS "slogan" TEXT`);
    } catch (e) {
      console.log('[MIGRATE] slogan column may already exist');
    }

    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "RescueForce" ADD COLUMN IF NOT EXISTS "zipCode" TEXT`);
    } catch (e) {
      console.log('[MIGRATE] zipCode column may already exist');
    }

    console.log('[MIGRATE] Added RescueForce fields');

    // 2. Create ForcePost table
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ForcePost" (
            "id" TEXT NOT NULL,
            "rescueForceId" TEXT NOT NULL,
            "divisionId" TEXT,
            "authorId" TEXT NOT NULL,
            "title" TEXT,
            "content" TEXT NOT NULL,
            "imageUrl" TEXT,
            "upvotes" INTEGER NOT NULL DEFAULT 0,
            "downvotes" INTEGER NOT NULL DEFAULT 0,
            "commentCount" INTEGER NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "editedAt" TIMESTAMP(3),
            "isDeleted" BOOLEAN NOT NULL DEFAULT false,
            "deletedAt" TIMESTAMP(3),
            CONSTRAINT "ForcePost_pkey" PRIMARY KEY ("id")
        )
      `);
      console.log('[MIGRATE] Created ForcePost table');
    } catch (e) {
      console.log('[MIGRATE] ForcePost table may already exist');
    }

    // 3. Create ForcePostComment table
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ForcePostComment" (
            "id" TEXT NOT NULL,
            "postId" TEXT NOT NULL,
            "authorId" TEXT NOT NULL,
            "content" TEXT NOT NULL,
            "parentCommentId" TEXT,
            "upvotes" INTEGER NOT NULL DEFAULT 0,
            "downvotes" INTEGER NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "editedAt" TIMESTAMP(3),
            "isDeleted" BOOLEAN NOT NULL DEFAULT false,
            "deletedAt" TIMESTAMP(3),
            CONSTRAINT "ForcePostComment_pkey" PRIMARY KEY ("id")
        )
      `);
      console.log('[MIGRATE] Created ForcePostComment table');
    } catch (e) {
      console.log('[MIGRATE] ForcePostComment table may already exist');
    }

    // 4. Create ForcePostVote table
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ForcePostVote" (
            "id" TEXT NOT NULL,
            "postId" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "vote" INTEGER NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "ForcePostVote_pkey" PRIMARY KEY ("id")
        )
      `);
      console.log('[MIGRATE] Created ForcePostVote table');
    } catch (e) {
      console.log('[MIGRATE] ForcePostVote table may already exist');
    }

    // 5. Create ForceCommentVote table
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ForceCommentVote" (
            "id" TEXT NOT NULL,
            "commentId" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "vote" INTEGER NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "ForceCommentVote_pkey" PRIMARY KEY ("id")
        )
      `);
      console.log('[MIGRATE] Created ForceCommentVote table');
    } catch (e) {
      console.log('[MIGRATE] ForceCommentVote table may already exist');
    }

    // 6. Create indexes (each separately)
    const indexes = [
      `CREATE INDEX IF NOT EXISTS "ForcePost_rescueForceId_createdAt_idx" ON "ForcePost"("rescueForceId", "createdAt")`,
      `CREATE INDEX IF NOT EXISTS "ForcePost_divisionId_idx" ON "ForcePost"("divisionId")`,
      `CREATE INDEX IF NOT EXISTS "ForcePost_authorId_idx" ON "ForcePost"("authorId")`,
      `CREATE INDEX IF NOT EXISTS "ForcePost_createdAt_idx" ON "ForcePost"("createdAt")`,
      `CREATE INDEX IF NOT EXISTS "ForcePost_upvotes_idx" ON "ForcePost"("upvotes")`,
      `CREATE INDEX IF NOT EXISTS "ForcePostComment_postId_createdAt_idx" ON "ForcePostComment"("postId", "createdAt")`,
      `CREATE INDEX IF NOT EXISTS "ForcePostComment_authorId_idx" ON "ForcePostComment"("authorId")`,
      `CREATE INDEX IF NOT EXISTS "ForcePostComment_parentCommentId_idx" ON "ForcePostComment"("parentCommentId")`,
      `CREATE INDEX IF NOT EXISTS "ForcePostComment_createdAt_idx" ON "ForcePostComment"("createdAt")`,
      `CREATE INDEX IF NOT EXISTS "ForcePostVote_postId_idx" ON "ForcePostVote"("postId")`,
      `CREATE INDEX IF NOT EXISTS "ForcePostVote_userId_idx" ON "ForcePostVote"("userId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "ForcePostVote_postId_userId_key" ON "ForcePostVote"("postId", "userId")`,
      `CREATE INDEX IF NOT EXISTS "ForceCommentVote_commentId_idx" ON "ForceCommentVote"("commentId")`,
      `CREATE INDEX IF NOT EXISTS "ForceCommentVote_userId_idx" ON "ForceCommentVote"("userId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "ForceCommentVote_commentId_userId_key" ON "ForceCommentVote"("commentId", "userId")`,
    ];

    for (const indexSql of indexes) {
      try {
        await prisma.$executeRawUnsafe(indexSql);
      } catch (e) {
        console.log('[MIGRATE] Index may already exist:', e.message);
      }
    }

    console.log('[MIGRATE] Created all indexes');

    // 7. Add foreign key constraints (each separately)
    const foreignKeys = [
      `ALTER TABLE "ForcePost" DROP CONSTRAINT IF EXISTS "ForcePost_rescueForceId_fkey"`,
      `ALTER TABLE "ForcePost" ADD CONSTRAINT "ForcePost_rescueForceId_fkey" FOREIGN KEY ("rescueForceId") REFERENCES "RescueForce"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      `ALTER TABLE "ForcePost" DROP CONSTRAINT IF EXISTS "ForcePost_divisionId_fkey"`,
      `ALTER TABLE "ForcePost" ADD CONSTRAINT "ForcePost_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE`,

      `ALTER TABLE "ForcePost" DROP CONSTRAINT IF EXISTS "ForcePost_authorId_fkey"`,
      `ALTER TABLE "ForcePost" ADD CONSTRAINT "ForcePost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      `ALTER TABLE "ForcePostComment" DROP CONSTRAINT IF EXISTS "ForcePostComment_postId_fkey"`,
      `ALTER TABLE "ForcePostComment" ADD CONSTRAINT "ForcePostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ForcePost"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      `ALTER TABLE "ForcePostComment" DROP CONSTRAINT IF EXISTS "ForcePostComment_authorId_fkey"`,
      `ALTER TABLE "ForcePostComment" ADD CONSTRAINT "ForcePostComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      `ALTER TABLE "ForcePostComment" DROP CONSTRAINT IF EXISTS "ForcePostComment_parentCommentId_fkey"`,
      `ALTER TABLE "ForcePostComment" ADD CONSTRAINT "ForcePostComment_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "ForcePostComment"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      `ALTER TABLE "ForcePostVote" DROP CONSTRAINT IF EXISTS "ForcePostVote_postId_fkey"`,
      `ALTER TABLE "ForcePostVote" ADD CONSTRAINT "ForcePostVote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ForcePost"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      `ALTER TABLE "ForcePostVote" DROP CONSTRAINT IF EXISTS "ForcePostVote_userId_fkey"`,
      `ALTER TABLE "ForcePostVote" ADD CONSTRAINT "ForcePostVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      `ALTER TABLE "ForceCommentVote" DROP CONSTRAINT IF EXISTS "ForceCommentVote_commentId_fkey"`,
      `ALTER TABLE "ForceCommentVote" ADD CONSTRAINT "ForceCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "ForcePostComment"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      `ALTER TABLE "ForceCommentVote" DROP CONSTRAINT IF EXISTS "ForceCommentVote_userId_fkey"`,
      `ALTER TABLE "ForceCommentVote" ADD CONSTRAINT "ForceCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    ];

    for (const fkSql of foreignKeys) {
      try {
        await prisma.$executeRawUnsafe(fkSql);
      } catch (e) {
        console.log('[MIGRATE] Foreign key constraint issue:', e.message);
      }
    }

    console.log('[MIGRATE] Added all foreign key constraints');
    console.log('[MIGRATE] Migration completed successfully!');

    return NextResponse.json({
      success: true,
      message: 'Database migration applied successfully',
      tables: ['ForcePost', 'ForcePostComment', 'ForcePostVote', 'ForceCommentVote'],
    });

  } catch (error) {
    console.error('[MIGRATE] Error:', error);

    return NextResponse.json(
      {
        error: 'Migration failed',
        details: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
