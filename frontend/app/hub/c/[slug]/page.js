/**
 * Hub category - Server Component with share metadata
 */

import prisma from '@/app/lib/prisma';
import {
  SITE_NAME,
  buildShareMetadata,
  genericShareMetadata,
} from '@/app/lib/shareMetadata';
import CategoryPageClient from './CategoryPageClient';

// Category listings change constantly; hoisted from the client page
// when it became a server wrapper (route config is ignored elsewhere)
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  try {
    const category = await prisma.forumCategory.findUnique({
      where: { slug: params.slug },
      select: { name: true, description: true, threadCount: true },
    });
    if (!category) return genericShareMetadata(`Rescue Hub | ${SITE_NAME}`);

    return buildShareMetadata({
      title: `${category.name} | Rescue Hub`,
      description: category.description || `Community discussions in ${category.name} on the ${SITE_NAME} Rescue Hub.`,
      canonical: `/hub/c/${params.slug}`,
      index: true,
    });
  } catch (error) {
    console.error('Error generating category metadata:', error);
    return genericShareMetadata(`Rescue Hub | ${SITE_NAME}`);
  }
}

export default function CategoryPage({ params }) {
  return <CategoryPageClient params={params} />;
}
