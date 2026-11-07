'use client';

/**
 * RecoveryKit - the share kit on the public case page: the scannable QR,
 * the printable flyers, and the share images with their captions, all
 * from the PII-safe /recovery-kit read (useRecoveryKit). Renders nothing
 * for a case with no kit, and tells the page so through onEmptyChange.
 *
 * The page after posting has its own layout (SuccessScreen) and reads the
 * same hook.
 */

import { useEffect, useState } from 'react';
import { Check, Copy, Download, FileText, Image as ImageIcon, QrCode, Sparkles } from 'lucide-react';
import useRecoveryKit from './useRecoveryKit';

export function CopyButton({ text, label = 'Copy', className = '' }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        try {
          navigator.clipboard?.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* ignore */
        }
      }}
      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border-2 border-midnight-300 bg-white px-3 text-[13px] font-bold text-midnight-900 hover:border-midnight-500 transition-colors ${className}`}
    >
      {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
      {copied ? 'Copied' : label}
    </button>
  );
}

function AssetChip({ href, label, icon: Icon }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 border-midnight-300 bg-white px-3.5 text-[13px] font-bold text-midnight-900 hover:border-midnight-500 transition-colors"
    >
      <Icon size={15} />
      {label}
    </a>
  );
}

export default function RecoveryKit({ caseNumber, initialStatus = 'COMPLETE', fallback = null, petName, onEmptyChange }) {
  const { kit } = useRecoveryKit(caseNumber, { initialStatus });
  const hasShareable = Boolean(kit?.assets?.qr?.url || kit?.assets?.flyers?.length > 0 || kit?.assets?.social?.length > 0);
  const isEmpty = !kit || kit.exists === false || !hasShareable;

  useEffect(() => {
    if (onEmptyChange) onEmptyChange(isEmpty);
  }, [isEmpty, onEmptyChange]);

  if (isEmpty) return fallback;

  const social = kit.assets.social || [];
  const square = social.find((s) => s.kind === 'SOCIAL_SQUARE');
  const story = social.find((s) => s.kind === 'SOCIAL_STORY');
  const link = social.find((s) => s.kind === 'SOCIAL_OG');
  const captions = kit.copy?.captions || null;

  return (
    <div className="text-left">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={18} className="text-flash-500" />
        <h3 className="font-extrabold text-midnight-900">{petName ? `${petName}'s` : 'The'} share kit</h3>
      </div>
      <p className="text-sm text-midnight-600 mb-4">Print a flyer, post an image, or share the link.</p>

      {kit.assets.qr?.url && (
        <div className="mb-4 flex items-center gap-4 rounded-2xl border border-midnight-200 bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={kit.assets.qr.url}
            alt={`QR code linking to this page for ${petName || 'this pet'}`}
            width={92}
            height={92}
            className="w-[92px] h-[92px] rounded-lg shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <QrCode size={15} className="text-midnight-500" />
              <p className="font-bold text-midnight-800 text-sm">Scan to open this page</p>
            </div>
            <p className="text-xs text-midnight-600 leading-relaxed">
              Point a phone camera at this code to open this page. It is printed on every flyer too.
            </p>
            <a
              href={kit.assets.qr.url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-midnight-700 hover:text-midnight-900"
            >
              <Download size={13} /> Download QR
            </a>
          </div>
        </div>
      )}

      {kit.assets.flyers?.length > 0 && (
        <div className="mb-4 rounded-2xl border border-midnight-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={17} className="text-midnight-500" />
            <h4 className="font-bold text-midnight-800 text-sm">Printable flyers</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {kit.assets.flyers.map((f) => (
              <AssetChip key={f.kind} href={f.url} label={f.label} icon={Download} />
            ))}
          </div>
          <p className="text-xs text-midnight-500 mt-2">Each one has the map and a QR code back to this page.</p>
        </div>
      )}

      {social.length > 0 && (
        <div className="rounded-2xl border border-midnight-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <ImageIcon size={17} className="text-midnight-500" />
            <h4 className="font-bold text-midnight-800 text-sm">Share images</h4>
          </div>
          <div className="flex flex-wrap gap-3 items-start">
            {square && (
              <a href={square.url} target="_blank" rel="noopener noreferrer" download className="block w-[150px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={square.url} alt={`Square share image for ${petName || 'this pet'}`} className="w-[150px] h-[150px] rounded-lg border border-midnight-200 object-cover" />
                <span className="mt-1.5 block text-center text-xs font-bold text-midnight-700">Square</span>
              </a>
            )}
            {story && (
              <a href={story.url} target="_blank" rel="noopener noreferrer" download className="block w-[84px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={story.url} alt={`Story share image for ${petName || 'this pet'}`} className="w-[84px] h-[150px] rounded-lg border border-midnight-200 object-cover" />
                <span className="mt-1.5 block text-center text-xs font-bold text-midnight-700">Story</span>
              </a>
            )}
            {link && (
              <a href={link.url} target="_blank" rel="noopener noreferrer" download className="block w-[150px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={link.url} alt={`Link preview image for ${petName || 'this pet'}`} className="w-[150px] h-[79px] rounded-lg border border-midnight-200 object-cover" />
                <span className="mt-1.5 block text-center text-xs font-bold text-midnight-700">Link preview</span>
              </a>
            )}
          </div>
          {captions && (
            <div className="mt-3 space-y-2">
              {['facebook', 'nextdoor', 'instagram'].map((p) =>
                captions[p] ? (
                  <div key={p} className="flex items-start gap-2 p-2.5 rounded-xl bg-midnight-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.65rem] font-bold uppercase tracking-wide text-midnight-500 mb-0.5 capitalize">{p}</p>
                      <p className="text-xs text-midnight-700 line-clamp-3">{captions[p]}</p>
                    </div>
                    <CopyButton text={captions[p]} />
                  </div>
                ) : null
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
