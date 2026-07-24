/**
 * Inquiries: the shelter's inbox. Every "Ask about" form submitted on
 * the public page lands here with the sender's contact info, so
 * adoption interest never gets lost in a shared email account. Reply
 * by email or phone, then mark the row so the team knows it's handled.
 */

import Link from 'next/link';
import prisma from '@/app/lib/prisma';
import { requirePortal } from '../lib';
import InquiryActions from './InquiryActions';
import { Inbox, ArrowUpRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_META = {
  NEW: { dot: 'bg-amber-500', label: 'New' },
  REPLIED: { dot: 'bg-blue-500', label: 'Replied' },
  CLOSED: { dot: 'bg-midnight-300', label: 'Closed' },
};

function shortDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Inquiry contact details are attacker-supplied. Percent-encode each side of
 * the address so a stored '?cc=...' cannot append headers to the mailto: the
 * staffer clicks; keep '@' literal so every mail client still resolves it.
 */
function mailtoHref(email, subject) {
  const addr = String(email).split('@').map(encodeURIComponent).join('@');
  return `mailto:${addr}?subject=${subject}`;
}

function telHref(phone) {
  return `tel:${String(phone).replace(/[^0-9+]/g, '')}`;
}

export default async function PortalInquiries() {
  const { shelter } = await requirePortal();

  const inquiries = await prisma.shelterInquiry.findMany({
    where: { shelterId: shelter.id },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true, name: true, email: true, phone: true, message: true,
      status: true, createdAt: true,
      pet: { select: { id: true, name: true } },
    },
  });

  const newCount = inquiries.filter((i) => i.status === 'NEW').length;
  const digest = inquiries.length === 0
    ? 'Nothing yet.'
    : [
        `${inquiries.length} ${inquiries.length === 1 ? 'inquiry' : 'inquiries'}`,
        newCount > 0 ? `${newCount} new` : null,
      ].filter(Boolean).join(' · ');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] leading-tight font-black text-midnight-900">Inquiries</h1>
        <p className="text-[15px] text-midnight-500 mt-1">{digest}</p>
      </div>

      {inquiries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-midnight-200 bg-white px-6 py-10 text-center">
          <Inbox className="w-8 h-8 text-midnight-300 mx-auto mb-2" />
          <p className="font-bold text-midnight-900">No inquiries yet</p>
          <p className="text-sm text-midnight-500 mt-1 max-w-md mx-auto">
            When someone taps &ldquo;Ask about&rdquo; an animal on your public page,
            their message and contact info land here.
          </p>
          <a
            href={`/shelters/${shelter.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-midnight-900 hover:text-flash-600 transition"
          >
            Open your page <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      ) : (
        <div className="rounded-xl border border-midnight-100 bg-white divide-y divide-midnight-100 overflow-hidden">
          {inquiries.map((q) => {
            const meta = STATUS_META[q.status] || STATUS_META.NEW;
            const subject = encodeURIComponent(
              `Re: your inquiry about ${q.pet ? q.pet.name : 'adoption'} at ${shelter.name}`
            );
            return (
              <div key={q.id} className="px-4 py-3.5">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="font-bold text-midnight-900 text-[15px] leading-tight">
                    {q.name}
                    {q.pet && (
                      <span className="font-medium text-midnight-500">
                        {' '}about{' '}
                        <Link href={`/my-shelter/animals/${q.pet.id}`} className="underline underline-offset-2 hover:text-midnight-900">
                          {q.pet.name}
                        </Link>
                      </span>
                    )}
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-midnight-600">
                    <i className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </span>
                  <span className="text-[13px] text-midnight-400 ml-auto tabular-nums" title={new Date(q.createdAt).toLocaleString('en-US')}>
                    {shortDate(q.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-midnight-700 mt-1.5 whitespace-pre-line">{q.message}</p>
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  <a
                    href={mailtoHref(q.email, subject)}
                    className="text-[13px] font-bold text-midnight-900 hover:text-flash-600 transition"
                  >
                    Reply to {q.email}
                  </a>
                  {q.phone && (
                    <a href={telHref(q.phone)} className="text-[13px] font-semibold text-midnight-600 hover:text-midnight-900 transition">
                      {q.phone}
                    </a>
                  )}
                  <span className="ml-auto">
                    <InquiryActions inquiryId={q.id} status={q.status} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[12px] leading-relaxed text-midnight-400">
        Replying happens from your own email or phone; marking a row replied or
        closed just keeps the team from answering twice.
      </p>
    </div>
  );
}
