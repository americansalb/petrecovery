'use client';

/**
 * /geo/script: choose a pool and start.
 *
 * The lobby's job is to make the point of the mode obvious before the
 * first round, because "guess the language" reads as a trivia quiz
 * until you see that the answer is a place on a map.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Languages } from 'lucide-react';
import { randomSeedString } from '@/app/lib/geo/random';
import { LADDERS, LADDER_ORDER, SCRIPT_ROUND_OPTIONS, SCRIPT_TIME_OPTIONS, languagesForLadder, scriptConfigToQuery } from '@/app/lib/geo/script';
import { LANGUAGES, scriptsInCorpus } from '@/app/lib/geo/languages';
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
  const scripts = useMemo(() => scriptsInCorpus().length, []);

  const start = () => {
    router.push(`/geo/script/play?${scriptConfigToQuery({ ladder, rounds, timer, seed: randomSeedString() })}`);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-3">
        <Languages className="h-7 w-7 text-flash-500" />
        <h1 className="text-3xl font-bold">Script</h1>
      </div>
      <p className="mt-3 max-w-2xl text-gray-600">
        You get a sentence. You place a pin where that language is spoken. Points depend on how close you are, the same way a
        street-level round works, so there is no dropdown of language names and no all-or-nothing answer.
      </p>
      <p className="mt-2 max-w-2xl text-gray-600">
        Scoring against a pin instead of a country is the point. On a map of borders, Tamil, Marathi and Maithili are all just
        India. On this one they are {LANGUAGES.length} languages across {scripts} writing systems, and the pin has to land in
        the right one.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {SHOWCASE.map((row) => (
          <div key={row.script} className="rounded-xl bg-midnight-950 p-4">
            <ScriptSample text={row.text} script={row.script} size="sm" />
          </div>
        ))}
      </div>

      <fieldset className="mt-8">
        <legend className="text-sm font-semibold text-gray-900">Pool</legend>
        <div className="mt-2 space-y-2">
          {LADDER_ORDER.map((id) => {
            const option = LADDERS[id];
            const active = ladder === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setLadder(id)}
                aria-pressed={active}
                className={`w-full rounded-xl border p-3 text-left transition ${active ? 'border-flash-500 bg-flash-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <span className="font-semibold text-gray-900">{option.label}</span>
                <span className="ml-2 text-sm text-gray-500">{languagesForLadder(id).length} languages</span>
                <p className="mt-1 text-sm text-gray-600">{option.description}</p>
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
        className="mt-8 w-full rounded-xl bg-flash-500 px-4 py-3 text-lg font-semibold text-midnight-950 transition hover:bg-flash-400 sm:w-auto sm:px-8"
      >
        Play {rounds} rounds
      </button>
      <p className="mt-3 text-sm text-gray-500">
        {poolSize} languages in this pool. Script rounds use no imagery and no map key, so they do not count against the
        game&apos;s daily Street View allowance.
      </p>
    </div>
  );
}

function Choice({ label, value, options, onChange }) {
  return (
    <div>
      <p className="text-sm font-semibold text-gray-900">{label}</p>
      <div className="mt-2 flex gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              value === option.value ? 'border-flash-500 bg-flash-50 text-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
