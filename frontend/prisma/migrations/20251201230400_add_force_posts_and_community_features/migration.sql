-- AlterTable: Add new fields to RescueSquad
ALTER TABLE "RescueSquad" ADD COLUMN "photoUrl" TEXT;
ALTER TABLE "RescueSquad" ADD COLUMN "slogan" TEXT;
ALTER TABLE "RescueSquad" ADD COLUMN "zipCode" TEXT;

-- CreateTable: SquadPost
CREATE TABLE "SquadPost" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SquadPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SquadPostComment
CREATE TABLE "SquadPostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SquadPostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SquadPostVote
CREATE TABLE "SquadPostVote" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vote" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SquadPostVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SquadCommentVote
CREATE TABLE "SquadCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vote" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SquadCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SquadPost_rescueSquadId_createdAt_idx" ON "SquadPost"("rescueSquadId", "createdAt");
CREATE INDEX "SquadPost_divisionId_idx" ON "SquadPost"("divisionId");
CREATE INDEX "SquadPost_authorId_idx" ON "SquadPost"("authorId");
CREATE INDEX "SquadPost_createdAt_idx" ON "SquadPost"("createdAt");
CREATE INDEX "SquadPost_upvotes_idx" ON "SquadPost"("upvotes");

-- CreateIndex
CREATE INDEX "SquadPostComment_postId_createdAt_idx" ON "SquadPostComment"("postId", "createdAt");
CREATE INDEX "SquadPostComment_authorId_idx" ON "SquadPostComment"("authorId");
CREATE INDEX "SquadPostComment_parentCommentId_idx" ON "SquadPostComment"("parentCommentId");
CREATE INDEX "SquadPostComment_createdAt_idx" ON "SquadPostComment"("createdAt");

-- CreateIndex
CREATE INDEX "SquadPostVote_postId_idx" ON "SquadPostVote"("postId");
CREATE INDEX "SquadPostVote_userId_idx" ON "SquadPostVote"("userId");
CREATE UNIQUE INDEX "SquadPostVote_postId_userId_key" ON "SquadPostVote"("postId", "userId");

-- CreateIndex
CREATE INDEX "SquadCommentVote_commentId_idx" ON "SquadCommentVote"("commentId");
CREATE INDEX "SquadCommentVote_userId_idx" ON "SquadCommentVote"("userId");
CREATE UNIQUE INDEX "SquadCommentVote_commentId_userId_key" ON "SquadCommentVote"("commentId", "userId");

-- AddForeignKey
ALTER TABLE "SquadPost" ADD CONSTRAINT "SquadPost_rescueSquadId_fkey" FOREIGN KEY ("rescueSquadId") REFERENCES "RescueSquad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SquadPost" ADD CONSTRAINT "SquadPost_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SquadPost" ADD CONSTRAINT "SquadPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadPostComment" ADD CONSTRAINT "SquadPostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SquadPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SquadPostComment" ADD CONSTRAINT "SquadPostComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SquadPostComment" ADD CONSTRAINT "SquadPostComment_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "SquadPostComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadPostVote" ADD CONSTRAINT "SquadPostVote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SquadPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SquadPostVote" ADD CONSTRAINT "SquadPostVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadCommentVote" ADD CONSTRAINT "SquadCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "SquadPostComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SquadCommentVote" ADD CONSTRAINT "SquadCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
