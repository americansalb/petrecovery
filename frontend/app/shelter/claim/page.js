import ShelterClaimClient from './ShelterClaimClient';

export const metadata = {
  title: 'Claim your shelter account | ReunitePets',
  description: 'Accept your invitation and claim your shelter\'s free account on ReunitePets.',
  robots: { index: false, follow: false },
};

export default function ShelterClaimPage() {
  return <ShelterClaimClient />;
}
