/**
 * Static share metadata for /care, the daily product's front door
 * (docs/PRODUCT_IA_PLAN.md §2). See docs/LINK_PREVIEWS.md.
 */

import { buildShareMetadata } from '@/app/lib/shareMetadata';

export const metadata = buildShareMetadata({
  title: 'Your Pet’s Health Book, Free | ReunitePets',
  description:
    'Medications with one-tap logging, vaccine records, weight tracking, and a link any vet or sitter can read. No app, no fees, no catch.',
  index: true,
  keywords: [
    'pet medication tracker', 'pet health record', 'pet vaccination record',
    'dog medication schedule', 'cat medication tracker', 'pet health book',
  ],
});

export default function CareLayout({ children }) {
  return children;
}
