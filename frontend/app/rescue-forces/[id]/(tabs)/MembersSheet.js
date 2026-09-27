'use client';

/**
 * Who is in the force, opened from "12 members" in its header: what the
 * force is, its leaders, its members by first name, and its rules. This is
 * where the old Overview tab's "about" facts went.
 */

import { Modal } from '@/components/ui';
import { FORCE_RULES } from '@/app/lib/forceRules';

const LEADER_LABEL = { FOUNDER: 'Started this force', LEADER: 'Leader', ADMINISTRATOR: 'Leader' };
const SHOWN = 24;

export function Avatar({ person, i = 0, size = 'h-9 w-9 text-sm' }) {
  if (person?.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={person.image} alt="" className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  const tint = ['bg-midnight-900 text-white', 'bg-violet-100 text-violet-700', 'bg-pink-100 text-pink-700'][i % 3];
  return (
    <span className={`${size} ${tint} inline-flex shrink-0 items-center justify-center rounded-full font-extrabold`} aria-hidden="true">
      {(person?.name || '?').charAt(0).toUpperCase()}
    </span>
  );
}

function Heading({ children }) {
  return <h3 className="mt-6 text-xs font-extrabold uppercase tracking-wider text-midnight-500">{children}</h3>;
}

export default function MembersSheet({ open, onClose, force, members, onJoin }) {
  const leaders = members.filter((m) => LEADER_LABEL[m.role]);
  const others = members.filter((m) => !LEADER_LABEL[m.role]);
  const started = new Date(force.startedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const n = members.length;

  return (
    <Modal open={open} onClose={onClose} title={`Who is in ${force.name}`}>
      <p className="text-[15px] leading-relaxed text-midnight-700">
        {n === 1 ? '1 neighbor who helps' : `${n} neighbors who help`} find lost pets{force.city ? ` in ${force.city}` : ''}. They
        cover the area inside the yellow line on the map. Started {started}.
      </p>

      {leaders.length > 0 && (
        <>
          <Heading>{leaders.length === 1 ? 'Leader' : 'Leaders'}</Heading>
          <ul className="mt-2 space-y-2.5">
            {leaders.map((m, i) => (
              <li key={m.id} className="flex items-center gap-3">
                <Avatar person={m} i={i} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-midnight-900">{m.name || 'Neighbor'}</span>
                  <span className="block text-sm text-midnight-500">{LEADER_LABEL[m.role]}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {others.length > 0 && (
        <>
          <Heading>Members</Heading>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2.5">
            {others.slice(0, SHOWN).map((m, i) => (
              <li key={m.id} className="flex min-w-0 items-center gap-2.5">
                <Avatar person={m} i={i + 1} size="h-8 w-8 text-xs" />
                <span className="truncate text-midnight-800">{m.name || 'Neighbor'}</span>
              </li>
            ))}
          </ul>
          {others.length > SHOWN && <p className="mt-2 text-sm text-midnight-500">and {others.length - SHOWN} more</p>}
        </>
      )}

      <Heading>Rules</Heading>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-midnight-700">
        {FORCE_RULES.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>

      {onJoin && (
        <button
          type="button"
          onClick={onJoin}
          className="mt-6 flex h-[52px] w-full items-center justify-center rounded-[14px] bg-flash-400 text-base font-extrabold text-midnight-900"
        >
          Join to help
        </button>
      )}
    </Modal>
  );
}
