'use client';

/**
 * OperationsRail - the coordinator's right hand (command instrument)
 *
 * Four worktabs as a real segmented control: Activity (the paper
 * trail + Add note), Chat, Tasks, Shelters. Controlled from outside
 * so the mission panel's checklist can jump straight to a tab
 * ("Call nearby shelters" → Shelters).
 */

import { useState, useEffect, useCallback } from 'react';
import { FileText, ListChecks, MessageCircle, Building2, Loader2, Plus } from 'lucide-react';
import ActivityLog, { buildActivityItems } from '../regions/ActivityLog';
import TaskBoard from '../regions/TaskBoard';
import ChatModule from '../regions/ChatModule';
import ShelterList from '../regions/ShelterList';

const TABS = [
  { id: 'activity', label: 'Activity', icon: FileText },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'tasks', label: 'Tasks', icon: ListChecks },
  { id: 'shelters', label: 'Shelters', icon: Building2 },
];

export default function OperationsRail({
  missionId,
  sightings,
  completedLegs,
  now,
  chat,
  pois,
  poisLoading,
  unreadChat = 0,
  activeTab,
  onTabChange,
  readOnly = false,
}) {
  const [tab, setTab] = useState(activeTab || 'activity');
  useEffect(() => {
    if (activeTab) setTab(activeTab);
  }, [activeTab]);
  const selectTab = (id) => {
    setTab(id);
    onTabChange?.(id);
  };

  const [notes, setNotes] = useState([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const loadNotes = useCallback(async () => {
    if (!missionId) return;
    try {
      const res = await fetch(`/api/missions/${missionId}/notes`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.updates || []);
      }
    } catch (e) {}
  }, [missionId]);

  useEffect(() => {
    loadNotes();
    const t = setInterval(loadNotes, 60000);
    return () => clearInterval(t);
  }, [loadNotes]);

  const addNote = async () => {
    const content = noteDraft.trim();
    if (!content || savingNote) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/missions/${missionId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setNoteDraft('');
        await loadNotes();
      }
    } catch (e) {
    } finally {
      setSavingNote(false);
    }
  };

  const logItems = buildActivityItems({ sightings, completedLegs, notes });

  return (
    <div className="absolute right-6 top-4 bottom-6 w-[340px] z-[600] flex flex-col rounded-2xl border border-white/10 bg-slate-950/85 backdrop-blur-xl shadow-2xl overflow-hidden">
      {/* Segmented worktabs */}
      <div className="shrink-0 p-2 border-b border-white/10">
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04]">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectTab(id)}
                aria-pressed={active}
                className={`relative flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-300 ${
                  active ? 'bg-flash-400 text-midnight-950 shadow' : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <Icon size={15} aria-hidden />
                {label}
                {id === 'chat' && unreadChat > 0 && !active && (
                  <span className="absolute top-1 right-2 min-w-[15px] h-[15px] px-0.5 bg-flash-400 text-midnight-950 text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadChat}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.35)_transparent]">
        {tab === 'activity' && (
          <div className="space-y-3">
            {!readOnly && (
              <div className="flex gap-2">
                <input
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addNote(); }}
                  placeholder="Add a note for the team..."
                  className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-white/[0.05] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-flash-400/70"
                />
                <button
                  type="button"
                  onClick={addNote}
                  disabled={!noteDraft.trim() || savingNote}
                  aria-label="Add note"
                  className="shrink-0 w-10 h-10 rounded-xl bg-flash-400 text-midnight-950 flex items-center justify-center hover:bg-flash-300 transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-300"
                >
                  {savingNote ? <Loader2 size={15} className="animate-spin" /> : <Plus size={17} />}
                </button>
              </div>
            )}
            <ActivityLog items={logItems} now={now} emptyText="The log starts with the first sighting, walk, or note." />
          </div>
        )}
        {tab === 'chat' && (
          <div className="h-full min-h-[360px] flex flex-col">
            <ChatModule {...chat} />
          </div>
        )}
        {tab === 'tasks' && <TaskBoard missionId={missionId} canCreate={!readOnly} />}
        {tab === 'shelters' && <ShelterList pois={pois} missionId={missionId} isLoading={poisLoading} />}
      </div>
    </div>
  );
}
