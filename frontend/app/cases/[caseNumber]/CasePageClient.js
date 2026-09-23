'use client';

/**
 * A pet's public page, the one most people reach first from a link in a
 * group chat. From the top it answers: which pet, where and when it was
 * last seen, and what to do now (report a sighting, call the owner,
 * share). Below that come the map, sightings and updates, other ways to
 * help, and the flyer kit when the report has one.
 *
 * The link preview is built by the server page (page.js). This fetches
 * the public case, which never includes the owner's email. Wording comes
 * from app/lib/caseLabels.js, shared with the Lost & Found board.
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ChevronLeft, MapPin, Clock, Eye, Phone, Share2, Printer, Building2, Users,
  HeartHandshake, Radar, PawPrint, ExternalLink, Megaphone,
} from 'lucide-react';

import { Button } from '@/components/ui';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import { STATUS_DOT } from '@/app/lost-and-found/PetCard';
import {
  caseStatus, caseTitle, caseDescriptor, casePlace, caseTimeline, caseSize,
  caseDescription, casePhone, known, shortDate, timeAgo,
} from '@/app/lib/caseLabels';
import { PIN_ONLY_LABEL, looksLikeCoordinates } from '@/app/lib/maps/reverseLabel';
import { speciesLabel } from '@/app/lib/species';
import { getBaseUrl } from '@/app/lib/config';
import useInstrument, { INSTRUMENTS } from '@/app/hooks/useInstrument';
import MarkReunitedModal from '@/app/mission-control/components/overlays/MarkReunitedModal';
import { Activity, RecoveryKitPanel, ShareSheet, SightingSheet, StickyActions, WaysToHelp } from './components';

const LastSeenMap = dynamic(() => import('./components/LastSeenMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-midnight-100" />,
});

const ACTIONS_ID = 'pet-actions';
const HOT_SIGHTING_MS = 60 * 60 * 1000;

const OUTLINE_LINK =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 border-midnight-300 px-3 py-3 text-base font-semibold text-midnight-700 transition hover:border-midnight-400 hover:bg-midnight-50';
const PRIMARY_LINK =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-flash-400 px-6 py-3 text-base font-semibold text-midnight-900 shadow-sm transition hover:bg-flash-500';
const ICON_BUTTON =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-midnight-100 text-midnight-700 transition hover:bg-midnight-200';

/* ------------------------------- Page states ------------------------------ */

function Loading() {
  return (
    <div className="min-h-screen bg-midnight-50" aria-busy="true">
      <div className="border-b border-midnight-200 bg-white">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 pb-8 pt-16 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10">
          <div className="aspect-[3/2] animate-pulse rounded-2xl bg-midnight-100 md:aspect-square" />
          <div className="space-y-4">
            <div className="h-7 w-20 animate-pulse rounded-full bg-midnight-100" />
            <div className="h-10 w-2/3 animate-pulse rounded-lg bg-midnight-100" />
            <div className="h-5 w-1/2 animate-pulse rounded bg-midnight-100" />
            <div className="h-5 w-3/4 animate-pulse rounded bg-midnight-100" />
            <div className="h-12 w-full animate-pulse rounded-xl bg-midnight-100" />
          </div>
        </div>
      </div>
      <p className="sr-only">Loading</p>
    </div>
  );
}

function Problem({ title, body, children }) {
  return (
    <div className="min-h-screen bg-midnight-50 px-4 py-20">
      <div className="mx-auto max-w-md rounded-2xl bg-white px-6 py-10 text-center ring-1 ring-midnight-200">
        <PawPrint size={36} className="mx-auto text-midnight-300" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold text-midnight-900">{title}</h1>
        <p className="mt-2 text-midnight-500">{body}</p>
        <div className="mt-6 flex flex-col items-center gap-3">{children}</div>
      </div>
    </div>
  );
}

/* --------------------------------- Pieces --------------------------------- */

function Photo({ c, alt }) {
  const [failed, setFailed] = useState(false);
  const src = c.petPhotoUrl;
  return (
    <div className="relative aspect-[3/2] overflow-hidden rounded-2xl bg-midnight-100 md:aspect-square">
      {src && !failed ? (
        <a href={src} target="_blank" rel="noopener noreferrer" aria-label="Open the full-size photo" className="block h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} onError={() => setFailed(true)} className="h-full w-full object-cover" />
        </a>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-midnight-400">
          <SpeciesIcon species={String(c.petSpecies || '').toUpperCase()} size={56} />
          <span className="text-sm">No photo yet</span>
        </div>
      )}
    </div>
  );
}

function HotSighting({ s }) {
  const where = s.address && !looksLikeCoordinates(s.address) ? s.address.split(',')[0].trim().replace(/^near\s+/i, '') : '';
  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl bg-flash-50 p-4 ring-1 ring-flash-300">
      <span className="relative mt-1.5 flex h-3 w-3 shrink-0" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flash-400 opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-flash-500" />
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-midnight-900">
          Seen {timeAgo(s.sightedAt)}{where ? ` near ${where}` : ''}
        </p>
        {s.description && <p className="mt-0.5 break-words text-midnight-600">{s.description}</p>}
      </div>
    </div>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function CasePageClient() {
  const { caseNumber } = useParams();
  const { data: session, status: authStatus } = useSession();
  const { instrument } = useInstrument();

  const [c, setC] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | missing | busy | failed
  const [attempt, setAttempt] = useState(0);
  const [sheet, setSheet] = useState(null); // 'share' | 'sighting' | 'home'
  const [kitReady, setKitReady] = useState(false);
  const [savingHome, setSavingHome] = useState(false);
  const [homeError, setHomeError] = useState(null);

  useEffect(() => {
    if (!caseNumber) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/missions/${encodeURIComponent(caseNumber)}`);
        if (cancelled) return;
        if (res.status === 404) return setState('missing');
        if (res.status === 429) return setState('busy');
        if (!res.ok) return setState('failed');
        const data = await res.json();
        if (cancelled) return;
        setC(data);
        setState('ready');
      } catch {
        if (!cancelled) setState('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseNumber, attempt]);

  const retry = () => {
    setState('loading');
    setAttempt((n) => n + 1);
  };
  const closeSheet = useCallback(() => setSheet(null), []);
  const onKitChange = useCallback((empty) => setKitReady(!empty), []);

  if (state === 'loading') return <Loading />;
  if (state === 'missing') {
    return (
      <Problem title="We couldn't find this pet" body="The report may have been removed, or the link is missing part of its address.">
        <Button href="/lost-and-found">Browse Lost &amp; Found</Button>
      </Problem>
    );
  }
  if (state !== 'ready' || !c) {
    return (
      <Problem
        title="This page didn't load"
        body={state === 'busy' ? 'Too many requests from your network. Wait a minute, then try again.' : 'Check your connection, then try again.'}
      >
        <Button onClick={retry}>Try again</Button>
        <Link href="/lost-and-found" className="inline-flex items-center text-sm font-medium text-midnight-600 hover:text-midnight-900">
          Browse Lost &amp; Found
        </Link>
      </Problem>
    );
  }

  /* ----------------------------- What the page says ---------------------------- */

  const status = caseStatus(c);
  const open = status.key === 'lost' || status.key === 'found';
  const isFound = status.key === 'found';
  const title = caseTitle(c);
  const species = speciesLabel(c.petSpecies).toLowerCase();
  const petName = c.reportType === 'FOUND' ? '' : known(c.petName);
  const name = petName || `this ${species}`;
  const Name = petName || `This ${species}`;
  const descriptor = [caseDescriptor(c), caseSize(c)].filter(Boolean).join(' · ');
  const description = caseDescription(c);
  const place = casePlace(c);
  const pinOnly = place === PIN_ONLY_LABEL;
  const sightings = c.sightings || [];
  const updates = c.updates || [];
  const phone = casePhone(c);
  const contactName = c.contact?.name && c.contact.name !== 'The owner' ? c.contact.name : '';
  const signedIn = authStatus === 'authenticated';
  const isOwner = signedIn && Boolean(session?.user?.id) && session.user.id === c.reporterId;
  const lat = Number(c.lastSeenLatitude);
  const lng = Number(c.lastSeenLongitude);
  const hasCoords = c.lastSeenLatitude != null && c.lastSeenLongitude != null && Number.isFinite(lat) && Number.isFinite(lng);
  const caseRef = c.missionNumber || caseNumber;

  const seenWord = isFound ? 'Found' : 'Last seen';
  const whereText = !pinOnly
    ? `${seenWord} near ${place}`
    : hasCoords
      ? `${seenWord} at the spot pinned on the map below`
      : `${seenWord}: no location given`;
  const since = shortDate(c.lastSeenAt || c.createdAt);
  const whenText =
    status.key === 'lost' ? `${caseTimeline(c)}, since ${since}` : isFound ? `${caseTimeline(c)}, on ${since}` : caseTimeline(c);
  const facts = [
    { icon: MapPin, text: whereText },
    { icon: Clock, text: whenText },
    open && sightings.length > 0 && {
      icon: Eye,
      text: `${sightings.length} ${sightings.length === 1 ? 'sighting' : 'sightings'} reported`,
    },
  ].filter(Boolean);

  const backHref = isFound ? '/lost-and-found?tab=found' : status.key === 'home' ? '/lost-and-found?tab=reunited' : '/lost-and-found';
  const hot = open && sightings[0] && Date.now() - new Date(sightings[0].sightedAt).getTime() <= HOT_SIGHTING_MS ? sightings[0] : null;

  /* ---------------------------------- Links ---------------------------------- */

  const missionHref = `/mission-control?mission=${encodeURIComponent(c.id)}`;
  const reportSightingHref = signedIn ? `${missionHref}&action=sighting` : `/join/${encodeURIComponent(c.id)}`;
  const joinHref = signedIn ? missionHref : `/join/${encodeURIComponent(c.id)}`;
  const directionsHref = hasCoords ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : null;
  const sheltersHref = !pinOnly
    ? `/shelters?near=${encodeURIComponent(place)}`
    : hasCoords
      ? `/shelters?near=${encodeURIComponent(`${lat},${lng}`)}&label=${encodeURIComponent('the last-seen spot')}`
      : '/shelters';

  const shareUrl = `${getBaseUrl()}/cases/${encodeURIComponent(caseRef)}`;
  const nearText = pinOnly ? '' : ` near ${place}`;
  const shareTitle = status.key === 'home' ? `${Name} is home` : isFound ? `${title}${nearText}` : `Help find ${Name}`;
  const shareText =
    status.key === 'home'
      ? `${Name} is back home. Thank you to everyone who shared.`
      : isFound
        ? `${title}${nearText}. Do you know who owns this ${species}?`
        : `Help find ${petName ? `${petName}, a lost ${species},` : `this lost ${species},`} last seen${nearText}.`;

  const share = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return; // the person closed the share sheet
      }
    }
    setSheet('share');
  };

  const confirmHome = async ({ resolution, resolutionNotes }) => {
    setSavingHome(true);
    setHomeError(null);
    try {
      const res = await fetch(`/api/missions/${encodeURIComponent(c.id)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REUNITED', resolution, resolutionNotes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || 'Could not update the report');
      }
      setSheet(null);
      setAttempt((n) => n + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setHomeError(err.message);
    } finally {
      setSavingHome(false);
    }
  };

  /* ------------------------------ Other ways to help ------------------------------ */

  const flyerItem = kitReady
    ? { key: 'flyer', icon: Printer, label: 'Print a flyer', sub: `Put it up near where ${name} was last seen.`, href: '#share-kit' }
    : signedIn
      ? { key: 'flyer', icon: Printer, label: 'Print a flyer', sub: `Put it up near where ${name} was last seen.`, href: `${missionHref}&tab=flyer` }
      : null;
  const helpItems =
    status.key === 'lost'
      ? [
          { key: 'share', icon: Share2, label: 'Share this page', sub: 'Post it in local groups and neighborhood apps.', onClick: share },
          {
            key: 'shelters',
            icon: Building2,
            label: pinOnly ? 'Check nearby shelters' : `Check shelters near ${place}`,
            sub: 'Lost pets are often taken to a shelter. Call or visit.',
            href: sheltersHref,
          },
          flyerItem,
          {
            key: 'join',
            icon: Users,
            label: 'Join the search',
            sub: signedIn ? 'Open the search in Mission Control.' : 'Sign up to search the area. No account needed.',
            href: joinHref,
          },
        ].filter(Boolean)
      : [];

  /* ---------------------------------- Actions ---------------------------------- */

  let actions;
  if (open && isOwner) {
    // The owner's own page: no "I've seen" or "Call the owner" (that is them).
    // Their tools are in the panel below.
    actions = (
      <Button size="lg" fullWidth leftIcon={Share2} onClick={share}>
        Share this page
      </Button>
    );
  } else if (status.key === 'lost') {
    actions = (
      <div className="space-y-3">
        <Button size="lg" fullWidth leftIcon={Eye} onClick={() => setSheet('sighting')}>
          I&apos;ve seen {name}
        </Button>
        <div className={`grid gap-3 ${phone ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {phone && (
            <a href={`tel:${phone.tel}`} className={OUTLINE_LINK}>
              <Phone className="h-4 w-4" aria-hidden="true" />
              Call the owner
            </a>
          )}
          <Button variant="outline" size="lg" leftIcon={Share2} onClick={share}>
            Share
          </Button>
        </div>
        {phone && <p className="hidden text-sm text-midnight-500 md:block">Owner&apos;s phone: {phone.display}</p>}
      </div>
    );
  } else if (isFound) {
    actions = (
      <div className="space-y-3">
        {phone ? (
          <a href={`tel:${phone.tel}`} className={PRIMARY_LINK}>
            <Phone className="h-4 w-4" aria-hidden="true" />
            Call the finder
          </a>
        ) : (
          <Button size="lg" fullWidth href="/report/new" leftIcon={Megaphone}>
            Report your lost pet
          </Button>
        )}
        <Button variant="outline" size="lg" fullWidth leftIcon={Share2} onClick={share}>
          Share
        </Button>
        <p className="text-sm text-midnight-500">
          {phone
            ? `Is this your pet? Call the finder, and have a photo or vet record ready to show it's yours.`
            : `The finder didn't leave a phone number. If this is your pet, report it lost: new lost reports are checked against found pets nearby.`}
        </p>
        {phone && <p className="hidden text-sm text-midnight-500 md:block">Finder&apos;s phone: {phone.display}</p>}
      </div>
    );
  } else if (status.key === 'home') {
    actions = (
      <div className="space-y-3">
        <p className="rounded-xl bg-emerald-50 px-4 py-3 font-medium text-emerald-800 ring-1 ring-emerald-200">
          {Name} is back home.
        </p>
        <Button size="lg" fullWidth leftIcon={Share2} onClick={share}>
          Share the good news
        </Button>
      </div>
    );
  } else {
    actions = (
      <div className="space-y-3">
        <p className="rounded-xl bg-midnight-50 px-4 py-3 text-midnight-700 ring-1 ring-midnight-200">This search has closed.</p>
        <Button size="lg" variant="outline" fullWidth href="/lost-and-found">
          See pets still missing
        </Button>
      </div>
    );
  }

  /* ----------------------------------- View ----------------------------------- */

  return (
    <div className="min-h-screen bg-midnight-50">
      <header className="border-b border-midnight-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 pb-8 pt-3 sm:pt-5">
          <Link href={backHref} className="-ml-1 inline-flex items-center gap-1 px-1 text-sm font-medium text-midnight-500 hover:text-midnight-900">
            <ChevronLeft size={16} aria-hidden="true" />
            Lost &amp; Found
          </Link>

          <div className="mt-2 grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10">
            <Photo c={c} alt={`Photo of ${title}`} />

            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-midnight-100 px-3 py-1 text-sm font-semibold text-midnight-800">
                <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status.key]}`} aria-hidden="true" />
                {status.label}
              </span>
              <h1 className="mt-3 break-words text-3xl font-bold tracking-tight text-midnight-900 sm:text-4xl">{title}</h1>
              {descriptor && <p className="mt-1 text-lg text-midnight-500">{descriptor}</p>}

              <ul className="mt-5 space-y-2.5">
                {facts.map((f) => (
                  <li key={f.text} className="flex items-start gap-2.5 text-midnight-700">
                    <f.icon size={18} className="mt-0.5 shrink-0 text-midnight-400" aria-hidden="true" />
                    <span className="min-w-0 break-words">{f.text}</span>
                  </li>
                ))}
              </ul>

              <div id={ACTIONS_ID} className="mt-6">
                {actions}
              </div>

              {description && (
                <p className="mt-6 whitespace-pre-line break-words leading-relaxed text-midnight-700">{description}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 pb-40 pt-6 lg:pb-12">
        {hot && <HotSighting s={hot} />}

        {isOwner && open && (
          <section className="flex flex-col gap-4 rounded-2xl bg-midnight-900 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">This is your report</p>
              <p className="text-sm text-midnight-300">Manage the search from Mission Control.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button href={missionHref} leftIcon={Radar}>
                {instrument === INSTRUMENTS.COMMAND ? 'Open Command Center' : 'Open Mission Control'}
              </Button>
              {/* A plain button: Button's outline variant is dark text for a
                  light page, and its classes are joined, not merged, so they
                  can't be overridden for this dark panel. */}
              <button
                type="button"
                onClick={() => setSheet('home')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/30 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/10"
              >
                <HeartHandshake className="h-4 w-4" aria-hidden="true" />
                Mark as reunited
              </button>
            </div>
          </section>
        )}

        <div className={`grid gap-6 ${helpItems.length ? 'lg:grid-cols-3' : ''}`}>
          <div className={`min-w-0 space-y-6 ${helpItems.length ? 'lg:col-span-2' : ''}`}>
            {/* Only while the search is open. Once the pet is home the exact
                spot (often the family's own street) helps nobody, and the
                town in the facts above says enough. */}
            {open && (
            <section aria-labelledby="map-heading" className="overflow-hidden rounded-2xl bg-white ring-1 ring-midnight-200">
              <div className="px-5 pb-4 pt-5 sm:px-6">
                <h2 id="map-heading" className="text-lg font-semibold text-midnight-900">
                  {isFound ? `Where ${name} was found` : `Where ${name} was last seen`}
                </h2>
                <p className="mt-1 break-words text-midnight-500">
                  {c.lastSeenAddress && !looksLikeCoordinates(c.lastSeenAddress)
                    ? c.lastSeenAddress
                    : hasCoords
                      ? 'The spot pinned on the map'
                      : 'The report does not give a location.'}
                </p>
              </div>
              {hasCoords && (
                <>
                  {/* isolate keeps Leaflet's own z-indexes (400 to 1000) inside the
                      map, so its zoom buttons never paint over this page's dialogs. */}
                  <div className="relative isolate h-64 sm:h-80">
                    <LastSeenMap
                      lat={lat}
                      lng={lng}
                      address={c.lastSeenAddress && !looksLikeCoordinates(c.lastSeenAddress) ? c.lastSeenAddress : ''}
                      sightings={sightings}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-midnight-100 px-5 py-2 text-sm sm:px-6">
                    {/* Same colours as the pins in LastSeenMap.js */}
                    <span className="inline-flex items-center gap-1.5 text-midnight-600">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />
                      {isFound ? 'Found here' : 'Last seen'}
                    </span>
                    {sightings.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-midnight-600">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden="true" />
                        Sighting
                      </span>
                    )}
                    <span className="ml-auto flex flex-wrap items-center gap-x-4">
                      {signedIn && open && (
                        <Link href={missionHref} className="inline-flex items-center font-medium text-midnight-700 hover:text-midnight-900">
                          Open the search map
                        </Link>
                      )}
                      <a
                        href={directionsHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-midnight-700 hover:text-midnight-900"
                      >
                        Open in Google Maps
                        <ExternalLink size={14} aria-hidden="true" />
                      </a>
                    </span>
                  </div>
                </>
              )}
            </section>
            )}

            <Activity
              sightings={sightings}
              updates={updates}
              reportedAt={c.createdAt}
              emptyText={open ? 'No sightings reported yet.' : 'No sightings were reported.'}
            />

            {open && <RecoveryKitPanel caseNumber={caseRef} petName={petName || title} onEmptyChange={onKitChange} />}

            {!helpItems.length && <p className="text-center text-xs text-midnight-400">Case {caseRef}</p>}
          </div>

          {helpItems.length > 0 && (
            <aside className="min-w-0 space-y-4">
              <WaysToHelp items={helpItems} />
              <p className="text-center text-xs text-midnight-400">Case {caseRef}</p>
            </aside>
          )}
        </div>
      </main>

      {status.key === 'lost' && !isOwner && (
        <StickyActions watchId={ACTIONS_ID}>
          <Button size="lg" className="flex-1" leftIcon={Eye} onClick={() => setSheet('sighting')}>
            I&apos;ve seen {name}
          </Button>
          <button type="button" onClick={share} aria-label="Share" className={ICON_BUTTON}>
            <Share2 size={20} aria-hidden="true" />
          </button>
          {phone && (
            <a href={`tel:${phone.tel}`} aria-label="Call the owner" className={ICON_BUTTON}>
              <Phone size={20} aria-hidden="true" />
            </a>
          )}
        </StickyActions>
      )}
      {isFound && phone && !isOwner && (
        <StickyActions watchId={ACTIONS_ID}>
          <a href={`tel:${phone.tel}`} className={`${PRIMARY_LINK} flex-1`}>
            <Phone className="h-4 w-4" aria-hidden="true" />
            Call the finder
          </a>
          <button type="button" onClick={share} aria-label="Share" className={ICON_BUTTON}>
            <Share2 size={20} aria-hidden="true" />
          </button>
        </StickyActions>
      )}

      <ShareSheet open={sheet === 'share'} onClose={closeSheet} url={shareUrl} title={shareTitle} text={shareText} />
      <SightingSheet
        open={sheet === 'sighting'}
        onClose={closeSheet}
        name={name}
        phone={phone}
        contactName={contactName}
        reportHref={reportSightingHref}
        signedIn={signedIn}
      />
      {sheet === 'home' && (
        <MarkReunitedModal mission={c} onClose={closeSheet} onConfirm={confirmHome} isSaving={savingHome} error={homeError} />
      )}
    </div>
  );
}
