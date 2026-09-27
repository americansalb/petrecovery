'use client';

/**
 * "Join {force}" in a sheet: the force's rules, then the join form
 * (app/rescue-forces/[id]/JoinForcePanel.js: one tap when signed in, sign
 * up or sign in otherwise). The force's page opens it from "Join to help";
 * a pet's page opens it when someone who is not a member tries to help.
 * `onJoined` runs once the membership starts.
 */

import { Modal } from '@/components/ui';
import JoinForcePanel from '@/app/rescue-forces/[id]/JoinForcePanel';
import { FORCE_RULES } from '@/app/lib/forceRules';

export default function JoinForceSheet({ open, onClose, force, signedIn, onJoined }) {
  return (
    <Modal open={open} onClose={onClose} title={`Join ${force.name}`}>
      <div className="mb-4 rounded-xl bg-midnight-50 px-4 py-3 text-sm text-midnight-700">
        <p className="font-bold text-midnight-900">Group rules</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {FORCE_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </div>
      <JoinForcePanel forceId={force.id} forceName={force.name} signedIn={signedIn} startOpen inSheet onJoined={onJoined} />
    </Modal>
  );
}
