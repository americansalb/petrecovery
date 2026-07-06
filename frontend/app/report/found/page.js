'use client';

/**
 * Report Found Pet — one-decision-at-a-time wizard.
 *
 * Built for a helper looking at the animal right now: observable facts first
 * (species → where → when → photo → colors), tag details optional, contact
 * last, and potential matches as the payoff on the success screen.
 *
 * Photos upload to the CDN via /api/upload (no more base64), and the merged
 * Where step replaces the old text-geocode + separate-pinpoint screens.
 * Shares every primitive (and the exact look) of the lost wizard — only the
 * emerald FOUND semantics and copy differ.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  PawPrint, Clock, MapPin, Camera, Palette, Mail, Megaphone, Tag,
} from 'lucide-react';
import WizardShell from '../../components/report/WizardShell';
import StepScreen from '../../components/report/StepScreen';
import OptionCardGrid from '../../components/report/OptionCardGrid';
import LocationPicker from '../../components/report/LocationPicker';
import PhotoStep from '../../components/report/PhotoStep';
import ContactFields, { contactIsValid } from '../../components/report/ContactFields';
import ReviewPosterCard from '../../components/report/ReviewPosterCard';
import SuccessScreen from '../../components/report/SuccessScreen';
import TagDetailsStep from '../../components/report/found/TagDetailsStep';
import DraftPrompt from '../../components/report/DraftPrompt';
import useWizardHistory from '../../components/report/useWizardHistory';
import { loadDraft, saveDraft, clearDraft } from '../../components/report/wizardDraft';
import ColorSelector from '../../components/ColorSelector';
import {
  SPECIES_OPTIONS, FOUND_TIME_OPTIONS, WIZARD_THEMES,
} from '../../components/report/wizardTheme';

const VARIANT = 'found';
const CONTACT_MODE = 'email-first'; // matches are emailed — email stays required
const LOCATION_STORAGE_KEY = 'reportLocation';
const DRAFT_KEY = 'reportDraft:found';

const GROUP_OF = {
  species: 'animal', where: 'where', when: 'when', photo: 'photo',
  colors: 'colors', details: 'details', contact: 'contact', review: 'post',
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
  const [contact, setContact] = useState({ firstName: '', method: 'email', email: '', phone: '' });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
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
    try {
      const orderedPhotos = photos.length
        ? [photos[displayIndex], ...photos.filter((_, i) => i !== displayIndex)]
        : [];
      const response = await fetch('/api/reports/found-pet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          photos: orderedPhotos, // CDN URLs from /api/upload — never base64
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create report');
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
        sidebarTitle: 'You might be the reunion',
        sidebarCopy: 'Most found pets are missed by someone nearby. A quick report starts the match search.',
      },
      {
        id: 'where',
        label: 'Where',
        sidebarIcon: MapPin,
        sidebarTitle: 'Location is the #1 signal',
        sidebarCopy: 'Lost pets are matched by distance first — pin the spot where you found them.',
      },
      {
        id: 'when',
        label: 'When',
        sidebarIcon: Clock,
        sidebarTitle: 'Fresh sightings match faster',
        sidebarCopy: 'Owners search hardest in the first hours — timing helps us rank the matches.',
      },
      {
        id: 'photo',
        label: 'Photo',
        sidebarIcon: Camera,
        sidebarTitle: 'Photos triple match speed',
        sidebarCopy: 'An owner will recognize their pet in a heartbeat. Even a quick phone snap helps.',
      },
      {
        id: 'colors',
        label: 'Colors',
        sidebarIcon: Palette,
        sidebarTitle: 'Colors drive the match',
        sidebarCopy: 'Our match engine compares colors against every lost report nearby.',
      },
      {
        id: 'details',
        label: 'Details',
        sidebarIcon: Tag,
        sidebarTitle: 'Check the collar',
        sidebarCopy: 'A tag name or chip number can end the search instantly. All optional.',
      },
      ...(!isLoggedIn
        ? [{
            id: 'contact',
            label: 'Contact',
            sidebarIcon: Mail,
            sidebarTitle: 'Where matches go',
            sidebarCopy: 'When an owner matches, we connect you by email. No password, no hoops.',
          }]
        : []),
      {
        id: 'post',
        label: 'Post it',
        sidebarIcon: Megaphone,
        sidebarTitle: 'Start the match search',
        sidebarCopy: 'We compare your report with every nearby lost pet the moment you post.',
      },
    ],
    [isLoggedIn]
  );

  const summary = useMemo(() => {
    const items = [];
    if (species) {
      const opt = SPECIES_OPTIONS.find((o) => o.value === species);
      if (opt) items.push({ icon: opt.icon, text: `Found ${opt.label.toLowerCase()}` });
    }
    if (location?.address) items.push({ icon: MapPin, text: location.address });
    if (timeElapsed) {
      const opt = FOUND_TIME_OPTIONS.find((o) => o.value === timeElapsed);
      if (opt) items.push({ icon: Clock, text: `Found: ${opt.label.toLowerCase()}` });
    }
    if (photos.length > 0) items.push({ icon: Camera, text: `${photos.length} photo${photos.length > 1 ? 's' : ''} added` });
    return items;
  }, [species, location, timeElapsed, photos]);

  const theme = WIZARD_THEMES[VARIANT];
  const speciesLabel = SPECIES_OPTIONS.find((o) => o.value === species)?.label?.toLowerCase() || 'pet';

  if (result) {
    return (
      <div className="h-full flex flex-col bg-white overflow-hidden">
        <SuccessScreen
          variant={VARIANT}
          caseNumber={result.caseNumber}
          petName={details.petName || `the ${speciesLabel}`}
          photoMissing={photos.length === 0}
          isLoggedIn={isLoggedIn}
          accountCreated={result.accountCreated}
          contactEmail={effectiveEmail}
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
      summary={summary}
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
        </StepScreen>
      )}

      {stepId === 'where' && (
        <StepScreen
          stepKey="where"
          variant={VARIANT}
          question="Where did you find them?"
          wide
          fillBody
          primary={{ label: 'Confirm this spot', onClick: advance, disabled: !location }}
        >
          <LocationPicker
            variant={VARIANT}
            value={location}
            onChange={setLocation}
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
          question="Snap a photo if you can"
          hint="An owner will recognize their pet instantly — photos triple match speed."
          primary={{ label: 'Continue', onClick: advance, disabled: photos.length === 0 }}
          skip={photos.length === 0 ? { label: "I can't take a photo right now", onClick: advance } : null}
        >
          <PhotoStep
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
              ? 'We spotted these in the photo — tap to adjust, then continue.'
              : 'Pick every color that fits — matches are compared by color.'
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
          hint="All optional — a tag name or chip number can end the search instantly."
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
          question="Where should we send matches?"
          hint="When an owner matches, this is how we connect you."
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
            emailHint="Match alerts land here — that's why we need it."
            phoneHint="Optional — for faster coordination on a strong match."
          />
        </StepScreen>
      )}

      {stepId === 'review' && (
        <StepScreen
          stepKey="review"
          variant={VARIANT}
          question="Ready to post?"
          hint="Tap any detail to change it."
          error={error}
          primary={{
            label: `Post ${theme.stamp} report`,
            tone: 'post',
            onClick: handleSubmit,
            loading: isSubmitting,
            loadingLabel: 'Checking for matches…',
          }}
        >
          <ReviewPosterCard
            variant={VARIANT}
            photoUrl={photos[displayIndex] || photos[0]}
            species={species}
            petName={details.petName || `Found ${speciesLabel}`}
            chips={[
              ...color.split(',').map((c) => c.trim()).filter(Boolean),
              details.size ? details.size.toLowerCase() : null,
              details.breed || null,
              details.microchipId ? 'chip scanned' : null,
            ]}
            rows={[
              {
                id: 'where',
                icon: MapPin,
                label: 'Found near',
                value: location ? location.city || location.address : '',
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
                label: 'Details',
                value:
                  [details.petName, details.breed, details.marks].filter(Boolean).join(' · ') ||
                  'None added',
              },
              ...(!isLoggedIn
                ? [{
                    id: 'contact',
                    icon: Mail,
                    label: 'Contact',
                    value: [contact.firstName, contact.email].filter(Boolean).join(' · '),
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
