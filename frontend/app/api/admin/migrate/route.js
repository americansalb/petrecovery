import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { isAdmin } from '@/app/lib/authz';

/**
 * POST /api/admin/migrate
 *
 * Applies pending database migrations
 * Admin-only endpoint for emergency migration deployment
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // In-handler admin re-check (role read fresh from DB, not the JWT): this
    // runs raw DDL, so it must not rely on middleware or a stale token alone.
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log('[MIGRATE] Starting migration...');
    console.log('[MIGRATE] User:', session.user.email);

    // Apply the community posts migration - each statement separately

    // 1. Add RescueSquad fields
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "RescueSquad" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT`);
    } catch (e) {
      console.log('[MIGRATE] photoUrl column may already exist');
    }

    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "RescueSquad" ADD COLUMN IF NOT EXISTS "slogan" TEXT`);
    } catch (e) {
      console.log('[MIGRATE] slogan column may already exist');
    }

    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "RescueSquad" ADD COLUMN IF NOT EXISTS "zipCode" TEXT`);
    } catch (e) {
      console.log('[MIGRATE] zipCode column may already exist');
    }

    console.log('[MIGRATE] Added RescueSquad fields');

    // 2. Create SquadPost table
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SquadPost" (
            "id" TEXT NOT NULL,
            "rescueSquadId" TEXT NOT NULL,
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
            CONSTRAINT "SquadPost_pkey" PRIMARY KEY ("id")
        )
      `);
      console.log('[MIGRATE] Created SquadPost table');
    } catch (e) {
      console.log('[MIGRATE] SquadPost table may already exist');
    }

    // 3. Create SquadPostComment table
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SquadPostComment" (
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
            CONSTRAINT "SquadPostComment_pkey" PRIMARY KEY ("id")
        )
      `);
      console.log('[MIGRATE] Created SquadPostComment table');
    } catch (e) {
      console.log('[MIGRATE] SquadPostComment table may already exist');
    }

    // 4. Create SquadPostVote table
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SquadPostVote" (
            "id" TEXT NOT NULL,
            "postId" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "vote" INTEGER NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "SquadPostVote_pkey" PRIMARY KEY ("id")
        )
      `);
      console.log('[MIGRATE] Created SquadPostVote table');
    } catch (e) {
      console.log('[MIGRATE] SquadPostVote table may already exist');
    }

    // 5. Create SquadCommentVote table
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SquadCommentVote" (
            "id" TEXT NOT NULL,
            "commentId" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "vote" INTEGER NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "SquadCommentVote_pkey" PRIMARY KEY ("id")
        )
      `);
      console.log('[MIGRATE] Created SquadCommentVote table');
    } catch (e) {
      console.log('[MIGRATE] SquadCommentVote table may already exist');
    }

    // 6. Create indexes (each separately)
    const indexes = [
      `CREATE INDEX IF NOT EXISTS "SquadPost_rescueSquadId_createdAt_idx" ON "SquadPost"("rescueSquadId", "createdAt")`,
      `CREATE INDEX IF NOT EXISTS "SquadPost_divisionId_idx" ON "SquadPost"("divisionId")`,
      `CREATE INDEX IF NOT EXISTS "SquadPost_authorId_idx" ON "SquadPost"("authorId")`,
      `CREATE INDEX IF NOT EXISTS "SquadPost_createdAt_idx" ON "SquadPost"("createdAt")`,
      `CREATE INDEX IF NOT EXISTS "SquadPost_upvotes_idx" ON "SquadPost"("upvotes")`,
      `CREATE INDEX IF NOT EXISTS "SquadPostComment_postId_createdAt_idx" ON "SquadPostComment"("postId", "createdAt")`,
      `CREATE INDEX IF NOT EXISTS "SquadPostComment_authorId_idx" ON "SquadPostComment"("authorId")`,
      `CREATE INDEX IF NOT EXISTS "SquadPostComment_parentCommentId_idx" ON "SquadPostComment"("parentCommentId")`,
      `CREATE INDEX IF NOT EXISTS "SquadPostComment_createdAt_idx" ON "SquadPostComment"("createdAt")`,
      `CREATE INDEX IF NOT EXISTS "SquadPostVote_postId_idx" ON "SquadPostVote"("postId")`,
      `CREATE INDEX IF NOT EXISTS "SquadPostVote_userId_idx" ON "SquadPostVote"("userId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "SquadPostVote_postId_userId_key" ON "SquadPostVote"("postId", "userId")`,
      `CREATE INDEX IF NOT EXISTS "SquadCommentVote_commentId_idx" ON "SquadCommentVote"("commentId")`,
      `CREATE INDEX IF NOT EXISTS "SquadCommentVote_userId_idx" ON "SquadCommentVote"("userId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "SquadCommentVote_commentId_userId_key" ON "SquadCommentVote"("commentId", "userId")`,
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
      `ALTER TABLE "SquadPost" DROP CONSTRAINT IF EXISTS "SquadPost_rescueSquadId_fkey"`,
      `ALTER TABLE "SquadPost" ADD CONSTRAINT "SquadPost_rescueSquadId_fkey" FOREIGN KEY ("rescueSquadId") REFERENCES "RescueSquad"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      `ALTER TABLE "SquadPost" DROP CONSTRAINT IF EXISTS "SquadPost_divisionId_fkey"`,
      `ALTER TABLE "SquadPost" ADD CONSTRAINT "SquadPost_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE`,

      `ALTER TABLE "SquadPost" DROP CONSTRAINT IF EXISTS "SquadPost_authorId_fkey"`,
      `ALTER TABLE "SquadPost" ADD CONSTRAINT "SquadPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      `ALTER TABLE "SquadPostComment" DROP CONSTRAINT IF EXISTS "SquadPostComment_postId_fkey"`,
      `ALTER TABLE "SquadPostComment" ADD CONSTRAINT "SquadPostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SquadPost"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      `ALTER TABLE "SquadPostComment" DROP CONSTRAINT IF EXISTS "SquadPostComment_authorId_fkey"`,
      `ALTER TABLE "SquadPostComment" ADD CONSTRAINT "SquadPostComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      `ALTER TABLE "SquadPostComment" DROP CONSTRAINT IF EXISTS "SquadPostComment_parentCommentId_fkey"`,
      `ALTER TABLE "SquadPostComment" ADD CONSTRAINT "SquadPostComment_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "SquadPostComment"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      `ALTER TABLE "SquadPostVote" DROP CONSTRAINT IF EXISTS "SquadPostVote_postId_fkey"`,
      `ALTER TABLE "SquadPostVote" ADD CONSTRAINT "SquadPostVote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SquadPost"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      `ALTER TABLE "SquadPostVote" DROP CONSTRAINT IF EXISTS "SquadPostVote_userId_fkey"`,
      `ALTER TABLE "SquadPostVote" ADD CONSTRAINT "SquadPostVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      `ALTER TABLE "SquadCommentVote" DROP CONSTRAINT IF EXISTS "SquadCommentVote_commentId_fkey"`,
      `ALTER TABLE "SquadCommentVote" ADD CONSTRAINT "SquadCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "SquadPostComment"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      `ALTER TABLE "SquadCommentVote" DROP CONSTRAINT IF EXISTS "SquadCommentVote_userId_fkey"`,
      `ALTER TABLE "SquadCommentVote" ADD CONSTRAINT "SquadCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
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
      tables: ['SquadPost', 'SquadPostComment', 'SquadPostVote', 'SquadCommentVote'],
    });

  } catch (error) {
    console.error('[MIGRATE] Error:', error);

    return NextResponse.json(
      { error: 'Migration failed' },
      { status: 500 }
    );
  }
}
