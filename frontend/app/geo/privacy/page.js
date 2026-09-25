import Link from 'next/link';

export const metadata = {
  title: 'Privacy | Probably Earth',
  description: 'What Probably Earth saves and how to manage your game account.',
};

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@petrecovery.org';

export default function GamePrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
      <Link href="/geo" className="text-sm text-white/70 underline">Back to the game</Link>
      <h1 className="mt-5 text-4xl font-bold">Privacy</h1>
      <p className="mt-3 text-white/70">Probably Earth keeps its game accounts separate from ReunitePets accounts.</p>
      <div className="mt-8 space-y-8 text-base leading-relaxed text-white/80">
        <section aria-labelledby="privacy-play">
          <h2 id="privacy-play" className="mb-2 text-xl font-semibold text-white">Playing and saving</h2>
          <p>Your play profile contains your display name, ratings, points, badges and results. A token in your browser identifies it. Guest progress stays on that browser; an account can keep a saved-game checkpoint so you can continue on another device.</p>
        </section>
        <section aria-labelledby="privacy-account">
          <h2 id="privacy-account" className="mb-2 text-xl font-semibold text-white">Signing in</h2>
          <p>An account uses your email address or phone number. Email sign-in uses a link sent to that address through Resend, with a six-digit code in the same email; the game stores a hash of each, not the link or the code. When phone sign-in is enabled, Twilio Verify sends and checks a text-message code. The game stores the verified phone number, not the code. There is no password.</p>
          <p className="mt-3">The geo_session and geo_signed_in cookies keep you signed in for 90 days. You can sign out in Profile settings.</p>
        </section>
        <section aria-labelledby="privacy-matches">
          <h2 id="privacy-matches" className="mb-2 text-xl font-semibold text-white">Matches and public scores</h2>
          <p>Other players can see your display name and game results. Daily and weekly boards show names and scores. Matchmaking stores your chosen game, profile, queue activity times, assigned room and a one-way hash of your IP address. Assigned room credentials are encrypted. A search expires after 20 seconds without a heartbeat.</p>
          <p className="mt-3">The play meter counts rounds against your profile and a one-way hash of your IP address to limit abuse and imagery usage.</p>
          <p className="mt-3">If you report a mistake on a Script answer, the game stores what you picked and wrote, the round&apos;s text, your pin and a one-way hash of your IP address. The hash is there so repeated reports from one person count once.</p>
        </section>
        <section aria-labelledby="privacy-retention">
          <h2 id="privacy-retention" className="mb-2 text-xl font-semibold text-white">Keeping and deleting data</h2>
          <p>Housekeeping is designed to remove play-meter records after 120 days, finished rooms after 14 days, abandoned rooms after 3 days and the IP hash on a Script report after 2 days.</p>
          <p className="mt-3">Delete your game account from <Link className="underline" href="/geo/me">Profile → Settings</Link> to remove your email address or phone number, saved-game checkpoint, profile, ratings, points, badges, results, queue entries and challenge scores.</p>
        </section>
        <section aria-labelledby="privacy-contact">
          <h2 id="privacy-contact" className="mb-2 text-xl font-semibold text-white">Questions</h2>
          <p>Contact <a className="break-words underline" href={`mailto:${supportEmail}`}>{supportEmail}</a> about your game data.</p>
        </section>
      </div>
    </div>
  );
}
