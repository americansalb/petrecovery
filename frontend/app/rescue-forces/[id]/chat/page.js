/**
 * A Rescue Force's chat, for its members: quick messages while a search is
 * on. Reads and sends through /api/rescue-forces/[id]/chat, which answers
 * members only. Before this page, no link anywhere led to the force chat,
 * and sending a message failed every time.
 */

import { notFound } from 'next/navigation';
import { requireForceMember } from '@/app/lib/forceViewer';
import MemberPageHeader from '../MemberPageHeader';
import ChatClient from './ChatClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Chat', robots: { index: false, follow: false } };

export default async function ChatPage({ params }) {
  const { id } = await params;
  const viewer = await requireForceMember(id, `/rescue-forces/${id}/chat`);
  if (!viewer.force) notFound();

  return (
    <div className="min-h-screen bg-midnight-50">
      <MemberPageHeader force={viewer.force} title="Chat" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <ChatClient forceId={id} userId={viewer.userId} canSend={Boolean(viewer.membership)} />
      </main>
    </div>
  );
}
