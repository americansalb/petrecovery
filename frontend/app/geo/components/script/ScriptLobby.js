'use client';

/** A ready-to-play expedition with optional rules, not a configuration form. */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Play } from 'lucide-react';
import { randomSeedString } from '@/app/lib/geo/random';
import {
  LADDERS,
  LADDER_ORDER,
  SCRIPT_ROUND_OPTIONS,
  SCRIPT_TIME_OPTIONS,
  languagesForLadder,
  scriptConfigToQuery,
} from '@/app/lib/geo/script';
import ScriptArtwork from '../home/ScriptArtwork';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { fontStackFor } from '../../script/fonts';

const POOL_GLYPHS = { world: '文', alphabets: 'Aa', india: 'அ', deva: 'अ', arab: 'ع', cyrl: 'Ж', latn: 'Aa' };

export default function ScriptLobby() {
  const router = useRouter();
  const [ladder, setLadder] = useState('world');
  const [rounds, setRounds] = useState(5);
  const [timer, setTimer] = useState(0);
  const [starting, setStarting] = useState(false);
  const poolSize = useMemo(() => languagesForLadder(ladder).length, [ladder]);
  const start = () => {
    setStarting(true);
    router.push(
      `/geo/script/play?${scriptConfigToQuery({ ladder, rounds, timer, seed: randomSeedString() })}`,
    );
  };
  return (
    <main className="ui-page">
      <Link href="/geo" className="ui-btn ui-btn--ghost ui-btn--sm -ml-3">
        <ArrowLeft size={16} aria-hidden="true" /> All games
      </Link>
      {/* The heading every other page has, and the cards beside it where
          there is room for them. They used to hang off the right edge of
          a phone, and the page was a hero of its own with "Free to play"
          twice. */}
      <div className="mt-4 flex items-center justify-between gap-8">
        <div className="min-w-0">
          <h1 className="ui-h1">Script</h1>
          <p className="ui-lead mt-2 max-w-md">
            Read a sentence and pin where the language is spoken.
          </p>
        </div>
        <div className="relative hidden h-[330px] w-[420px] shrink-0 overflow-hidden md:block" aria-hidden="true">
          <ScriptArtwork compact />
        </div>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="pool-title">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="pool-title" className="ui-h2">Choose languages</h2>
            <span className="text-sm tabular-nums text-pe-muted">{poolSize} languages</span>
          </div>
          <div className="mt-3 divide-y divide-pe-line overflow-hidden rounded-xl border border-pe-line bg-pe-surface">
            {LADDER_ORDER.map((id) => {
              const chosen = ladder === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={chosen}
                  onClick={() => setLadder(id)}
                  className={`flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-pe-raised ${chosen ? 'bg-pe-accent/10' : ''}`}
                >
                  <span className="w-9 shrink-0 text-center text-2xl leading-none text-pe-fg" aria-hidden="true" style={{ fontFamily: fontStackFor(id === 'india' ? 'taml' : id) }}>
                    {POOL_GLYPHS[id]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block font-semibold text-pe-fg">{LADDERS[id].label}</strong>
                    <small className="block text-sm text-pe-muted">{LADDERS[id].description}</small>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-pe-muted">
                    {languagesForLadder(id).length}
                  </span>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${chosen ? 'border-pe-accent bg-pe-accent text-white' : 'border-pe-line-strong'}`}
                    aria-hidden="true"
                  >
                    {chosen ? <Check size={13} strokeWidth={3} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <p className="text-sm font-medium text-pe-muted">Solo game</p>
            <h2 className="ui-h2 mt-1">{LADDERS[ladder].label}</h2>
            <p className="mt-1 text-sm text-pe-muted">
              {rounds} rounds ·{' '}
              {timer ? `${timer} seconds per round` : 'No timer'}
            </p>
            <ol className="mt-4 grid gap-2.5 text-sm text-pe-fg">
              {['Read the sentence.', 'Pin the language on the map.', 'See the answer.'].map((line, i) => (
                <li key={line} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pe-raised text-xs font-semibold tabular-nums text-pe-muted">
                    {i + 1}
                  </span>
                  {line}
                </li>
              ))}
            </ol>
            <details className="mt-4 border-t border-pe-line pt-3">
              <summary className="flex min-h-[44px] cursor-pointer items-center text-sm font-medium text-pe-accent-fg">
                Rounds and timer
              </summary>
              <Choice
                label="Rounds"
                value={rounds}
                options={SCRIPT_ROUND_OPTIONS.map((n) => ({
                  value: n,
                  label: String(n),
                }))}
                onChange={setRounds}
              />
              <Choice
                label="Timer"
                value={timer}
                options={SCRIPT_TIME_OPTIONS.map((n) => ({
                  value: n,
                  label: n ? `${n}s` : 'Off',
                }))}
                onChange={setTimer}
              />
            </details>
            <Button
              onClick={start}
              disabled={starting}
              size="lg"
              block
              className="mt-4"
            >
              <Play size={18} fill="currentColor" aria-hidden="true" />
              {starting ? 'Starting…' : `Play ${rounds} rounds`}
            </Button>
            {/* This line used to tell players an account was unnecessary,
                under the only button anybody presses. It says what the
                game costs instead, and the bar above offers the account. */}
            <p className="mt-2 text-center text-xs text-pe-subtle">Free to play.</p>
          </Card>
        </aside>
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
