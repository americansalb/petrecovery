import Link from 'next/link';
import { FileText, ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service - ReunitePets.org',
  description: 'The terms that govern your use of ReunitePets.org.',
};

const LAST_UPDATED = 'July 27, 2026';
// Single source of truth. This was hardcoded in three places on the retired
// petrecovery.org domain, including in the Terms and the Privacy Policy where
// it is the contact of record. Set SUPPORT_EMAIL once the reunitepets.org
// mailbox is confirmed monitored - do not change the default blind, an
// unmonitored support address is worse than an off-brand one.
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@petrecovery.org';

const SECTIONS = [
  {
    title: 'Acceptance of these terms',
    body: [
      'By creating an account or using ReunitePets.org, you agree to these terms. If you don’t agree, please don’t use the service.',
      'You must be old enough to form a binding agreement in your jurisdiction to use the platform.',
    ],
  },
  {
    title: 'What ReunitePets does',
    body: [
      'We provide a community-powered platform to report lost and found pets, surface potential matches, and coordinate with local rescue volunteers.',
      'We are a coordination tool - we do not guarantee that any pet will be found or reunited, and we are not responsible for the conduct of other users.',
    ],
  },
  {
    title: 'Your responsibilities',
    body: [
      'Provide accurate information in your reports, and keep your account secure.',
      'Only post content you have the right to share, and don’t upload anything unlawful, harmful, or that isn’t yours.',
      'Use the platform to help reunite pets - not to harass others, scam, or collect people’s information for unrelated purposes.',
      'Meet others safely. Use good judgment when arranging to recover or hand off a pet; ReunitePets is not a party to those interactions.',
    ],
  },
  {
    title: 'Content you submit',
    body: [
      'You keep ownership of the photos and details you post. You grant us a license to display and distribute that content on the platform for the purpose of reuniting pets.',
      'We may remove content that violates these terms or that is reported as abusive, fraudulent, or unsafe.',
    ],
  },
  {
    title: 'Pet care tools & the Health Book',
    body: [
      'Your pet\u2019s profile includes everyday-care tools: medication schedules, dose logging, care routines, a Health Book (vaccine records, weight history, your vet\u2019s info), and shareable care pages. These are currently provided at no charge. We may change what the service includes, and we will give notice of material changes.',
      'They\u2019re a helper for remembering, not veterinary advice. The Health Book shows exactly what you enter. Nothing is verified by a clinic, and labels like \u201cdue soon\u201d or \u201cexpired\u201d are simple date math on the dates you typed. Always follow your vet\u2019s guidance and the medication label; you stay in charge of your pet\u2019s care.',
      'It isn\u2019t proof of vaccination or an official record. For travel, boarding, grooming, or licensing, the paper certificate from your vet is the document that counts, and a good habit is to double-check entries against it.',
      'If your pet ever seems sick or hurt, call your vet or an emergency clinic first. Never wait on an app, including this one.',
      'Share links show your pet\u2019s care and health record to anyone who has the link. Share thoughtfully; you can change or revoke a link anytime.',
      'Reminders depend on devices and networks, so please don\u2019t rely on them alone for critical care. ReunitePets isn\u2019t liable for outcomes related to missed, late, or incorrect doses, or for decisions made from records and statuses shown in the app.',
    ],
  },
  {
    title: 'Disclaimers & limitation of liability',
    body: [
      'The service is provided “as is,” without warranties of any kind. We work hard to keep it reliable, but we can’t guarantee it will be uninterrupted or error-free.',
      'To the fullest extent permitted by law, ReunitePets is not liable for indirect or consequential damages arising from your use of the platform or interactions with other users.',
    ],
  },
  {
    title: 'Changes & contact',
    body: [
      'We may update these terms; continued use after an update means you accept the revised terms. We’ll revise the date above when we make changes.',
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0a1526] via-midnight-900 to-[#0c1a30] py-16 md:py-20">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[620px] h-[620px] bg-flash-400/15 rounded-full blur-[130px] pointer-events-none" />
        <div className="max-w-3xl mx-auto px-4 text-center relative">
          <span className="inline-flex items-center gap-2 bg-flash-400/10 text-flash-200 px-4 py-2 rounded-full border border-flash-400/25 backdrop-blur-sm text-sm font-medium mb-5">
            <FileText className="w-4 h-4" /> The fine print
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
            Terms of{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-flash-300 via-flash-400 to-amber-300 drop-shadow-[0_0_24px_rgba(250,204,21,0.35)]">
              Service
            </span>
          </h1>
          <p className="text-midnight-200 text-lg max-w-xl mx-auto">
            The ground rules for using ReunitePets to help reunite lost pets with their families.
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
              . See also our{' '}
              <Link href="/privacy" className="text-midnight-900 font-semibold underline hover:text-flash-600">
                Privacy Policy
              </Link>
              .
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
