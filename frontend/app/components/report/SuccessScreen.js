'use client';

/**
 * SuccessScreen - the page after posting, for both reports.
 *
 * It answers the owner's questions in order. Is it live, and how do I get
 * back here: the link, which was emailed or texted. Is there a lead
 * already: a matching report nearby goes first. What do I do now: post
 * it, print it, call the shelters, each with the real thing inside (the
 * share image, the flyer, the numbers). What would make it better: the
 * questions left, one tap each. Then the one warning that matters once
 * the calls start, and the way to the pet's page. One yellow button per
 * screen.
 *
 * Lost: the kit arrives from useRecoveryKit as the cascade draws it, so
 * the tiles fill in while the owner reads. Found: the matches are the
 * payoff, then what to do with the animal.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Camera, Check, ChevronDown, ChevronUp, Copy, Download, ExternalLink, Loader2, MapPin, Phone, Printer, Share2,
} from 'lucide-react';
import { MatchCard } from '@/components/case/MatchCard';
import { bandLabel, matchIsActionable } from '@/components/case/matchGating';
import { caseShortLabel, caseShortUrl } from '@/app/lib/caseShortLink';
import { WIZARD_THEMES } from './wizardTheme';
import FlyerPreview from './FlyerPreview';
import DetailsHub from './lost/DetailsHub';
import ScamNote from './ScamNote';
import useRecoveryKit from './recoveryKit/useRecoveryKit';
import { CopyButton } from './recoveryKit/RecoveryKit';

const CARD = 'rounded-2xl border border-midnight-200 bg-white p-4 lg:p-5';
const EYEBROW = 'text-[11px] font-bold uppercase tracking-[0.08em] text-midnight-500';
const BODY = 'text-[15px] leading-relaxed text-midnight-600';
const NAVY =
  'inline-flex items-center justify-center gap-2 min-h-[52px] rounded-xl bg-gradient-to-b from-midnight-800 to-midnight-900 px-4 text-[15px] font-bold text-white hover:from-midnight-700 transition-colors';
const FLASH =
  'inline-flex items-center justify-center gap-2 min-h-[52px] rounded-xl bg-gradient-to-b from-flash-300 to-flash-400 px-4 text-[15px] font-extrabold text-midnight-900 hover:from-flash-400 hover:to-flash-500 transition-colors';
const OUTLINE =
  'inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl border-2 border-midnight-300 bg-white px-3.5 text-[13px] font-bold text-midnight-900 hover:border-midnight-500 transition-colors';
const SPECIES_WORD = { DOG: 'dog', CAT: 'cat', BIRD: 'bird', RABBIT: 'rabbit', OTHER: 'pet' };

const STEP_META = {
  reverse_match: (n) => (n > 0 ? `Compared with found reports nearby: ${n} possible match${n === 1 ? '' : 'es'}` : 'Compared with every found report nearby'),
  flyers: () => 'Drew the flyers',
  social: () => 'Drew the share images',
  share_targets: (n) => (n > 0 ? `Found ${n} local place${n === 1 ? '' : 's'} to post` : 'Looked for local places to post'),
  search_plan: () => 'Wrote a search plan',
  shelters: (n) => (n > 0 ? `Listed ${n} shelters near the spot` : 'Looked up the shelters near the spot'),
  neighbor_alert: (n) => (n > 0 ? `Alerted ${n} neighbor${n === 1 ? '' : 's'}` : 'Alerted neighbors'),
  rescue_force: () => 'Sent the report to the Rescue Force',
  recovery_email: () => 'Emailed you the kit',
  followups: () => 'Set reminders to check in with you',
  ai_copy: () => 'Wrote the flyer copy',
  qr: () => 'Made the QR code',
};
const STEP_ORDER = ['reverse_match', 'flyers', 'social', 'share_targets', 'search_plan', 'shelters', 'neighbor_alert', 'rescue_force', 'recovery_email', 'followups', 'ai_copy', 'qr'];

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

function Header({ variant, title, link, lines, aside }) {
  const theme = WIZARD_THEMES[variant];
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
  const linkRow = link.url ? (
    <div className="flex items-center gap-2 rounded-xl border border-midnight-700 bg-midnight-800 py-1 pl-3.5 pr-1.5">
      <span className="min-w-0 flex-1 truncate font-mono text-[15px] font-semibold text-white">{link.label}</span>
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 px-2 text-[13px] font-bold text-flash-400"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  ) : null;
  return (
    <header className="bg-midnight-900 text-white">
      <div className="mx-auto max-w-6xl px-5 pt-[max(2.75rem,env(safe-area-inset-top))] pb-6 sm:px-8 lg:grid lg:grid-cols-[1fr_420px] lg:items-start lg:gap-12 lg:pt-10 lg:pb-9">
        <div className="space-y-3.5">
          <div className="flex items-center gap-2.5">
            <span className={`inline-block rounded-md px-2.5 py-0.5 font-mono text-[11px] font-black uppercase tracking-[0.16em] -rotate-2 ${theme.stampChip}`}>
              {theme.stamp}
            </span>
          </div>
          <h1 className="text-[27px] font-extrabold leading-8 tracking-tight lg:text-[34px] lg:leading-10">{title}</h1>
          <div className="lg:hidden">{linkRow}</div>
          {lines.map((line, i) => (
            <p key={i} className="text-[15px] leading-relaxed text-midnight-300 lg:text-[17px]">
              {line}
            </p>
          ))}
        </div>
        <div className="hidden lg:block space-y-2.5">
          {linkRow}
          {aside}
        </div>
      </div>
    </header>
  );
}

function StepCard({ n, title, children, className = '' }) {
  return (
    <section className={`${CARD} flex flex-col gap-3 ${className}`} aria-labelledby={`step-${n}-heading`}>
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

function SocialTile({ asset, working, petName }) {
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
          {working ? 'Drawing the share image' : 'The share image is on the page when it is ready'}
        </span>
      </div>
      {working && <span className="text-center text-[13px] text-midnight-500">about a minute</span>}
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
      <p className="text-[13px] text-midnight-500">The finder has been told about {name}&apos;s report. We keep comparing as new found reports come in.</p>
    </section>
  );
}

function PhotoNudge({ caseUrl, word }) {
  return (
    <section className="flex items-start gap-3 rounded-2xl border border-flash-300 bg-flash-50 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-flash-400 text-midnight-900">
        <Camera size={19} />
      </span>
      <div className="min-w-0 space-y-1.5">
        <p className="text-[15px] font-bold text-midnight-900">No photo yet</p>
        <p className="text-sm leading-snug text-midnight-700">
          People recognize a {word} from a photo faster than from any description. A quick phone picture is enough. Add one from the page.
        </p>
        <Link href={caseUrl} className={`${OUTLINE} border-midnight-900`}>
          Add a photo
        </Link>
      </div>
    </section>
  );
}

function Footer({ caseUrl, label, note, isLoggedIn }) {
  return (
    <div className="pt-1">
      <Link href={caseUrl} className={`${NAVY} w-full min-h-[54px] text-[17px] font-extrabold`}>
        {label}
      </Link>
      <p className="mt-3 text-center text-[15px] leading-relaxed text-midnight-600">
        {note}
        {isLoggedIn && (
          <>
            {' '}
            <Link href="/dashboard" className="font-bold text-midnight-900 underline underline-offset-4 decoration-midnight-300">
              Back to dashboard
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

function LostBody({
  caseNumber, caseId, name, word, species, breed, details, detailsToken, isLoggedIn, photoMissing, activation, flyer, link,
}) {
  const { kit, working } = useRecoveryKit(caseNumber, { initialStatus: activation?.status || 'PENDING' });
  const [allShelters, setAllShelters] = useState(false);
  const caseUrl = `/cases/${caseNumber}`;
  const social = kit?.assets?.social || [];
  const flyers = kit?.assets?.flyers || [];
  const square = social.find((s) => s.kind === 'SOCIAL_SQUARE');
  const story = social.find((s) => s.kind === 'SOCIAL_STORY');
  const letter = flyers.find((f) => f.kind === 'FLYER_LETTER');
  const half = flyers.find((f) => f.kind === 'FLYER_HALF');
  const poster = flyers.find((f) => f.kind === 'FLYER_POSTER');
  const caption = kit?.copy?.captions?.facebook || '';
  const matches = kit?.matches || [];
  const shelters = kit?.shelters || [];
  const steps = kit?.steps || [];
  const stepByKey = Object.fromEntries(steps.map((s) => [s.key, s]));
  const done = STEP_ORDER.filter((k) => stepByKey[k]?.status === 'SUCCESS');
  const facebook = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link.url)}`;
  const shareIsPrimary = matches.length === 0;

  return (
    <>
      {matches.length > 0 && <FoundNearby matches={matches} name={name} word={word} />}
      {photoMissing && <PhotoNudge caseUrl={caseUrl} word={word} />}

      <p className={`${EYEBROW} pl-1`}>Do this now</p>
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-5 lg:items-stretch">
        <StepCard n={1} title="Post it where neighbors look">
          <p className={BODY}>Facebook, Nextdoor, the neighborhood group chat. One share often reaches the person who sees {name}.</p>
          <div className="flex items-start gap-3">
            <SocialTile asset={square} working={working} petName={name} />
            {story?.url && (
              <a href={story.url} target="_blank" rel="noopener noreferrer" download className="block w-[84px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={story.url} alt={`Story share image for ${name}`} className="h-[150px] w-[84px] rounded-lg border border-midnight-200 object-cover" />
                <span className="mt-1.5 block text-center text-[13px] font-bold text-midnight-700">Story size</span>
              </a>
            )}
          </div>
          {caption && (
            <div className="space-y-2 rounded-xl bg-midnight-50 p-3">
              <p className={EYEBROW}>Your post</p>
              <p className="text-[14px] leading-snug text-midnight-900">{caption}</p>
              <CopyButton text={caption} label="Copy post" />
            </div>
          )}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => link.share(`Help find ${name}`)}
              className={`${shareIsPrimary ? FLASH : NAVY} flex-1`}
            >
              {link.canShare ? <Share2 size={17} /> : <Copy size={17} />}
              {link.canShare ? 'Share the link' : 'Copy the link'}
            </button>
            <a href={facebook} target="_blank" rel="noopener noreferrer" className={`${OUTLINE} min-h-[52px] px-4 text-[15px]`}>
              Facebook
            </a>
          </div>
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
            <p className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-midnight-50 px-4 text-[14px] font-semibold text-midnight-500">
              {working && <Loader2 size={16} className="animate-spin" />}
              {working ? 'Drawing the flyer, about a minute' : 'The flyer is on the page when it is ready'}
            </p>
          )}
          {(half || poster) && (
            <div className="flex gap-2.5 lg:mt-auto">
              {half && (
                <a href={half.url} target="_blank" rel="noopener noreferrer" className={`${OUTLINE} flex-1`}>
                  Half sheets
                </a>
              )}
              {poster && (
                <a href={poster.url} target="_blank" rel="noopener noreferrer" className={`${OUTLINE} flex-1`}>
                  Poster
                </a>
              )}
            </div>
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
              {working ? 'Finding the shelters near the spot' : 'The shelter list is on the page when it is ready.'}
            </p>
          )}
          <p className="text-[13px] leading-snug text-midnight-500 lg:mt-auto">The list is on {name}&apos;s page too.</p>
        </StepCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr] lg:gap-5">
        {caseId && (detailsToken || isLoggedIn) ? (
          <DetailsHub
            caseId={caseId}
            token={detailsToken}
            species={species}
            name={name}
            details={details}
            breed={breed}
            title="Make the flyer stronger"
            intro={`One tap each. Each answer goes on ${name}'s flyer and page within a minute.`}
            limit={4}
          />
        ) : (
          <div className="hidden lg:block" />
        )}
        <ScamNote compact title="Before the calls start" />
      </div>

      <Footer caseUrl={caseUrl} label={`Open ${name}'s page`} note="Sightings, the map and your tools live there." isLoggedIn={isLoggedIn} />

      {(done.length > 0 || kit?.searchPlan?.sections?.length > 0) && (
        <div className="px-1">
          <Collapsible title="What we did with your report">
            <ul className="space-y-1.5 pt-1">
              {done.map((k) => (
                <li key={k} className="flex items-start gap-2 text-[14px] text-midnight-700">
                  <Check size={15} strokeWidth={3} className="mt-0.5 shrink-0 text-green-600" />
                  <span>{STEP_META[k](stepByKey[k].count || 0)}</span>
                </li>
              ))}
            </ul>
            {kit?.searchPlan?.sections?.length > 0 && (
              <div className="mt-4 space-y-3 rounded-xl bg-midnight-50 p-3.5">
                <p className="text-[15px] font-extrabold text-midnight-900">Your search plan</p>
                {kit.searchPlan.narrative && <p className="text-[14px] leading-relaxed text-midnight-700">{kit.searchPlan.narrative}</p>}
                {kit.searchPlan.sections.map((sec, i) => (
                  <div key={i}>
                    <p className={EYEBROW}>{sec.title}</p>
                    <ul className="mt-1 space-y-1">
                      {sec.items.map((it, j) => (
                        <li key={j} className="flex gap-2 text-[14px] text-midnight-700">
                          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-midnight-400" aria-hidden="true" />
                          <span>{it}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Collapsible>
        </div>
      )}
    </>
  );
}

function FoundBody({ caseNumber, word, matches, photoMissing, isLoggedIn, link }) {
  const caseUrl = `/cases/${caseNumber}`;
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
                  }}
                />
              ))}
            </div>
            {matches.length > 5 && <p className="text-[13px] text-midnight-500">{matches.length - 5} more possible matches are on the report page.</p>}
          </>
        ) : (
          <h2 id="matches-heading" className="text-[21px] font-extrabold leading-7 tracking-tight text-midnight-900">
            No lost report matches yet.
          </h2>
        )}
        <p className="text-[13px] text-midnight-500">We keep comparing as new lost reports come in and email you when one matches.</p>
      </section>

      <p className={`${EYEBROW} pl-1`}>While you have the {word}</p>
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-5 lg:items-stretch">
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

      {photoMissing && <PhotoNudge caseUrl={caseUrl} word={word} />}

      <Footer caseUrl={caseUrl} label="Open the report page" note="Messages from owners land there." isLoggedIn={isLoggedIn} />
    </>
  );
}

export default function SuccessScreen({
  variant = 'lost',
  caseNumber,
  petName,
  species,
  photoMissing = false,
  isLoggedIn = false,
  accountCreated = false,
  contactEmail,
  contactPhone, // phone-only guests: where the case-link SMS went
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
}) {
  const link = useShareLink(caseNumber);
  const word = SPECIES_WORD[String(species || 'OTHER').toUpperCase()] || 'pet';
  const name = (petName || '').trim() || `the ${word}`;
  const lost = variant === 'lost';

  const lines = useMemo(() => {
    const out = [];
    if (lost) {
      if (!contactEmail && contactPhone) {
        out.push(
          <>
            We texted this link to <strong className="font-semibold text-white">{contactPhone}</strong>. Sightings come by text too.
          </>
        );
      } else if (contactEmail && (accountCreated || !isLoggedIn)) {
        out.push(
          <>
            We emailed this link to <strong className="font-semibold text-white">{contactEmail}</strong>. Sightings land there too.
          </>
        );
      } else if (contactEmail) {
        out.push(
          <>
            Sightings and messages go to <strong className="font-semibold text-white">{contactEmail}</strong>.
          </>
        );
      }
      if (assignedSquad?.name) {
        out.push(
          <>
            Sent to {assignedSquad.name}, which covers the spot where {name} was last seen.
            {assignedSquad.id && (
              <>
                {' '}
                <Link href={`/rescue-forces/${assignedSquad.id}`} className="font-semibold text-white underline underline-offset-4 decoration-midnight-500">
                  See the force
                </Link>
              </>
            )}
          </>
        );
      } else if (squadsNotified > 0) {
        out.push(<>Sent to the {squadsNotified} Rescue Forces that cover the spot where {name} was last seen.</>);
      } else {
        out.push(<>Neighbors near the spot where {name} was last seen can see the report.</>);
      }
    } else if (contactEmail) {
      out.push(
        <>
          We emailed this link to <strong className="font-semibold text-white">{contactEmail}</strong>. Owners whose lost report matches get an email too.
        </>
      );
    }
    return out;
  }, [lost, contactEmail, contactPhone, accountCreated, isLoggedIn, assignedSquad, squadsNotified, name]);

  if (!caseNumber) {
    return (
      <div className="flex-1 overflow-y-auto">
        <Header variant={variant} title={lost ? `${name}'s report is live.` : 'Thank you. The report is live.'} link={link} lines={lines} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-midnight-50 animate-slide-up">
      <Header
        variant={variant}
        title={lost ? `${name}'s report is live.` : 'Thank you. The report is live.'}
        link={link}
        lines={lines}
        aside={
          <Link href={`/cases/${caseNumber}`} className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 border-midnight-600 px-4 text-[15px] font-bold text-white hover:border-midnight-400 transition-colors">
            {lost ? `Open ${name}'s page` : 'Open the report page'}
          </Link>
        }
      />
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
            photoMissing={photoMissing}
            activation={activation}
            flyer={flyer}
            link={link}
          />
        ) : (
          <FoundBody caseNumber={caseNumber} word={word} matches={matches} photoMissing={photoMissing} isLoggedIn={isLoggedIn} link={link} />
        )}
      </div>
    </div>
  );
}
