'use client';

/**
 * "Needs you": the short list of what is waiting for the person running
 * the search, each card with one main thing to do about it
 * (lib/needs.js writes the cards; this only shows them). It is the phone's
 * rule at a desk: one card, one button, several cards deep.
 *
 * When nothing is waiting it says so, and says what the search is doing
 * by itself, so an empty list reads as "all is in hand" and not as a
 * screen that failed to load.
 */
import { NEEDS_SHOWN } from '../lib/needs';
import { SaramaPose } from '../components/Sarama';
import Gear from '../components/Gear';

const MAIN =
  'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-extrabold leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mc-ink)] disabled:opacity-60';

export default function Needs({ cards = [], quiet = '', guide = null, onTasks = null, busy = null, problem = '', onDo, all = false, onAll }) {
  const shown = all ? cards : cards.slice(0, NEEDS_SHOWN);
  const hidden = cards.length - shown.length;
  return (
    <section aria-label="Needs you">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[17px] font-extrabold leading-6 text-[var(--mc-ink)]">
          {/* Sarama is on the search with whoever runs it: calm here, with no cheering. Their pet is missing. */}
          <SaramaPose size={40} still />
          Needs you
          {cards.length > 0 && <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[var(--mc-ink)] px-1.5 text-[14px] font-extrabold tabular-nums text-[var(--mc-surface)]">{cards.length}</span>}
        </h2>
        {(hidden > 0 || all) && cards.length > NEEDS_SHOWN && (
          <button type="button" onClick={onAll} className="text-[13px] font-bold text-[var(--mc-ink)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400">
            {all ? 'Show fewer' : `${hidden} more`}
          </button>
        )}
      </div>
      {/* No decision is waiting. That is never said as "nothing is waiting for you": their pet is still missing.
          Sarama says what kind of search this is and the next thing to do in it (app/lib/searchPlan.js). */}
      {cards.length === 0 && (
        <div className="mt-2 rounded-2xl bg-[var(--mc-raised)] px-4 py-3">
          {guide ? (
            <>
              <p className="text-[15px] font-medium leading-[22px] text-[var(--mc-ink)]">{guide.about}</p>
              {guide.next && (
                <>
                  <p className="mt-2.5 text-[15px] font-bold leading-[21px] text-[var(--mc-ink)]">{guide.next.lead}</p>
                  <p className="text-[15px] font-medium leading-[21px] text-[var(--mc-soft)]">{guide.next.what}</p>
                  {/* What the site already made for that step, here to use at once: the flyers to print, the numbers to call. */}
                  <Gear items={guide.next.gear || []} className="mt-2.5" />
                  {onTasks && (
                    <button type="button" onClick={onTasks} className={`${MAIN} mt-2.5 border border-flash-600 bg-flash-400 text-[var(--mc-on-flash)] hover:bg-flash-300`}>
                      Set it up in Tasks
                    </button>
                  )}
                </>
              )}
              {guide.lines.map((line) => (
                <p key={line} className="mt-2.5 text-[14px] font-medium leading-5 text-[var(--mc-soft)]">
                  {line}
                </p>
              ))}
            </>
          ) : (
            <p className="text-[15px] font-medium leading-[22px] text-[var(--mc-soft)]">{quiet}</p>
          )}
        </div>
      )}
      <ul className="mt-2 flex flex-col gap-2.5">
        {shown.map((card, index) => {
          const seen = card.tone === 'seen';
          return (
            <li key={card.id} className={`rounded-2xl px-4 pb-3.5 pt-3 shadow-sm ${seen ? 'border border-l-4 border-[var(--mc-seen)] bg-[var(--mc-seen-bg)]' : 'bg-[var(--mc-raised)]'}`}>
              <p className={`text-[13px] font-bold leading-[18px] ${seen ? 'text-[var(--mc-seen-ink)]' : 'text-[var(--mc-muted)]'}`}>{card.label}</p>
              {card.title && <h3 className="mt-0.5 text-[17px] font-bold leading-[23px] text-[var(--mc-ink)]">{card.title}</h3>}
              <p className="mt-0.5 whitespace-pre-line break-words text-[15px] font-medium leading-[21px] text-[var(--mc-soft)]">{card.body}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <button
                  type="button"
                  onClick={() => onDo(card, card.primary.do)}
                  disabled={Boolean(busy)}
                  // The first card's button is the yellow one: the next thing to do at this desk. The rest are plain.
                  className={`${MAIN} ${index === 0 ? 'border border-flash-600 bg-flash-400 text-[var(--mc-on-flash)] hover:bg-flash-300' : 'border border-[var(--mc-line-strong)] bg-transparent text-[var(--mc-ink)] hover:bg-[var(--mc-surface)]'}`}
                >
                  {busy === card.id ? 'One moment' : card.primary.words}
                </button>
                {card.more.map((m) => (
                  <button key={m.words} type="button" onClick={() => onDo(card, m.do)} disabled={Boolean(busy)} className="min-h-[32px] text-[14px] font-semibold text-[var(--mc-ink)] underline underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400">
                    {m.words}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      {problem && (
        <p role="alert" className="mt-2 text-sm font-semibold text-[var(--mc-danger)]">
          {problem}
        </p>
      )}
    </section>
  );
}
