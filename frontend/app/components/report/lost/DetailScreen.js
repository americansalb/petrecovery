'use client';

/**
 * DetailScreen - the body of one optional question from the checklist
 * (app/lib/caseDetails.js DETAIL_SCREENS): collar, microchip, facts,
 * marks, how they got out, what they come to, fears, places, notes.
 * Chips wherever a tap can answer; a line of text only where it cannot.
 */

import {
  COLLAR_OPTIONS,
  COLLAR_COLORS,
  TAG_OPTIONS,
  YES_NO_UNKNOWN,
  SEX_OPTIONS,
  ageOptions,
  markOptions,
  HOW_OUT_OPTIONS,
  LURE_OPTIONS,
  FEAR_OPTIONS,
  PLACE_OPTIONS,
  collarBits,
  marksLine,
  factsBits,
  lureLine,
  placesLine,
} from '@/app/lib/caseDetails';
import BreedSelector from '../../BreedSelector';
import Chips from '../Chips';
import OnTheFlyer from '../OnTheFlyer';
import { WIZARD_THEMES } from '../wizardTheme';

function Field({ label, hint, children }) {
  return (
    <div>
      {label && <p className="mb-2.5 text-sm font-semibold text-midnight-700">{label}</p>}
      {children}
      {hint && <p className="mt-1.5 text-xs text-midnight-400">{hint}</p>}
    </div>
  );
}

function Check({ checked, onChange, children }) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-semibold text-midnight-800">
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-midnight-900" />
      {children}
    </label>
  );
}

export default function DetailScreen({ id, variant = 'lost', species, name, details = {}, onChange, breed = '', onBreedChange }) {
  const theme = WIZARD_THEMES[variant];
  const input = `w-full rounded-2xl border-2 border-midnight-100 bg-white px-4 py-3.5 text-[16px] outline-none ${theme.focusRing}`;
  const area = `${input} resize-none leading-relaxed`;
  const d = details;

  switch (id) {
    case 'collar':
      return (
        <div className="space-y-6">
          <Chips variant={variant} options={COLLAR_OPTIONS} value={d.collar || null} onChange={(collar) => onChange({ collar })} ariaLabel="Collar" />
          {d.collar && d.collar !== 'NONE' && (
            <>
              <Field label="What colour?">
                <Chips
                  variant={variant}
                  size="sm"
                  options={COLLAR_COLORS.map((c) => ({ value: c, label: c }))}
                  value={d.collarColor || null}
                  onChange={(collarColor) => onChange({ collarColor })}
                  ariaLabel="Collar colour"
                />
              </Field>
              <Field label="A tag?">
                <Chips variant={variant} size="sm" options={TAG_OPTIONS} value={d.tag || null} onChange={(tag) => onChange({ tag })} ariaLabel="Tag" />
              </Field>
            </>
          )}
          <Check checked={d.leash} onChange={(leash) => onChange({ leash })}>
            {name} is dragging a leash
          </Check>
          <OnTheFlyer line={collarBits(d).join(' ')} />
        </div>
      );

    case 'microchip':
      return (
        <div className="space-y-6">
          <Chips variant={variant} options={YES_NO_UNKNOWN} value={d.microchip || null} onChange={(microchip) => onChange({ microchip })} ariaLabel="Microchipped" />
          {d.microchip === 'YES' && (
            <>
              <Field label="Is your phone number on the chip current?" hint="If not, call the registry today. A shelter that scans the chip calls the number on file.">
                <Chips
                  variant={variant}
                  size="sm"
                  options={YES_NO_UNKNOWN}
                  value={d.microchipCurrent || null}
                  onChange={(microchipCurrent) => onChange({ microchipCurrent })}
                  ariaLabel="Chip details current"
                />
              </Field>
              <Field label="Chip number" hint="Optional. Never shown publicly; it is for a vet or shelter that asks.">
                <input type="text" inputMode="numeric" value={d.microchipNumber || ''} onChange={(e) => onChange({ microchipNumber: e.target.value })} maxLength={24} className={input} />
              </Field>
            </>
          )}
          {d.microchip === 'NO' && <p className="text-sm text-midnight-500">No problem. The photo, the collar and the markings are what a finder goes by.</p>}
        </div>
      );

    case 'facts':
      return (
        <div className="space-y-6">
          <Field label="Sex">
            <Chips variant={variant} options={SEX_OPTIONS} value={d.sex || null} onChange={(sex) => onChange({ sex })} ariaLabel="Sex" />
          </Field>
          <Field label="Neutered or spayed?" hint="An intact male roams farther; a female in heat draws other animals. Both change where to look.">
            <Chips variant={variant} options={YES_NO_UNKNOWN} value={d.fixed || null} onChange={(fixed) => onChange({ fixed })} ariaLabel="Neutered or spayed" />
          </Field>
          <Field label="Age">
            <Chips variant={variant} options={ageOptions(species)} value={d.ageBand || null} onChange={(ageBand) => onChange({ ageBand })} ariaLabel="Age" />
          </Field>
          {onBreedChange && (
            <Field label="Breed">
              <BreedSelector species={String(species || '').toUpperCase()} value={breed} onChange={onBreedChange} />
            </Field>
          )}
          <OnTheFlyer line={[breed && breed !== 'Unknown' ? breed : '', ...factsBits(d, { species }), d.microchip === 'YES' ? 'Microchipped' : ''].filter(Boolean).join(', ')} />
        </div>
      );

    case 'marks':
      return (
        <div className="space-y-6">
          <Chips variant={variant} multi options={markOptions(species)} value={d.marks || []} onChange={(marks) => onChange({ marks })} ariaLabel="Markings" />
          <Field label="Anything else?">
            <textarea value={d.marksNote || ''} onChange={(e) => onChange({ marksNote: e.target.value })} rows={2} maxLength={160} placeholder="Scar over the left eye, one white toe" className={area} />
          </Field>
          <OnTheFlyer line={marksLine(d)} />
        </div>
      );

    case 'howOut':
      return (
        <div className="space-y-6">
          <Chips variant={variant} options={HOW_OUT_OPTIONS} value={d.howOut || null} onChange={(howOut) => onChange({ howOut })} ariaLabel="How they got out" />
          <Check checked={d.withOtherPet} onChange={(withOtherPet) => onChange({ withOtherPet })}>
            {name} was with another pet
          </Check>
        </div>
      );

    case 'lure':
      return (
        <div className="space-y-6">
          <Chips variant={variant} multi options={LURE_OPTIONS} value={d.lure || []} onChange={(lure) => onChange({ lure })} ariaLabel="What they come to" />
          <Field label="Words or commands" hint="A searcher calling the right word is worth a lot.">
            <input type="text" value={d.lureNote || ''} onChange={(e) => onChange({ lureNote: e.target.value })} maxLength={80} placeholder="Come, treat, car ride" className={input} />
          </Field>
          <OnTheFlyer line={lureLine(d)} />
        </div>
      );

    case 'fears':
      return <Chips variant={variant} multi exclusive={['NONE']} options={FEAR_OPTIONS} value={d.fears || []} onChange={(fears) => onChange({ fears })} ariaLabel="Fears" />;

    case 'places':
      return (
        <div className="space-y-6">
          <Chips variant={variant} multi exclusive={['NONE']} options={PLACE_OPTIONS} value={d.places || []} onChange={(places) => onChange({ places })} ariaLabel="Places they know" />
          <Field label="Addresses, if you know them">
            <textarea value={d.placesNote || ''} onChange={(e) => onChange({ placesNote: e.target.value })} rows={2} maxLength={160} placeholder="Grandma's at 12 Oak St, the dog park on Elm" className={area} />
          </Field>
          <OnTheFlyer label="On the page" line={placesLine(d)} />
        </div>
      );

    case 'notes':
      return (
        <textarea
          value={d.notes || ''}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={4}
          maxLength={300}
          placeholder="Limps when cold. Loves kids. Will get in any car with the door open."
          className={area}
          autoFocus
        />
      );

    default:
      return null;
  }
}
