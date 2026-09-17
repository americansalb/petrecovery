'use client';

/**
 * /geo/script: choose a pool and start.
 *
 * It used to open with two paragraphs arguing for the mode - that
 * scoring against a pin rather than a country is the point, that other
 * games in the genre call the whole subcontinent India - and only then
 * show anything playable. A player who has clicked Script has already
 * decided to play it (founder, 2026-09-17: "the Script setup reads like
 * you are defending a design thesis").
 *
 * So: one line, the specimens, the pools, the rules, Start. The
 * argument for the mode is the specimens.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Languages } from 'lucide-react';
import { randomSeedString } from '@/app/lib/geo/random';
import { LADDERS, LADDER_ORDER, SCRIPT_ROUND_OPTIONS, SCRIPT_TIME_OPTIONS, languagesForLadder, scriptConfigToQuery } from '@/app/lib/geo/script';
import ScriptSample from './ScriptSample';

// Shown on the lobby so the mode explains itself: three alphabets, one
// of which most visitors will not be able to name.
const SHOWCASE = [
  { script: 'deva', text: 'आज सुबह बहुत ठंड थी' },
  { script: 'taml', text: 'இன்று காலை மிகவும் குளிராக இருந்தது' },
  { script: 'ethi', text: 'ዛሬ ጠዋት በጣም ቀዝቃዛ ነበር' },
];

export default function ScriptLobby() {
  const router = useRouter();
  const [ladder, setLadder] = useState('world');
  const [rounds, setRounds] = useState(5);
  const [timer, setTimer] = useState(0);

  const poolSize = useMemo(() => languagesForLadder(ladder).length, [ladder]);

  const start = () => {
    router.push(`/geo/script/play?${scriptConfigToQuery({ ladder, rounds, timer, seed: randomSeedString() })}`);
  };

  const startLabel = `Play ${rounds} rounds`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <Languages className="h-7 w-7 shrink-0 text-clay-300" />
            <h1 className="text-3xl font-bold">Script</h1>
          </div>
          <p className="mt-2 text-white/70">Read the sentence. Pin where the language is used.</p>
        </div>
        <button
          type="button"
          onClick={start}
          className="shrink-0 rounded-xl bg-clay-400 px-6 py-3 text-lg font-bold text-ocean-950 transition hover:bg-clay-300"
        >
          {startLabel}
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {SHOWCASE.map((row) => (
          <div key={row.script} className="rounded-xl border border-sand-300 bg-[#fffdf8] p-4 shadow-sm">
            <ScriptSample text={row.text} script={row.script} size="sm" />
          </div>
        ))}
      </div>

      <fieldset className="mt-8">
        <legend className="text-sm font-semibold text-white">Languages</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {LADDER_ORDER.map((id) => {
            const option = LADDERS[id];
            const active = ladder === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setLadder(id)}
                aria-pressed={active}
                className={`w-full rounded-xl border p-3 text-left transition ${active ? 'border-clay-400 bg-clay-500/10' : 'border-white/10 hover:border-white/15'}`}
              >
                <span className="font-semibold text-white">{option.label}</span>
                <span className="ml-2 text-sm text-white/60">{languagesForLadder(id).length} languages</span>
                <p className="mt-1 text-sm text-white/60">{option.description}</p>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Choice label="Rounds" value={rounds} options={SCRIPT_ROUND_OPTIONS.map((n) => ({ value: n, label: String(n) }))} onChange={setRounds} />
        <Choice
          label="Timer"
          value={timer}
          options={SCRIPT_TIME_OPTIONS.map((n) => ({ value: n, label: n ? `${n}s` : 'Off' }))}
          onChange={setTimer}
        />
      </div>

      <button
        type="button"
        onClick={start}
        className="mt-8 w-full rounded-xl bg-clay-400 px-4 py-3 text-lg font-bold text-ocean-950 transition hover:bg-clay-300 sm:w-auto sm:px-8"
      >
        {startLabel}
      </button>
      <p className="mt-3 text-sm text-white/60">
        {LADDERS[ladder].label} &middot; {poolSize} languages &middot; {timer ? `${timer}s a round` : 'no timer'}
      </p>
    </div>
  );
}

function Choice({ label, value, options, onChange }) {
  return (
    <div>
      <p className="text-sm font-semibold text-white">{label}</p>
      <div className="mt-2 flex gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              value === option.value ? 'border-clay-400 bg-clay-500/10 text-white' : 'border-white/10 text-white/60 hover:border-white/15'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
