'use client';

/**
 * Share a pet's page: copy the link, or open it in the apps neighbors
 * actually use. Shown when the device has no share sheet of its own
 * (most desktops).
 */

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Modal, Button } from '@/components/ui';

export default function ShareSheet({ open, onClose, url, title, text }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard permission: the link is in the box, selected, to copy by hand.
      document.getElementById('share-link')?.select();
    }
  };

  const enc = encodeURIComponent;
  const targets = [
    { label: 'WhatsApp', href: `https://wa.me/?text=${enc(`${text} ${url}`)}` },
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { label: 'Nextdoor', href: `https://nextdoor.com/sharekit/?source=reunitepets&body=${enc(`${text} ${url}`)}` },
    { label: 'X', href: `https://x.com/intent/tweet?text=${enc(text)}&url=${enc(url)}` },
    { label: 'Text message', href: `sms:?&body=${enc(`${text} ${url}`)}`, sameTab: true },
    { label: 'Email', href: `mailto:?subject=${enc(title)}&body=${enc(`${text}\n\n${url}`)}`, sameTab: true },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share this page"
      subtitle="Post it where people near you will see it: local Facebook groups, Nextdoor, group chats."
    >
      <div className="flex items-center gap-2 rounded-xl bg-midnight-50 p-1.5 pl-3 ring-1 ring-midnight-200">
        <input
          id="share-link"
          readOnly
          value={url}
          aria-label="Link to this page"
          onFocus={(e) => e.target.select()}
          className="min-w-0 flex-1 bg-transparent text-midnight-700 outline-none"
        />
        <Button size="sm" variant="secondary" onClick={copy} leftIcon={copied ? Check : Copy}>
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {targets.map((t) => (
          <a
            key={t.label}
            href={t.href}
            {...(t.sameTab ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
            className="flex items-center justify-center rounded-xl px-3 py-3 text-sm font-semibold text-midnight-800 ring-1 ring-midnight-200 transition hover:bg-midnight-50 hover:ring-midnight-300"
          >
            {t.label}
          </a>
        ))}
      </div>
    </Modal>
  );
}
