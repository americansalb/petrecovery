import Link from 'next/link';
import { Shield, ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy - ReunitePets.org',
  description: 'How ReunitePets.org collects, uses, and protects your information.',
};

const LAST_UPDATED = 'May 30, 2026';
// Single source of truth. This was hardcoded in three places on the retired
// petrecovery.org domain, including in the Terms and the Privacy Policy where
// it is the contact of record. Set SUPPORT_EMAIL once the reunitepets.org
// mailbox is confirmed monitored - do not change the default blind, an
// unmonitored support address is worse than an off-brand one.
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@petrecovery.org';

const SECTIONS = [
  {
    title: 'Information we collect',
    body: [
      'Account details you provide - name, email, and (optionally) a phone number - when you register or file a report.',
      'Pet report details - photos, descriptions, and the last-seen or found location you choose to share.',
      'Approximate location data, used to match reports and connect you with nearby rescue forces. We snap shared locations to a coarse area rather than publishing exact coordinates.',
      'Basic technical data (device/browser type, and rate-limiting signals) needed to operate and secure the service.',
    ],
  },
  {
    title: 'How we use your information',
    body: [
      'To create and display lost and found pet reports and match them to one another.',
      'To notify you about potential matches, sightings, and activity on your reports.',
      'To connect owners, finders, and rescue volunteers - only the minimum needed to help reunite a pet, and only after the relevant parties opt in.',
      'To keep the platform safe (preventing abuse, spam, and fraudulent reports).',
    ],
  },
  {
    title: 'What we share - and what we don’t',
    body: [
      'We do not sell your personal information.',
      'Contact details (phone, email, exact address) are not published publicly. They are shared only when you and another party mutually choose to connect about a specific match.',
      'Public report pages show pet details and a coarse area - never your exact home location or raw contact info.',
      'We may share information when required by law, or to investigate safety and abuse.',
    ],
  },
  {
    title: 'Data security & retention',
    body: [
      'Passwords are stored hashed, and access to sensitive data is restricted. We apply rate limiting and other safeguards against abuse.',
      'You can edit or close your reports, and request deletion of your account data, by contacting us.',
    ],
  },
  {
    title: 'Your choices',
    body: [
      'You control what you put in a report and can update or remove it.',
      'You can manage notification preferences in your account settings.',
      'You can reach us any time with privacy questions or data requests.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0a1526] via-midnight-900 to-[#0c1a30] py-16 md:py-20">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[620px] h-[620px] bg-flash-400/15 rounded-full blur-[130px] pointer-events-none" />
        <div className="max-w-3xl mx-auto px-4 text-center relative">
          <span className="inline-flex items-center gap-2 bg-flash-400/10 text-flash-200 px-4 py-2 rounded-full border border-flash-400/25 backdrop-blur-sm text-sm font-medium mb-5">
            <Shield className="w-4 h-4" /> Your privacy
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
            Privacy{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-flash-300 via-flash-400 to-amber-300 drop-shadow-[0_0_24px_rgba(250,204,21,0.35)]">
              Policy
            </span>
          </h1>
          <p className="text-midnight-200 text-lg max-w-xl mx-auto">
            We collect only what’s needed to reunite pets with their families - and we protect it.
          </p>
          <p className="text-midnight-300/70 text-sm mt-4">Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-3xl mx-auto px-4 py-14 md:py-16">
        <div className="space-y-10">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h2 className="text-xl md:text-2xl font-bold text-midnight-900 mb-4">{s.title}</h2>
              <ul className="space-y-3">
                {s.body.map((p, i) => (
                  <li key={i} className="flex gap-3 text-midnight-700 leading-relaxed">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-flash-400 shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="rounded-2xl border border-midnight-100 bg-midnight-50/60 p-6">
            <h2 className="text-lg font-bold text-midnight-900 mb-2">Questions?</h2>
            <p className="text-midnight-700">
              Email us at{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-midnight-900 font-semibold underline hover:text-flash-600">
                {SUPPORT_EMAIL}
              </a>
              . We may update this policy from time to time; we’ll revise the date above when we do.
            </p>
          </div>

          <Link href="/" className="inline-flex items-center gap-2 text-midnight-600 hover:text-midnight-900 font-medium">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
        </div>
      </section>
    </div>
  );
}
