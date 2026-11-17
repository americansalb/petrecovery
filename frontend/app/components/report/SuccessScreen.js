'use client';

/**
 * SuccessScreen - the page after posting, for both reports.
 *
 * It covers the whole screen (app/report/layout.js), so the way out is
 * pinned at its top and never scrolls away: for a lost pet, one yellow
 * button to the pet's search, where the owner can search and see who is
 * looking, and the pet's page beside it (founder, 2026-11-17, on a phone:
 * "Terrible UX over the phone wow"; the page was nearly four screens long
 * with its only way out at the bottom).
 *
 * Then it answers the owner's questions in order. Is it live, and how do
 * I get back here: the lines say what was sent where. What do I do now:
 * share the link, the first card. Is there a lead already: a matching
 * report nearby. Everything else (post it, print it, call the shelters,
 * the questions left, the warning about scams) is folded under one card
 * that names what is in it, each with the real thing inside (the share
 * image, the flyer, the numbers). One yellow button per screen.
 *
 * Lost: the kit arrives from useRecoveryKit as the cascade draws it, so
 * the tiles fill in while the owner reads. Found: the matches are the
 * payoff, then what to do with the animal.
 */

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Check, ChevronDown, ChevronUp, Copy, Download, ExternalLink, Loader2, MapPin, Phone, Printer, RefreshCw, Share2,
} from 'lucide-react';
import { MatchCard } from '@/components/case/MatchCard';
import { bandLabel, matchIsActionable } from '@/components/case/matchGating';
import { caseShortLabel, caseShortUrl } from '@/app/lib/caseShortLink';
import { WIZARD_THEMES } from './wizardTheme';
import FlyerPreview, { formatPhone } from './FlyerPreview';
import DetailsHub from './lost/DetailsHub';
import ScamNote from './ScamNote';
import useRecoveryKit from './recoveryKit/useRecoveryKit';
import { CopyButton } from './recoveryKit/RecoveryKit';
import { captchaHeaders } from '@/app/lib/captchaClient';
import {
  lostLinkLine, lostForceLine, lostNeighborsLine, foundLines, finderReplyNote, KIT_WORDS,
} from './successWords';

/** A line from successWords: strings, and the address or number in bold. */
function Parts({ parts }) {
  return parts.map((p, i) =>
    typeof p === 'string' ? <Fragment key={i}>{p}</Fragment> : <strong key={i} className="font-semibold text-white">{p.strong}</strong>
  );
}

/** How long a second drawing is waited for before the page says it did not come out. */
const REDRAW_WAIT_MS = 3 * 60 * 1000;

/**
 * Drawing the kit again when the first try did not make the flyer or the
 * share image (POST /api/reports/[id]/redraw), and waiting for it. Only
 * for the owner: the details token, or a session.
 */
function useRedraw({ caseId, detailsToken, isLoggedIn, refetch, drawn }) {
  const [state, setState] = useState('idle'); // idle | asking | drawing | missing
  const allowed = Boolean(caseId && (detailsToken || isLoggedIn));

  const start = useCallback(async () => {
    setState('asking');
    try {
      // The bot check middleware asks for on every POST to /api/reports when CAPTCHA is on.
      const res = await fetch(`/api/reports/${encodeURIComponent(caseId)}/redraw`, {
        method: 'POST',
        headers: { ...(detailsToken ? { 'x-details-token': detailsToken } : {}), ...(await captchaHeaders('kit_redraw')) },
      });
      if (res.status === 202) setState('drawing');
      else if (res.ok) {
        refetch();
        setState('idle');
      } else setState('missing');
    } catch {
      setState('missing');
    }
  }, [caseId, detailsToken, refetch]);

  useEffect(() => {
    if (state !== 'drawing') return undefined;
    if (drawn) {
      setState('idle');
      return undefined;
    }
    const poll = setInterval(refetch, 5000);
    const give = setTimeout(() => setState('missing'), REDRAW_WAIT_MS);
    return () => {
      clearInterval(poll);
      clearTimeout(give);
    };
  }, [state, drawn, refetch]);

  return { allowed, state, start };
}

/** The button that draws the kit again, or what became of the last try. */
function RedrawButton({ redraw }) {
  if (!redraw.allowed) return null;
  if (redraw.state === 'drawing') return null;
  return (
    <>
      <button type="button" onClick={redraw.start} disabled={redraw.state === 'asking'} className={`${OUTLINE} w-full`}>
        {redraw.state === 'asking' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
        {KIT_WORDS.tryAgain}
      </button>
      {redraw.state === 'missing' && <p className="text-[13px] text-midnight-500">{KIT_WORDS.stillMissing}</p>}
    </>
  );
}

const CARD = 'rounded-2xl border border-midnight-200 bg-white p-4 lg:p-5';
const EYEBROW = 'text-[11px] font-bold uppercase tracking-[0.08em] text-midnight-500';
const BODY = 'text-[15px] leading-relaxed text-midnight-600';
const NAVY =
  'inline-flex items-center justify-center gap-2 min-h-[52px] rounded-xl bg-gradient-to-b from-midnight-800 to-midnight-900 px-4 text-[15px] font-bold text-white hover:from-midnight-700 transition-colors';
const FLASH =
  'inline-flex items-center justify-center gap-2 min-h-[52px] rounded-xl bg-gradient-to-b from-flash-300 to-flash-400 px-4 text-[15px] font-extrabold text-midnight-900 hover:from-flash-400 hover:to-flash-500 transition-colors';
const OUTLINE =
  'inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl border-2 border-midnight-300 bg-white px-3.5 text-[13px] font-bold text-midnight-900 hover:border-midnight-500 transition-colors';
/** A second button on the dark bar: outlined, never yellow. */
const ON_DARK =
  'inline-flex items-center justify-center gap-2 min-h-[52px] rounded-xl border-2 border-midnight-600 px-4 text-center text-[15px] font-bold leading-tight text-white hover:border-midnight-400 transition-colors';
const SPECIES_WORD = { DOG: 'dog', CAT: 'cat', BIRD: 'bird', RABBIT: 'rabbit', OTHER: 'pet' };

function useShareLink(caseNumber) {
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);
  const url = caseNumber ? caseShortUrl(caseNumber) : '';
  const label = caseNumber ? caseShortLabel(caseNumber) : '';
  const share = (title) => {
    if (!url) return;
    if (canShare) {
      navigator.share({ title, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
    }
  };
  return { url, label, canShare, share };
}

/**
 * The way out, pinned at the top of the screen: it does not scroll with the page. A lost pet's search is the
 * yellow button, the pet's page the second. A found report has its page, and no search.
 */
function Exits({ lost, name, caseNumber }) {
  const page = `/cases/${encodeURIComponent(caseNumber)}`;
  return (
    <nav aria-label="Where to go from here" className="shrink-0 border-b border-midnight-800 bg-midnight-900 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-8">
      <div className="mx-auto flex max-w-6xl gap-2.5">
        {lost ? (
          <>
            <Link href={`/mission-control?mission=${encodeURIComponent(caseNumber)}`} className={`${FLASH} min-w-0 flex-[3] text-center leading-tight lg:flex-none lg:px-6`}>
              Go to {name}&apos;s search
            </Link>
            <Link href={page} className={`${ON_DARK} min-w-0 flex-[2] lg:flex-none`}>
              Open {name}&apos;s page
            </Link>
          </>
        ) : (
          <Link href={page} className={`${ON_DARK} flex-1 lg:flex-none`}>
            Open the report page
          </Link>
        )}
      </div>
    </nav>
  );
}

/** The link to the pet's page, written out so it can be read and kept, with a way to copy it. */
function LinkRow({ link, copyButton = true }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try {
      navigator.clipboard?.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };
  if (!link.url) return null;
  return (
    <div className="flex min-h-[48px] items-center gap-2 rounded-xl border border-midnight-200 bg-midnight-50 py-1 pl-3.5 pr-1.5">
      <span className="min-w-0 flex-1 truncate font-mono text-[15px] font-semibold text-midnight-900">{link.label}</span>
      {copyButton && (
        <button type="button" onClick={copy} className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 px-2 text-[13px] font-bold text-midnight-900">
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      )}
    </div>
  );
}

/** The first card: the link to share, and the buttons that share it. */
function ShareCard({ name, link, title }) {
  const facebook = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link.url)}`;
  return (
    <section className={`${CARD} flex min-w-0 flex-col gap-3`} aria-labelledby="share-heading">
      <h2 id="share-heading" className="text-[19px] font-extrabold leading-6 text-midnight-900">
        Share {name}&apos;s link
      </h2>
      <p className={BODY}>Text it to neighbors and post it in local groups. Anyone who opens it can tell you where they saw {name}.</p>
      {/* With no share sheet the main button copies, so the row does not carry a second copy button. */}
      <LinkRow link={link} copyButton={link.canShare} />
      <div className="flex gap-2.5">
        <button type="button" onClick={() => link.share(title)} className={`${NAVY} flex-1 whitespace-nowrap`}>
          {link.canShare ? <Share2 size={17} /> : <Copy size={17} />}
          {link.canShare ? 'Share the link' : 'Copy the link'}
        </button>
        <a href={facebook} target="_blank" rel="noopener noreferrer" className={`${OUTLINE} min-h-[52px] px-4 text-[15px]`}>
          Facebook
        </a>
      </div>
    </section>
  );
}

/**
 * Everything after the first card, folded: one card that names what is in it, a few words a line, and opens it.
 * Nobody reads four screens on a phone straight after posting (founder, 2026-11-17).
 */
function More({ items, children }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <section className={CARD}>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-h-[44px] w-full items-start justify-between gap-3 text-left">
          <span className="min-w-0">
            <span className="block text-[19px] font-extrabold leading-6 text-midnight-900">More you can do now</span>
            <span className="mt-1.5 block space-y-0.5 text-[15px] leading-snug text-midnight-600">
              {items.map((item) => (
                <span key={item} className="block">
                  {item}
                </span>
              ))}
            </span>
          </span>
          <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[15px] font-bold text-midnight-900">
            {open ? 'Hide' : 'Show'}
            {open ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
          </span>
        </button>
      </section>
      {open && children}
    </>
  );
}

/**
 * What happened, under the bar. A found report's link is here, under its title, where its lines say it is
 * ("Copy it above"); a lost pet's is the first card below, where its lines say it is.
 */
function Header({ variant, title, lines, link = null }) {
  const theme = WIZARD_THEMES[variant];
  return (
    <header className="bg-midnight-900 text-white">
      <div className="mx-auto max-w-6xl space-y-3 px-5 pb-5 pt-4 sm:px-8 lg:space-y-3.5 lg:pb-9 lg:pt-8">
        <div className="flex items-center gap-2.5">
          <span className={`inline-block rounded-md px-2.5 py-0.5 font-mono text-[11px] font-black uppercase tracking-[0.16em] -rotate-2 ${theme.stampChip}`}>
            {theme.stamp}
          </span>
        </div>
        <h1 className="text-[25px] font-extrabold leading-8 tracking-tight lg:text-[34px] lg:leading-10">{title}</h1>
        {link && <DarkLinkRow link={link} />}
        {lines.map((line, i) => (
          <p key={i} className="text-[15px] leading-[22px] text-midnight-300 lg:text-[17px] lg:leading-relaxed">
            {line}
          </p>
        ))}
      </div>
    </header>
  );
}

/** A found report's link on the dark header, with a way to copy it. */
function DarkLinkRow({ link }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try {
      navigator.clipboard?.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };
  if (!link.url) return null;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-midnight-700 bg-midnight-800 py-1 pl-3.5 pr-1.5 lg:max-w-md">
      <span className="min-w-0 flex-1 truncate font-mono text-[15px] font-semibold text-white">{link.label}</span>
      <button type="button" onClick={copy} className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 px-2 text-[13px] font-bold text-flash-400">
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function StepCard({ n, title, children, className = '' }) {
  return (
    <section className={`${CARD} flex min-w-0 flex-col gap-3 ${className}`} aria-labelledby={`step-${n}-heading`}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-midnight-900 text-sm font-extrabold text-flash-400">{n}</span>
        <h2 id={`step-${n}-heading`} className="text-[19px] font-extrabold leading-6 text-midnight-900">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function SocialTile({ asset, working, redrawing, petName }) {
  if (asset?.url) {
    return (
      <div className="flex w-[150px] flex-col gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.url} alt={`Share image for ${petName}`} className="h-[150px] w-[150px] rounded-lg border border-midnight-200 object-cover" />
        <a href={asset.url} target="_blank" rel="noopener noreferrer" download className={`${OUTLINE} px-2`}>
          <Download size={14} />
          Save image
        </a>
      </div>
    );
  }
  return (
    <div className="flex w-[150px] flex-col gap-1.5">
      <div className="flex h-[150px] w-[150px] items-center justify-center rounded-lg border border-dashed border-midnight-300 bg-midnight-50 p-3 text-center">
        <span className="text-[13px] font-semibold leading-snug text-midnight-500">
          {working || redrawing ? KIT_WORDS.shareDrawing : KIT_WORDS.shareMissing}
        </span>
      </div>
      {(working || redrawing) && <span className="text-center text-[13px] text-midnight-500">about a minute</span>}
    </div>
  );
}

function Collapsible({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left text-[15px] font-semibold text-midnight-700"
      >
        <span>{title}</span>
        {open ? <ChevronUp size={18} className="text-midnight-400" /> : <ChevronDown size={18} className="text-midnight-400" />}
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

function LocalGroups({ targets, caption }) {
  return (
    <Collapsible title={`${targets.length} local place${targets.length === 1 ? '' : 's'} we found`}>
      <div className="space-y-1.5">
        {targets.slice(0, 12).map((t) => (
          <a
            key={t.url}
            href={t.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-midnight-50 px-3 py-2 hover:bg-midnight-100 transition-colors"
          >
            <ExternalLink size={14} className="shrink-0 text-midnight-700" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-midnight-900">{t.name}</span>
              {t.coverage ? <span className="block truncate text-[11px] text-midnight-500">Covers {t.coverage}</span> : null}
            </span>
            {t.kind === 'facebook_group' && (
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-midnight-500">
                {t.category === 'COMMUNITY' ? 'Community' : 'Lost pets'}
              </span>
            )}
          </a>
        ))}
      </div>
      {caption && (
        <div className="mt-2">
          <CopyButton text={caption} label="Copy your post" />
        </div>
      )}
      <p className="mt-2 text-[11px] leading-snug text-midnight-500">
        Independent groups from public search results, not groups we run. Follow each group&apos;s posting rules.
      </p>
    </Collapsible>
  );
}

function FoundNearby({ matches, name, word }) {
  const strong = matches.filter((m) => matchIsActionable(m)).length;
  const title =
    matches.length === 1
      ? `Someone found a ${word} near the spot.`
      : `${matches.length} found ${word}s were reported near the spot.`;
  return (
    <section className={`${CARD} space-y-3`} aria-labelledby="found-nearby-heading">
      <p className={EYEBROW}>{matches.length === 1 ? `A found ${word} nearby` : `Found ${word}s nearby`}</p>
      <h2 id="found-nearby-heading" className="text-[21px] font-extrabold leading-7 tracking-tight text-midnight-900">
        {title} {matches.length === 1 ? `Is it ${name}?` : `Is one of them ${name}?`}
      </h2>
      <div className="space-y-2.5">
        {matches.slice(0, 5).map((m, i) => {
          const actionable = matchIsActionable(m);
          const label = bandLabel(m.band);
          return (
            <div key={m.reportId || i} className="flex items-center gap-3 rounded-xl border border-midnight-200 p-3">
              {m.petPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.petPhoto} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-midnight-100 text-midnight-400">
                  <MapPin size={24} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-midnight-900">{m.petName || `Found ${word}`}</p>
                {m.coarseArea && <p className="truncate text-[13px] text-midnight-600">Found near {m.coarseArea}</p>}
                <p className={`flex items-center gap-1 text-[13px] font-bold ${actionable ? 'text-green-700' : 'text-midnight-600'}`}>
                  {actionable && <Check size={14} strokeWidth={3} />}
                  {label?.text || (actionable ? 'Strong match' : 'Possible match')}
                </p>
              </div>
              {m.reportId && (
                <Link
                  href={`/cases/${m.reportId}`}
                  className={`${actionable && i === 0 && strong > 0 ? FLASH : NAVY} shrink-0 min-h-[48px] px-4 text-[14px]`}
                >
                  See it
                </Link>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[13px] text-midnight-500">
        {strong > 0 ? `The finder of a strong match has been told about ${name}'s report. ` : ''}We keep comparing as new found reports come in.
      </p>
    </section>
  );
}

/** The last line: a note, and the dashboard for someone signed in. The report's page is in the bar pinned at the top. */
function Footer({ note, isLoggedIn }) {
  if (!note && !isLoggedIn) return null;
  return (
    <p className="pt-1 text-center text-[15px] leading-relaxed text-midnight-600">
      {note}
      {isLoggedIn && (
        <>
          {' '}
          <Link href="/dashboard" className="inline-flex min-h-[44px] items-center font-bold text-midnight-900 underline underline-offset-4 decoration-midnight-300">
            Back to dashboard
          </Link>
        </>
      )}
    </p>
  );
}

function LostBody({
  caseNumber, caseId, name, word, species, breed, details, detailsToken, isLoggedIn, activation, flyer, link,
}) {
  const { kit, working, refetch } = useRecoveryKit(caseNumber, { initialStatus: activation?.status || 'PENDING' });
  const [allShelters, setAllShelters] = useState(false);
  const social = kit?.assets?.social || [];
  const flyers = kit?.assets?.flyers || [];
  const square = social.find((s) => s.kind === 'SOCIAL_SQUARE');
  const story = social.find((s) => s.kind === 'SOCIAL_STORY');
  const letter = flyers.find((f) => f.kind === 'FLYER_LETTER');
  // The first drawing finished without the flyer or the share image: say so, and offer to draw them again.
  const redraw = useRedraw({ caseId, detailsToken, isLoggedIn, refetch, drawn: Boolean(letter && square?.url) });
  const redrawing = redraw.state === 'drawing';
  const caption = kit?.copy?.captions?.facebook || '';
  const matches = kit?.matches || [];
  const shelters = kit?.shelters || [];
  const hub = Boolean(caseId && (detailsToken || isLoggedIn));
  // What the fold holds, a few words a line, so the owner knows what is under it without opening it.
  const more = ['Post it where neighbors look', 'Print the flyer', 'Call the shelters near the spot', ...(hub ? ['Make the flyer stronger'] : []), 'Before the calls start'];

  return (
    <>
      <ShareCard name={name} link={link} title={`Help find ${name}`} />
      {matches.length > 0 && <FoundNearby matches={matches} name={name} word={word} />}
      <More items={more}>
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5 lg:items-stretch">
          <StepCard n={1} title="Post it where neighbors look">
            <p className={BODY}>Facebook, Nextdoor, the neighborhood group chat. One share often reaches the person who sees {name}.</p>
            <div className="flex items-start gap-3">
              <SocialTile asset={square} working={working} redrawing={redrawing} petName={name} />
              {story?.url && (
                <a href={story.url} target="_blank" rel="noopener noreferrer" download className="block w-[84px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={story.url} alt={`Story share image for ${name}`} className="h-[150px] w-[84px] rounded-lg border border-midnight-200 object-cover" />
                  <span className="mt-1.5 block text-center text-[13px] font-bold text-midnight-700">Story size</span>
                </a>
              )}
            </div>
            {!working && !square?.url && letter && <RedrawButton redraw={redraw} />}
            {caption && (
              <div className="min-w-0 space-y-2 rounded-xl bg-midnight-50 p-3">
                <p className={EYEBROW}>Your post</p>
                <p className="line-clamp-3 text-[14px] leading-snug text-midnight-900 [overflow-wrap:anywhere]">{caption}</p>
                <CopyButton text={caption} label="Copy post" />
              </div>
            )}
            {kit?.shareTargets?.length > 0 && (
              <div className="border-t border-midnight-100 pt-1 lg:mt-auto">
                <LocalGroups targets={kit.shareTargets} caption={caption} />
              </div>
            )}
          </StepCard>

          <StepCard n={2} title="Print the flyer and put it up">
            <div className="flex items-start gap-3.5">
              <div className="w-[120px] shrink-0 overflow-hidden rounded-md shadow-card">
                <FlyerPreview {...flyer} variant="lost" width={120} />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <p className={BODY}>Letter with tear-off tabs, two half sheets, an 11 by 17 poster. Each has the map and the QR code back to {name}&apos;s page.</p>
                <p className="text-[13px] leading-snug text-midnight-600">Corners, mailboxes, store windows, at eye level.</p>
              </div>
            </div>
            {letter ? (
              <a href={letter.url} target="_blank" rel="noopener noreferrer" className={NAVY}>
                <Printer size={17} />
                Open the flyer (PDF)
              </a>
            ) : (
              <>
                <p className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-midnight-50 px-4 text-[14px] font-semibold text-midnight-500">
                  {(working || redrawing) && <Loader2 size={16} className="animate-spin" />}
                  {working ? KIT_WORDS.flyerDrawing : redrawing ? KIT_WORDS.flyerRedrawing : KIT_WORDS.flyerMissing}
                </p>
                {!working && <RedrawButton redraw={redraw} />}
              </>
            )}
          </StepCard>

          <StepCard n={3} title="Call the shelters near the spot today">
            <p className={BODY}>Ask them to note {name}&apos;s report and your number. Call again in two days.</p>
            {shelters.length > 0 ? (
              <div>
                {(allShelters ? shelters : shelters.slice(0, 3)).map((s, i) => (
                  <div key={`${s.name}-${i}`} className="flex items-center gap-3 border-t border-midnight-100 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold text-midnight-900">{s.name}</p>
                      <p className="truncate text-[13px] text-midnight-500">
                        {s.address}
                        {s.distanceMi != null ? `, ${s.distanceMi} mi` : ''}
                      </p>
                    </div>
                    {s.phone && (
                      <a href={`tel:${s.phone}`} className={`${NAVY} min-h-[44px] px-3.5 text-[13px]`}>
                        <Phone size={14} />
                        Call
                      </a>
                    )}
                  </div>
                ))}
                {shelters.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setAllShelters((a) => !a)}
                    className="flex min-h-[44px] w-full items-center justify-center border-t border-midnight-100 text-[15px] font-bold text-midnight-900 underline underline-offset-4 decoration-midnight-300"
                  >
                    {allShelters ? 'Fewer' : `All ${shelters.length} shelters`}
                  </button>
                )}
              </div>
            ) : kit?.sheltersGuidance ? (
              <p className={BODY}>{kit.sheltersGuidance}</p>
            ) : (
              <p className="flex items-center gap-2 text-[14px] text-midnight-500">
                {working && <Loader2 size={16} className="animate-spin" />}
                {working ? KIT_WORDS.sheltersFinding : KIT_WORDS.sheltersMissing}
              </p>
            )}
          </StepCard>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr] lg:gap-5">
          {hub ? (
            <DetailsHub
              caseId={caseId}
              token={detailsToken}
              species={species}
              name={name}
              details={details}
              breed={breed}
              title="Make the flyer stronger"
              intro={`One tap each. Each answer goes on ${name}'s flyer and page within a minute.`}
              limit={3}
            />
          ) : (
            <div className="hidden lg:block" />
          )}
          <ScamNote compact title="Before the calls start" />
        </div>
      </More>

      <Footer note="" isLoggedIn={isLoggedIn} />
    </>
  );
}

function FoundBody({ word, matches, isLoggedIn, link, replyNote }) {
  const facebook = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link.url)}`;
  const shown = matches.slice(0, 5);
  return (
    <>
      <section className={`${CARD} space-y-3`} aria-labelledby="matches-heading">
        <p className={EYEBROW}>Lost pets reported nearby</p>
        {shown.length > 0 ? (
          <>
            <h2 id="matches-heading" className="text-[21px] font-extrabold leading-7 tracking-tight text-midnight-900">
              {shown.length === 1
                ? `A ${word} was reported lost near where you found this one. Is it the same ${word}?`
                : `${shown.length} ${word}s were reported lost near where you found this one. Is it one of them?`}
            </h2>
            <div className="space-y-3">
              {shown.map((match) => (
                <MatchCard
                  key={match.reportId}
                  connectAvailable={false}
                  replyNote={replyNote}
                  lostPageUrl={match.reportId ? `/cases/${encodeURIComponent(match.reportId)}` : null}
                  match={{
                    matchId: match.reportId,
                    petPhoto: match.petPhoto,
                    petName: match.petName,
                    species: match.petSpecies,
                    coarseArea: match.coarseArea,
                    pTrueMatch: match.pTrueMatch,
                    matchSource: match.matchSource,
                    band: match.band,
                    canConnect: match.canConnect,
                    ownerTold: match.ownerTold,
                  }}
                />
              ))}
            </div>
          </>
        ) : (
          <h2 id="matches-heading" className="text-[21px] font-extrabold leading-7 tracking-tight text-midnight-900">
            No lost report matches yet.
          </h2>
        )}
        <p className="text-[13px] text-midnight-500">We keep comparing as new lost reports come in.</p>
      </section>

      <p className={`${EYEBROW} pl-1`}>While you have the {word}</p>
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5 lg:items-stretch">
        <StepCard n={1} title="Keep them somewhere calm">
          <p className={BODY}>A quiet room, water, away from other pets and traffic. A found pet is often scared and may bolt from an open door.</p>
        </StepCard>
        <StepCard n={2} title="Get the chip scanned">
          <p className={BODY}>Any vet or shelter scans for a microchip, usually at no charge. A chip leads straight to the owner.</p>
          <Link href="/shelters" className={`${NAVY} lg:mt-auto`}>
            <MapPin size={17} />
            Shelters and vets near you
          </Link>
        </StepCard>
        <StepCard n={3} title="Share the report">
          <p className={BODY}>The owner&apos;s friends and neighbors often see a found post before the owner does.</p>
          <div className="flex gap-2.5 lg:mt-auto">
            <button type="button" onClick={() => link.share(`Found ${word}: is this yours?`)} className={`${NAVY} flex-1`}>
              {link.canShare ? <Share2 size={17} /> : <Copy size={17} />}
              {link.canShare ? 'Share the link' : 'Copy the link'}
            </button>
            <a href={facebook} target="_blank" rel="noopener noreferrer" className={`${OUTLINE} min-h-[52px] px-4 text-[15px]`}>
              Facebook
            </a>
          </div>
        </StepCard>
      </div>

      <Footer note={replyNote || ''} isLoggedIn={isLoggedIn} />
    </>
  );
}

export default function SuccessScreen({
  variant = 'lost',
  caseNumber,
  petName,
  species,
  isLoggedIn = false,
  accountCreated = false,
  contactEmail,
  contactPhone, // phone-only guests: where the case-link SMS went
  told, // from the create response: what went, and to whom (app/components/report/successWords.js)
  // lost
  squadsNotified = 0,
  assignedSquad,
  activation, // { caseNumber, status } snapshot from the create response; drives the live kit
  caseId, // the case's id, for the details hub
  detailsToken, // from the create response: lets a guest add details before they have a session
  details, // the questionnaire so far (app/lib/caseDetails.js)
  breed,
  flyer = {}, // FlyerPreview props, from the answers
  // found
  matches = [],
  matchesNotified = 0,
}) {
  const link = useShareLink(caseNumber);
  const word = SPECIES_WORD[String(species || 'OTHER').toUpperCase()] || 'pet';
  const name = (petName || '').trim() || `the ${word}`;
  const lost = variant === 'lost';
  const phoneLabel = contactPhone ? formatPhone(contactPhone) : '';

  // Only what the create route says happened (successWords.js).
  const lines = useMemo(() => {
    const out = [];
    if (lost) {
      const linkLine = lostLinkLine({ contactEmail, contactPhone, phoneLabel, accountCreated, isLoggedIn, told, name });
      if (linkLine) out.push(<Parts parts={linkLine} />);
      out.push(
        <>
          {lostForceLine({ assignedSquad, squadsNotified, name })}
          {assignedSquad?.id && (
            <>
              {' '}
              {/* A whole finger's height, not the height of the line of text it sits in. */}
              <Link href={`/rescue-forces/${assignedSquad.id}`} className="inline-flex min-h-[44px] items-center align-middle font-semibold text-white underline underline-offset-4 decoration-midnight-500">
                See the force
              </Link>
            </>
          )}
        </>
      );
      const neighbors = lostNeighborsLine({ told });
      if (neighbors) out.push(<>{neighbors}</>);
    } else {
      for (const line of foundLines({ contactEmail, contactPhone, phoneLabel, told, matchesNotified, word })) {
        out.push(<Parts parts={line} />);
      }
    }
    return out;
  }, [lost, contactEmail, contactPhone, phoneLabel, accountCreated, isLoggedIn, told, assignedSquad, squadsNotified, name, matchesNotified, word]);
  const replyNote = lost ? null : finderReplyNote({ contactEmail, contactPhone, phoneLabel });

  if (!caseNumber) {
    return (
      <div className="flex-1 overflow-y-auto">
        <Header variant={variant} title={lost ? `${name}'s report is live.` : 'Thank you. The report is live.'} lines={lines} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-midnight-900">
      {/* Pinned: the page scrolls under it, so the way out is always on the screen. */}
      <Exits lost={lost} name={name} caseNumber={caseNumber} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-midnight-50 animate-slide-up">
        <Header variant={variant} title={lost ? `${name}'s report is live.` : 'Thank you. The report is live.'} lines={lines} link={lost ? null : link} />
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8 lg:space-y-5 lg:py-7">
          {lost ? (
            <LostBody
              caseNumber={caseNumber}
              caseId={caseId}
              name={name}
              word={word}
              species={species}
              breed={breed}
              details={details}
              detailsToken={detailsToken}
              isLoggedIn={isLoggedIn}
              activation={activation}
              flyer={flyer}
              link={link}
            />
          ) : (
            <FoundBody word={word} matches={matches} isLoggedIn={isLoggedIn} link={link} replyNote={replyNote} />
          )}
        </div>
      </div>
    </div>
  );
}
