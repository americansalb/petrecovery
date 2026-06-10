'use client';

/**
 * TaskBoard - the coordinator's checklist, finally real
 *
 * Wired to the SquadTask API (tasks used to live in localStorage and
 * evaporate). Tasks belong to the force working the case, so the board
 * explains itself when no force has taken the case yet.
 */

import { useState, useEffect, useCallback } from 'react';
import { Check, Plus, Loader2, Shield } from 'lucide-react';

const PRIORITY_DOT = {
  URGENT: 'bg-red-400',
  HIGH: 'bg-flash-400',
  MEDIUM: 'bg-sky-400',
  LOW: 'bg-slate-500',
};

export default function TaskBoard({ missionId, canCreate = true }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!missionId) return;
    try {
      const res = await fetch(`/api/missions/${missionId}/tasks`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
        setError(null);
      }
    } catch (e) {
      // polling will retry
    } finally {
      setLoading(false);
    }
  }, [missionId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const create = async () => {
    const trimmed = title.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/missions/${missionId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
      if (res.ok) {
        setTitle('');
        await load();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Could not create the task');
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setCreating(false);
    }
  };

  const complete = async (task) => {
    if (busyId) return;
    setBusyId(task.id);
    try {
      const res = await fetch(`/api/mission/${missionId}/tasks/${task.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      });
      if (res.ok) await load();
    } catch (e) {
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 size={18} className="animate-spin text-slate-500" />
      </div>
    );
  }

  const open = tasks.filter((t) => t.status !== 'COMPLETED');
  const done = tasks.filter((t) => t.status === 'COMPLETED');

  return (
    <div className="space-y-3">
      {canCreate && (
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
            placeholder="Add a task: flyer Clark St, call the shelter..."
            className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-flash-400"
          />
          <button
            type="button"
            onClick={create}
            disabled={!title.trim() || creating}
            aria-label="Add task"
            className="shrink-0 w-10 h-10 rounded-xl bg-flash-400 text-midnight-950 flex items-center justify-center hover:bg-flash-300 transition disabled:opacity-50"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={18} />}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {tasks.length === 0 ? (
        <div className="text-center py-5">
          <Shield size={20} className="text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            Tasks unlock when a rescue force takes the case.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {[...open, ...done].map((task) => {
            const completed = task.status === 'COMPLETED';
            return (
              <li
                key={task.id}
                className={`flex items-center gap-3 rounded-2xl border-2 p-3 ${completed ? 'border-slate-800 bg-slate-900/50 opacity-70' : 'border-slate-800 bg-slate-900'}`}
              >
                <button
                  type="button"
                  onClick={() => !completed && complete(task)}
                  disabled={completed || busyId === task.id}
                  aria-label={completed ? 'Completed' : `Complete ${task.title}`}
                  className={`shrink-0 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition ${completed ? 'bg-emerald-500 border-emerald-500 text-midnight-950' : 'border-slate-600 text-transparent hover:border-emerald-400'}`}
                >
                  {busyId === task.id ? <Loader2 size={13} className="animate-spin text-slate-400" /> : <Check size={15} strokeWidth={3} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${completed ? 'text-slate-500 line-through' : 'text-white'}`}>
                    {task.title}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {completed && task.completedBy?.firstName
                      ? `Done by ${task.completedBy.firstName}`
                      : task.assignedTo?.firstName
                        ? `With ${task.assignedTo.firstName}`
                        : task.createdBy?.firstName
                          ? `By ${task.createdBy.firstName}`
                          : ''}
                  </p>
                </div>
                {!completed && (
                  <span className={`shrink-0 w-2 h-2 rounded-full ${PRIORITY_DOT[task.priority] || PRIORITY_DOT.MEDIUM}`} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
