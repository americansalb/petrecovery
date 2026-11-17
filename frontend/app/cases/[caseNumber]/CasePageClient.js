'use client';

/**
 * A pet's public page, the one most people reach first from a link in a
 * group chat, and the one place where everyone helping with the pet meets.
 * From the top it answers: which pet, where and when it was last seen, and
 * what to do now (report a sighting, call the owner, share). Below that,
 * "How you can help" gathers the rest: search on the map (Mission Control,
 * one tap away), the Rescue Force's search party and needs for the pet, and
 * what anyone can do. Then the map, what happened, the flyer kit when the
 * report has one, and the force's other pets.
 *
 * A phone (under md) gets its own page, built for one hand and half a
 * minute (components/PhoneTop.js): the first screen is the photo, where
 * and when, the newest sighting and the buttons; then the owner's approach
 * line ("If you see Max", the rest one tap away), the map, what happened,
 * the flyers folded, the force's other pets. A visitor who is not signed in
 * gets the two ways to help at the top and nothing more: the job picker and
 * the force's needs are for its members. The owner gets their own version:
 * how the search stands, their one row of buttons, then their tools.
 *
 * The link preview is built by the server page (page.js). This fetches
 * the public case, which never includes the owner's email, and the force's
 * part (/api/public/missions/[caseNumber]/help, app/lib/petRoom.js).
 * Wording comes from app/lib/caseLabels.js, shared with the Lost & Found
 * board.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ChevronLeft, MapPin, Clock, Eye, Phone, Share2, Printer, Building2,
  PawPrint, ExternalLink, MessageCircle, Map as MapIcon, Bell, Users, Footprints, HeartHandshake,
} from 'lucide-react';

import { Button } from '@/components/ui';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import PetStatusDot from '@/app/components/PetStatusDot';
import { PET_BG } from '@/app/lib/petColors';
import {
  caseStatus, caseTitle, caseDescriptor, casePlace, caseTimeline, caseSize,
  caseDescription, casePhone, known, shortDate, timeAgo, caseBadge, lastSeenDay,
} from '@/app/lib/caseLabels';
import { placeOnly } from '@/app/lib/placeLabel';
import { PIN_ONLY_LABEL, looksLikeCoordinates, isNoPlace } from '@/app/lib/maps/reverseLabel';
import { speciesLabel } from '@/app/lib/species';
import { getBaseUrl } from '@/app/lib/config';
import MarkReunitedModal from '@/app/mission-control/components/overlays/MarkReunitedModal';
import JoinForceSheet from '@/app/components/help/JoinForceSheet';
import { Activity, HowToHelp, OtherPets, OwnerPanel, RecoveryKitPanel, ShareSheet, SightingSheet, StickyActions } from './components';
import FinderGuide, { IfYouSee } from './components/FinderGuide';
import PhoneTop, { OwnerTop, OWNER_TILE } from './components/PhoneTop';

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
// "Search on the map": the way into Mission Control, the pet's search
// screen. It opens for anyone, signed in or not: a visitor can join with a
// first name and be handed an area to search. a.bg-midnight-900 gets its shading
// from app/globals.css.
const DARK_LINK =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-midnight-900 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-midnight-800';

// The phone's buttons: 48px and up, words that never wrap (a long one is cut with an ellipsis).
const PHONE_PRIMARY =
  'inline-flex min-h-[52px] w-full min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-flash-400 px-4 text-lg font-bold text-midnight-900 shadow-sm transition hover:bg-flash-500';
const PHONE_DARK =
  'inline-flex min-h-[48px] min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-midnight-900 px-3 text-base font-semibold text-white shadow-sm';
const PHONE_OUTLINE =
  'inline-flex min-h-[48px] min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 border-midnight-300 bg-white px-3 text-base font-semibold text-midnight-800';
const PHONE_CALL =
  'flex min-h-[48px] w-full items-center gap-3 rounded-xl border-2 border-midnight-300 bg-white px-4 text-base font-semibold text-midnight-900';
// The phone's pinned bar: one row, 44px buttons in a 56px bar (StickyActions `compact`).
const BAR_PRIMARY =
  'inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-flash-400 px-3 text-base font-bold text-midnight-900 shadow-sm transition hover:bg-flash-500';
const BAR_DARK =
  'inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-midnight-900 px-3 text-base font-semibold text-white shadow-sm';

// The force's part of the page when there is none, or it did not load.
const NO_ROOM = { force: null, member: false, needs: [], done: [], party: null, searchingNow: 0, others: [] };

/**
 * Whether the screen matches `query`, kept up to date as a phone turns.
 * A computer screen (min-width 1024px): the map sits beside the page
 * instead of in it. A phone (under md, 768px): the phone's own page.
 */
function useMedia(query) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/** "Nobody is out searching right now", "1 person is out searching now". */
function outWords(n) {
  if (!n) return 'Nobody is out searching right now';
  return n === 1 ? '1 person is out searching now' : `${n} people are out searching now`;
}

/* ------------------------------- Page states ------------------------------ */

function Loading() {
  return (
    <div className="min-h-screen bg-midnight-50" aria-busy="true">
      <div className="border-b border-midnight-200 bg-white">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 pb-8 pt-3 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10 md:pt-16">
          <div className="h-[200px] animate-pulse rounded-2xl bg-midnight-100 md:aspect-square md:h-auto" />
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
          <img
            src={src}
            alt={alt}
            fetchPriority="high"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
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
  // A sighting sent with only a pin has no street: it reads "Seen 5 minutes ago", never "near Marked on the map".
  const where = isNoPlace(s.address) ? '' : s.address.split(',')[0].trim().replace(/^near\s+/i, '');
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
  const { status: authStatus } = useSession();
  const wide = useMedia('(min-width: 1024px)');
  const narrow = useMedia('(max-width: 767.98px)');

  const [c, setC] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | missing | busy | failed
  const [attempt, setAttempt] = useState(0);
  const [room, setRoom] = useState(null); // the force's part; null until it loads
  const [sheet, setSheet] = useState(null); // 'share' | 'sighting' | 'home' | 'join'
  const [kitReady, setKitReady] = useState(false);
  const [savingHome, setSavingHome] = useState(false);
  const [homeError, setHomeError] = useState(null);
  const afterJoin = useRef(null);

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

  // The homepage's "I've seen Linda" buttons link here with ?seen=1: open the
  // sighting sheet as soon as the report has loaded, if it is still open.
  useEffect(() => {
    if (state !== 'ready' || !c) return;
    if (new URLSearchParams(window.location.search).get('seen') !== '1') return;
    const key = caseStatus(c).key;
    if (key === 'lost' || key === 'found') setSheet('sighting');
  }, [state, c]);

  // The force looking for the pet, its needs for the pet and the rest
  // (app/lib/petRoom.js). Again when the viewer signs in, and after they act.
  const loadRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/missions/${encodeURIComponent(caseNumber)}/help`, { cache: 'no-store' });
      setRoom(res.ok ? await res.json() : NO_ROOM);
    } catch {
      setRoom((r) => r || NO_ROOM);
    }
  }, [caseNumber]);

  useEffect(() => {
    if (caseNumber && authStatus !== 'loading') loadRoom();
  }, [caseNumber, authStatus, attempt, loadRoom]);

  const retry = () => {
    setState('loading');
    setAttempt((n) => n + 1);
  };
  const closeSheet = useCallback(() => setSheet(null), []);
  const onKitChange = useCallback((empty) => setKitReady(!empty), []);

  // Someone who is not in the force taps a need: they join first, then
  // what they tapped goes through.
  const openJoin = useCallback((then) => {
    afterJoin.current = then || null;
    setSheet('join');
  }, []);
  const onJoined = useCallback(async () => {
    setSheet(null);
    await loadRoom();
    const then = afterJoin.current;
    afterJoin.current = null;
    if (then) then();
  }, [loadRoom]);

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
  // The page's data says whether the person asking is the owner, by the rule Mission Control uses: the account
  // the report was filed to, or the owner's key to this one search, which the browser that sent a report made
  // without an account keeps (app/lib/ownerKey.js). So a guest owner has their tools here too, without signing
  // in. The owner's account id is not sent to the page.
  const isOwner = c.viewerIsOwner === true;
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
  const since = shortDate(c.lastSeenAt || c.createdAt, Date.now(), c.timeZone || undefined);
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

  const postedBy = contactName ? `Posted by ${contactName}, ${isFound ? `who found ${petName ? petName : `this ${species}`}` : 'the owner'}` : '';

  const backHref = isFound ? '/lost-and-found?tab=found' : status.key === 'home' ? '/lost-and-found?tab=reunited' : '/lost-and-found';
  const hot = open && sightings[0] && Date.now() - new Date(sightings[0].sightedAt).getTime() <= HOT_SIGHTING_MS ? sightings[0] : null;

  /* ------------------------------- On a phone ------------------------------- */

  // Where and when, in one line. A pet still lost or found: the place from the report (the street or the
  // landmark, never a house number, never only the town) and the day. A pet home, or a search closed: the
  // town and how it ended, as the facts above say it.
  const spot = placeOnly(c.lastSeenAddress);
  const day = lastSeenDay(c, Date.now(), c.timeZone || undefined);
  const phoneWhere = spot
    ? `${seenWord} near ${spot}`
    : hasCoords
      ? `${seenWord} at the spot pinned on the map`
      : day
        ? seenWord
        : `${seenWord}: no location given`;
  const phoneLines = open
    ? [{ icon: MapPin, text: day ? `${phoneWhere} · ${day}` : phoneWhere }]
    : [
        { icon: MapPin, text: whereText },
        { icon: Clock, text: whenText },
      ];
  // The newest sighting, one line that jumps to the map.
  const latest = open ? sightings[0] || null : null;
  // "I've seen Señor Bigotes de la Calle Principal" does not fit a phone's button: a long name is "this dog".
  const seenName = petName.length > 14 ? `this ${species}` : name;
  // The owner's row: "Open Pip's search", "Pip is home"; a long name, the plain words.
  const shortName = petName && petName.length <= 12 ? petName : '';

  /* ---------------------------------- Links ---------------------------------- */

  // Mission Control, the search map. "Search on the map" is the way in; by
  // case number, so its way back out lands on this page's own address.
  const missionHref = `/mission-control?mission=${encodeURIComponent(caseRef)}`;
  // The search screen takes a sighting from anyone, with or without an account.
  const reportSightingHref = `${missionHref}&action=sighting`;
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

  /* ------------------------------ What anyone can do ------------------------------ */

  // The flyers are the share kit's, further down this page. Where a pet has none (an older report, or one
  // still being made) there is nothing to print, so no row offers it. It used to send a signed-in visitor
  // to a flyer tab on the search screen, which that screen no longer has.
  const flyerItem = kitReady
    ? { key: 'flyer', icon: Printer, label: 'Print a flyer', sub: `Put it up near where ${name} was last seen.`, href: '#share-kit' }
    : null;
  const ways =
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
        ].filter(Boolean)
      : [];

  // Where the story starts and, for a pet back home, ends ("What happened").
  const startedAt = c.lastSeenAt || c.createdAt;
  const marks = [
    isFound
      ? { kind: 'found', text: `${Name} was found${nearText}`, at: startedAt }
      : { kind: 'lost', text: `${Name} went missing${nearText}`, at: startedAt },
    status.key === 'home' && c.resolvedAt && { kind: 'home', text: `${Name} is back home`, at: c.resolvedAt },
  ].filter(Boolean);

  /* ---------------------------------- Actions ---------------------------------- */

  let actions;
  if (open && isOwner) {
    // The owner's own page: no "I've seen" or "Call the owner" (that is them).
    // Their tools are in the panel below.
    actions = (
      <div className="space-y-3">
        {status.key === 'lost' && (
          <Link href={missionHref} className={`${DARK_LINK} w-full`}>
            <MapIcon className="h-4 w-4" aria-hidden="true" />
            Search on the map
          </Link>
        )}
        <Button size="lg" fullWidth leftIcon={Share2} onClick={share}>
          Share this page
        </Button>
      </div>
    );
  } else if (status.key === 'lost') {
    actions = (
      <div className="space-y-3">
        <Link href={missionHref} className={`${DARK_LINK} w-full`}>
          <MapIcon className="h-4 w-4" aria-hidden="true" />
          Search on the map
        </Link>
        <Button size="lg" fullWidth leftIcon={Eye} onClick={() => setSheet('sighting')}>
          I&apos;ve seen {name}
        </Button>
        <div className={`grid gap-3 ${phone ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {phone && (
            // The number itself is the label: eight of ten people in the
            // 2026-11-09 walks looked for the digits on the first screen and
            // found an icon, or small grey text that phones did not show.
            <a
              href={`tel:${phone.tel}`}
              aria-label={`Call the owner, ${phone.display}`}
              className={`${OUTLINE_LINK} min-w-0 px-2 tabular-nums`}
            >
              <Phone className="hidden h-4 w-4 shrink-0 min-[390px]:block" aria-hidden="true" />
              <span className="truncate text-[15px] font-bold">{phone.display}</span>
            </a>
          )}
          <Button variant="outline" size="lg" leftIcon={Share2} onClick={share}>
            Share
          </Button>
        </div>
      </div>
    );
  } else if (isFound) {
    actions = (
      <div className="space-y-3">
        {/* Whatever the finder left, the owner can write to them here (app/report/found/message): the site passes the
            words on and shows neither address. Before 2026-11-16 a finder who chose email left the owner nothing to
            press but a button to report their pet lost, which they had already done. */}
        {phone ? (
          <a href={`tel:${phone.tel}`} className={PRIMARY_LINK}>
            <Phone className="h-4 w-4" aria-hidden="true" />
            {narrow ? (
              <>
                <span className="truncate">Call the finder</span>
                <span className="shrink-0 whitespace-nowrap tabular-nums">{phone.display}</span>
              </>
            ) : (
              'Call the finder'
            )}
          </a>
        ) : (
          <Button size="lg" fullWidth href={`/report/found/message?case=${encodeURIComponent(caseNumber)}`} leftIcon={MessageCircle}>
            Message the finder
          </Button>
        )}
        {phone && (
          <Button variant="outline" size="lg" fullWidth href={`/report/found/message?case=${encodeURIComponent(caseNumber)}`} leftIcon={MessageCircle}>
            Message the finder
          </Button>
        )}
        <Button variant="outline" size="lg" fullWidth leftIcon={Share2} onClick={share}>
          Share
        </Button>
        <p className="text-sm text-midnight-500">Is this your pet? Have a photo or vet record ready to show it&apos;s yours.</p>
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

  const force = room?.force || null;
  const mapSection = open ? (
    // Only while the search is open. Once the pet is home the exact spot
    // (often the family's own street) helps nobody, and the town in the
    // facts above says enough.
    <section id="pet-map" aria-labelledby="map-heading" className="scroll-mt-20 overflow-hidden rounded-2xl bg-white ring-1 ring-midnight-200">
      <div className={narrow ? 'px-4 pb-3 pt-4' : 'px-5 pb-4 pt-5 sm:px-6'}>
        <h2 id="map-heading" className="text-lg font-semibold text-midnight-900">
          {isFound ? `Where ${name} was found` : sightings.length ? `Where ${name} has been` : `Where ${name} was last seen`}
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
          <div className={`relative isolate ${narrow ? 'h-48' : 'h-64 sm:h-80'}`}>
            <LastSeenMap
              lat={lat}
              lng={lng}
              address={c.lastSeenAddress && !looksLikeCoordinates(c.lastSeenAddress) ? c.lastSeenAddress : ''}
              sightings={sightings}
              found={isFound}
            />
          </div>
          <div className={`flex flex-wrap items-center border-t border-midnight-100 text-sm ${narrow ? 'gap-x-3 px-4 py-0.5' : 'gap-x-5 gap-y-1 px-5 py-2 sm:px-6'}`}>
            {/* Same colours as the pins in LastSeenMap.js */}
            <span className="inline-flex items-center gap-1.5 text-midnight-600">
              <span className={`h-2.5 w-2.5 rounded-full ${isFound ? PET_BG.found : PET_BG.lost}`} aria-hidden="true" />
              {isFound ? 'Found here' : 'Last seen'}
            </span>
            {sightings.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-midnight-600">
                <span className={`h-2.5 w-2.5 rounded-full ${PET_BG.seen}`} aria-hidden="true" />
                Sighting
              </span>
            )}
            <a
              href={directionsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 font-medium text-midnight-700 hover:text-midnight-900"
            >
              {narrow ? 'Google Maps' : 'Open in Google Maps'}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        </>
      )}
    </section>
  ) : null;
  const others = <OtherPets force={force} pets={room?.others} />;
  const ownerPanelProps = {
    caseId: c.id,
    name,
    phone,
    species: c.petSpecies,
    details: c.details,
    breed: c.petBreed,
    ownerStatus: room?.owner?.status || null,
    onChanged: () => {
      setAttempt((n) => n + 1);
      loadRoom();
    },
    onReunited: () => setSheet('home'),
  };
  const help = open ? (
    <HowToHelp
      name={name}
      caseId={c.id}
      caseNumber={caseRef}
      signedIn={signedIn}
      isOwner={isOwner}
      lost={status.key === 'lost'}
      room={room}
      searchHref={missionHref}
      ways={ways}
      onJoin={openJoin}
      onChanged={loadRoom}
    />
  ) : null;
  const activity = (
    <Activity
      sightings={sightings}
      updates={updates}
      done={room?.done || []}
      marks={marks}
      emptyText={open ? 'No sightings reported yet.' : 'No sightings were reported.'}
    />
  );
  const sheets = (
    <>
      <ShareSheet open={sheet === 'share'} onClose={closeSheet} url={shareUrl} title={shareTitle} text={shareText} />
      <SightingSheet
        open={sheet === 'sighting'}
        onClose={closeSheet}
        name={name}
        phone={phone}
        contactName={contactName}
        reportHref={reportSightingHref}
      />
      {sheet === 'home' && (
        <MarkReunitedModal mission={c} onClose={closeSheet} onConfirm={confirmHome} isSaving={savingHome} error={homeError} />
      )}
      {force && (
        <JoinForceSheet
          open={sheet === 'join'}
          onClose={closeSheet}
          force={force}
          signedIn={signedIn}
          onJoined={onJoined}
        />
      )}
    </>
  );

  /* ------------------------------ The phone's page ------------------------------ */

  if (narrow) {
    // The owner's own page while the search is open: how it stands, their buttons, their tools. No finder's
    // box, no helper's job, no other pets and no pinned bar: their buttons are on the page.
    const ownerView = isOwner && open;
    const callWho = contactName || 'the owner';
    // How the search stands, in plain words. The neighbors alerted come with the page's data (for the owner
    // alone); who is out now and the force come with the force's part, a moment later, so that line's place is
    // held until then and the buttons below do not jump.
    const alerted = Number(c.neighborsAlerted) || 0;
    const ownerFacts = [
      { icon: Clock, text: whenText },
      alerted > 0 && { icon: Bell, text: `${alerted} ${alerted === 1 ? 'neighbor was' : 'neighbors were'} alerted` },
      {
        icon: Eye,
        text: sightings.length ? `${sightings.length} ${sightings.length === 1 ? 'sighting' : 'sightings'} reported` : 'No sightings reported yet',
      },
      status.key === 'lost' && { icon: Footprints, text: room ? outWords(room.searchingNow) : '', held: !room },
      force && { icon: Users, text: `${force.name} is looking for ${name}` },
    ].filter(Boolean);

    let top;
    if (ownerView) {
      top = (
        <OwnerTop c={c} title={title} alt={`Photo of ${title}`} badge={caseBadge(c)} statusKey={status.key} facts={ownerFacts} sighting={latest} actionsId={ACTIONS_ID}>
          <div className={`grid gap-2 ${status.key === 'lost' ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <button type="button" onClick={share} className={`${OWNER_TILE} bg-flash-400 text-midnight-900 hover:bg-flash-500`}>
              <Share2 size={20} aria-hidden="true" />
              Share the link
            </button>
            {status.key === 'lost' && (
              <Link href={missionHref} className={`${OWNER_TILE} bg-midnight-900 text-white`}>
                <MapIcon size={20} className="text-flash-400" aria-hidden="true" />
                {shortName ? `Open ${shortName}'s search` : 'Open the search'}
              </Link>
            )}
            <button type="button" onClick={() => setSheet('home')} className={`${OWNER_TILE} border-2 border-midnight-300 bg-white text-midnight-800`}>
              <HeartHandshake size={20} aria-hidden="true" />
              {shortName && status.key === 'lost' ? `${shortName} is home` : 'Mark as reunited'}
            </button>
          </div>
        </OwnerTop>
      );
    } else {
      top = (
        <PhoneTop c={c} title={title} alt={`Photo of ${title}`} badge={caseBadge(c)} statusKey={status.key} looks={descriptor} lines={phoneLines} sighting={latest} actionsId={ACTIONS_ID}>
          {status.key === 'lost' ? (
            <div className="space-y-2">
              <button type="button" onClick={() => setSheet('sighting')} className={PHONE_PRIMARY}>
                <Eye className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="truncate">I&apos;ve seen {seenName}</span>
              </button>
              <div className="grid grid-cols-2 gap-2">
                <Link href={missionHref} className={PHONE_DARK}>
                  <MapIcon className="h-5 w-5 shrink-0 text-flash-400" aria-hidden="true" />
                  Help search
                </Link>
                <button type="button" onClick={share} className={PHONE_OUTLINE}>
                  <Share2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                  Share
                </button>
              </div>
              {phone && (
                // The whole number, always: people who have the pet in front of them want the digits.
                <a href={`tel:${phone.tel}`} aria-label={`Call ${callWho}, ${phone.display}`} className={PHONE_CALL}>
                  <Phone className="h-5 w-5 shrink-0 text-midnight-600" aria-hidden="true" />
                  <span className="min-w-0 truncate">Call {callWho}</span>
                  <span className="ml-auto shrink-0 whitespace-nowrap font-bold tabular-nums">{phone.display}</span>
                </a>
              )}
            </div>
          ) : (
            actions
          )}
        </PhoneTop>
      );
    }

    // One row, 56px, that never wraps. A member: the map first, as on a computer.
    let bar = null;
    if (status.key === 'lost' && !isOwner) {
      bar = (
        <StickyActions watchId={ACTIONS_ID} compact>
          {signedIn ? (
            <Link href={missionHref} className={BAR_DARK}>
              <MapIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="truncate">Search on the map</span>
            </Link>
          ) : (
            <button type="button" onClick={() => setSheet('sighting')} className={BAR_PRIMARY}>
              <Eye className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="truncate">I&apos;ve seen {seenName}</span>
            </button>
          )}
          {signedIn && (
            <button type="button" onClick={() => setSheet('sighting')} aria-label={`I've seen ${name}`} className={ICON_BUTTON}>
              <Eye size={20} aria-hidden="true" />
            </button>
          )}
          {phone && (
            <a href={`tel:${phone.tel}`} aria-label={`Call ${callWho}, ${phone.display}`} className={ICON_BUTTON}>
              <Phone size={20} aria-hidden="true" />
            </a>
          )}
          <button type="button" onClick={share} aria-label="Share" className={ICON_BUTTON}>
            <Share2 size={20} aria-hidden="true" />
          </button>
        </StickyActions>
      );
    } else if (isFound && phone && !isOwner) {
      bar = (
        <StickyActions watchId={ACTIONS_ID} compact>
          <a href={`tel:${phone.tel}`} aria-label={`Call the finder, ${phone.display}`} className={BAR_PRIMARY}>
            <Phone className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="truncate">Call the finder</span>
          </a>
          <button type="button" onClick={share} aria-label="Share" className={ICON_BUTTON}>
            <Share2 size={20} aria-hidden="true" />
          </button>
        </StickyActions>
      );
    }

    return (
      <div className="min-h-screen bg-midnight-50">
        <main className="mx-auto max-w-lg space-y-4 px-4 pb-8">
          {top}

          {isOwner && open && (
            <OwnerPanel {...ownerPanelProps} reunitedButton={false} />
          )}

          {!ownerView && (
            <IfYouSee
              name={name}
              Name={Name}
              guide={status.key === 'lost' ? c.finderGuide : null}
              hasReward={status.key === 'lost' && c.hasReward}
              rewardAmount={c.rewardAmount}
              description={description}
              looks={descriptor}
              postedBy={postedBy}
            />
          )}

          {/* The job picker, the search party and the force's needs: for people signed in. A visitor's two ways
              to help are at the top. */}
          {signedIn && !isOwner && help}

          {mapSection}
          {activity}
          {open && <RecoveryKitPanel caseNumber={caseRef} petName={petName || title} onEmptyChange={onKitChange} folded />}
          {!ownerView && others}

          <p className="pt-2 text-center text-sm text-midnight-500">Case {caseRef}</p>
        </main>
        {bar}
        {sheets}
      </div>
    );
  }

  /* ---------------------------- Tablets and computers ---------------------------- */

  return (
    <div className="min-h-screen bg-midnight-50">
      <header className="border-b border-midnight-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 pb-8 pt-1 sm:pt-3">
          {/* Back to the force looking for the pet, or to Lost & Found. Held
              empty until the page knows which, so the words never swap. */}
          {!room ? (
            <span className="block h-11" aria-hidden="true" />
          ) : force ? (
            <Link
              href={`/rescue-forces/${force.id}`}
              className="-ml-1 inline-flex max-w-full items-center gap-1 px-1 text-sm font-medium text-midnight-500 hover:text-midnight-900"
            >
              <ChevronLeft size={16} className="shrink-0" aria-hidden="true" />
              <span className="truncate">{force.name}</span>
            </Link>
          ) : (
            <Link href={backHref} className="-ml-1 inline-flex items-center gap-1 px-1 text-sm font-medium text-midnight-500 hover:text-midnight-900">
              <ChevronLeft size={16} aria-hidden="true" />
              Lost &amp; Found
            </Link>
          )}

          <div className="mt-1 grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10">
            <Photo c={c} alt={`Photo of ${title}`} />

            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-midnight-100 px-3 py-1 text-sm font-semibold text-midnight-800">
                <PetStatusDot status={status.key} />
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
              {postedBy && <p className="mt-3 text-sm text-midnight-500">{postedBy}</p>}

              <div id={ACTIONS_ID} className="mt-6">
                {actions}
              </div>

              {description && (
                <p className="mt-6 whitespace-pre-line break-words leading-relaxed text-midnight-700">{description}</p>
              )}

              {open && status.key === 'lost' && c.finderGuide && (
                <FinderGuide name={name} guide={c.finderGuide} hasReward={c.hasReward} rewardAmount={c.rewardAmount} />
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-40 pt-6 lg:pb-12">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
          <div className="min-w-0 space-y-6">
            {hot && <HotSighting s={hot} />}

            {isOwner && open && (
              <OwnerPanel {...ownerPanelProps} />
            )}

            {help}

            {!wide && mapSection}

            {activity}

            {open && <RecoveryKitPanel caseNumber={caseRef} petName={petName || title} onEmptyChange={onKitChange} />}

            {!wide && others}

            <p className="text-center text-xs text-midnight-400">Case {caseRef}</p>
          </div>

          {wide && (mapSection || room?.others?.length > 0) && (
            <aside className="min-w-0 space-y-6">
              {mapSection}
              {others}
            </aside>
          )}
        </div>
      </main>

      {/* Signed in (the force's members) or the owner: the map first, since
          that is where the searching happens. A visitor: "I've seen". */}
      {status.key === 'lost' && (
        <StickyActions watchId={ACTIONS_ID}>
          {signedIn || isOwner ? (
            <Link href={missionHref} className={`${DARK_LINK} flex-1`}>
              <MapIcon className="h-4 w-4" aria-hidden="true" />
              Search on the map
            </Link>
          ) : (
            <Button size="lg" className="flex-1" leftIcon={Eye} onClick={() => setSheet('sighting')}>
              I&apos;ve seen {name}
            </Button>
          )}
          {signedIn && !isOwner && (
            <button type="button" onClick={() => setSheet('sighting')} aria-label={`I've seen ${name}`} className={ICON_BUTTON}>
              <Eye size={20} aria-hidden="true" />
            </button>
          )}
          <button type="button" onClick={share} aria-label="Share" className={ICON_BUTTON}>
            <Share2 size={20} aria-hidden="true" />
          </button>
          {phone && !isOwner && (
            <a
              href={`tel:${phone.tel}`}
              aria-label={`Call the owner, ${phone.display}`}
              className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-midnight-100 px-3 text-midnight-700 transition hover:bg-midnight-200"
            >
              <Phone size={20} aria-hidden="true" />
              {/* The number as text on the first screen: people who have the pet
                  in front of them want the digits, not an icon. */}
              <span className="hidden text-[15px] font-bold tabular-nums min-[380px]:inline">{phone.display}</span>
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

      {sheets}
    </div>
  );
}
