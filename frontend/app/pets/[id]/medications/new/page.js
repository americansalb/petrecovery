'use client';

/**
 * Add / Edit Medication Wizard
 *
 * Route: /pets/[id]/medications/new        (create)
 *        /pets/[id]/medications/new?edit=… (edit)
 *
 * Four friendly steps: What → Schedule → Supply → Look. Step 1 has a smart
 * box: type the medication like you'd say it ("Apoquel 16mg twice a day with
 * food") and Auto-fill parses it — Claude when configured, a local parser
 * otherwise — pre-filling the rest of the wizard.
 */

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, Check, Plus, X, Sparkles, Loader2,
  CalendarDays, Package, Palette, FlaskConical,
} from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { Card, Button, cn } from '@/components/ui';
import { MedIcon, MedIconChip } from '@/app/components/medications/MedIcon';
import {
  MED_COLORS, MED_COLOR_TOKENS, MED_ICON_TOKENS, FORM_OPTIONS, FORM_DEFAULT_ICON,
  SCHEDULE_OPTIONS, WEEKDAYS, medColor, formatSchedule, formatTime,
} from '@/lib/medications';

const STEPS = [
  { key: 'what', label: 'What', icon: FlaskConical },
  { key: 'schedule', label: 'Schedule', icon: CalendarDays },
  { key: 'supply', label: 'Supply', icon: Package },
  { key: 'look', label: 'Look', icon: Palette },
];

const TIME_PRESETS = [
  { label: 'Once a day', times: ['08:00'] },
  { label: 'Twice a day', times: ['08:00', '20:00'] },
  { label: '3× a day', times: ['08:00', '14:00', '20:00'] },
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

function Stepper({ step }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8" role="list" aria-label="Wizard progress">
      {STEPS.map((s, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <div key={s.key} className="flex items-center" role="listitem">
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors',
                done ? 'bg-emerald-500 border-emerald-500 text-white'
                  : current ? 'bg-flash-400 border-flash-400 text-midnight-900'
                  : 'bg-white border-midnight-200 text-midnight-400'
              )}>
                {done ? <Check size={16} strokeWidth={3} /> : <s.icon size={16} />}
              </div>
              <span className={cn('text-[11px] font-semibold', current ? 'text-midnight-900' : 'text-midnight-400')}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('w-10 sm:w-16 h-0.5 mx-1.5 mb-5 rounded', done ? 'bg-emerald-400' : 'bg-midnight-200')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-midnight-800 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
        {hint && <span className="block text-xs font-normal text-midnight-400 mt-0.5">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-xl border border-midnight-300 px-3.5 py-2.5 text-midnight-900 text-sm ' +
  'placeholder:text-midnight-400 focus:outline-none focus:ring-2 focus:ring-flash-400 focus:border-flash-400 bg-white';

function ChipSelect({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3.5 py-2 rounded-xl text-sm font-semibold border-2 transition-colors',
            value === opt.value
              ? 'border-flash-400 bg-flash-50 text-midnight-900'
              : 'border-midnight-200 bg-white text-midnight-600 hover:border-midnight-300'
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

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(Boolean(editId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Smart parse state
  const [smartText, setSmartText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseNote, setParseNote] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=/pets/${petId}/medications/new`);
    }
  }, [status, router, petId]);

  // Edit mode: load the medication into the form
  useEffect(() => {
    if (status !== 'authenticated' || !editId) return;
    (async () => {
      try {
        const res = await fetch(`/api/pets/${petId}/medications`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        const med = (data.medications || []).find((m) => m.id === editId);
        if (!med) throw new Error('Medication not found');
        // Care routines are not medications; this wizard would mangle
        // one into a medical shape. Their home is the Care tab.
        if (med.kind === 'CARE') {
          router.replace(`/pets/${petId}/care`);
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
        setParseNote({
          tone: 'ok',
          text: `Got it: ${understood.join(' · ')}`,
          source: data.source,
        });
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
      router.push(`/pets/${petId}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-midnight-50 flex items-center justify-center">
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
    <div className="min-h-screen bg-midnight-50 px-4 py-6 md:px-8 md:py-10">
      <div className="max-w-2xl mx-auto">
        <Link
          href={`/pets/${petId}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-midnight-500 hover:text-midnight-800 transition-colors mb-4"
        >
          <ArrowLeft size={16} /> Back
        </Link>

        <h1 className="text-2xl md:text-3xl font-bold text-midnight-900 mb-1 text-center">
          {editId ? `Edit ${form.name || 'medication'}` : 'Add a medication'}
        </h1>
        <p className="text-midnight-500 text-sm text-center mb-8">
          {editId ? 'Tune anything. History stays put.' : 'A minute now, one-tap tracking forever.'}
        </p>

        <Stepper step={step} />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700"><X size={18} /></button>
          </div>
        )}

        <Card padding="lg">
          {/* ------------------------------ Step 1: What ------------------------------ */}
          {step === 0 && (
            <div className="space-y-5">
              {/* Smart fill */}
              <div className="rounded-2xl border-2 border-dashed border-flash-300 bg-flash-50/60 p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-midnight-900 mb-2">
                  <Sparkles size={16} className="text-flash-600" /> Type it like the vet said it
                </p>
                <textarea
                  value={smartText}
                  onChange={(e) => setSmartText(e.target.value)}
                  rows={2}
                  placeholder={'e.g. "Apoquel 16mg twice a day with food for allergies"'}
                  className={cn(inputClass, 'resize-none')}
                />
                <div className="flex items-center justify-between gap-3 mt-2.5 flex-wrap">
                  <p className="text-xs text-midnight-500">We&apos;ll fill the fields below. You stay in control.</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={runSmartFill}
                    disabled={parsing || !smartText.trim()}
                    leftIcon={parsing ? undefined : Sparkles}
                    loading={parsing}
                  >
                    Auto-fill
                  </Button>
                </div>
                {parseNote && (
                  <p className={cn(
                    'mt-2.5 text-xs font-medium rounded-lg px-3 py-2',
                    parseNote.tone === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                  )}>
                    {parseNote.text}
                    {parseNote.source === 'ai' && <span className="opacity-70"> · understood by AI</span>}
                  </p>
                )}
              </div>

              <Field label="Medication name" required>
                <input
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="Apoquel"
                  className={inputClass}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Strength">
                  <input
                    value={form.strength}
                    onChange={(e) => set({ strength: e.target.value })}
                    placeholder="16 mg"
                    className={inputClass}
                  />
                </Field>
                <Field label="What's it for?">
                  <input
                    value={form.purpose}
                    onChange={(e) => set({ purpose: e.target.value })}
                    placeholder="Allergies"
                    className={inputClass}
                  />
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
                <input
                  value={form.prescribedBy}
                  onChange={(e) => set({ prescribedBy: e.target.value })}
                  placeholder="Dr. Patel, Lakeview Animal Clinic"
                  className={inputClass}
                />
              </Field>
            </div>
          )}

          {/* ---------------------------- Step 2: Schedule ---------------------------- */}
          {step === 1 && (
            <div className="space-y-5">
              <Field label="How often?">
                <ChipSelect
                  options={SCHEDULE_OPTIONS}
                  value={form.scheduleType}
                  onChange={(v) => set({ scheduleType: v })}
                />
              </Field>

              {form.scheduleType === 'AS_NEEDED' ? (
                <p className="text-sm text-midnight-600 bg-midnight-50 border border-midnight-200 rounded-xl px-4 py-3">
                  No fixed schedule. You&apos;ll get a <strong>“Log dose now”</strong> button on the tracker for whenever you give it.
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
                              'w-11 h-11 rounded-full text-sm font-bold border-2 transition-colors',
                              form.daysOfWeek.includes(i)
                                ? 'bg-flash-400 border-flash-400 text-midnight-900'
                                : 'bg-white border-midnight-200 text-midnight-500 hover:border-midnight-300'
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
                        <span className="text-sm text-midnight-500">
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
                            'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                            JSON.stringify(form.timesOfDay) === JSON.stringify(p.times)
                              ? 'bg-midnight-900 border-midnight-900 text-white'
                              : 'bg-white border-midnight-200 text-midnight-600 hover:border-midnight-400'
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
                          <span className="text-xs text-midnight-400">{formatTime(t)}</span>
                          {form.timesOfDay.length > 1 && (
                            <button
                              type="button"
                              onClick={() => set({ timesOfDay: form.timesOfDay.filter((_, x) => x !== i) })}
                              className="p-1.5 text-midnight-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                              aria-label="Remove time"
                            >
                              <X size={15} />
                            </button>
                          )}
                        </div>
                      ))}
                      {form.timesOfDay.length < 6 && (
                        <button
                          type="button"
                          onClick={() => set({ timesOfDay: [...form.timesOfDay, '12:00'] })}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-midnight-600 hover:text-midnight-900 transition-colors"
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
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => set({ startDate: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Ends" hint="Leave empty if ongoing">
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => set({ endDate: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>
          )}

          {/* ----------------------------- Step 3: Supply ----------------------------- */}
          {step === 2 && (
            <div className="space-y-5">
              <p className="text-sm text-midnight-500 -mt-1">
                All optional. Tell us what&apos;s in the bottle and we&apos;ll count down with every dose and warn you before it runs out.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Doses on hand">
                  <input
                    type="number" min="0" step="0.5"
                    value={form.quantityRemaining}
                    onChange={(e) => set({ quantityRemaining: e.target.value })}
                    placeholder="30"
                    className={inputClass}
                  />
                </Field>
                <Field label="Warn me at">
                  <input
                    type="number" min="0" step="0.5"
                    value={form.refillAlertAt}
                    onChange={(e) => set({ refillAlertAt: e.target.value })}
                    placeholder="5"
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Instructions" hint='e.g. "Give with food", "Wrap in a pill pocket"'>
                <input
                  value={form.instructions}
                  onChange={(e) => set({ instructions: e.target.value })}
                  placeholder="Give with food"
                  className={inputClass}
                />
              </Field>
              <Field label="Notes">
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => set({ notes: e.target.value })}
                  placeholder="Anything else worth remembering…"
                  className={cn(inputClass, 'resize-none')}
                />
              </Field>
            </div>
          )}

          {/* ------------------------------ Step 4: Look ------------------------------ */}
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
                        form.color === token ? 'ring-2 ring-offset-2 ring-midnight-900 scale-110' : 'hover:scale-105'
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
                        'w-11 h-11 rounded-xl border-2 flex items-center justify-center transition-colors',
                        form.icon === token
                          ? cn('border-transparent', colors.iconBg, 'ring-2 ring-midnight-900')
                          : 'border-midnight-200 text-midnight-500 bg-white hover:border-midnight-300'
                      )}
                      aria-label={token}
                    >
                      <MedIcon icon={token} className="w-5 h-5" />
                    </button>
                  ))}
                </div>
              </Field>

              {/* Live preview = review */}
              <div>
                <p className="text-sm font-semibold text-midnight-800 mb-2">How it&apos;ll look</p>
                <div className={cn('rounded-2xl border border-midnight-200 bg-white border-l-4 p-4', colors.accent)}>
                  <div className="flex items-start gap-3">
                    <MedIconChip med={previewMed} size="lg" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-midnight-900">{form.name || 'Medication'}</span>
                        {form.strength && <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', colors.chip)}>{form.strength}</span>}
                      </div>
                      {form.purpose && <p className="text-xs text-midnight-500 mt-0.5">{form.purpose}</p>}
                      <p className="text-sm text-midnight-700 mt-1">{formatSchedule(previewMed)}</p>
                      {form.instructions && <p className="text-xs text-midnight-500 italic mt-1">{form.instructions}</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* -------------------------------- Nav row -------------------------------- */}
          <div className="flex items-center justify-between gap-3 mt-8 pt-5 border-t border-midnight-100">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => setStep(step - 1)} leftIcon={ArrowLeft}>Back</Button>
            ) : <span />}

            {step < STEPS.length - 1 ? (
              <Button variant="primary" onClick={() => setStep(step + 1)} disabled={!stepValid} rightIcon={ArrowRight}>
                Continue
              </Button>
            ) : (
              <Button variant="primary" onClick={save} disabled={!form.name.trim() || saving} loading={saving} leftIcon={Check}>
                {editId ? 'Save changes' : 'Add medication'}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function MedicationWizardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-midnight-50 flex items-center justify-center"><LoadingSpinner /></div>}>
      <MedicationWizard />
    </Suspense>
  );
}
