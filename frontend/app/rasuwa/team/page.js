/**
 * /rasuwa/team: the family task force board for the Rasuwa flood
 * response. A closed coordination space behind a shared code (no
 * accounts): pinned updates, a needs board with claims, the letter
 * coverage wall, and a running conversation. Immersive route (under
 * /rasuwa in app/lib/navChrome.js): no pet-site chrome; the board's
 * own header links back to the letter wizard and home.
 *
 * Deliberately unindexed and never share-carded: this page is passed
 * around inside the family group chats, not published.
 */

import TeamBoard from './TeamBoard';

export const metadata = {
  title: 'Family task force | rescueourfamily.org',
  description: 'The coordination board for the families of the people missing in the Rasuwa flood.',
  robots: { index: false, follow: false },
};

export default function TeamPage() {
  return (
    <div className="min-h-screen supports-[min-height:100dvh]:min-h-[100dvh] bg-slate-100">
      <TeamBoard />
    </div>
  );
}
