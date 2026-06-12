/**
 * Hub member profile - Server Component with share metadata
 *
 * First name only (already public on the hub), noindex: profiles
 * should preview nicely when shared but not rank in search.
 */

import prisma from '@/app/lib/prisma';
import {
  SITE_NAME,
  buildShareMetadata,
  genericShareMetadata,
} from '@/app/lib/shareMetadata';
import ForumProfileClient from './ForumProfileClient';

export async function generateMetadata({ params }) {
  try {
    const profile = await prisma.forumProfile.findUnique({
      where: { userId: params.id },
      select: { bio: true, reputation: true, isBanned: true },
    });
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { firstName: true },
    });
    if (!user || profile?.isBanned) return genericShareMetadata(`Rescue Hub | ${SITE_NAME}`);

    return buildShareMetadata({
      title: `${user.firstName} on the Rescue Hub | ${SITE_NAME}`,
      description: profile?.bio || `${user.firstName}'s posts and reputation on the ${SITE_NAME} Rescue Hub.`,
      index: false,
    });
  } catch (error) {
    console.error('Error generating hub profile metadata:', error);
    return genericShareMetadata(`Rescue Hub | ${SITE_NAME}`);
  }
}

export default function ForumProfilePage({ params }) {
  return <ForumProfileClient params={params} />;
}
