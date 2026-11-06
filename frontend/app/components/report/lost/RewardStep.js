'use client';

/**
 * RewardStep - "Offering a reward?" No reward advances at once. Yes opens
 * the amount (preset chips, another amount, or no printed amount) and the
 * note about reward scams, which the owner has to tick before going on:
 * nobody pays before the pet is back in their hands.
 */

import { REWARD_AMOUNTS, scamAcknowledgement } from '@/app/lib/caseDetails';
import Chips from '../Chips';
import { WIZARD_THEMES } from '../wizardTheme';

const money = (n) => `$${Number(n).toLocaleString('en-US')}`;

/** True when the reward answer is complete enough to continue. */
export function rewardIsValid({ hasReward, rewardMode, rewardAmount, scamAck }) {
  if (hasReward === false) return true;
  if (hasReward !== true) return false;
  if (!scamAck) return false;
  if (rewardMode === 'unstated') return true;
  return Number.isFinite(Number(rewardAmount)) && Number(rewardAmount) > 0;
}

export default function RewardStep({ variant = 'lost', name, value, onChange, onNo }) {
  const theme = WIZARD_THEMES[variant];
  const { hasReward, rewardMode, rewardAmount, scamAck } = value;
  const amountChips = [
    ...REWARD_AMOUNTS.map((n) => ({ value: String(n), label: money(n) })),
    { value: 'custom', label: 'Another amount' },
    { value: 'unstated', label: "Don't print an amount" },
  ];
  const chipValue = rewardMode === 'custom' ? 'custom' : rewardMode === 'unstated' ? 'unstated' : rewardAmount ? String(rewardAmount) : null;

  const pickAmount = (v) => {
    if (v === null) {
      onChange({ rewardMode: null, rewardAmount: null });
    } else if (v === 'custom') {
      onChange({ rewardMode: 'custom', rewardAmount: null });
    } else if (v === 'unstated') {
      onChange({ rewardMode: 'unstated', rewardAmount: null });
    } else {
      onChange({ rewardMode: 'preset', rewardAmount: Number(v) });
    }
  };

  const card = (on) =>
    `w-full rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.985] ${
      on ? theme.selectedCard : 'border-midnight-100 bg-white hover:border-midnight-300'
    }`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          aria-pressed={hasReward === false}
          className={card(hasReward === false)}
          onClick={() => {
            onChange({ hasReward: false });
            onNo?.();
          }}
        >
          <span className="block font-bold text-midnight-900">No reward</span>
          <span className="mt-1 block text-xs text-midnight-400">Most reunions happen without one</span>
        </button>
        <button type="button" aria-pressed={hasReward === true} className={card(hasReward === true)} onClick={() => onChange({ hasReward: true })}>
          <span className="block font-bold text-midnight-900">Yes, a reward</span>
          <span className="mt-1 block text-xs text-midnight-400">Goes on the flyer as a tag</span>
        </button>
      </div>

      {hasReward === true && (
        <>
          <div>
            <p className="mb-2.5 text-sm font-semibold text-midnight-700">How much?</p>
            <Chips variant={variant} options={amountChips} value={chipValue} onChange={pickAmount} ariaLabel="Reward amount" />
            {rewardMode === 'custom' && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-lg font-bold text-midnight-500">$</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={rewardAmount || ''}
                  onChange={(e) => onChange({ rewardAmount: e.target.value ? Number(e.target.value) : null })}
                  placeholder="Amount"
                  className={`w-40 rounded-2xl border-2 border-midnight-100 bg-white px-4 py-3 text-[16px] outline-none ${theme.focusRing}`}
                  autoFocus
                />
              </div>
            )}
          </div>

          <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 ${scamAck ? 'border-midnight-900 bg-midnight-50' : 'border-midnight-200 bg-white'}`}>
            <input
              type="checkbox"
              checked={Boolean(scamAck)}
              onChange={(e) => onChange({ scamAck: e.target.checked })}
              className="mt-1 h-5 w-5 shrink-0 accent-midnight-900"
            />
            <span className="text-sm leading-relaxed text-midnight-800">
              <span className="block font-bold text-midnight-900">Read this before you offer money</span>
              {scamAcknowledgement(name)}
            </span>
          </label>
        </>
      )}
    </div>
  );
}
