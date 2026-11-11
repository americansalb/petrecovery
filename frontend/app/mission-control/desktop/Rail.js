'use client';

/**
 * The right-hand column of the desk: who is on which street, what nobody
 * has walked, and the sightings so far. It is facts only. It suggests no
 * plan and tells nobody what to do: the plan is the lead's or the
 * owner's own, written by them and sent in their name.
 *
 * Only the owner and the forces looking for the pet see this column,
 * because it names people.
 */
import { Eyebrow } from '../components/kit';
import { dayAndTime, placeWords, goingWords, clockTime } from '../lib/words';

function Card({ title, right = null, children }) {
  return (
    <section className="rounded-2xl border border-[var(--mc-line)] bg-[var(--mc-surface)] px-5 pb-3 pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold leading-6 text-[var(--mc-ink)]">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

const Empty = ({ children }) => <p className="py-2 text-sm font-medium leading-5 text-[var(--mc-muted)]">{children}</p>;

export default function Rail({ picture, items, unit, now }) {
  const zone = picture.timeZone;
  const thing = unit === 'block' ? 'block' : 'street';
  const out = items.filter((i) => i.status === 'IN_PROGRESS');
  const open = items.filter((i) => i.status === 'UNSEARCHED' || i.status === 'NEEDS_REVISIT');
  const searched = items.filter((i) => i.status === 'SEARCHED').length;
  const sightings = picture.sightings.filter((s) => s.state !== 'NOT_THE_PET');
  return (
    <div className="flex flex-col gap-3.5">
      <Card title={`On the ${thing}s now`} right={<Eyebrow>{out.length}</Eyebrow>}>
        {out.length === 0 && <Empty>Nobody is walking a {thing} right now.</Empty>}
        <ul>
          {out.map((i) => (
            <li key={i.id} className="flex items-start gap-3 border-b border-[var(--mc-line)] py-2.5 last:border-b-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--mc-ink)] text-xs font-extrabold text-[var(--mc-surface)]" aria-hidden="true">
                {String(i.claimedByName || '?').charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-bold leading-5 text-[var(--mc-ink)]">
                  {i.claimedByName || 'A helper'}
                  <span className="font-medium text-[var(--mc-muted)]"> since {clockTime(i.claimedAt, zone)}</span>
                </span>
                <span className="block text-sm font-medium leading-5 text-[var(--mc-soft)]">{i.title}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Not searched yet" right={<Eyebrow>{open.length}</Eyebrow>}>
        <p className="pt-1 text-sm font-semibold leading-5 text-[var(--mc-ink)]">
          {searched} of {items.length} {thing}s {searched === 1 ? 'is' : 'are'} searched.
        </p>
        {open.length === 0 && <Empty>Every {thing} has been walked or has someone on it.</Empty>}
        <ul>
          {open.slice(0, 6).map((i) => (
            <li key={i.id} className="border-b border-[var(--mc-line)] py-2 text-sm font-medium leading-5 text-[var(--mc-soft)] last:border-b-0">
              {i.title}
            </li>
          ))}
        </ul>
        {open.length > 6 && <Empty>And {open.length - 6} more, further from where {picture.pet?.name || 'the pet'} was lost.</Empty>}
      </Card>
      <Card title="Sightings so far" right={<Eyebrow>{sightings.length}</Eyebrow>}>
        {sightings.length === 0 && <Empty>Nobody has reported a sighting yet.</Empty>}
        <ul>
          {sightings.slice(0, 6).map((s) => (
            <li key={s.id} className="flex items-baseline gap-2.5 border-b border-[var(--mc-line)] py-2 last:border-b-0">
              <span className="w-[92px] shrink-0 text-[13px] font-semibold leading-5 text-[var(--mc-muted)]">{dayAndTime(s.at, zone, now)}</span>
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--mc-seen)]" aria-hidden="true" />
              <span className="min-w-0 text-sm font-medium leading-5 text-[var(--mc-ink)]">
                {placeWords(s.place) ? `Seen ${placeWords(s.place)}` : 'Marked on the map'}
                {goingWords(s) ? `, ${goingWords(s)}` : ''}
                {s.by ? `, from ${s.by}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
