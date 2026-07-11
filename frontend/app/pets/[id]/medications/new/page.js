'use client';

/**
 * Add or edit a medication.
 *
 * Route: /pets/[id]/medications/new        (create)
 *        /pets/[id]/medications/new?edit=… (edit)
 *
 * Four steps: What, Schedule, Supply, Look. Step 1 has a quick box: type
 * the medication the way the vet said it and Auto-fill parses it (Claude
 * when configured, a local parser otherwise) to prefill the rest.
 */

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Plus, X, Loader2 } from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { cn } from '@/components/ui';
import { useToast } from '@/app/components/ui/Toast';
import { MedIcon, MedIconChip } from '@/app/components/medications/MedIcon';
import {
  MED_COLORS, MED_COLOR_TOKENS, MED_ICON_TOKENS, FORM_OPTIONS, FORM_DEFAULT_ICON,
  SCHEDULE_OPTIONS, WEEKDAYS, medColor, formatSchedule,
} from '@/lib/medications';

const STEPS = [
  { key: 'what', label: 'What' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'supply', label: 'Supply' },
  { key: 'look', label: 'Look' },
];

const TIME_PRESETS = [
  { label: 'Once a day', times: ['08:00'] },
  { label: 'Twice a day', times: ['08:00', '20:00'] },
  { label: '3 times a day', times: ['08:00', '14:00', '20:00'] },
];

const EMPTY_FORM = {
  name: '',
  strength: '',
  form: 'PILL',
  purpose: '',
  prescribedBy: '',
  scheduleType: 'DAILY',
  timesOfDay: ['08:00'],
  daysOfWeek: [],
  intervalDays: 2,
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  quantityRemaining: '',
  refillAlertAt: '',
  instructions: '',
  notes: '',
  color: 'amber',
  icon: 'pill',
  iconTouched: false,
};

const inputClass =
  'w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-[15px] text-neutral-900 ' +
  'placeholder:text-neutral-400 focus:outline-none focus:border-care-teal transition-colors';

const labelClass = 'block text-[13px] font-medium text-neutral-700 mb-1.5';

function Field({ label, hint, required, children }) {
  return (
    <label className="block">
      <span className={labelClass}>
        {label} {required && <span className="text-red-600">*</span>}
        {hint && <span className="block font-normal text-[13px] text-neutral-400 mt-0.5">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function ChipSelect({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
            value === opt.value
              ? 'border-care-teal bg-care-teal text-white'
              : 'border-neutral-300 text-neutral-700 hover:border-care-teal'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function MedicationWizard() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const petId = params.id;
  const editId = searchParams.get('edit');

  const toast = useToast();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(Boolean(editId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [smartText, setSmartText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseNote, setParseNote] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=/pets/${petId}/medications/new`);
    }
  }, [status, router, petId]);

  useEffect(() => {
    if (status !== 'authenticated' || !editId) return;
    (async () => {
      try {
        const res = await fetch(`/api/pets/${petId}/medications`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        const med = (data.medications || []).find((m) => m.id === editId);
        if (!med) throw new Error('Medication not found');
        // Care routines are managed on Today, not here.
        if (med.kind === 'CARE') {
          router.replace(`/pets/${petId}/today`);
          return;
        }
        setForm({
          name: med.name,
          strength: med.strength || '',
          form: med.form,
          purpose: med.purpose || '',
          prescribedBy: med.prescribedBy || '',
          scheduleType: med.scheduleType,
          timesOfDay: med.timesOfDay?.length ? med.timesOfDay : ['08:00'],
          daysOfWeek: med.daysOfWeek || [],
          intervalDays: med.intervalDays || 2,
          startDate: med.startDate ? med.startDate.slice(0, 10) : EMPTY_FORM.startDate,
          endDate: med.endDate ? med.endDate.slice(0, 10) : '',
          quantityRemaining: med.quantityRemaining ?? '',
          refillAlertAt: med.refillAlertAt ?? '',
          instructions: med.instructions || '',
          notes: med.notes || '',
          color: med.color,
          icon: med.icon,
          iconTouched: true,
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [status, editId, petId]);

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const runSmartFill = async () => {
    if (!smartText.trim()) return;
    setParsing(true);
    setParseNote(null);
    try {
      const res = await fetch('/api/ai/parse-medication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: smartText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not parse that');
      const f = data.fields;
      const patch = {};
      const understood = [];
      if (f.name) { patch.name = f.name; understood.push(f.name); }
      if (f.strength) { patch.strength = f.strength; understood.push(f.strength); }
      if (f.form) {
        patch.form = f.form;
        understood.push(FORM_OPTIONS.find((o) => o.value === f.form)?.label || f.form);
      }
      if (f.scheduleType) {
        patch.scheduleType = f.scheduleType;
        if (f.timesOfDay?.length) patch.timesOfDay = f.timesOfDay;
        if (f.intervalDays) patch.intervalDays = f.intervalDays;
        if (f.daysOfWeek?.length) patch.daysOfWeek = f.daysOfWeek;
        understood.push(formatSchedule({
          scheduleType: f.scheduleType,
          timesOfDay: f.timesOfDay || [],
          daysOfWeek: f.daysOfWeek,
          intervalDays: f.intervalDays,
        }));
      }
      if (f.instructions) { patch.instructions = f.instructions; understood.push(f.instructions); }
      if (f.purpose) { patch.purpose = f.purpose; understood.push(`for ${f.purpose.toLowerCase()}`); }
      if (f.prescribedBy) patch.prescribedBy = f.prescribedBy;
      if (f.quantityRemaining != null) patch.quantityRemaining = f.quantityRemaining;
      if (patch.form && !form.iconTouched) patch.icon = FORM_DEFAULT_ICON[patch.form] || 'pill';

      if (!understood.length) {
        setParseNote({ tone: 'warn', text: "Couldn't pick out details. Fill the fields below and we'll take it from there." });
      } else {
        set(patch);
        setParseNote({ tone: 'ok', text: `Got it: ${understood.join(', ')}`, source: data.source });
      }
    } catch (err) {
      setParseNote({ tone: 'warn', text: err.message });
    } finally {
      setParsing(false);
    }
  };

  const stepValid = useMemo(() => {
    if (step === 0) return form.name.trim().length > 0;
    if (step === 1) {
      if (form.scheduleType === 'AS_NEEDED') return true;
      if (!form.timesOfDay.length) return false;
      if (form.scheduleType === 'SPECIFIC_DAYS' && !form.daysOfWeek.length) return false;
      if (form.scheduleType === 'EVERY_N_DAYS' && (!form.intervalDays || form.intervalDays < 1)) return false;
      return true;
    }
    return true;
  }, [step, form]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        strength: form.strength || null,
        form: form.form,
        purpose: form.purpose || null,
        prescribedBy: form.prescribedBy || null,
        scheduleType: form.scheduleType,
        timesOfDay: form.scheduleType === 'AS_NEEDED' ? [] : form.timesOfDay,
        daysOfWeek: form.scheduleType === 'SPECIFIC_DAYS' ? form.daysOfWeek : null,
        intervalDays: form.scheduleType === 'EVERY_N_DAYS' ? Number(form.intervalDays) : null,
        startDate: new Date(`${form.startDate}T00:00:00`).toISOString(),
        endDate: form.endDate ? new Date(`${form.endDate}T23:59:59`).toISOString() : null,
        quantityRemaining: form.quantityRemaining === '' ? null : Number(form.quantityRemaining),
        refillAlertAt: form.refillAlertAt === '' ? null : Number(form.refillAlertAt),
        instructions: form.instructions || null,
        notes: form.notes || null,
        color: form.color,
        icon: form.icon,
      };
      const res = await fetch(
        editId ? `/api/pets/${petId}/medications/${editId}` : `/api/pets/${petId}/medications`,
        {
          method: editId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      // Land back where medications live, and say what happened.
      toast.success(editId ? `${form.name} updated` : `${form.name} added. Doses appear on Today.`);
      router.push(`/pets/${petId}/meds`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner text="Loading..." />
      </div>
    );
  }
  if (status === 'unauthenticated') return null;

  const previewMed = {
    ...form,
    timesOfDay: form.scheduleType === 'AS_NEEDED' ? [] : form.timesOfDay,
    daysOfWeek: form.scheduleType === 'SPECIFIC_DAYS' ? JSON.stringify(form.daysOfWeek) : null,
    intervalDays: form.scheduleType === 'EVERY_N_DAYS' ? Number(form.intervalDays) : null,
  };
  const colors = medColor(form.color);

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 mb-1">
        {editId ? `Edit ${form.name || 'medication'}` : 'Add a medication'}
      </h1>
      <p className="text-[13px] text-neutral-500 mb-6">Step {step + 1} of {STEPS.length}, {STEPS[step].label}</p>

      {/* Progress segments */}
      <div className="flex gap-1.5 mb-8" role="list" aria-label="Wizard progress">
        {STEPS.map((s, i) => (
          <div key={s.key} role="listitem" className={cn('h-1 flex-1 rounded-full', i <= step ? 'bg-care-teal' : 'bg-neutral-200')} />
        ))}
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-red-50 text-red-700 px-4 py-3 mb-6 text-sm">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800" aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}

      {/* Step 1: What. The smart-parse box is for capturing a NEW
          prescription; when editing, the fields are already filled and the
          box would only invite accidentally overwriting them. */}
      {step === 0 && (
        <div className="space-y-5">
          {!editId && (
          <div className="rounded-xl border border-neutral-200 p-4">
            <p className={labelClass}>Type it like the vet said it</p>
            <textarea
              value={smartText}
              onChange={(e) => setSmartText(e.target.value)}
              rows={2}
              placeholder={'Apoquel 16mg twice a day with food for allergies'}
              className={cn(inputClass, 'resize-none')}
            />
            <div className="flex items-center justify-between gap-3 mt-2.5 flex-wrap">
              <p className="text-[13px] text-neutral-500">We'll fill the fields below. You stay in control.</p>
              <button
                type="button"
                onClick={runSmartFill}
                disabled={parsing || !smartText.trim()}
                className="rounded-full bg-care-teal text-white text-sm font-medium px-4 py-1.5 hover:bg-care-tealDark transition-colors disabled:opacity-50"
              >
                {parsing ? 'Reading...' : 'Auto-fill'}
              </button>
            </div>
            {parseNote && (
              <p className={cn('mt-2.5 text-[13px]', parseNote.tone === 'ok' ? 'text-emerald-600' : 'text-red-600')}>
                {parseNote.text}
                {parseNote.source === 'ai' && <span className="text-neutral-400"> (read by AI)</span>}
              </p>
            )}
          </div>
          )}

          <Field label="Medication name" required>
            <input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Apoquel" className={inputClass} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Strength">
              <input value={form.strength} onChange={(e) => set({ strength: e.target.value })} placeholder="16 mg" className={inputClass} />
            </Field>
            <Field label="What's it for?">
              <input value={form.purpose} onChange={(e) => set({ purpose: e.target.value })} placeholder="Allergies" className={inputClass} />
            </Field>
          </div>

          <Field label="Form">
            <ChipSelect
              options={FORM_OPTIONS}
              value={form.form}
              onChange={(v) => set({ form: v, ...(form.iconTouched ? {} : { icon: FORM_DEFAULT_ICON[v] || 'pill' }) })}
            />
          </Field>

          <Field label="Prescribed by" hint="Optional, handy at refill time">
            <input value={form.prescribedBy} onChange={(e) => set({ prescribedBy: e.target.value })} placeholder="Dr. Patel, Lakeview Animal Clinic" className={inputClass} />
          </Field>
        </div>
      )}

      {/* Step 2: Schedule */}
      {step === 1 && (
        <div className="space-y-5">
          <Field label="How often?">
            <ChipSelect options={SCHEDULE_OPTIONS} value={form.scheduleType} onChange={(v) => set({ scheduleType: v })} />
          </Field>

          {form.scheduleType === 'AS_NEEDED' ? (
            <p className="text-[15px] text-neutral-600 rounded-lg bg-neutral-50 px-4 py-3">
              No fixed schedule. You'll get a <span className="font-medium text-neutral-900">Give</span> button on Today for whenever you give it.
            </p>
          ) : (
            <>
              {form.scheduleType === 'SPECIFIC_DAYS' && (
                <Field label="Which days?" required>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((d, i) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => set({
                          daysOfWeek: form.daysOfWeek.includes(i)
                            ? form.daysOfWeek.filter((x) => x !== i)
                            : [...form.daysOfWeek, i].sort(),
                        })}
                        className={cn(
                          'w-11 h-11 rounded-full text-sm font-medium border transition-colors',
                          form.daysOfWeek.includes(i)
                            ? 'bg-care-teal border-care-teal text-white'
                            : 'border-neutral-300 text-neutral-700 hover:border-care-teal'
                        )}
                      >
                        {d[0]}
                      </button>
                    ))}
                  </div>
                </Field>
              )}

              {form.scheduleType === 'EVERY_N_DAYS' && (
                <Field label="Every how many days?" required>
                  <div className="flex items-center gap-3">
                    <input
                      type="number" min="1" max="365"
                      value={form.intervalDays}
                      onChange={(e) => set({ intervalDays: e.target.value })}
                      className={cn(inputClass, 'w-24')}
                    />
                    <span className="text-[15px] text-neutral-600">
                      days {Number(form.intervalDays) === 2 && '(every other day)'}
                      {Number(form.intervalDays) === 7 && '(weekly)'}
                      {Number(form.intervalDays) === 30 && '(monthly)'}
                    </span>
                  </div>
                </Field>
              )}

              <Field label="At what times?" required>
                <div className="flex flex-wrap gap-2 mb-3">
                  {TIME_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => set({ timesOfDay: p.times })}
                      className={cn(
                        'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                        JSON.stringify(form.timesOfDay) === JSON.stringify(p.times)
                          ? 'bg-care-teal border-care-teal text-white'
                          : 'border-neutral-300 text-neutral-700 hover:border-care-teal'
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {form.timesOfDay.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={t}
                        onChange={(e) => {
                          const next = [...form.timesOfDay];
                          next[i] = e.target.value;
                          set({ timesOfDay: next });
                        }}
                        className={cn(inputClass, 'w-36')}
                      />
                      {form.timesOfDay.length > 1 && (
                        <button
                          type="button"
                          onClick={() => set({ timesOfDay: form.timesOfDay.filter((_, x) => x !== i) })}
                          className="p-1.5 text-neutral-400 hover:text-red-600 transition-colors"
                          aria-label="Remove time"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  {form.timesOfDay.length < 6 && (
                    <button
                      type="button"
                      onClick={() => set({ timesOfDay: [...form.timesOfDay, '12:00'] })}
                      className="inline-flex items-center gap-1 text-[13px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
                    >
                      <Plus size={14} /> Add another time
                    </button>
                  )}
                </div>
              </Field>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Starts">
              <input type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Ends" hint="Leave empty if ongoing">
              <input type="date" value={form.endDate} onChange={(e) => set({ endDate: e.target.value })} className={inputClass} />
            </Field>
          </div>
        </div>
      )}

      {/* Step 3: Supply */}
      {step === 2 && (
        <div className="space-y-5">
          <p className="text-[13px] text-neutral-500">
            All optional. Tell us what's in the bottle and we'll count down with every dose and warn you before it runs out.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Doses on hand">
              <input type="number" min="0" step="0.5" value={form.quantityRemaining} onChange={(e) => set({ quantityRemaining: e.target.value })} placeholder="30" className={inputClass} />
            </Field>
            <Field label="Warn me at">
              <input type="number" min="0" step="0.5" value={form.refillAlertAt} onChange={(e) => set({ refillAlertAt: e.target.value })} placeholder="5" className={inputClass} />
            </Field>
          </div>
          <Field label="Instructions" hint='e.g. "Give with food", "Wrap in a pill pocket"'>
            <input value={form.instructions} onChange={(e) => set({ instructions: e.target.value })} placeholder="Give with food" className={inputClass} />
          </Field>
          <Field label="Notes">
            <textarea rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Anything else worth remembering" className={cn(inputClass, 'resize-none')} />
          </Field>
        </div>
      )}

      {/* Step 4: Look */}
      {step === 3 && (
        <div className="space-y-6">
          <Field label="Pick a color" hint="Color-code meds so they're recognizable at a glance">
            <div className="flex flex-wrap gap-2.5">
              {MED_COLOR_TOKENS.map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => set({ color: token })}
                  className={cn(
                    'w-10 h-10 rounded-full transition-transform',
                    MED_COLORS[token].swatch,
                    form.color === token ? 'ring-2 ring-offset-2 ring-neutral-900 scale-110' : 'hover:scale-105'
                  )}
                  aria-label={MED_COLORS[token].label}
                  title={MED_COLORS[token].label}
                />
              ))}
            </div>
          </Field>

          <Field label="Pick an icon">
            <div className="flex flex-wrap gap-2.5">
              {MED_ICON_TOKENS.map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => set({ icon: token, iconTouched: true })}
                  className={cn(
                    'w-11 h-11 rounded-lg border flex items-center justify-center transition-colors',
                    form.icon === token
                      ? cn('border-transparent', colors.iconBg, 'ring-2 ring-neutral-900')
                      : 'border-neutral-300 text-neutral-600 hover:border-care-teal'
                  )}
                  aria-label={token}
                >
                  <MedIcon icon={token} className="w-5 h-5" />
                </button>
              ))}
            </div>
          </Field>

          <div>
            <p className={labelClass}>Preview</p>
            <div className="rounded-xl border border-neutral-200 p-4">
              <div className="flex items-start gap-3">
                <MedIconChip med={previewMed} size="lg" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[15px] font-medium text-neutral-900">{form.name || 'Medication'}</span>
                    {form.strength && <span className="text-[13px] text-neutral-400">{form.strength}</span>}
                  </div>
                  {form.purpose && <p className="text-[13px] text-neutral-500 mt-0.5">{form.purpose}</p>}
                  <p className="text-[13px] text-neutral-600 mt-1">{formatSchedule(previewMed)}</p>
                  {form.instructions && <p className="text-[13px] text-neutral-500 mt-0.5">{form.instructions}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nav row */}
      <div className="flex items-center justify-between gap-3 mt-8">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            <ArrowLeft size={15} /> Back
          </button>
        ) : <span />}

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            disabled={!stepValid}
            className="rounded-full bg-care-teal text-white text-sm font-medium px-5 py-2 hover:bg-care-tealDark transition-colors disabled:opacity-40"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={save}
            disabled={!form.name.trim() || saving}
            className="inline-flex items-center gap-2 rounded-full bg-care-teal text-white text-sm font-medium px-5 py-2 hover:bg-care-tealDark transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {editId ? 'Save changes' : 'Add medication'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function MedicationWizardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><LoadingSpinner /></div>}>
      <MedicationWizard />
    </Suspense>
  );
}
