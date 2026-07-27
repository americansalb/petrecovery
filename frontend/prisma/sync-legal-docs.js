/**
 * Version-aware legal document sync, run at boot (see "start" in
 * package.json) so a Terms version bump in prisma/legal/ reaches the
 * live DB on the next deploy - prod never runs the full seed.
 *
 * Create-if-missing, update-if-version-changed, otherwise no-op.
 * Never exits non-zero: a hiccup here must not block the app from
 * starting (the old document version keeps serving instead).
 */

const { PrismaClient } = require('@prisma/client');
const { TERMS_OF_SERVICE_DOC } = require('./legal/terms-of-service');

const DOCS = [TERMS_OF_SERVICE_DOC];

async function main() {
  const prisma = new PrismaClient();
  try {
    for (const doc of DOCS) {
      const existing = await prisma.legalDocument.findUnique({
        where: { slug: doc.slug },
        select: { version: true },
      });

      if (!existing) {
        await prisma.legalDocument.create({ data: doc });
        console.log(`[legal-sync] created ${doc.slug} v${doc.version}`);
      } else if (existing.version !== doc.version) {
        await prisma.legalDocument.update({
          where: { slug: doc.slug },
          data: {
            version: doc.version,
            title: doc.title,
            summary: doc.summary,
            content: doc.content,
            publishedAt: new Date(),
          },
        });
        console.log(`[legal-sync] ${doc.slug} v${existing.version} -> v${doc.version}`);
      }
    }
  } catch (error) {
    console.error('[legal-sync] skipped:', error.message);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main();
