import TransferAcceptClient from './TransferAcceptClient';

// Private, emailed-token route: no entity metadata on purpose (the invite
// must not leak the pet to preview bots). Listed in KNOWN_PRIVATE in
// __tests__/link-previews.test.js.
export const metadata = {
  title: 'Accept a pet health record - ReunitePets.org',
  description: 'Accept a pet\'s complete health record on ReunitePets.org.',
  robots: { index: false, follow: false },
};

export default function PetTransferPage({ params }) {
  return <TransferAcceptClient token={params.token} />;
}
