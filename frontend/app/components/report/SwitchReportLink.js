import Link from 'next/link';

/**
 * The other report wizard, one tap from the first step.
 *
 * The Report button in the phone tab bar opens the lost-pet wizard
 * directly, so someone who had found a dog landed on "What kind of pet is
 * missing?" with no way across except closing the wizard.
 */
export default function SwitchReportLink({ to }) {
  const lost = to === 'lost';
  return (
    <p className="mt-6 text-center text-sm text-midnight-500">
      {lost ? 'Looking for your own pet? ' : 'Found someone else’s pet? '}
      <Link
        href={lost ? '/report/new' : '/report/found'}
        className="font-semibold text-midnight-800 underline underline-offset-2 hover:text-midnight-950"
      >
        {lost ? 'Report a lost pet' : 'Report a found pet'}
      </Link>
    </p>
  );
}
