'use client';

/**
 * The Script page: what the game is, the two things a player can set,
 * and Play.
 *
 * There is no choice of languages. This page used to lead with seven
 * sets to pick from, each with the number of languages in it, which
 * told every player what could come up. Every game now draws from the
 * one pool and nothing here says what is in it (app/lib/geo/script.js).
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Play } from 'lucide-react';
import { randomSeedString } from '@/app/lib/geo/random';
import { SCRIPT_ROUND_OPTIONS, SCRIPT_TIME_OPTIONS, scriptConfigToQuery } from '@/app/lib/geo/script';
import ScriptArtwork from '../home/ScriptArtwork';
import Button from '../ui/Button';
import Card from '../ui/Card';

export default function ScriptLobby() {
  const router = useRouter();
  const [rounds, setRounds] = useState(5);
  const [timer, setTimer] = useState(0);
  const [starting, setStarting] = useState(false);
  const start = () => {
    setStarting(true);
    router.push(`/geo/script/play?${scriptConfigToQuery({ rounds, timer, seed: randomSeedString() })}`);
  };
  return (
    <main className="ui-page">
      <Link href="/geo" className="ui-btn ui-btn--ghost ui-btn--sm -ml-3">
        <ArrowLeft size={16} aria-hidden="true" /> All games
      </Link>
      <div className="mt-4 flex items-start justify-between gap-8">
        <div className="min-w-0 flex-1">
          <h1 className="ui-h1">Script</h1>
          <p className="ui-lead mt-2 max-w-md">
            Read a few lines and pin where the language is spoken.
          </p>
          <Card className="mt-6 max-w-md">
            <h2 className="ui-h2">Solo game</h2>
            <p className="mt-1 text-sm text-pe-muted">
              {rounds} rounds ·{' '}
              {timer ? `${timer} seconds per round` : 'No timer'}
            </p>
            <ol className="mt-4 grid gap-2.5 text-sm text-pe-fg">
              {['Read the text.', 'Pin the language on the map.', 'See the answer.'].map((line, i) => (
                <li key={line} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pe-raised text-xs font-semibold tabular-nums text-pe-muted">
                    {i + 1}
                  </span>
                  {line}
                </li>
              ))}
            </ol>
            <div className="mt-2 border-t border-pe-line pt-1">
              <Choice
                label="Rounds"
                value={rounds}
                options={SCRIPT_ROUND_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
                onChange={setRounds}
              />
              <Choice
                label="Timer"
                value={timer}
                options={SCRIPT_TIME_OPTIONS.map((n) => ({ value: n, label: n ? `${n}s` : 'Off' }))}
                onChange={setTimer}
              />
            </div>
            <Button onClick={start} disabled={starting} size="lg" block className="mt-5">
              <Play size={18} fill="currentColor" aria-hidden="true" />
              {starting ? 'Starting…' : `Play ${rounds} rounds`}
            </Button>
            <p className="mt-2 text-center text-xs text-pe-subtle">Free to play.</p>
          </Card>
        </div>
        <div className="relative hidden h-[330px] w-[420px] shrink-0 overflow-hidden md:block" aria-hidden="true">
          <ScriptArtwork compact />
        </div>
      </div>
    </main>
  );
}

function Choice({ label, value, options, onChange }) {
  return (
    <fieldset className="mt-3">
      <legend className="text-sm font-medium text-pe-muted">{label}</legend>
      <div className="ui-seg mt-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
