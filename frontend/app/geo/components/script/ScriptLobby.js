'use client';

/** A ready-to-play expedition with optional rules, not a configuration form. */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Play } from 'lucide-react';
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
    <main className="pe-script-lobby pe-page">
      <Link href="/geo" className="pe-back">
        <ArrowLeft size={16} /> All games
      </Link>
      <div className="pe-script-intro">
        <div>
          <p className="pe-eyebrow">Language game</p>
          <h1>
            Script<span>.</span>
          </h1>
          <p>
            Guess where a language is spoken.
          </p>
          <span className="pe-free">
            <span /> Free to play
          </span>
        </div>
        <ScriptArtwork compact />
      </div>
      <div className="pe-script-setup">
        <section aria-labelledby="pool-title">
          <div className="pe-section-heading">
            <h2 id="pool-title">Choose languages</h2>
            <span>{poolSize} languages</span>
          </div>
          <div className="pe-language-pools">
            {LADDER_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={ladder === id}
                onClick={() => setLadder(id)}
              >
                <span className="pe-pool-glyph" aria-hidden="true" style={{fontFamily: fontStackFor(id === 'india' ? 'taml' : id)}}>
                  {POOL_GLYPHS[id]}
                </span>
                <span>
                  <strong>{LADDERS[id].label}</strong>
                  <small>{LADDERS[id].description}</small>
                </span>
                <span className="pe-pool-count">
                  {languagesForLadder(id).length}
                </span>
                {ladder === id ? (
                  <Check size={18} />
                ) : (
                  <span className="pe-choice-dot" />
                )}
              </button>
            ))}
          </div>
        </section>
        <aside className="pe-ready-panel">
          <p className="pe-eyebrow">Solo game</p>
          <h2>{LADDERS[ladder].label}</h2>
          <p>
            {rounds} rounds ·{' '}
            {timer ? `${timer} seconds per round` : 'Take your time'}
          </p>
          <ol className="pe-how-to">
            <li>
              <span>1</span> Read the sentence.
            </li>
            <li>
              <span>2</span> Pin the language on the map.
            </li>
            <li>
              <span>3</span> See the answer.
            </li>
          </ol>
          <details className="pe-custom-rules">
            <summary>Customize rounds & timer</summary>
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
            className="pe-play-button"
          >
            <Play size={18} fill="currentColor" />
            {starting ? 'Starting…' : `Play ${rounds} rounds`}
            <ArrowRight size={18} />
          </Button>
          <small>No account needed.</small>
        </aside>
      </div>
    </main>
  );
}
function Choice({ label, value, options, onChange }) {
  return (
    <fieldset className="pe-rule-choice">
      <legend>{label}</legend>
      <div>
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
