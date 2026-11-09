'use client';

/**
 * Report Found Pet - one-decision-at-a-time wizard.
 *
 * Built for a helper looking at the animal right now: observable facts first
 * (species → where → when → photo → colors), tag details optional, contact
 * last, and potential matches as the payoff on the success screen.
 *
 * Photos upload to the CDN via /api/upload (no more base64), and the merged
 * Where step replaces the old text-geocode + separate-pinpoint screens.
 * Shares every primitive (and the exact look) of the lost wizard - only the
 * blue FOUND semantics and copy differ.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  PawPrint, Clock, MapPin, Camera, Mail, Megaphone, Tag,
} from 'lucide-react';
import WizardShell from '../../components/report/WizardShell';
import StepScreen from '../../components/report/StepScreen';
import OptionCardGrid from '../../components/report/OptionCardGrid';
import LocationPicker from '../../components/report/LocationPicker';
import { looksLikeCoordinates } from '@/app/lib/maps/reverseLabel';
import PhotoStep from '../../components/report/PhotoStep';
import ContactFields, { contactIsValid } from '../../components/report/ContactFields';
import ReviewPosterCard from '../../components/report/ReviewPosterCard';
import FlyerStrip from '../../components/report/FlyerStrip';
import FlyerPreview from '../../components/report/FlyerPreview';
import SuccessScreen from '../../components/report/SuccessScreen';
import { captchaHeaders } from '@/app/lib/captchaClient';
import TagDetailsStep from '../../components/report/found/TagDetailsStep';
import DraftPrompt from '../../components/report/DraftPrompt';
import SwitchReportLink from '../../components/report/SwitchReportLink';
import useWizardHistory from '../../components/report/useWizardHistory';
import { loadDraft, saveDraft, clearDraft } from '../../components/report/wizardDraft';
import ColorSelector from '../../components/ColorSelector';
import {
  SPECIES_OPTIONS, FOUND_TIME_OPTIONS, GENERIC_SIZE_OPTIONS,
} from '../../components/report/wizardTheme';

const VARIANT = 'found';
const CONTACT_MODE = 'either'; // a phone number or an email, whichever they have
const LOCATION_STORAGE_KEY = 'reportLocation';
const DRAFT_KEY = 'reportDraft:found';

const GROUP_OF = {
  species: 'animal', where: 'wherewhen', when: 'wherewhen', photo: 'photo',
  colors: 'photo', details: 'details', contact: 'contact', review: 'post',
};
// What each screen is called in the sidebar's list of the current group.
const SCREEN_LABEL = {
  species: 'Kind of animal', where: 'Where', when: 'When', photo: 'Photo', colors: 'Colors',
  details: 'Collar and tag', contact: 'Where we reach you', review: 'Review and post',
};

export default function ReportFoundPet() {
  const { data: session, status: authStatus } = useSession();
  const isLoggedIn = authStatus === 'authenticated';

  // ── Wizard navigation ─────────────────────────────────────────────
  const [stepId, setStepId] = useState('species');
  const [history, setHistory] = useState([]);
  const returnToRef = useRef(null);

  // ── Report data ───────────────────────────────────────────────────
  const [species, setSpecies] = useState('');
  const [location, setLocation] = useState(null); // { lat, lng, address, city }
  const [timeElapsed, setTimeElapsed] = useState('');
  const [photos, setPhotos] = useState([]);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [color, setColor] = useState('');
  const [aiSuggested, setAiSuggested] = useState(false);
  const [details, setDetails] = useState({ petName: '', breed: '', size: '', marks: '', microchipId: '' });
  const [contact, setContact] = useState({ firstName: '', method: 'phone', email: '', phone: '' });
  const locationControl = useRef(null); // LocationPicker's locate(), for the footer button
  const photoControl = useRef(null); // PhotoStep's openPicker(), for the footer button

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [errorLink, setErrorLink] = useState(null);
  const [result, setResult] = useState(null);
  const [pendingDraft, setPendingDraft] = useState(null); // unfinished draft awaiting resume/fresh choice

  // Prefill contact from session
  useEffect(() => {
    if (session?.user) {
      setContact((prev) => ({
        ...prev,
        firstName: prev.firstName || session.user.name || '',
        email: prev.email || session.user.email || '',
      }));
    }
  }, [session]);

  // ── Navigation ────────────────────────────────────────────────────
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

  const advance = () => {
    if (returnToRef.current) {
      const back = returnToRef.current;
      returnToRef.current = null;
      go(back);
      return;
    }
    const chain = {
      species: 'where',
      where: 'when',
      when: 'photo',
      photo: 'colors',
      colors: 'details',
      details: isLoggedIn ? 'review' : 'contact',
      contact: 'review',
    };
    if (chain[stepId]) go(chain[stepId]);
  };

  const handleAnalysis = (analysis) => {
    if (analysis?.colors?.length > 0 && !color) {
      setColor(analysis.colors.join(', '));
      setAiSuggested(true);
    }
  };

  // ── Draft persistence (session-scoped, explicit restore) ──────────
  const dirty = Boolean(
    species || location || timeElapsed || photos.length > 0 || color ||
    details.petName || details.marks || details.microchipId || contact.firstName.trim()
  );

  const draftCheckedRef = useRef(false);
  useEffect(() => {
    if (draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    const d = loadDraft(DRAFT_KEY);
    if (d && (d.species || d.location || d.photos?.length || d.color)) setPendingDraft(d);
  }, []);

  useEffect(() => {
    if (!dirty || pendingDraft || result) return;
    saveDraft(DRAFT_KEY, {
      species, location, timeElapsed, photos, displayIndex, color, details, contact,
    });
  }, [dirty, pendingDraft, result, species, location, timeElapsed, photos, displayIndex, color, details, contact]);

  const resumeDraft = () => {
    const d = pendingDraft;
    setSpecies(d.species || '');
    setLocation(d.location || null);
    setTimeElapsed(d.timeElapsed || '');
    setPhotos(d.photos || []);
    setDisplayIndex(d.displayIndex || 0);
    setColor(d.color || '');
    setDetails(d.details || { petName: '', breed: '', size: '', marks: '', microchipId: '' });
    setContact((prev) => d.contact || prev);

    // Land on the first incomplete step, with a plausible back-stack.
    const done = {
      species: !!d.species,
      where: !!d.location,
      when: !!d.timeElapsed,
      photo: true, // skippable
      colors: !!d.color,
      details: true, // all-optional
      contact: isLoggedIn || contactIsValid(d.contact || {}, CONTACT_MODE),
    };
    const order = ['species', 'where', 'when', 'photo', 'colors', 'details', ...(!isLoggedIn ? ['contact'] : [])];
    const chain = [];
    let resume = 'review';
    for (const s of order) {
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

  // ── Submit ────────────────────────────────────────────────────────
  const effectiveEmail = isLoggedIn ? session?.user?.email || '' : contact.email.trim();
  const effectiveName = isLoggedIn ? session?.user?.name || 'Helpful Neighbor' : contact.firstName.trim();

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    setErrorLink(null);
    try {
      const orderedPhotos = photos.length
        ? [photos[displayIndex], ...photos.filter((_, i) => i !== displayIndex)]
        : [];
      // The same bot check the lost-pet form sends: middleware requires it
      // on /api/reports* whenever CAPTCHA is switched on, and without it
      // every found report would be refused.
      const response = await fetch('/api/reports/found-pet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await captchaHeaders('report_found')) },
        body: JSON.stringify({
          email: effectiveEmail,
          phone: contact.phone.trim(),
          firstName: effectiveName,
          petName: details.petName.trim(),
          breed: details.breed,
          color,
          size: details.size || 'MEDIUM',
          distinctiveMarks: details.marks,
          microchipId: details.microchipId.trim() || undefined,
          foundAddress: location.address,
          center: [location.lat, location.lng],
          radiusMiles: 10, // match radius, not user-facing
          timeElapsed,
          petType: species,
          photos: orderedPhotos, // CDN URLs from /api/upload - never base64
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.signInUrl) setErrorLink({ href: data.signInUrl, label: 'Sign in to post it' });
        throw new Error(data.error || 'Failed to create report');
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

  // ── Shell step groups ─────────────────────────────────────────────
  const steps = useMemo(
    () => [
      {
        id: 'animal',
        label: 'The animal',
        sidebarIcon: PawPrint,
        sidebarTitle: 'Found a pet?',
        sidebarCopy: 'We compare your report with lost-pet reports nearby and email owners whose pet looks like a close match.',
      },
      {
        id: 'wherewhen',
        label: 'Where and when',
        sidebarIcon: MapPin,
        sidebarTitle: 'Where you found them',
        sidebarCopy: 'Matches are compared by distance from this spot. The time goes on the report, so owners can tell whether it fits.',
      },
      {
        id: 'photo',
        label: 'Photo and colors',
        sidebarIcon: Camera,
        sidebarTitle: 'A photo',
        sidebarCopy: 'An owner can recognize their pet from a photo. A quick phone picture is enough. Colors are compared with lost-pet reports nearby.',
      },
      {
        id: 'details',
        label: 'Collar and tag',
        sidebarIcon: Tag,
        sidebarTitle: 'Check the collar',
        sidebarCopy: 'A name on a tag or a microchip number can identify the owner. All optional.',
      },
      ...(!isLoggedIn
        ? [{
            id: 'contact',
            label: 'Contact',
            sidebarIcon: Mail,
            sidebarTitle: 'Where we reach you',
            sidebarCopy: "We email you about this report here. You don't need a password.",
          }]
        : []),
      {
        id: 'post',
        label: 'Post it',
        sidebarIcon: Megaphone,
        sidebarTitle: 'Post the report',
        sidebarCopy: 'It goes on the public Lost and Found board, and we compare it with lost-pet reports nearby.',
      },
    ],
    [isLoggedIn]
  );

  // ── Progress: every screen of this report, in order ───────────────
  const screenOrder = useMemo(
    () => ['species', 'where', 'when', 'photo', 'colors', 'details', ...(!isLoggedIn ? ['contact'] : []), 'review'],
    [isLoggedIn]
  );
  const screenIndex = Math.max(0, screenOrder.indexOf(stepId));
  const progress = { done: screenIndex + 1, total: screenOrder.length };
  const groupScreens = screenOrder.filter((id) => GROUP_OF[id] === GROUP_OF[stepId]);
  const position = { index: Math.max(1, groupScreens.indexOf(stepId) + 1), total: groupScreens.length };
  const substeps = groupScreens.map((id) => ({
    id,
    label: SCREEN_LABEL[id] || id,
    state: id === stepId ? 'current' : screenOrder.indexOf(id) < screenIndex ? 'done' : 'todo',
  }));

  // ── The report as a flyer, drawn from the answers so far ──────────
  const flyer = useMemo(() => {
    const colorLine = color ? `${color.split(',').map((c) => c.trim()).filter(Boolean).join(', ')} coat.` : '';
    const sizeWord = details.size ? GENERIC_SIZE_OPTIONS.find((o) => o.value === details.size)?.label || '' : '';
    const facts = [details.breed, sizeWord].filter(Boolean);
    return {
      variant: 'found',
      species,
      petName: details.petName || '',
      photoUrl: photos[displayIndex] || photos[0] || '',
      pills: details.microchipId ? ['Chip scanned'] : [],
      when: FOUND_TIME_OPTIONS.find((o) => o.value === timeElapsed)?.label || '',
      where: location ? location.city || (looksLikeCoordinates(location.address) ? 'the pinned spot' : location.address) : '',
      lookFor: [colorLine, facts.length ? `${facts.join(', ')}.` : '', details.marks ? details.marks.trim().replace(/[.]?$/, '.') : ''].filter(Boolean).join(' '),
      phone: isLoggedIn ? '' : contact.phone,
      email: isLoggedIn ? session?.user?.email || '' : contact.email,
    };
  }, [species, details, photos, displayIndex, timeElapsed, location, color, isLoggedIn, contact, session]);
  const preview = species ? <FlyerPreview {...flyer} width={272} /> : null;


  if (result) {
    return (
      <div className="h-full flex flex-col bg-white overflow-hidden">
        <SuccessScreen
          variant={VARIANT}
          caseNumber={result.caseNumber}
          petName={details.petName}
          species={species}
          photoMissing={photos.length === 0}
          isLoggedIn={isLoggedIn}
          accountCreated={result.accountCreated}
          contactEmail={effectiveEmail}
          contactPhone={isLoggedIn ? '' : contact.phone.trim()}
          matches={result.potentialMatches || []}
          matchesNotified={result.matchesNotified || 0}
        />
      </div>
    );
  }

  if (pendingDraft) {
    const bits = [
      pendingDraft.species ? `found ${pendingDraft.species}` : null,
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

  return (
    <WizardShell
      variant={VARIANT}
      steps={steps}
      activeStepId={GROUP_OF[stepId] || 'animal'}
      substeps={substeps}
      progress={progress}
      position={position}
      preview={stepId === 'review' ? null : preview}
      strip={species && stepId !== 'review' ? <FlyerStrip flyer={flyer} label="The report so far" /> : null}
      previewLabel="The report so far"
      onBack={history.length > 0 ? browserBack : null}
      closeHref={isLoggedIn ? '/dashboard' : '/'}
      dirty={dirty}
    >
      {stepId === 'species' && (
        <StepScreen
          stepKey="species"
          variant={VARIANT}
          eyebrow="Thank you for stopping"
          question="What kind of animal did you find?"
          wide
        >
          <OptionCardGrid
            variant={VARIANT}
            options={SPECIES_OPTIONS}
            value={species}
            columns={5}
            centered
            onSelect={(value) => {
              setSpecies(value);
              advance();
            }}
          />
          <SwitchReportLink to="lost" />
        </StepScreen>
      )}

      {stepId === 'where' && (
        <StepScreen
          stepKey="where"
          variant={VARIANT}
          question="Where did you find them?"
          wide
          fillBody
          primary={
            location
              ? { label: 'Confirm this spot', onClick: advance }
              : { label: 'Use my location', onClick: () => locationControl.current?.locate() }
          }
        >
          <LocationPicker
            variant={VARIANT}
            value={location}
            onChange={setLocation}
            onLocated={(spot) => {
              // The device's fix is the answer for most people: no second tap.
              setLocation(spot);
              advance();
            }}
            controlRef={locationControl}
            storageKey={LOCATION_STORAGE_KEY}
          />
        </StepScreen>
      )}

      {stepId === 'when' && (
        <StepScreen
          stepKey="when"
          variant={VARIANT}
          question="When did you find them?"
          wide
        >
          <OptionCardGrid
            variant={VARIANT}
            options={FOUND_TIME_OPTIONS}
            value={timeElapsed}
            columns={2}
            onSelect={(value) => {
              setTimeElapsed(value);
              advance();
            }}
          />
        </StepScreen>
      )}

      {stepId === 'photo' && (
        <StepScreen
          stepKey="photo"
          variant={VARIANT}
          question="Add a photo of them"
          hint="A photo is the easiest way for an owner to recognize their pet."
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
            photos={photos}
            displayIndex={displayIndex}
            onPhotosChange={setPhotos}
            onDisplayChange={setDisplayIndex}
            onAnalysis={handleAnalysis}
          />
        </StepScreen>
      )}

      {stepId === 'colors' && (
        <StepScreen
          stepKey="colors"
          variant={VARIANT}
          question="What colors are they?"
          hint={
            aiSuggested
              ? 'We spotted these in the photo - tap to adjust, then continue.'
              : 'Pick every color that fits - matches are compared by color.'
          }
          primary={{ label: 'Continue', onClick: advance, disabled: !color }}
        >
          <ColorSelector value={color} onChange={setColor} />
        </StepScreen>
      )}

      {stepId === 'details' && (
        <StepScreen
          stepKey="details"
          variant={VARIANT}
          question="Anything from a collar or tag?"
          hint="All optional. A tag name or chip number can identify the owner."
          primary={{ label: 'Continue', onClick: advance }}
          skip={{ label: 'Nothing to add', onClick: advance }}
        >
          <TagDetailsStep variant={VARIANT} species={species} value={details} onChange={setDetails} />
        </StepScreen>
      )}

      {stepId === 'contact' && (
        <StepScreen
          stepKey="contact"
          variant={VARIANT}
          question="How can the owner reach you?"
          hint="A text or an email, whichever you check."
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
          />
        </StepScreen>
      )}

      {stepId === 'review' && (
        <StepScreen
          stepKey="review"
          variant={VARIANT}
          question="Here is the report."
          hint="This is what owners see. Tap anything below to change it."
          error={error}
          errorLink={errorLink}
          primary={{
            label: 'Post the found report',
            tone: 'post',
            onClick: handleSubmit,
            loading: isSubmitting,
            loadingLabel: 'Checking for matches…',
          }}
          footerNote="It goes on the Lost and Found board, and we compare it with lost-pet reports nearby."
        >
          <ReviewPosterCard
            variant={VARIANT}
            flyer={flyer}
            rows={[
              {
                id: 'photo',
                icon: Camera,
                label: 'Photo',
                value: photos.length ? `${photos.length} photo${photos.length > 1 ? 's' : ''}` : 'No photo yet',
              },
              {
                id: 'where',
                icon: MapPin,
                label: 'Found near',
                value: location
                  ? location.city ||
                    (looksLikeCoordinates(location.address) ? 'Pinned on the map' : location.address)
                  : '',
              },
              {
                id: 'when',
                icon: Clock,
                label: 'Found',
                value: FOUND_TIME_OPTIONS.find((o) => o.value === timeElapsed)?.label || '',
              },
              {
                id: 'details',
                icon: Tag,
                label: 'Collar and tag',
                value:
                  [details.petName, details.breed, details.marks].filter(Boolean).join(', ') ||
                  'Nothing added',
              },
              ...(!isLoggedIn
                ? [{
                    id: 'contact',
                    icon: Mail,
                    label: 'We reach you at',
                    value: [contact.firstName, contact.email].filter(Boolean).join(', '),
                  }]
                : []),
            ]}
            onEdit={editFromReview}
          />
        </StepScreen>
      )}
    </WizardShell>
  );
}
