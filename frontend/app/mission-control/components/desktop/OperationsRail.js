'use client';

/**
 * OperationsRail - the coordinator's right hand (command instrument)
 *
 * Four worktabs: Log (document everything), Tasks (assign the work),
 * Chat (talk), Shelters (call). The Log is the mission's paper trail:
 * sightings, search legs, and coordinator notes in one stream.
 */

import { useState, useEffect, useCallback } from 'react';
import { FileText, ListChecks, MessageCircle, Building2, Loader2 } from 'lucide-react';
import ActivityLog, { buildActivityItems } from '../regions/ActivityLog';
import TaskBoard from '../regions/TaskBoard';
import ChatModule from '../regions/ChatModule';
import ShelterList from '../regions/ShelterList';

const TABS = [
  { id: 'log', label: 'Log', icon: FileText },
  { id: 'tasks', label: 'Tasks', icon: ListChecks },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
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
}) {
  const [tab, setTab] = useState('log');
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
    <div className="absolute right-6 top-20 bottom-6 w-[340px] z-[600] flex flex-col rounded-2xl border-2 border-slate-700/70 bg-slate-900/85 backdrop-blur-xl shadow-2xl overflow-hidden">
      {/* Worktabs */}
      <div className="shrink-0 flex p-2 gap-1 border-b border-slate-800">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition ${
              tab === id
                ? 'bg-flash-400/15 text-flash-300 border border-flash-400/40'
                : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
            }`}
          >
            <Icon size={14} />
            {label}
            {id === 'chat' && unreadChat > 0 && tab !== 'chat' && (
              <span className="min-w-[16px] h-4 px-1 bg-flash-400 text-midnight-950 text-[10px] rounded-full flex items-center justify-center">
                {unreadChat}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5">
        {tab === 'log' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addNote(); }}
                placeholder="Add to the mission log..."
                className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-flash-400"
              />
              <button
                type="button"
                onClick={addNote}
                disabled={!noteDraft.trim() || savingNote}
                className="shrink-0 px-3 h-10 rounded-xl bg-flash-400 text-midnight-950 text-xs font-bold hover:bg-flash-300 transition disabled:opacity-50"
              >
                {savingNote ? <Loader2 size={14} className="animate-spin" /> : 'Log it'}
              </button>
            </div>
            <ActivityLog items={logItems} now={now} emptyText="The log starts with the first sighting, leg, or note." />
          </div>
        )}
        {tab === 'tasks' && <TaskBoard missionId={missionId} />}
        {tab === 'chat' && (
          <div className="h-full min-h-[360px] flex flex-col">
            <ChatModule {...chat} />
          </div>
        )}
        {tab === 'shelters' && <ShelterList pois={pois} missionId={missionId} isLoading={poisLoading} />}
      </div>
    </div>
  );
}
