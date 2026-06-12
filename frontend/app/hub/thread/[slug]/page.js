/**
 * Hub thread - Server Component with share metadata
 *
 * Threads get shared for help ("tips for shy cats?"); the preview
 * carries the title and opening words, not the site logo.
 */

import prisma from '@/app/lib/prisma';
import {
  SITE_NAME,
  buildShareMetadata,
  genericShareMetadata,
} from '@/app/lib/shareMetadata';
import ThreadPageClient from './ThreadPageClient';

export async function generateMetadata({ params }) {
  try {
    const thread = await prisma.forumThread.findUnique({
      where: { slug: params.slug },
      select: {
        title: true,
        content: true,
        isHidden: true,
        replyCount: true,
        locationTag: true,
        category: { select: { name: true } },
      },
    });
    if (!thread || thread.isHidden) return genericShareMetadata(`Rescue Hub | ${SITE_NAME}`);

    const excerpt = thread.content
      ? `${thread.content.substring(0, 150)}${thread.content.length > 150 ? '...' : ''}`
      : `A discussion in ${thread.category?.name || 'the Rescue Hub'}.`;

    return buildShareMetadata({
      title: `${thread.title} | Rescue Hub`,
      description: excerpt,
      canonical: `/hub/thread/${params.slug}`,
      index: true,
    });
  } catch (error) {
    console.error('Error generating thread metadata:', error);
    return genericShareMetadata(`Rescue Hub | ${SITE_NAME}`);
  }
}

export default function ThreadPage({ params }) {
  return <ThreadPageClient params={params} />;
}
