import { buildShareMetadata } from '@/app/lib/shareMetadata';

export const metadata = buildShareMetadata({
  title: 'Free Shelter Accounts | ReunitePets',
  description:
    'Shelters and rescues run their animals on ReunitePets free, forever: a health record for every animal, automatic lost-pet matching, adoption handoffs with full medical history, staff seats, and your own public page.',
  canonical: '/for-shelters',
  index: true,
  keywords: ['animal shelter software', 'free shelter management', 'rescue management', 'pet adoption software', 'lost pet matching'],
});

export default function ForSheltersLayout({ children }) {
  return children;
}
