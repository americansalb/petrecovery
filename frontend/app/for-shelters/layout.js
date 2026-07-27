import { buildShareMetadata } from '@/app/lib/shareMetadata';

export const metadata = buildShareMetadata({
  title: 'Free Shelter Accounts | ReunitePets',
  description:
    'Shelters and rescues run their animals on ReunitePets free, forever: medical records for every animal, lost-pet matching, stray-hold tracking, adoption transfers with full history, an adoption-inquiry inbox, staff accounts, and a public page.',
  canonical: '/for-shelters',
  index: true,
  keywords: ['animal shelter software', 'free shelter management', 'rescue management', 'pet adoption software', 'lost pet matching'],
});

export default function ForSheltersLayout({ children }) {
  return children;
}
