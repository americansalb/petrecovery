'use client';

/**
 * Report Lost Pet — one-decision-at-a-time wizard.
 *
 * Flow (guests): species → name → size → when → where → photo (skippable) →
 * colors → contact (passwordless) → post/review → success. Logged-in owners
 * with saved pets start from a pet picker that short-circuits straight to
 * "when". Option taps advance immediately; typed steps use the footer
 * Continue. Geolocation is only requested from the Where step's button.
 *
 * All UI comes from the shared primitives in app/components/report/.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  Heart, Clock, MapPin, Camera, Palette, Mail, Megaphone,
} from 'lucide-react';
import WizardShell from '../../components/report/WizardShell';
import StepScreen from '../../components/report/StepScreen';
import OptionCardGrid from '../../components/report/OptionCardGrid';
import LocationPicker from '../../components/report/LocationPicker';
import PhotoStep from '../../components/report/PhotoStep';
import ContactFields, { contactIsValid } from '../../components/report/ContactFields';
import ReviewPosterCard from '../../components/report/ReviewPosterCard';
import SuccessScreen from '../../components/report/SuccessScreen';
import MyPetsStep from '../../components/report/lost/MyPetsStep';
import DetailsStep from '../../components/report/lost/DetailsStep';
import DraftPrompt from '../../components/report/DraftPrompt';
import useWizardHistory from '../../components/report/useWizardHistory';
import { loadDraft, saveDraft, clearDraft } from '../../components/report/wizardDraft';
import ColorSelector from '../../components/ColorSelector';
import {
  SPECIES_OPTIONS, SPECIES_ICONS, DOG_SIZE_OPTIONS, CAT_LIVING_OPTIONS,
  LOST_TIME_OPTIONS, WIZARD_THEMES, speciesToApi,
} from '../../components/report/wizardTheme';
import { SARAMA_AVATAR } from '@/lib/brandAssets';

const VARIANT = 'lost';
// Contact capture mode. 'either' lets reporters choose email OR text —
// phone-only is supported server-side via a placeholder account email.
const CONTACT_MODE = 'either';
const LOCATION_STORAGE_KEY = 'reportLocation';
const DRAFT_KEY = 'reportDraft:lost';

const GROUP_OF = {
  pets: 'pet', species: 'pet', name: 'pet', size: 'pet',
  when: 'when', where: 'where', photo: 'photo', colors: 'colors',
  contact: 'contact', review: 'post', details: 'post',
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
  const [species, setSpecies] = useState('');
  const [petName, setPetName] = useState('');
  const [petSize, setPetSize] = useState('');
  const [isIndoorCat, setIsIndoorCat] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState('');
  const [location, setLocation] = useState(null); // { lat, lng, address, city }
  const [photos, setPhotos] = useState([]);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [color, setColor] = useState('');
  const [aiSuggested, setAiSuggested] = useState(false);
  const [contact, setContact] = useState({ firstName: '', method: 'email', email: '', phone: '' });
  const [marks, setMarks] = useState('');
  const [breed, setBreed] = useState('');
  const [escapeScenario, setEscapeScenario] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [pendingDraft, setPendingDraft] = useState(null); // unfinished draft awaiting resume/fresh choice

  // ── Load saved pets, resolve the first step ───────────────────────
  useEffect(() => {
    if (authStatus === 'loading') return;
    if (!isLoggedIn) {
      setMyPets([]);
      return;
    }
    fetch('/api/pets')
      .then((res) => (res.ok ? res.json() : { pets: [] }))
      .then((data) => setMyPets(data.pets || []))
      .catch(() => setMyPets([]));
  }, [authStatus, isLoggedIn]);

  useEffect(() => {
    if (stepId || authStatus === 'loading' || myPets === null) return;
    setStepId(isLoggedIn && myPets.length > 0 ? 'pets' : 'species');
  }, [stepId, authStatus, isLoggedIn, myPets]);

  // ── Draft persistence (session-scoped, explicit restore) ──────────
  const dirty = Boolean(
    species || petName.trim() || timeElapsed || location || photos.length > 0 ||
    color || marks || breed || contact.firstName.trim()
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
      species, petName, petSize, isIndoorCat, timeElapsed, location,
      photos, displayIndex, color, contact, marks, breed, escapeScenario,
      selectedPet: selectedPet
        ? {
            id: selectedPet.id, name: selectedPet.name, species: selectedPet.species,
            color: selectedPet.color, breed: selectedPet.breed, size: selectedPet.size,
            isIndoor: selectedPet.isIndoor, primaryPhotoUrl: selectedPet.primaryPhotoUrl,
          }
        : null,
    });
  }, [dirty, pendingDraft, result, species, petName, petSize, isIndoorCat, timeElapsed,
      location, photos, displayIndex, color, contact, marks, breed, escapeScenario, selectedPet]);

  const resumeDraft = () => {
    const d = pendingDraft;
    setSpecies(d.species || '');
    setPetName(d.petName || '');
    setPetSize(d.petSize || '');
    setIsIndoorCat(d.isIndoorCat ?? null);
    setTimeElapsed(d.timeElapsed || '');
    setLocation(d.location || null);
    setPhotos(d.photos || []);
    setDisplayIndex(d.displayIndex || 0);
    setColor(d.color || '');
    setContact(d.contact || { firstName: '', method: 'email', email: '', phone: '' });
    setMarks(d.marks || '');
    setBreed(d.breed || '');
    setEscapeScenario(d.escapeScenario || '');
    if (d.selectedPet) setSelectedPet(d.selectedPet);

    // Land on the first incomplete step, with a plausible back-stack.
    const done = {
      species: !!d.species,
      name: !!d.petName?.trim(),
      size: d.species === 'dog' ? !!d.petSize : d.species === 'cat' ? d.isIndoorCat != null : true,
      when: !!d.timeElapsed,
      where: !!d.location,
      photo: true, // skippable — never blocks resume
      colors: !!d.color,
      contact: isLoggedIn || contactIsValid(d.contact || {}, CONTACT_MODE),
    };
    const order = [
      'species', 'name',
      ...(d.species === 'dog' || d.species === 'cat' ? ['size'] : []),
      'when', 'where', 'photo', 'colors',
      ...(!isLoggedIn ? ['contact'] : []),
    ];
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

  /** Advance from `stepId` along the normal chain, honoring review edits. */
  const advance = () => {
    if (returnToRef.current) {
      const back = returnToRef.current;
      returnToRef.current = null;
      go(back);
      return;
    }
    const needsSize = species === 'dog' || species === 'cat';
    const needsColors = !color || !selectedPet;
    const chain = {
      species: 'name',
      name: needsSize ? 'size' : 'when',
      size: 'when',
      when: 'where',
      where: 'photo',
      photo: needsColors ? 'colors' : isLoggedIn ? 'review' : 'contact',
      colors: isLoggedIn ? 'review' : 'contact',
      contact: 'review',
      details: 'review',
    };
    if (chain[stepId]) go(chain[stepId]);
  };

  // ── Selections ────────────────────────────────────────────────────
  const handleSelectPet = (pet) => {
    const typeMap = { DOG: 'dog', CAT: 'cat', BIRD: 'bird', RABBIT: 'rabbit' };
    setSelectedPet(pet);
    setSpecies(typeMap[pet.species] || 'other');
    setPetName(pet.name || '');
    if (pet.color) setColor(pet.color);
    if (pet.breed) setBreed(pet.breed);
    if (pet.size) setPetSize(pet.size);
    if (pet.isIndoor !== undefined && pet.isIndoor !== null) setIsIndoorCat(pet.isIndoor);
    setPhotos(pet.primaryPhotoUrl ? [pet.primaryPhotoUrl] : []);
    setDisplayIndex(0);
    go('when');
  };

  const handleNewPet = () => {
    setSelectedPet(null);
    go('species');
  };

  const handleAnalysis = (analysis) => {
    if (analysis?.colors?.length > 0 && !color) {
      setColor(analysis.colors.join(', '));
      setAiSuggested(true);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────
  const effectiveEmail = isLoggedIn
    ? session?.user?.email || ''
    : CONTACT_MODE === 'either' && contact.method === 'phone'
      ? ''
      : contact.email.trim();
  const effectivePhone = isLoggedIn ? '' : contact.phone.trim();
  const effectiveName = isLoggedIn ? session?.user?.name || 'Pet Owner' : contact.firstName.trim();

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const orderedPhotos = photos.length
        ? [photos[displayIndex], ...photos.filter((_, i) => i !== displayIndex)]
        : [];
      const response = await fetch('/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: effectiveEmail,
          phone: effectivePhone,
          firstName: effectiveName,
          petName: petName.trim(),
          color,
          breed: breed || undefined,
          distinctiveMarks: marks || undefined,
          escapeScenario: escapeScenario || undefined,
          lastSeenAddress: location.address,
          center: [location.lat, location.lng],
          radiusMiles: 0.1,
          timeElapsed,
          petType: speciesToApi(species),
          petSize: species === 'dog' ? petSize : undefined,
          isIndoorCat: species === 'cat' ? isIndoorCat : undefined,
          photos: orderedPhotos,
          locationType: 'address',
          cityName: location.city,
          selectedPetId: selectedPet?.id,
          reporterLocation: null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create report');
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

  // ── Shell step groups (stable checklist) ──────────────────────────
  const steps = useMemo(() => {
    const name = petName || 'your pet';
    return [
      {
        id: 'pet',
        label: 'Your pet',
        sidebarIcon: Heart,
        sidebarTitle: 'Who went missing?',
        sidebarCopy: 'A few quick taps — every answer sharpens what searchers look for.',
      },
      {
        id: 'when',
        label: 'When',
        sidebarIcon: Clock,
        sidebarTitle: 'Timing shapes the search',
        sidebarCopy: 'Pets lost within the hour are usually still close. The clock sets the urgency of your alert.',
      },
      {
        id: 'where',
        label: 'Where',
        sidebarIcon: MapPin,
        sidebarTitle: 'Pin the spot',
        sidebarCopy: `Volunteers search outward from this point — drag the pin to exactly where ${name} was last seen.`,
      },
      {
        id: 'photo',
        label: 'Photo',
        sidebarIcon: Camera,
        sidebarTitle: 'Worth 1,000 flyers',
        sidebarCopy: 'A clear photo is the single best thing you can add. No photo handy? Skip it and add one later.',
      },
      {
        id: 'colors',
        label: 'Colors',
        sidebarIcon: Palette,
        sidebarTitle: 'Colors people can match',
        sidebarCopy: 'Sightings are matched by color first — accurate colors mean fewer false alarms.',
      },
      ...(!isLoggedIn
        ? [{
            id: 'contact',
            label: 'Contact',
            sidebarIcon: Mail,
            sidebarTitle: 'Stay reachable',
            sidebarCopy: `The moment someone spots ${name}, this is how we tell you. No password, no hoops.`,
          }]
        : []),
      {
        id: 'post',
        label: 'Post it',
        sidebarIcon: Megaphone,
        sidebarTitle: 'Blast the alert',
        sidebarCopy: 'Your report reaches volunteers, rescue forces and the public board the second you post.',
      },
    ];
  }, [isLoggedIn, petName]);

  const summary = useMemo(() => {
    const items = [];
    const SpeciesIcon = SPECIES_ICONS[species] || SPECIES_ICONS.other;
    if (petName) items.push({ icon: SpeciesIcon, text: petName });
    if (timeElapsed) {
      const opt = LOST_TIME_OPTIONS.find((o) => o.value === timeElapsed);
      if (opt) items.push({ icon: Clock, text: `Missing since: ${opt.label.toLowerCase()}` });
    }
    if (location?.address) items.push({ icon: MapPin, text: location.address });
    if (photos.length > 0) items.push({ icon: Camera, text: `${photos.length} photo${photos.length > 1 ? 's' : ''} added` });
    return items;
  }, [species, petName, timeElapsed, location, photos]);

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
          activation={result.activation}
        />
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
  const name = petName || 'your pet';

  return (
    <WizardShell
      variant={VARIANT}
      steps={steps}
      activeStepId={GROUP_OF[stepId] || 'pet'}
      summary={summary}
      onBack={history.length > 0 ? browserBack : null}
      closeHref={isLoggedIn ? '/dashboard' : '/'}
      dirty={dirty}
    >
      {stepId === 'pets' && (
        <StepScreen
          stepKey="pets"
          variant={VARIANT}
          question="Which pet is missing?"
          hint="We'll fill in their details for you."
          wide
        >
          <MyPetsStep pets={myPets || []} onSelectPet={handleSelectPet} onNewPet={handleNewPet} />
        </StepScreen>
      )}

      {stepId === 'species' && (
        <StepScreen
          stepKey="species"
          variant={VARIANT}
          question="What kind of pet is missing?"
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
              if (value !== 'dog') setPetSize('');
              if (value !== 'cat') setIsIndoorCat(null);
              advance();
            }}
          />
        </StepScreen>
      )}

      {stepId === 'name' && (
        <StepScreen
          stepKey="name"
          variant={VARIANT}
          question="What's their name?"
          hint="The name they answer to — it goes on the poster."
          primary={{ label: 'Continue', onClick: advance, disabled: !petName.trim() }}
        >
          <input
            type="text"
            value={petName}
            onChange={(e) => setPetName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && petName.trim()) advance();
            }}
            placeholder="Max, Bella, Charlie…"
            autoFocus
            className={`w-full text-xl font-semibold px-5 py-4 bg-white border-2 border-midnight-100 rounded-2xl outline-none transition-colors placeholder:text-midnight-200 placeholder:font-normal ${theme.focusRing}`}
          />
        </StepScreen>
      )}

      {stepId === 'size' && species === 'dog' && (
        <StepScreen stepKey="size-dog" variant={VARIANT} question={`How big is ${name}?`} wide>
          <OptionCardGrid
            variant={VARIANT}
            options={DOG_SIZE_OPTIONS}
            value={petSize}
            columns={5}
            onSelect={(value) => {
              setPetSize(value);
              advance();
            }}
          />
        </StepScreen>
      )}

      {stepId === 'size' && species === 'cat' && (
        <StepScreen
          stepKey="size-cat"
          variant={VARIANT}
          question={`Is ${name} an indoor or outdoor cat?`}
          hint="Indoor cats usually hide close by. Outdoor cats roam farther."
        >
          <OptionCardGrid
            variant={VARIANT}
            options={CAT_LIVING_OPTIONS}
            value={isIndoorCat === true ? 'indoor' : isIndoorCat === false ? 'outdoor' : ''}
            columns={2}
            onSelect={(value) => {
              setIsIndoorCat(value === 'indoor');
              advance();
            }}
          />
        </StepScreen>
      )}

      {stepId === 'when' && (
        <StepScreen
          stepKey="when"
          variant={VARIANT}
          question={`When did ${name} go missing?`}
          hint="This sets the urgency and search radius of your alert."
          wide
        >
          <OptionCardGrid
            variant={VARIANT}
            options={LOST_TIME_OPTIONS}
            value={timeElapsed}
            columns={3}
            onSelect={(value) => {
              setTimeElapsed(value);
              advance();
            }}
          />
        </StepScreen>
      )}

      {stepId === 'where' && (
        <StepScreen
          stepKey="where"
          variant={VARIANT}
          question={`Where was ${name} last seen?`}
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

      {stepId === 'photo' && (
        <StepScreen
          stepKey="photo"
          variant={VARIANT}
          question={`Add a photo of ${name}`}
          hint="Reports with photos get far more sightings."
          primary={{ label: 'Continue', onClick: advance, disabled: photos.length === 0 }}
          skip={photos.length === 0 ? { label: "I don't have a photo right now", onClick: advance } : null}
        >
          <PhotoStep
            variant={VARIANT}
            petName={petName}
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
          question={`What colors is ${name}?`}
          hint={
            aiSuggested
              ? 'We spotted these in the photo — tap to adjust, then continue.'
              : 'Pick every color that fits.'
          }
          primary={{ label: 'Continue', onClick: advance, disabled: !color }}
        >
          <ColorSelector value={color} onChange={setColor} />
        </StepScreen>
      )}

      {stepId === 'contact' && (
        <StepScreen
          stepKey="contact"
          variant={VARIANT}
          question="How can finders reach you?"
          hint={`The moment someone spots ${name}, this is how we tell you.`}
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
            emailHint="Sighting alerts and your manage link land here."
            phoneHint="We'll text you when someone reports a sighting."
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
            loadingLabel: 'Posting your alert…',
          }}
          skip={{ label: 'Add details that help searchers (30 sec)', onClick: () => go('details') }}
        >
          <ReviewPosterCard
            variant={VARIANT}
            photoUrl={photos[displayIndex] || photos[0]}
            species={species}
            petName={petName}
            chips={[
              ...color.split(',').map((c) => c.trim()).filter(Boolean),
              species === 'dog' && petSize ? petSize.toLowerCase() : null,
              species === 'cat' && isIndoorCat !== null ? (isIndoorCat ? 'indoor cat' : 'outdoor cat') : null,
              breed || null,
            ]}
            rows={[
              {
                id: 'where',
                icon: MapPin,
                label: 'Last seen',
                value: location ? location.city || location.address : '',
              },
              {
                id: 'when',
                icon: Clock,
                label: 'Missing since',
                value: LOST_TIME_OPTIONS.find((o) => o.value === timeElapsed)?.label || '',
              },
              ...(!isLoggedIn
                ? [{
                    id: 'contact',
                    icon: Mail,
                    label: 'Contact',
                    value: [contact.firstName, contact.method === 'phone' ? contact.phone : contact.email]
                      .filter(Boolean)
                      .join(' · '),
                  }]
                : []),
            ]}
            onEdit={editFromReview}
          />
        </StepScreen>
      )}

      {stepId === 'details' && (
        <StepScreen
          stepKey="details"
          variant={VARIANT}
          question={`Anything that helps someone recognize ${name}?`}
          hint="All optional — every detail makes the poster stronger."
          primary={{ label: 'Save details', onClick: advance }}
        >
          <DetailsStep
            variant={VARIANT}
            species={species}
            marks={marks}
            onMarksChange={setMarks}
            breed={breed}
            onBreedChange={setBreed}
            escapeScenario={escapeScenario}
            onEscapeChange={setEscapeScenario}
          />
        </StepScreen>
      )}
    </WizardShell>
  );
}
