'use client';

/**
 * DetailsHub - the checklist after posting, with each question answered in
 * place and saved at once: on the success screen (with the details token
 * from the create response, since a guest has no session yet) and in the
 * owner's panel on the pet's page (with the owner's session). Each save
 * goes to PATCH /api/missions/[id]; the flyers are redrawn a minute after
 * the last change (app/lib/cascade/redrawLater.js), once for the lot.
 *
 * The first questions are the ones the report form no longer asks before
 * posting (founder, 2026-11-17): size (a dog) or indoor or outdoor (a
 * cat), the other colors, health, and the reward with its scam note.
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { DETAIL_SCREENS, normalizeDetails } from '@/app/lib/caseDetails';
import { DETAILS_TOKEN_HEADER } from '@/app/lib/detailsToken';
import DetailsChecklist from './DetailsChecklist';
import DetailScreen from './DetailScreen';
import RewardStep, { rewardIsValid } from './RewardStep';

const NO_REWARD = { hasReward: null, rewardMode: null, rewardAmount: null, scamAck: false };

export default function DetailsHub({ caseId, token, species, name, details: initial, breed: initialBreed = '', title, intro, limit, onSaved }) {
  const [details, setDetails] = useState(() => normalizeDetails(initial));
  const [breed, setBreed] = useState(initialBreed === 'Unknown' ? '' : initialBreed || '');
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState({});
  const [draftBreed, setDraftBreed] = useState('');
  const [reward, setReward] = useState(NO_REWARD);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const screen = DETAIL_SCREENS.find((s) => s.id === openId);

  const open = (id) => {
    setOpenId(id);
    setDraft({});
    setDraftBreed(breed);
    setReward(details.reward === 'NO' ? { ...NO_REWARD, hasReward: false } : details.reward === 'YES' ? { ...NO_REWARD, hasReward: true } : NO_REWARD);
    setError('');
    setSaved(false);
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const body = {};
      if (Object.keys(draft).length) body.details = draft;
      if (openId === 'facts' && draftBreed !== breed) body.petBreed = draftBreed;
      if (openId === 'reward') {
        // The answer is kept with the others (details.reward) so the checklist knows it was asked.
        body.details = { reward: reward.hasReward ? 'YES' : 'NO' };
        body.hasReward = reward.hasReward === true;
        if (reward.hasReward) {
          if (reward.rewardMode !== 'unstated' && reward.rewardAmount) body.rewardAmount = reward.rewardAmount;
          body.rewardScamAcknowledged = Boolean(reward.scamAck);
        }
      }
      if (Object.keys(body).length) {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers[DETAILS_TOKEN_HEADER] = token;
        const res = await fetch(`/api/missions/${caseId}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'That did not save. Try again in a moment.');
        const next = normalizeDetails(data.case?.details ?? { ...details, ...(body.details || {}) });
        setDetails(next);
        if (body.petBreed !== undefined) setBreed(data.case?.petBreed === 'Unknown' ? '' : data.case?.petBreed || '');
        onSaved?.(data.case);
        setSaved(true);
      }
      setOpenId(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (screen) {
    const merged = { ...details, ...draft };
    const canSave = openId !== 'reward' || rewardIsValid(reward);
    return (
      <section aria-labelledby="details-hub-question" className="rounded-2xl border border-midnight-200 bg-white p-4 text-left">
        <h2 id="details-hub-question" className="text-lg font-extrabold leading-tight text-midnight-900">
          {screen.question(name)}
        </h2>
        <div className="mt-4">
          {openId === 'reward' ? (
            <RewardStep name={name} value={reward} onChange={(patch) => setReward((r) => ({ ...r, ...patch }))} />
          ) : (
            <DetailScreen
              id={openId}
              species={species}
              name={name}
              details={merged}
              onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
              breed={draftBreed}
              onBreedChange={openId === 'facts' ? setDraftBreed : undefined}
            />
          )}
        </div>
        {error && (
          <p role="alert" className="mt-3 text-[15px] font-semibold text-red-600">
            {error}
          </p>
        )}
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={busy || !canSave}
            className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-midnight-900 px-4 text-[16px] font-bold text-white disabled:opacity-60"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            Save
          </button>
          <button
            type="button"
            onClick={() => setOpenId(null)}
            disabled={busy}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border-2 border-midnight-200 px-4 text-[16px] font-semibold text-midnight-700"
          >
            Cancel
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-2">
      <DetailsChecklist details={details} breed={breed} species={species} name={name} onOpen={open} title={title} intro={intro} limit={limit} />
      {saved && (
        <p className="text-left text-[15px] text-midnight-600" role="status">
          Saved. The flyers and share images update in about a minute.
        </p>
      )}
    </div>
  );
}
