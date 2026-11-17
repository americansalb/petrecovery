'use client';

/**
 * Report Lost Pet - seven screens for an owner in a panic on a phone
 * (founder, 2026-11-17: "7 screens instead of 12"):
 *
 *   1. photo    a photo (skippable)
 *   2. pet      dog or cat (or another kind), and the name
 *   3. color    the main color, so the flyer is recognisable (one tap)
 *   4. place    when, and where: the spot the whole search circle is drawn
 *               around, shown on the map with "Is this where {name} got
 *               out?" and one Confirm, never taken from one tap on
 *               "Use my location" without being shown
 *   5. behaviour how the pet is with people (one tap): the search plan and
 *               the helper brief follow it (app/lib/searchPlan.js,
 *               app/lib/brief.js)
 *   6. contact  how finders reach a guest (text or email, as before), or
 *      phone    for a signed-in owner the phone finders call, prefilled
 *   7. review   the flyer, a small map of the spot, and Post
 *
 * Size, the other colors, health and the reward are asked right after
 * posting, on the page after posting and the pet's page (DetailsHub,
 * app/lib/caseDetails.js DETAIL_SCREENS), and the flyer is drawn again once
 * after the answers (app/lib/cascade/redrawLater.js). The finder questions
 * (collar, microchip, facts...) are asked there too. A signed-in owner with
 * saved pets starts from the pet picker instead of the photo; the count
 * stays seven, and a saved pet's color screen is passed over.
 *
 * The count never changes once the first screen shows. The flyer is shown
 * only on the review screen. A screen whose answer is a tap has no footer
 * and moves on at the tap; Back is at the top left on every screen after
 * the first. A guest whose browser already has a search open is told so
 * before the first question. Geolocation is only requested from the place
 * screen's "Use my location".
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  Camera, MapPin, Mail, Megaphone, HeartHandshake, Phone, PawPrint, Palette, Clock,
} from 'lucide-react';
import WizardShell from '../../components/report/WizardShell';
import StepScreen from '../../components/report/StepScreen';
import LocationPicker from '../../components/report/LocationPicker';
import { looksLikeCoordinates } from '@/app/lib/maps/reverseLabel';
import PhotoStep from '../../components/report/PhotoStep';
import ContactFields, { contactIsValid, OwnerPhoneField } from '../../components/report/ContactFields';
import OpenSearchNotice from '../../components/report/OpenSearchNotice';
import ReviewPosterCard from '../../components/report/ReviewPosterCard';
import { formatPhone } from '../../components/report/FlyerPreview';
import SuccessScreen from '../../components/report/SuccessScreen';
import Chips from '../../components/report/Chips';
import MyPetsStep from '../../components/report/lost/MyPetsStep';
import PetStep from '../../components/report/lost/PetStep';
import CoatColors from '../../components/report/lost/CoatColors';
import SpotMap from '../../components/report/lost/SpotMap';
import BehaviourStep from '../../components/report/lost/BehaviourStep';
import { lostScreenOrder } from '../../components/report/lost/screens';
import {
  TEMPERAMENT_OPTIONS, normalizeDetails, speciesKey, approachLine, factsBits,
} from '@/app/lib/caseDetails';
import { coatColorName } from '@/app/lib/coatColors';
import DraftPrompt from '../../components/report/DraftPrompt';
import SwitchReportLink from '../../components/report/SwitchReportLink';
import useWizardHistory from '../../components/report/useWizardHistory';
import { loadDraft, saveDraft, clearDraft } from '../../components/report/wizardDraft';
import {
  SPECIES_OPTIONS, DOG_SIZE_OPTIONS, LOST_TIME_OPTIONS, WIZARD_THEMES, speciesToApi, isValidPhone,
} from '../../components/report/wizardTheme';
import { SARAMA_AVATAR } from '@/lib/brandAssets';
import { captchaHeaders } from '@/app/lib/captchaClient';

const VARIANT = 'lost';
// Contact capture mode. 'either' lets reporters choose email OR text -
// phone-only is supported server-side via a placeholder account email.
const CONTACT_MODE = 'either';
const LOCATION_STORAGE_KEY = 'reportLocation';
const DRAFT_KEY = 'reportDraft:lost';
const WHEN_CHIPS = LOST_TIME_OPTIONS.map((o) => ({ value: o.value, label: o.short || o.label }));
// What the create route marks urgent (app/api/reports/create/route.js): a pet missing under an hour.
const URGENT_WHEN = LOST_TIME_OPTIONS.filter((o) => o.urgent).map((o) => o.short || o.label);

const SCREEN_LABEL = {
  photo: 'Photo', pet: 'Your pet', color: 'Color', place: 'When and where',
  behaviour: 'With people', contact: 'Contact', phone: 'Contact', review: 'Post it',
};
const SCREEN_ICON = {
  photo: Camera, pet: PawPrint, color: Palette, place: MapPin,
  behaviour: HeartHandshake, contact: Mail, phone: Phone, review: Megaphone,
};

export default function ReportLostPet() {
  const { data: session, status: authStatus } = useSession();
  const isLoggedIn = authStatus === 'authenticated';

  // ── Wizard navigation ─────────────────────────────────────────────
  const [stepId, setStepId] = useState(null); // resolved once auth/pets settle
  const [history, setHistory] = useState([]);
  const returnToRef = useRef(null); // set when editing a step from review

  // ── Report data ───────────────────────────────────────────────────
  const [myPets, setMyPets] = useState(null); // null = still loading (logged-in)
  const [selectedPet, setSelectedPet] = useState(null);
  const [newPet, setNewPet] = useState(false); // "A different pet" chosen in the picker
  const [species, setSpecies] = useState('');
  const [petName, setPetName] = useState('');
  const [timeElapsed, setTimeElapsed] = useState('');
  const [location, setLocation] = useState(null); // { lat, lng, address, city }
  const [photos, setPhotos] = useState([]);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [color, setColor] = useState('');
  const [aiSuggested, setAiSuggested] = useState(false);
  const [contact, setContact] = useState({ firstName: '', method: 'phone', email: '', phone: '' });
  const photoControl = useRef(null); // PhotoStep's openPicker(), for the footer button
  const placeRef = useRef(null); // the map on the place screen, brought into view once it has a spot
  const [breed, setBreed] = useState('');
  // How the pet is with people (app/lib/caseDetails.js): temperament and the owner's own line.
  const [details, setDetails] = useState({});
  const patchDetails = (patch) => setDetails((d) => ({ ...d, ...patch }));
  // The answers as they are now, for the photo reading that lands a few seconds after the upload.
  const latest = useRef({ species: '', color: '' });
  latest.current = { species, color };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [errorLink, setErrorLink] = useState(null);
  const [errorAction, setErrorAction] = useState(null); // the other way out of a posting error
  const [result, setResult] = useState(null);
  const [pendingDraft, setPendingDraft] = useState(null); // unfinished draft awaiting resume/fresh choice
  // A guest's search already open from this browser: undefined while asking, then null or { caseNumber, petName, url, hasEmail }.
  const [openSearch, setOpenSearch] = useState(undefined);

  // ── Load saved pets, resolve the first step ───────────────────────
  useEffect(() => {
    if (authStatus === 'loading') return;
    if (!isLoggedIn) {
      setMyPets([]);
      // Without signing in, one search can be open at a time; Post refuses a second. Ask now, so a guest who
      // already has one is told before the first question, with the way to it.
      fetch('/api/owner/open-search', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : { open: null }))
        .then((data) => setOpenSearch(data?.open?.caseNumber ? data.open : null))
        .catch(() => setOpenSearch(null));
      return;
    }
    setOpenSearch(null);
    fetch('/api/pets')
      .then((res) => (res.ok ? res.json() : { pets: [] }))
      .then((data) => setMyPets(data.pets || []))
      .catch(() => setMyPets([]));
    // The phone finders call: the account's, when it has one, as the answer to start from.
    fetch('/api/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const phone = String(data?.user?.phone || '').trim();
        if (phone) setContact((c) => (c.phone?.trim() ? c : { ...c, method: 'phone', phone }));
      })
      .catch(() => {});
  }, [authStatus, isLoggedIn]);

  // ── Every screen of this report, in order: fixed before the first one shows ──
  const hasPets = isLoggedIn && (myPets?.length || 0) > 0;
  const screenOrder = useMemo(() => lostScreenOrder({ isLoggedIn, hasPets }), [isLoggedIn, hasPets]);

  useEffect(() => {
    if (stepId || authStatus === 'loading' || myPets === null || openSearch === undefined) return;
    setStepId(screenOrder[0]);
  }, [stepId, authStatus, myPets, openSearch, screenOrder]);

  // ── Draft persistence (session-scoped, explicit restore) ──────────
  const dirty = Boolean(
    species || petName.trim() || timeElapsed || location || photos.length > 0 ||
    color || breed || contact.firstName.trim()
  );

  const draftCheckedRef = useRef(false);
  useEffect(() => {
    if (draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    const d = loadDraft(DRAFT_KEY);
    if (d && (d.species || d.petName || d.location || d.photos?.length)) setPendingDraft(d);
  }, []);

  useEffect(() => {
    if (!dirty || pendingDraft || result) return;
    saveDraft(DRAFT_KEY, {
      species, petName, timeElapsed, location,
      photos, displayIndex, color, contact, breed, details, newPet,
      selectedPet: selectedPet
        ? {
            id: selectedPet.id, name: selectedPet.name, species: selectedPet.species,
            color: selectedPet.color, breed: selectedPet.breed, size: selectedPet.size,
            isIndoor: selectedPet.isIndoor, primaryPhotoUrl: selectedPet.primaryPhotoUrl,
          }
        : null,
    });
  }, [dirty, pendingDraft, result, species, petName, timeElapsed,
      location, photos, displayIndex, color, contact, breed, details, newPet, selectedPet]);

  const resumeDraft = () => {
    const d = pendingDraft;
    setSpecies(d.species || '');
    setPetName(d.petName || '');
    setTimeElapsed(d.timeElapsed || '');
    setLocation(d.location || null);
    setPhotos(d.photos || []);
    setDisplayIndex(d.displayIndex || 0);
    setColor(d.color || '');
    // A draft with no phone keeps the account's, if it has loaded.
    setContact((c) => ({ ...(d.contact || { firstName: '', method: 'phone', email: '', phone: '' }), phone: d.contact?.phone || c.phone || '' }));
    setBreed(d.breed || '');
    setDetails(d.details && typeof d.details === 'object' ? d.details : {});
    setNewPet(Boolean(d.newPet));
    if (d.selectedPet) setSelectedPet(d.selectedPet);

    // Land on the first unanswered screen, with a plausible back-stack.
    const done = {
      photo: true, // skippable - never blocks resume
      pet: Boolean(d.species && d.petName?.trim()),
      color: Boolean(d.color),
      place: Boolean(d.location && d.timeElapsed),
      behaviour: Boolean(d.details?.temperament),
      contact: contactIsValid(d.contact || {}, CONTACT_MODE),
      phone: isValidPhone(d.contact?.phone),
    };
    const chain = [];
    let resume = 'review';
    for (const s of screenOrder.filter((id) => id !== 'review')) {
      if (!done[s]) {
        resume = s;
        break;
      }
      chain.push(s);
    }
    setHistory(chain);
    chain.forEach(() => recordPush());
    setStepId(resume);
    setPendingDraft(null);
  };

  const startFresh = () => {
    clearDraft(DRAFT_KEY);
    setPendingDraft(null);
  };

  // ── Navigation helpers ────────────────────────────────────────────
  const goBack = () => {
    setError(null);
    returnToRef.current = null;
    setHistory((h) => {
      if (!h.length) return h;
      setStepId(h[h.length - 1]);
      return h.slice(0, -1);
    });
  };

  // Browser back pops wizard steps (popstate → goBack); the in-app Back
  // button routes through the same path so both stay in sync.
  const { recordPush, browserBack, unwind } = useWizardHistory(goBack);

  const go = (next) => {
    setError(null);
    setHistory((h) => [...h, stepId]);
    setStepId(next);
    recordPush();
  };

  const editFromReview = (target) => {
    returnToRef.current = 'review';
    go(target);
  };

  /** The screen after `from`: a saved pet that already has its color passes the color screen. */
  const nextAfter = (from, { knownColor = Boolean(selectedPet && color) } = {}) => {
    let i = screenOrder.indexOf(from) + 1;
    if (screenOrder[i] === 'color' && knownColor) i += 1;
    return screenOrder[i] || 'review';
  };

  /** Advance from `stepId` along the order, honoring review edits. */
  const advance = () => {
    if (returnToRef.current) {
      const back = returnToRef.current;
      returnToRef.current = null;
      go(back);
      return;
    }
    go(nextAfter(stepId));
  };

  // ── Selections ────────────────────────────────────────────────────
  const handleSelectPet = (pet) => {
    const typeMap = { DOG: 'dog', CAT: 'cat', BIRD: 'bird', RABBIT: 'rabbit' };
    setSelectedPet(pet);
    setNewPet(false);
    setSpecies(typeMap[pet.species] || 'other');
    setPetName(pet.name || '');
    setColor(pet.color || '');
    setBreed(pet.breed || '');
    setPhotos(pet.primaryPhotoUrl ? [pet.primaryPhotoUrl] : []);
    setDisplayIndex(0);
    if (returnToRef.current) {
      advance();
      return;
    }
    go(nextAfter('pet', { knownColor: Boolean(pet.color) }));
  };

  const handleNewPet = () => {
    if (selectedPet) setPhotos([]);
    setSelectedPet(null);
    setNewPet(true);
    setSpecies('');
    setPetName('');
    setColor('');
    setBreed('');
  };

  // The photo is read for the kind of pet and its main color; the owner still sees both and can change them.
  const handleAnalysis = (analysis) => {
    const kind = String(analysis?.species || '').toLowerCase();
    if (!latest.current.species && kind !== 'other' && SPECIES_OPTIONS.some((o) => o.value === kind) && Number(analysis?.confidence) >= 0.7) {
      setSpecies(kind);
    }
    const main = coatColorName(analysis?.colors?.[0]);
    if (main && !latest.current.color) {
      setColor(main);
      setAiSuggested(true);
    }
  };

  // The map comes into view once it has a spot, above the question that confirms it.
  useEffect(() => {
    if (stepId !== 'place' || !location) return;
    const t = setTimeout(() => {
      const scroller = placeRef.current?.closest('.overflow-y-auto');
      scroller?.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
    }, 150);
    return () => clearTimeout(t);
  }, [stepId, location?.lat, location?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit ────────────────────────────────────────────────────────
  const effectiveEmail = isLoggedIn
    ? session?.user?.email || ''
    : CONTACT_MODE === 'either' && contact.method === 'phone'
      ? ''
      : contact.email.trim();
  // Signed in: the phone asked on its own screen (the account's when it has one). The case is saved with it, and
  // the flyer prints it under "Seen {name}? Call or text".
  const effectivePhone = contact.phone.trim();
  const effectiveName = isLoggedIn ? session?.user?.name || 'Pet Owner' : contact.firstName.trim();

  const handleSubmit = async () => {
    setError(null);
    setErrorLink(null);
    setErrorAction(null);
    // The flyer tells whoever sees the pet to call: never post a signed-in owner's report without a number.
    if (isLoggedIn && !isValidPhone(contact.phone)) {
      setError('Add the phone finders call. It goes on the flyer.');
      setErrorAction({ label: 'Add a phone', onClick: () => editFromReview('phone') });
      return;
    }
    setIsSubmitting(true);
    try {
      const orderedPhotos = photos.length
        ? [photos[displayIndex], ...photos.filter((_, i) => i !== displayIndex)]
        : [];
      // Size, the other colors, health and the reward are asked after posting: none of them is sent here, so
      // the report says nothing it was not told. A saved pet's size and indoor answer come from its record.
      const response = await fetch('/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await captchaHeaders('report_create')) },
        body: JSON.stringify({
          email: effectiveEmail,
          phone: effectivePhone,
          firstName: effectiveName,
          petName: petName.trim(),
          color,
          breed: breed || undefined,
          details: normalizeDetails(details),
          lastSeenAddress: location.address,
          center: [location.lat, location.lng],
          radiusMiles: 0.1,
          timeElapsed,
          petType: speciesToApi(species),
          petSize: species === 'dog' && selectedPet?.size ? selectedPet.size : undefined,
          isIndoorCat: species === 'cat' && typeof selectedPet?.isIndoor === 'boolean' ? selectedPet.isIndoor : undefined,
          photos: orderedPhotos,
          locationType: 'address',
          cityName: location.city,
          selectedPetId: selectedPet?.id,
          reporterLocation: null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        // An email that already has an account: signing in files the report
        // to it (the draft is kept). The nav is hidden here, so link it.
        // Already a search open from this browser: the way on is that search, which the answer names.
        if (data.code === 'OPEN_REPORT_EXISTS' && data.openUrl) setErrorLink({ href: data.openUrl, label: 'Open that search' });
        else if (data.signInUrl) setErrorLink({ href: data.signInUrl, label: 'Sign in to post it' });
        // A contact that belongs to an account: the other way out is a
        // different number or email, one tap away on the contact screen.
        if (data.code === 'PHONE_EXISTS' || data.code === 'ACCOUNT_EXISTS') {
          setErrorAction({
            label: data.code === 'PHONE_EXISTS' ? 'Use another number' : 'Use another email',
            onClick: () => editFromReview('contact'),
          });
        }
        throw new Error(data.error || 'Failed to create report');
      }
      try {
        localStorage.removeItem(LOCATION_STORAGE_KEY);
      } catch {
        /* non-fatal */
      }
      clearDraft(DRAFT_KEY);
      unwind(); // drop pushed history entries so back exits from the success screen
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Shell: one group per screen, the count fixed ──────────────────
  const steps = useMemo(() => {
    const name = petName || 'your pet';
    const copy = {
      photo: ['A photo', 'People recognize a pet from a photo much more easily than from a description. No photo handy? Skip it and add one from the page later.'],
      pet: ['Who went missing?', 'The kind of pet and the name it answers to. Both go on the flyer.'],
      color: ['The main color', 'The color most of the coat is. The other colors, the size and health are asked right after posting.'],
      place: ['When and where', `The search circle is drawn around this spot, and the Rescue Force that covers it gets the report. ${URGENT_WHEN.join(', ')} is marked urgent.`],
      behaviour: ['With people', `How ${name} is with people writes the "If you see ${name}" line on the flyer and decides how helpers search.`],
      contact: ['Stay reachable', `We send sightings of ${name} here. You don't need a password.`],
      phone: ['Stay reachable', `The flyer and ${name}'s page show this number, so whoever sees ${name} can call you.`],
      review: ['Post the report', 'It goes on the public Lost and Found board and to the Rescue Forces that cover the spot.'],
    };
    return screenOrder.map((id) => ({
      id,
      label: SCREEN_LABEL[id],
      sidebarIcon: SCREEN_ICON[id],
      sidebarTitle: copy[id][0],
      sidebarCopy: copy[id][1],
    }));
  }, [screenOrder, petName]);

  const screenIndex = Math.max(0, screenOrder.indexOf(stepId));
  const progress = { done: screenIndex + 1, total: screenOrder.length };

  // The sidebar's finished screens are links back; a jump from the review screen returns to it.
  const jumpTo = (id) => {
    if (!screenOrder.includes(id) || id === stepId) return;
    if (stepId === 'review') returnToRef.current = 'review';
    go(id);
  };

  // ── The flyer, drawn from the answers (shown on the review screen only) ──
  const flyer = useMemo(() => {
    const sp = speciesToApi(species);
    const who = petName || 'our pet';
    const colorLine = color ? `${color.split(',').map((c) => c.trim()).filter(Boolean).join(', ')} coat.` : '';
    // Only a size the report was told: a saved pet's.
    const sizeWord =
      species === 'dog' && selectedPet?.size ? DOG_SIZE_OPTIONS.find((o) => o.value === selectedPet.size)?.label || '' : '';
    const facts = [breed && breed !== 'Unknown' ? breed : '', sizeWord, ...factsBits(details, { species: sp })].filter(Boolean);
    return {
      variant: 'lost',
      species: sp,
      petName,
      breed,
      photoUrl: photos[displayIndex] || photos[0] || '',
      pills: [],
      when: LOST_TIME_OPTIONS.find((o) => o.value === timeElapsed)?.label || '',
      where: location ? location.city || (looksLikeCoordinates(location.address) ? 'the pinned spot' : location.address) : '',
      lookFor: [colorLine, facts.length ? `${facts.join(', ')}.` : ''].filter(Boolean).join(' '),
      urgent: '',
      approach: details.temperament || details.approachNote ? approachLine(details, { name: who, species: sp }) : '',
      phone: isLoggedIn || contact.method === 'phone' ? contact.phone : '',
      email: isLoggedIn ? session?.user?.email || '' : contact.method === 'phone' ? '' : contact.email,
    };
  }, [species, petName, selectedPet, color, breed, details, photos, displayIndex, timeElapsed, location, isLoggedIn, contact, session]);

  const theme = WIZARD_THEMES[VARIANT];

  // ── Loading / success ─────────────────────────────────────────────
  if (!stepId && !result) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center">
          <img src={SARAMA_AVATAR} alt="" className="w-16 h-16 mx-auto mb-4 animate-pulse-soft" />
          <p className="text-midnight-400">One moment…</p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="h-full flex flex-col bg-white overflow-hidden">
        <SuccessScreen
          variant={VARIANT}
          caseNumber={result.caseNumber}
          petName={result.petName || petName}
          photoMissing={photos.length === 0}
          isLoggedIn={isLoggedIn}
          accountCreated={result.accountCreated}
          contactEmail={effectiveEmail}
          contactPhone={!isLoggedIn && contact.method === 'phone' ? contact.phone : ''}
          squadsNotified={result.squadsNotified || 0}
          assignedSquad={result.assignedSquad}
          told={result.told}
          activation={result.activation}
          caseId={result.reportId}
          detailsToken={result.detailsToken}
          details={result.details}
          species={speciesToApi(species)}
          breed={result.petBreed}
          flyer={flyer}
        />
      </div>
    );
  }

  if (openSearch && !isLoggedIn) {
    return (
      <div className="h-full flex flex-col bg-white overflow-hidden">
        <OpenSearchNotice petName={openSearch.petName} url={openSearch.url} hasEmail={openSearch.hasEmail === true} />
      </div>
    );
  }

  if (pendingDraft) {
    const bits = [
      pendingDraft.petName,
      pendingDraft.species ? `lost ${pendingDraft.species}` : null,
      pendingDraft.location?.city || null,
    ].filter(Boolean);
    return (
      <div className="h-full flex flex-col bg-white overflow-hidden">
        <DraftPrompt
          variant={VARIANT}
          summary={
            bits.length
              ? `You started a report earlier: ${bits.join(' · ')}.`
              : 'You have an unfinished report from earlier.'
          }
          onResume={resumeDraft}
          onStartFresh={startFresh}
        />
      </div>
    );
  }

  // ── Steps ─────────────────────────────────────────────────────────
  const name = petName.trim() || 'your pet';
  const first = stepId === screenOrder[0];
  const kindWord = SPECIES_OPTIONS.find((o) => o.value === species)?.label.toLowerCase() || 'pet';
  const place = location
    ? looksLikeCoordinates(location.address) || !location.address
      ? location.city || 'The pinned spot'
      : location.address
    : '';
  const temperamentLabel =
    TEMPERAMENT_OPTIONS[speciesKey(speciesToApi(species))].find((o) => o.value === details.temperament)?.label || '';

  return (
    <WizardShell
      variant={VARIANT}
      steps={steps}
      activeStepId={stepId}
      onStepSelect={jumpTo}
      progress={progress}
      onBack={history.length > 0 ? browserBack : null}
      closeHref={isLoggedIn ? '/dashboard' : '/'}
      dirty={dirty}
    >
      {stepId === 'photo' && (
        <StepScreen
          stepKey="photo"
          variant={VARIANT}
          question={petName.trim() ? `Add a photo of ${name}` : 'Add a photo of your pet'}
          hint="A clear photo helps people recognize them. It goes on the flyer."
          primary={
            photos.length
              ? { label: 'Continue', onClick: advance }
              : { label: 'Add a photo', onClick: () => photoControl.current?.openPicker() }
          }
          skip={photos.length === 0 ? { label: 'Skip for now', onClick: advance } : null}
        >
          <PhotoStep
            controlRef={photoControl}
            variant={VARIANT}
            petName={petName}
            photos={photos}
            displayIndex={displayIndex}
            onPhotosChange={setPhotos}
            onDisplayChange={setDisplayIndex}
            onAnalysis={handleAnalysis}
            analyzedNote="Got it. What the photo shows is filled in on the next screens."
          />
          {first && <SwitchReportLink to="found" />}
        </StepScreen>
      )}

      {stepId === 'pet' && hasPets && !newPet && (
        <StepScreen
          stepKey="pets"
          variant={VARIANT}
          question="Which pet is missing?"
          hint="Their photo, color and size are filled in from what you saved."
          wide
        >
          <MyPetsStep pets={myPets || []} onSelectPet={handleSelectPet} onNewPet={handleNewPet} />
          {first && <SwitchReportLink to="found" />}
        </StepScreen>
      )}

      {stepId === 'pet' && (!hasPets || newPet) && (
        <StepScreen
          stepKey="pet"
          variant={VARIANT}
          question="What kind of pet is missing?"
          primary={{ label: 'Continue', onClick: advance, disabled: !species || !petName.trim() }}
        >
          <PetStep
            variant={VARIANT}
            species={species}
            onSpecies={setSpecies}
            name={petName}
            onName={setPetName}
            onSubmit={advance}
          />
          {hasPets && (
            <button
              type="button"
              onClick={() => setNewPet(false)}
              className="mt-5 min-h-[44px] text-[15px] font-semibold text-midnight-700 underline underline-offset-4"
            >
              Pick one of your saved pets instead
            </button>
          )}
          {first && <SwitchReportLink to="found" />}
        </StepScreen>
      )}

      {stepId === 'color' && (
        <StepScreen
          stepKey="color"
          variant={VARIANT}
          question={`What color is ${name} mostly?`}
          hint={
            aiSuggested && color
              ? 'Picked from the photo. Tap it to go on, or tap the right one.'
              : 'The color most of the coat is. You can add the others after posting.'
          }
        >
          <CoatColors
            value={color}
            onPick={(value) => {
              setColor(value);
              setAiSuggested(false);
              advance();
            }}
          />
        </StepScreen>
      )}

      {stepId === 'place' && (
        <StepScreen
          stepKey="place"
          variant={VARIANT}
          question={`When and where did ${name} get out?`}
          primary={location ? { label: 'Confirm', onClick: advance, disabled: !timeElapsed } : null}
          footerLead={
            location
              ? timeElapsed
                ? { title: `Is this where ${name} got out?`, text: 'Drag the pin to fix it.' }
                : { title: `When did ${name} get out?`, text: 'Pick a time above, then confirm the spot.' }
              : null
          }
        >
          <div>
            <p className="text-[16px] font-bold text-midnight-900">When</p>
            <p className="mb-2.5 text-[15px] text-midnight-600">{URGENT_WHEN.join(', ')} is marked urgent.</p>
            <Chips
              variant={VARIANT}
              options={WHEN_CHIPS}
              value={timeElapsed || null}
              onChange={(value) => {
                if (!value) return;
                setTimeElapsed(value);
                // On a small phone "Use my location" is under the fold: the answer brings the place into view.
                if (!location) setTimeout(() => placeRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
              }}
              ariaLabel={`When ${name} got out`}
            />
          </div>
          <div ref={placeRef} className="mt-6 flex flex-col">
            <p className="mb-2.5 text-[16px] font-bold text-midnight-900">Where</p>
            {/* Use my location sets the pin and stops there: the spot is shown on the map and confirmed below. */}
            <LocationPicker
              variant={VARIANT}
              value={location}
              onChange={setLocation}
              storageKey={LOCATION_STORAGE_KEY}
            />
          </div>
        </StepScreen>
      )}

      {stepId === 'behaviour' && (
        <StepScreen
          stepKey="behaviour"
          variant={VARIANT}
          question={`How is ${name} with people?`}
          hint="This writes the line on the flyer that says what to do on seeing them, and how helpers search."
          wide
          // A tap answers it and moves on; back on this screen with an answer, Continue keeps it.
          primary={details.temperament ? { label: 'Continue', onClick: advance } : null}
        >
          <BehaviourStep
            variant={VARIANT}
            species={speciesToApi(species)}
            name={name}
            value={details}
            onChange={(patch) => {
              patchDetails(patch);
              if (patch.temperament && patch.temperament !== details.temperament) advance();
            }}
          />
        </StepScreen>
      )}

      {stepId === 'contact' && (
        <StepScreen
          stepKey="contact"
          variant={VARIANT}
          question="How can finders reach you?"
          hint={`We send sightings of ${name} here.`}
          primary={{
            label: 'Continue',
            onClick: advance,
            disabled: !contactIsValid(contact, CONTACT_MODE),
          }}
        >
          <ContactFields
            variant={VARIANT}
            mode={CONTACT_MODE}
            value={contact}
            onChange={setContact}
            onSubmit={advance}
            emailHint="Sighting alerts and your manage link land here."
            phoneHint="We text you when someone reports a sighting."
          />
        </StepScreen>
      )}

      {stepId === 'phone' && (
        <StepScreen
          stepKey="phone"
          variant={VARIANT}
          question={`What number can finders call about ${name}?`}
          hint={`It goes on the flyer and ${name}'s page, so whoever sees ${name} can call or text you.`}
          primary={{ label: 'Continue', onClick: advance, disabled: !isValidPhone(contact.phone) }}
        >
          <OwnerPhoneField
            variant={VARIANT}
            value={contact.phone}
            onChange={(phone) => setContact((c) => ({ ...c, method: 'phone', phone }))}
            onSubmit={advance}
          />
        </StepScreen>
      )}

      {stepId === 'review' && (
        <StepScreen
          stepKey="review"
          variant={VARIANT}
          question={`Here is ${name}'s flyer.`}
          hint="Tap anything below to change it. Size, other colors, health and a reward are asked right after posting."
          error={error}
          errorLink={errorLink}
          errorAction={errorAction}
          primary={{
            label: `Post ${name}'s report`,
            tone: 'post',
            onClick: handleSubmit,
            loading: isSubmitting,
            loadingLabel: 'Posting the report…',
          }}
          footerNote="It goes on the Lost and Found board and to the Rescue Force that covers the spot."
        >
          <ReviewPosterCard
            variant={VARIANT}
            flyer={flyer}
            between={
              location ? (
                <SpotMap
                  lat={location.lat}
                  lng={location.lng}
                  label={`Where ${name} got out`}
                  place={place}
                  pinColor={theme.mapHex}
                  onEdit={() => editFromReview('place')}
                />
              ) : null
            }
            rows={[
              {
                id: 'photo',
                icon: Camera,
                label: 'Photo',
                value: photos.length ? `${photos.length} photo${photos.length > 1 ? 's' : ''}` : 'No photo yet',
              },
              {
                id: 'pet',
                icon: PawPrint,
                label: 'Pet',
                value: petName.trim() ? `${petName.trim()}, ${kindWord === 'other' ? 'pet' : kindWord}` : '',
              },
              { id: 'color', icon: Palette, label: 'Main color', value: color },
              {
                id: 'place',
                icon: Clock,
                label: 'Missing since',
                value: LOST_TIME_OPTIONS.find((o) => o.value === timeElapsed)?.label || '',
              },
              {
                id: 'behaviour',
                icon: HeartHandshake,
                label: 'With people',
                value: temperamentLabel || 'Not sure',
              },
              !isLoggedIn
                ? {
                    id: 'contact',
                    icon: Mail,
                    label: 'Finders reach you at',
                    value: [contact.firstName, contact.method === 'phone' ? formatPhone(contact.phone) : contact.email]
                      .filter(Boolean)
                      .join(', '),
                  }
                : {
                    id: 'phone',
                    icon: Phone,
                    label: 'Finders call',
                    value: formatPhone(contact.phone),
                  },
            ]}
            onEdit={editFromReview}
          />
        </StepScreen>
      )}
    </WizardShell>
  );
}
