'use client';

/**
 * The tasks of the search that are not searching ground, and the plan
 * they come from.
 *
 * A search team does not run the same search for every subject. The top
 * of this tab says, for this pet, what kind of search it is: the species
 * and how the owner said the pet is with people decide which tasks come
 * first (app/lib/searchPlan.js). A scared dog is found by sightings, a
 * feeding station and a trap, with few people on foot. A cat is found in
 * the nearest yards. The wording is that file's, shown as written.
 *
 * Each task comes with what the site already made for this pet
 * (components/Gear.js): the flyers to print are on Flyers, the half sheets
 * to hand out are on Door to door, the pictures and the words are on Posts
 * online, the phone numbers are on Shelters and vets. Founder, 2026-11-13:
 * "Door to door people need to give the flyer, no? Why are we acting as
 * though all these assets cannot assist in the mission control". They are
 * there before a task is set up, so nobody has to fill in a form to print
 * a flyer.
 *
 * Under it are the tasks set up so far, each with its place, who set it
 * up and when, and for a feeding station, a camera or a trap when it was
 * last looked at, and then the tasks that can be added, in the plan's
 * order. They belong to the search itself, so an owner with no Rescue
 * Force can run them (founder, 2026-11-13: "put yourselves in the shoes
 * of the complex S&R team").
 *
 * Only the person running the search sets tasks up. Where a station or a
 * trap is goes to them and to a force looking for the pet, never to
 * everyone with the link: people standing at a feeding station are what
 * keeps the animal away from it.
 */
import { useCallback, useEffect, useState } from 'react';
import { CHECK_EVERY_HOURS, KEPT_KINDS, dueCheck } from '@/app/lib/searchPlan';
import { agoWords } from '../lib/words';
import Gear from '../components/Gear';

const FIELD = 'h-10 w-full rounded-lg border border-[var(--mc-line-strong)] bg-[var(--mc-ground)] px-2.5 text-[14px] font-medium text-[var(--mc-ink)] placeholder:text-[var(--mc-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-flash-400';
const BUTTON = 'inline-flex min-h-[34px] items-center rounded-lg border px-2.5 text-[13px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 disabled:opacity-50';
const SMALL = `${BUTTON} border-[var(--mc-line-strong)] text-[var(--mc-ink)] hover:bg-[var(--mc-raised)]`;
// The one that saves. It had the plain button's ink on an ink ground, so its words could not be seen.
const SOLID = `${BUTTON} border-[var(--mc-ink)] bg-[var(--mc-ink)] text-[var(--mc-ground)]`;

export default function Tasks({ now, onRead, onWrite }) {
  const [data, setData] = useState(null);
  const [problem, setProblem] = useState('');
  const [adding, setAdding] = useState(null);
  const [place, setPlace] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Through the screen's one sender (hooks/useSearch.js), like everything else the desk asks for.
  const load = useCallback(async () => {
    const got = await onRead();
    if (got.error) return setProblem(got.error);
    setProblem('');
    return setData(got);
  }, [onRead]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  async function send(method, body) {
    if (busy) return false;
    setBusy(true);
    setProblem('');
    try {
      const sent = await onWrite(method, body);
      if (sent.error) {
        setProblem(sent.error);
        return false;
      }
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (await send('POST', { kind: adding, place, note })) {
      setAdding(null);
      setPlace('');
      setNote('');
    }
  }

  if (!data) return <p className="px-4 py-6 text-[15px] font-medium leading-[22px] text-[var(--mc-muted)]">{problem || 'Loading the tasks.'}</p>;

  const titleOf = Object.fromEntries(data.kinds.map((k) => [k.kind, k.title]));
  const gearOf = Object.fromEntries(data.kinds.map((k) => [k.kind, k.gear || []]));
  const open = data.tasks.filter((t) => t.status === 'OPEN');
  const finished = data.tasks.filter((t) => t.status === 'DONE');
  const leads = Boolean(data.leads);

  return (
    <section aria-label="Tasks" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4">
      <div className="mt-3 rounded-xl bg-[var(--mc-raised)] px-3 py-2.5">
        <p className="text-[13px] font-bold leading-[18px] text-[var(--mc-muted)]">How this search is run</p>
        <p className="mt-0.5 text-[15px] font-medium leading-[22px] text-[var(--mc-ink)]">{data.plan.about}</p>
        <p className="mt-1 text-[14px] font-medium leading-5 text-[var(--mc-soft)]">{data.plan.footNote}</p>
      </div>

      {problem && (
        <p role="alert" className="mt-2 text-[14px] font-semibold leading-5 text-[var(--mc-seen-ink)]">
          {problem}
        </p>
      )}

      <h3 className="mt-4 text-[13px] font-bold leading-[18px] text-[var(--mc-muted)]">{open.length ? `On the list (${open.length})` : 'Nothing is on the list yet'}</h3>
      <ul className="mt-1.5 flex flex-col gap-2">
        {open.map((task) => {
          const kept = KEPT_KINDS.includes(task.kind);
          const due = dueCheck(task, now);
          return (
            <li key={task.id} className={`rounded-xl border px-3 py-2.5 ${due ? 'border-[var(--mc-seen)]' : 'border-[var(--mc-line)]'}`}>
              <p className="flex items-baseline justify-between gap-2">
                <span className="text-[15px] font-bold leading-5 text-[var(--mc-ink)]">{titleOf[task.kind] || 'Task'}</span>
                {due && <span className="shrink-0 text-[13px] font-bold leading-5 text-[var(--mc-seen-ink)]">Due a look</span>}
              </p>
              {task.place && <p className="mt-0.5 break-words text-[14px] font-medium leading-5 text-[var(--mc-ink)]">{task.place}</p>}
              {task.note && <p className="mt-0.5 break-words text-[14px] font-medium leading-5 text-[var(--mc-soft)]">{task.note}</p>}
              <p className="mt-1 text-[13px] font-medium leading-[18px] text-[var(--mc-muted)]">
                Set up {agoWords(task.createdAt, now)}
                {task.by ? ` by ${task.by}` : ''}.{kept ? (task.checkedAt ? ` Last looked at ${agoWords(task.checkedAt, now)}.` : ' Not looked at since.') : ''}
                {kept ? ` Looked at every ${CHECK_EVERY_HOURS[task.kind]} hours.` : ''}
              </p>
              <Gear items={gearOf[task.kind]} className="mt-2" />
              {leads && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {kept && (
                    <button type="button" className={SMALL} disabled={busy} onClick={() => send('PATCH', { id: task.id, action: 'checked' })}>
                      Looked at it now
                    </button>
                  )}
                  <button type="button" className={SMALL} disabled={busy} onClick={() => send('PATCH', { id: task.id, action: 'done' })}>
                    {kept ? 'Taken down' : 'Done'}
                  </button>
                  <button type="button" className={SMALL} disabled={busy} onClick={() => send('PATCH', { id: task.id, action: 'drop' })}>
                    Remove
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {leads && (
        <>
          <h3 className="mt-4 text-[13px] font-bold leading-[18px] text-[var(--mc-muted)]">What to do, the first on the list first</h3>
          <ol className="mt-1.5 flex flex-col gap-1.5">
            {data.kinds.map((kind, i) => (
              <li key={kind.kind} className="rounded-xl border border-[var(--mc-line)] px-3 py-2.5">
                <div className="flex items-start gap-2.5">
                  <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--mc-raised)] text-[13px] font-extrabold leading-none text-[var(--mc-ink)]">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold leading-5 text-[var(--mc-ink)]">{kind.title}</p>
                    <p className="text-[14px] font-medium leading-5 text-[var(--mc-soft)]">{kind.what}</p>
                    {/* What the site already made for it, there to use whether or not the task is on the list. */}
                    <Gear items={kind.gear} className="mt-2" />
                    {adding === kind.kind ? (
                      <div className="mt-2 flex flex-col gap-1.5">
                        {/* The place is asked in the task's own words, and not at all of a task that has none. */}
                        {kind.where && <input aria-label={kind.where} className={FIELD} placeholder={kind.where} maxLength={120} value={place} onChange={(e) => setPlace(e.target.value)} />}
                        <input aria-label="A note" className={FIELD} placeholder="A note for the people running the search" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} />
                        {kind.shared && <p className="text-[13px] font-medium leading-[18px] text-[var(--mc-muted)]">The people helping are shown this task{kind.where ? `, ${kind.where.toLowerCase()},` : ''} and what to print. The note stays with you.</p>}
                        <div className="flex gap-2">
                          <button type="button" className={SOLID} disabled={busy} onClick={add}>
                            Put it on the list
                          </button>
                          <button type="button" className={SMALL} disabled={busy} onClick={() => setAdding(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className={`${SMALL} mt-2`} disabled={busy} onClick={() => { setAdding(kind.kind); setPlace(''); setNote(''); }}>
                        {kind.shared ? 'Put it on the list and ask helpers' : 'Put it on the list'}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      {finished.length > 0 && (
        <>
          <h3 className="mt-4 text-[13px] font-bold leading-[18px] text-[var(--mc-muted)]">Finished ({finished.length})</h3>
          <ul className="mt-1.5 flex flex-col gap-1">
            {finished.map((task) => (
              <li key={task.id} className="text-[14px] font-medium leading-5 text-[var(--mc-soft)]">
                {titleOf[task.kind] || 'Task'}
                {task.place ? `, ${task.place}` : ''}: {agoWords(task.doneAt, now)}.
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
