'use client';

import { Sparkles, Flame, MessageCircle, Map, ShieldCheck, MapPin } from 'lucide-react';
import { useSquadHub } from './context/SquadHubContext';

function StatPill({ icon: Icon, label, value, accent }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium border border-[var(--hub-border)] bg-[var(--hub-bg-card)]/60 shadow-sm ${accent}`}
    >
      <Icon size={14} />
      <span className="uppercase tracking-[0.08em] text-[10px] text-[var(--hub-text-muted)]">{label}</span>
      <span className="text-sm text-[var(--hub-text-primary)] font-semibold">{value}</span>
    </div>
  );
}

export default function SquadHero() {
  const {
    squad,
    membership,
    cases = [],
    divisions = [],
    selectedDivisionId,
    setMainTab,
    setCaseTab,
    openCommunityView,
  } = useSquadHub();

  const divisionCases = selectedDivisionId === 'ALL'
    ? cases
    : cases.filter(c => c.divisionId === selectedDivisionId);

  const incomingCount = divisionCases.filter(c =>
    !c.isUserHelper &&
    c.status !== 'REUNITED' &&
    c.status !== 'CLOSED_OTHER'
  ).length;

  const activeCount = divisionCases.filter(c =>
    c.status !== 'REUNITED' &&
    c.status !== 'CLOSED_OTHER'
  ).length;

  const urgentCount = divisionCases.filter(c =>
    c.urgency === 'HIGH' &&
    c.status !== 'REUNITED' &&
    c.status !== 'CLOSED_OTHER'
  ).length;

  const reunitedCount = divisionCases.filter(c => c.status === 'REUNITED').length;
  const activeDivisions = divisions.filter(d => d.activeCaseCount > 0).length;

  const divisionLabel = selectedDivisionId === 'ALL'
    ? 'All divisions'
    : divisions.find(d => d.id === selectedDivisionId)?.name || 'Division';

  const divisionLabelDisplay = divisionLabel?.toLowerCase?.() || 'division';

  return (
    <section className="relative overflow-hidden px-4 pt-4 pb-5 bg-[var(--hub-bg-root)]">
      <div className="relative z-10 rounded-2xl border border-[var(--hub-border)] bg-gradient-to-r from-cyan-500/10 via-[var(--hub-bg-panel)] to-violet-500/10 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-4 p-4 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[var(--hub-text-muted)] font-semibold">
                <Sparkles size={14} className="text-[var(--hub-accent-primary)]" />
                <span>Squad hub</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white drop-shadow-sm">
                {squad?.cityName || 'Your city'} Rescue Squad
              </h2>
              <p className="text-sm text-[var(--hub-text-secondary)]" aria-live="polite">
                Live view of {divisionLabelDisplay} • {activeDivisions} division{activeDivisions === 1 ? '' : 's'} active
              </p>
            </div>

            <div className="hidden md:flex flex-col items-end gap-2">
              <div className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                membership?.isOnDuty
                  ? 'hub-on-duty-active text-[var(--hub-accent-primary)]'
                  : 'border-[var(--hub-border)] text-[var(--hub-text-secondary)]'
              }`}>
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck size={14} />
                  {membership?.isOnDuty ? 'You are on duty' : 'Off duty'}
                </span>
              </div>
              <p className="text-[11px] text-[var(--hub-text-muted)] max-w-[200px] text-right">
                Keep your status current so coordinators know who is ready to respond.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatPill
              icon={Flame}
              label="Urgent"
              value={`${urgentCount} case${urgentCount === 1 ? '' : 's'}`}
              accent="text-[var(--hub-status-high)] border-[var(--hub-status-high)]/30 bg-[var(--hub-status-high)]/10"
            />
            <StatPill
              icon={Map}
              label="Active Searches"
              value={`${activeCount} in view`}
              accent="text-[var(--hub-accent-primary)] border-[var(--hub-accent-primary)]/30 bg-[var(--hub-accent-primary)]/10"
            />
            <StatPill
              icon={Sparkles}
              label="Incoming"
              value={`${incomingCount} need help`}
              accent="text-[var(--hub-accent-secondary)] border-[var(--hub-accent-secondary)]/30 bg-[var(--hub-accent-secondary)]/10"
            />
            <StatPill
              icon={MapPin}
              label="Reunited"
              value={`${reunitedCount} nearby`}
              accent="text-[var(--hub-status-success)] border-[var(--hub-status-success)]/30 bg-[var(--hub-status-success)]/10"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-[var(--hub-text-secondary)] text-xs">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--hub-bg-card)]/70 border border-[var(--hub-border)]">
                <span className="w-2 h-2 rounded-full bg-[var(--hub-status-high)] animate-pulse" />
                <span>High urgency glows brighter on map pins</span>
              </div>
              <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--hub-bg-card)]/70 border border-[var(--hub-border)]">
                <span className="w-2 h-2 rounded-full bg-[var(--hub-accent-primary)]" />
                <span>City + division filters apply everywhere</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setMainTab('OPERATIONS');
                  setCaseTab('ACTIVE');
                }}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--hub-accent-primary)] text-[var(--hub-bg-root)] shadow-[0_10px_30px_rgba(34,211,238,0.35)] hover:shadow-[0_12px_36px_rgba(34,211,238,0.45)] transition-all"
              >
                Open map focus
              </button>
              <button
                onClick={openCommunityView}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-[var(--hub-border)] text-[var(--hub-text-primary)] bg-[var(--hub-bg-card)]/70 hover:border-[var(--hub-accent-primary)]/40 transition-all flex items-center gap-2"
              >
                <MessageCircle size={16} className="text-[var(--hub-accent-primary)]" />
                Squad chat
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
