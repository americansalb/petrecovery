'use client';

/**
 * RecoveryKit — the live "here is everything we just did for you" dashboard on
 * the lost-report success screen (and reused on the case page). Reads the
 * durable /recovery-kit endpoint (so it renders fully on a cold reload with no
 * live connection) and layers SSE + a 3s poll on top so the checklist lights up
 * as each cascade action lands.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check, Loader2, Sparkles, FileText, Image as ImageIcon, MapPin, Users, Search,
  Megaphone, QrCode, Copy, Download, Heart, ChevronDown, ChevronUp, Mail, Bell,
} from 'lucide-react';
import { MatchCard } from '@/components/case/MatchCard';
import useRecoveryKitStream from './useRecoveryKitStream';

const STEP_META = {
  qr: { icon: QrCode, doneLabel: () => 'QR code ready' },
  ai_copy: { icon: Sparkles, doneLabel: () => 'Flyer copy written' },
  reverse_match: {
    icon: Heart,
    doneLabel: (n) => (n > 0 ? `${n} possible match${n === 1 ? '' : 'es'} found` : 'Checked every found report'),
  },
  shelters: { icon: MapPin, doneLabel: (n) => (n > 0 ? `${n} shelters near you` : 'Shelter call-list ready') },
  neighbor_alert: { icon: Megaphone, doneLabel: (n) => (n > 0 ? `${n} neighbor${n === 1 ? '' : 's'} alerted` : 'Neighbors notified') },
  rescue_force: { icon: Users, doneLabel: () => 'Rescue force is on the case' },
  flyers: { icon: FileText, doneLabel: (n) => `${n || 3} printable flyers ready` },
  social: { icon: ImageIcon, doneLabel: (n) => `${n || 3} share images ready` },
  search_plan: { icon: Search, doneLabel: () => 'Your search plan is ready' },
  recovery_email: { icon: Mail, doneLabel: () => 'Recovery kit emailed to you' },
  followups: { icon: Bell, doneLabel: () => 'We’ll check in with you along the way' },
};
const STEP_ORDER = ['reverse_match', 'flyers', 'social', 'search_plan', 'shelters', 'neighbor_alert', 'rescue_force', 'recovery_email', 'followups', 'ai_copy', 'qr'];

function isTerminal(status) {
  return ['COMPLETE', 'PARTIAL', 'FAILED'].includes(status);
}

function ChecklistItem({ stepKey, step }) {
  const meta = STEP_META[stepKey];
  if (!meta) return null;
  const Icon = meta.icon;
  const status = step?.status || 'PENDING';
  const running = status === 'PENDING' || status === 'RUNNING';
  const done = status === 'SUCCESS';
  const skipped = status === 'SKIPPED' || status === 'FAILED';
  if (skipped) return null; // don't show N/A or failed items as noise

  return (
    <div className="flex items-center gap-3 py-2">
      <span
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
          done ? 'bg-emerald-500' : 'bg-midnight-100'
        }`}
      >
        {done ? (
          <Check size={15} className="text-white" strokeWidth={3} />
        ) : (
          <Loader2 size={14} className="text-midnight-400 animate-spin" />
        )}
      </span>
      <Icon size={16} className={done ? 'text-midnight-500' : 'text-midnight-300'} />
      <span className={`text-sm ${done ? 'font-semibold text-midnight-800' : 'text-midnight-400'}`}>
        {done ? meta.doneLabel(step.count || 0) : running ? meta.pendingLabel || 'Working on it…' : ''}
      </span>
    </div>
  );
}

function AssetChip({ href, label, icon: Icon }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-midnight-100 text-midnight-700 text-sm font-semibold hover:bg-midnight-200 transition-colors"
    >
      <Icon size={15} />
      {label}
    </a>
  );
}

function CopyButton({ text, label = 'Copy caption' }) {
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
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-midnight-200 text-midnight-600 text-xs font-semibold hover:border-midnight-400 transition-colors"
    >
      {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
      {copied ? 'Copied' : label}
    </button>
  );
}

function Panel({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-midnight-100 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-midnight-50 transition-colors"
      >
        {Icon && <Icon size={17} className="text-midnight-500" />}
        <span className="flex-1 font-bold text-midnight-800 text-sm">{title}</span>
        {open ? <ChevronUp size={16} className="text-midnight-400" /> : <ChevronDown size={16} className="text-midnight-400" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function RecoveryKit({ caseNumber, initialStatus = 'PENDING', fallback = null, mode = 'full', petName }) {
  // 'full'  = live success-screen dashboard (checklist + matches + assets + plan)
  // 'share' = public case-page toolkit (scannable QR + printable flyers + share
  //           images/captions only; no internal checklist or owner-facing matches)
  const shareMode = mode === 'share';
  const [kit, setKit] = useState(null);
  const [status, setStatus] = useState(initialStatus);
  const pollRef = useRef(null);

  const fetchKit = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${encodeURIComponent(caseNumber)}/recovery-kit`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setKit(data);
      if (data.status) setStatus(data.status);
    } catch {
      /* transient — the poll retries */
    }
  }, [caseNumber]);

  // initial load
  useEffect(() => {
    if (caseNumber) fetchKit();
  }, [caseNumber, fetchKit]);

  // poll until terminal
  useEffect(() => {
    if (!caseNumber || isTerminal(status)) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(fetchKit, 3000);
    return () => pollRef.current && clearInterval(pollRef.current);
  }, [caseNumber, status, fetchKit]);

  // live SSE: refetch on any event (cheap; keeps the durable read authoritative)
  const debRef = useRef(null);
  useRecoveryKitStream(
    caseNumber,
    () => {
      if (debRef.current) clearTimeout(debRef.current);
      debRef.current = setTimeout(fetchKit, 400);
    },
    { enabled: Boolean(caseNumber) && !isTerminal(status) }
  );

  const steps = kit?.steps ? Object.fromEntries(kit.steps.map((s) => [s.key, s])) : {};
  const anyStep = kit?.steps?.length > 0;
  const working = !isTerminal(status);

  // Share mode has no live "building…" state — stay invisible until loaded so
  // the case page never flashes an empty panel.
  if (shareMode && !kit) return fallback;

  // If there is no activation at all (older cases / cascade never seeded), show
  // the caller's legacy static list instead of an empty dashboard.
  if (kit && kit.exists === false) return fallback;

  // Share mode is a pure asset toolkit: if nothing shareable rendered (all
  // assets failed, or still building on a cold case-page load), show nothing.
  if (shareMode && kit) {
    const hasShareable =
      kit.assets?.qr?.url || kit.assets?.flyers?.length > 0 || kit.assets?.social?.length > 0;
    if (!hasShareable) return fallback;
  }

  return (
    <div className="text-left">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={18} className="text-flash-500" />
        <h3 className="font-extrabold text-midnight-900">
          {shareMode
            ? `${petName ? `${petName}'s` : 'Your'} share kit`
            : working
              ? 'Building your recovery kit…'
              : 'Your recovery kit is ready'}
        </h3>
      </div>
      <p className="text-sm text-midnight-500 mb-4">
        {shareMode
          ? 'Print a flyer, post an image, or share the link — every one is another pair of eyes.'
          : 'The moment you posted, we went to work. Here’s everything we did to help bring them home.'}
      </p>

      {/* Live checklist (success screen only) */}
      {!shareMode && (
        <div className="rounded-2xl border border-midnight-100 bg-white px-4 py-2 mb-4">
          {anyStep ? (
            STEP_ORDER.filter((k) => steps[k]).map((k) => <ChecklistItem key={k} stepKey={k} step={steps[k]} />)
          ) : (
            <div className="flex items-center gap-3 py-3 text-sm text-midnight-400">
              <Loader2 size={15} className="animate-spin" /> Starting…
            </div>
          )}
        </div>
      )}

      {/* Scannable QR (share mode only) — the printable/postable link back here */}
      {shareMode && kit?.assets?.qr?.url && (
        <div className="mb-4 flex items-center gap-4 rounded-2xl border border-midnight-100 bg-white p-4">
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
            <p className="text-xs text-midnight-500 leading-relaxed">
              Point a phone camera at this code to jump straight here — it&apos;s printed on every flyer, too.
            </p>
            <a
              href={kit.assets.qr.url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-midnight-600 hover:text-midnight-900"
            >
              <Download size={13} /> Download QR
            </a>
          </div>
        </div>
      )}

      {/* Possible matches — the payoff (success screen only) */}
      {!shareMode && kit?.matches?.length > 0 && (
        <div className="mb-4">
          <Panel title={`${kit.matches.length} possible match${kit.matches.length === 1 ? '' : 'es'} near you`} icon={Heart}>
            <p className="text-xs text-midnight-500 mb-3">
              We compared your report with found pets nearby. Strong matches alert the finder automatically.
            </p>
            <div className="space-y-3">
              {kit.matches.slice(0, 5).map((m) => (
                <MatchCard
                  key={m.reportId}
                  connectAvailable={false}
                  match={{
                    matchId: m.reportId,
                    petPhoto: m.petPhoto,
                    petName: m.petName,
                    species: m.petSpecies,
                    coarseArea: m.coarseArea,
                    pTrueMatch: m.pTrueMatch,
                    matchSource: m.matchSource,
                    band: m.band,
                    canConnect: m.canConnect,
                  }}
                />
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* Flyers */}
      {kit?.assets?.flyers?.length > 0 && (
        <div className="mb-3">
          <Panel title="Printable flyers" icon={FileText}>
            <div className="flex flex-wrap gap-2">
              {kit.assets.flyers.map((f) => (
                <AssetChip key={f.kind} href={f.url} label={f.label} icon={Download} />
              ))}
            </div>
            <p className="text-xs text-midnight-400 mt-2">Print and post them around the neighborhood — each has a QR code back to this page.</p>
          </Panel>
        </div>
      )}

      {/* Social images + captions */}
      {kit?.assets?.social?.length > 0 && (
        <div className="mb-3">
          <Panel title="Share on social" icon={ImageIcon}>
            <div className="flex flex-wrap gap-2">
              {kit.assets.social.map((s) => (
                <AssetChip key={s.kind} href={s.url} label={s.label} icon={Download} />
              ))}
            </div>
            {kit.copy?.captions && (
              <div className="mt-3 space-y-2">
                {['facebook', 'nextdoor', 'instagram'].map((p) =>
                  kit.copy.captions[p] ? (
                    <div key={p} className="flex items-start gap-2 p-2.5 rounded-xl bg-midnight-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-midnight-400 mb-0.5 capitalize">{p}</p>
                        <p className="text-xs text-midnight-600 line-clamp-3">{kit.copy.captions[p]}</p>
                      </div>
                      <CopyButton text={kit.copy.captions[p]} label="Copy" />
                    </div>
                  ) : null
                )}
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* Search plan (success screen only) */}
      {!shareMode && kit?.searchPlan?.sections?.length > 0 && (
        <div className="mb-3">
          <Panel title="Your search plan" icon={Search} defaultOpen={false}>
            {kit.searchPlan.narrative && (
              <p className="text-sm text-midnight-600 leading-relaxed mb-3">{kit.searchPlan.narrative}</p>
            )}
            <div className="space-y-3">
              {kit.searchPlan.sections.map((sec, i) => (
                <div key={i}>
                  <p className="text-xs font-bold uppercase tracking-wide text-midnight-500 mb-1">{sec.title}</p>
                  <ul className="space-y-1">
                    {sec.items.map((it, j) => (
                      <li key={j} className="text-sm text-midnight-600 flex gap-2">
                        <span className="text-flash-500 mt-0.5">•</span>
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* Shelters to call (success screen only) */}
      {!shareMode && (kit?.shelters?.length > 0 || kit?.sheltersGuidance) && (
        <div className="mb-3">
          <Panel title="Shelters to call today" icon={MapPin} defaultOpen={false}>
            {kit.shelters?.length > 0 ? (
              <div className="space-y-2">
                {kit.shelters.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-midnight-50">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-midnight-800 truncate">{s.name}</p>
                      <p className="text-xs text-midnight-400 truncate">{s.address}{s.distanceMi != null ? ` · ${s.distanceMi} mi` : ''}</p>
                    </div>
                    {s.phone && (
                      <a href={`tel:${s.phone}`} className="shrink-0 px-3 py-1.5 rounded-lg bg-midnight-900 text-white text-xs font-semibold">
                        Call
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-midnight-600 leading-relaxed">{kit.sheltersGuidance}</p>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
