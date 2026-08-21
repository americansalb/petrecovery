'use client';

/**
 * Volunteer Coordination Panel
 *
 * Real-time volunteer coordination for Mission Command Center:
 * - Shows active searchers with status (Ready, Searching, Paused)
 * - Check-in/check-out functionality
 * - Task assignment for coordinators
 * - Live location updates (when shared)
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/app/components/ui/Toast';

const STATUS_CONFIG = {
  READY: { label: 'Ready', color: 'bg-blue-500', icon: '🔵', pulse: false },
  ACTIVE: { label: 'Searching', color: 'bg-green-500', icon: '🟢', pulse: true },
  PAUSED: { label: 'Paused', color: 'bg-yellow-500', icon: '🟡', pulse: false },
  COMPLETED: { label: 'Done', color: 'bg-slate-500', icon: '⚫', pulse: false },
};

const TASK_TYPES = [
  { value: 'SEARCH_AREA', label: 'Search Area', icon: '🔍' },
  { value: 'POSTER_DISTRIBUTION', label: 'Post Flyers', icon: '📄' },
  { value: 'SHELTER_CHECK', label: 'Check Shelter', icon: '🏠' },
  { value: 'FOLLOWUP', label: 'Follow Up', icon: '📞' },
  { value: 'OTHER', label: 'Other', icon: '📋' },
];

const PRIORITY_CONFIG = {
  LOW: { label: 'Low', color: 'text-slate-400', bg: 'bg-slate-500/20' },
  MEDIUM: { label: 'Medium', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  HIGH: { label: 'High', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  URGENT: { label: 'Urgent', color: 'text-red-400', bg: 'bg-red-500/20', pulse: true },
};

export default function VolunteerPanel({
  missionData,
  assignmentId,
  currentUserId,
  userRole,
  onUpdate
}) {
  const toast = useToast();
  const [participants, setParticipants] = useState([]);
  const [mySession, setMySession] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('team'); // 'team', 'tasks'
  const [showNewTask, setShowNewTask] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const isCoordinator = userRole === 'OWNER' || userRole === 'ADMIN';
  const isParticipant = userRole === 'PARTICIPANT';

  // Fetch participants and their sessions
  const fetchParticipants = useCallback(async () => {
    if (!assignmentId) return;

    try {
      const res = await fetch(`/api/assignments/${assignmentId}/participants`);
      if (res.ok) {
        const data = await res.json();
        setParticipants(data.participants || []);

        // Find current user's session
        const myParticipation = data.participants?.find(p => p.userId === currentUserId);
        if (myParticipation?.searchSessions?.length > 0) {
          const activeSession = myParticipation.searchSessions.find(
            s => s.status !== 'COMPLETED'
          );
          setMySession(activeSession || null);
        }
      }
    } catch (err) {
      console.error('Error fetching participants:', err);
    } finally {
      setLoading(false);
    }
  }, [assignmentId, currentUserId]);

  // Fetch tasks for this case
  const fetchTasks = useCallback(async () => {
    if (!missionData?.id) return;

    try {
      const res = await fetch(`/api/missions/${missionData.id}/tasks`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  }, [missionData?.id]);

  useEffect(() => {
    fetchParticipants();
    fetchTasks();

    // Poll for updates every 15 seconds
    const interval = setInterval(() => {
      fetchParticipants();
      fetchTasks();
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchParticipants, fetchTasks]);

  // Check-in (start searching)
  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });

      if (res.ok) {
        const data = await res.json();
        setMySession(data.session);
        fetchParticipants();
        onUpdate?.();
      }
    } catch (err) {
      console.error('Error checking in:', err);
      toast.error('Failed to check in. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Pause/Resume session
  const handleTogglePause = async () => {
    if (!mySession) return;

    setActionLoading(true);
    try {
      const action = mySession.status === 'PAUSED' ? 'resume' : 'pause';
      const res = await fetch(`/api/assignments/${assignmentId}/sessions/${mySession.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        const data = await res.json();
        setMySession(data.session);
        fetchParticipants();
      }
    } catch (err) {
      console.error('Error toggling pause:', err);
      toast.error('Failed to update session status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Check-out (end searching)
  const handleCheckOut = async () => {
    if (!mySession) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/sessions/${mySession.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end' }),
      });

      if (res.ok) {
        setMySession(null);
        fetchParticipants();
        onUpdate?.();
      }
    } catch (err) {
      console.error('Error checking out:', err);
      toast.error('Failed to check out. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Calculate session duration
  const getSessionDuration = (session) => {
    if (!session?.startedAt) return null;
    const start = new Date(session.startedAt);
    const end = session.endedAt ? new Date(session.endedAt) : new Date();
    const mins = Math.floor((end - start) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  // Get active searcher count
  const activeSearchers = participants.filter(p =>
    p.searchSessions?.some(s => s.status === 'ACTIVE')
  ).length;

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header with tabs */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('team')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                activeTab === 'team'
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Team ({participants.length})
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                activeTab === 'tasks'
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tasks ({tasks.filter(t => t.status !== 'COMPLETED').length})
            </button>
          </div>
        </div>

        {/* Active searchers badge */}
        {activeSearchers > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-green-400">
              {activeSearchers} searching
            </span>
          </div>
        )}
      </div>

      {/* My Status Bar (for participants) */}
      {isParticipant && (
        <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">Your Status:</span>
              {mySession ? (
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${STATUS_CONFIG[mySession.status]?.color} ${STATUS_CONFIG[mySession.status]?.pulse ? 'animate-pulse' : ''}`} />
                  <span className="text-sm font-medium text-white">
                    {STATUS_CONFIG[mySession.status]?.label}
                  </span>
                  {mySession.startedAt && (
                    <span className="text-xs text-slate-500">
                      ({getSessionDuration(mySession)})
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-sm text-slate-500">Not checked in</span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {!mySession ? (
                <button
                  onClick={handleCheckIn}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-400 transition disabled:opacity-50"
                >
                  {actionLoading ? '...' : '✓ Check In'}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleTogglePause}
                    disabled={actionLoading}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                      mySession.status === 'PAUSED'
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                    }`}
                  >
                    {mySession.status === 'PAUSED' ? '▶ Resume' : '⏸ Pause'}
                  </button>
                  <button
                    onClick={handleCheckOut}
                    disabled={actionLoading}
                    className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition disabled:opacity-50"
                  >
                    ✕ Check Out
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          </div>
        ) : activeTab === 'team' ? (
          <TeamList
            participants={participants}
            currentUserId={currentUserId}
            isCoordinator={isCoordinator}
            getSessionDuration={getSessionDuration}
          />
        ) : (
          <TaskList
            tasks={tasks}
            missionData={missionData}
            currentUserId={currentUserId}
            isCoordinator={isCoordinator}
            showNewTask={showNewTask}
            setShowNewTask={setShowNewTask}
            onTaskUpdate={fetchTasks}
          />
        )}
      </div>

      {/* Add Task Button (for coordinators) */}
      {isCoordinator && activeTab === 'tasks' && !showNewTask && (
        <div className="p-4 border-t border-slate-700/50">
          <button
            onClick={() => setShowNewTask(true)}
            className="w-full py-3 bg-cyan-500/20 text-cyan-400 rounded-xl font-medium hover:bg-cyan-500/30 transition"
          >
            + Assign New Task
          </button>
        </div>
      )}
    </div>
  );
}

// Team List Component
function TeamList({ participants, currentUserId, isCoordinator, getSessionDuration }) {
  if (participants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <span className="text-4xl mb-3">👥</span>
        <p className="text-slate-400 font-medium">No volunteers yet</p>
        <p className="text-sm text-slate-500">Be the first to join the search!</p>
      </div>
    );
  }

  // Sort: active searchers first, then by opt-in time
  const sortedParticipants = [...participants].sort((a, b) => {
    const aActive = a.searchSessions?.some(s => s.status === 'ACTIVE');
    const bActive = b.searchSessions?.some(s => s.status === 'ACTIVE');
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return new Date(a.optedInAt) - new Date(b.optedInAt);
  });

  return (
    <div className="divide-y divide-slate-700/50">
      {sortedParticipants.map((participant) => {
        const currentSession = participant.searchSessions?.find(s => s.status !== 'COMPLETED');
        const isMe = participant.userId === currentUserId;
        const statusConfig = currentSession ? STATUS_CONFIG[currentSession.status] : null;

        return (
          <div
            key={participant.id}
            className={`px-4 py-3 flex items-center gap-3 ${isMe ? 'bg-cyan-500/5' : ''}`}
          >
            {/* Avatar with status indicator */}
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-lg font-bold text-white">
                {participant.user?.firstName?.[0] || '?'}
              </div>
              {statusConfig && (
                <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-slate-900 ${statusConfig.color} ${statusConfig.pulse ? 'animate-pulse' : ''}`} />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white truncate">
                  {participant.user?.firstName} {participant.user?.lastName?.[0]}.
                </span>
                {isMe && (
                  <span className="text-xs bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded">
                    You
                  </span>
                )}
                {participant.user?.rescueLevel && (
                  <span className="text-xs text-slate-500">
                    {participant.user.rescueLevel}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                {currentSession ? (
                  <>
                    <span>{statusConfig?.label}</span>
                    {currentSession.startedAt && (
                      <span>• {getSessionDuration(currentSession)}</span>
                    )}
                  </>
                ) : (
                  <span>Joined {new Date(participant.optedInAt).toLocaleDateString()}</span>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="text-right text-xs">
              <div className="text-slate-400">
                {participant.areasMarked > 0 && (
                  <span title="Areas searched">{participant.areasMarked} areas</span>
                )}
              </div>
              <div className="text-slate-500">
                {participant.searchHours > 0 && (
                  <span>{participant.searchHours.toFixed(1)}h total</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Task List Component
function TaskList({ tasks, missionData, currentUserId, isCoordinator, showNewTask, setShowNewTask, onTaskUpdate }) {
  const toast = useToast();
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    type: 'SEARCH_AREA',
    priority: 'MEDIUM',
    assigneeId: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Group tasks by status
  const openTasks = tasks.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS');
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED');

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/missions/${missionData.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });

      if (res.ok) {
        setNewTask({ title: '', description: '', type: 'SEARCH_AREA', priority: 'MEDIUM', assigneeId: '' });
        setShowNewTask(false);
        onTaskUpdate();
      }
    } catch (err) {
      console.error('Error creating task:', err);
      toast.error('Failed to create task.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTaskAction = async (taskId, action) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        onTaskUpdate();
      }
    } catch (err) {
      console.error('Error updating task:', err);
      toast.error('Failed to update task.');
    }
  };

  if (tasks.length === 0 && !showNewTask) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <span className="text-4xl mb-3">📋</span>
        <p className="text-slate-400 font-medium">No tasks assigned</p>
        {isCoordinator && (
          <p className="text-sm text-slate-500">Create tasks to coordinate the search</p>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* New Task Form */}
      {showNewTask && (
        <form method="post" onSubmit={handleCreateTask} className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
          <div>
            <input
              type="text"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="Task title..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={newTask.type}
              onChange={(e) => setNewTask({ ...newTask, type: e.target.value })}
              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            >
              {TASK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
              ))}
            </select>
            <select
              value={newTask.priority}
              onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            >
              {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>

          <textarea
            value={newTask.description}
            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            placeholder="Description (optional)"
            rows={2}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewTask(false)}
              className="px-4 py-2 text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newTask.title.trim() || submitting}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-400 transition disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      )}

      {/* Open Tasks */}
      {openTasks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
            Active Tasks
          </h4>
          {openTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              currentUserId={currentUserId}
              isCoordinator={isCoordinator}
              onAction={handleTaskAction}
            />
          ))}
        </div>
      )}

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div className="space-y-2 mt-6">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
            Completed ({completedTasks.length})
          </h4>
          {completedTasks.slice(0, 3).map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              currentUserId={currentUserId}
              isCoordinator={isCoordinator}
              onAction={handleTaskAction}
              isCompleted
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Task Card Component
function TaskCard({ task, currentUserId, isCoordinator, onAction, isCompleted }) {
  const typeConfig = TASK_TYPES.find(t => t.value === task.type) || TASK_TYPES[4];
  const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM;
  const isAssignedToMe = task.assigneeId === currentUserId;

  return (
    <div className={`
      rounded-xl p-3 border transition
      ${isCompleted
        ? 'bg-slate-800/30 border-slate-700/30 opacity-60'
        : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'}
      ${isAssignedToMe && !isCompleted ? 'ring-1 ring-cyan-500/30' : ''}
    `}>
      <div className="flex items-start gap-3">
        <span className="text-xl">{typeConfig.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-medium ${isCompleted ? 'text-slate-500 line-through' : 'text-white'}`}>
              {task.title}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${priorityConfig.bg} ${priorityConfig.color} ${priorityConfig.pulse ? 'animate-pulse' : ''}`}>
              {priorityConfig.label}
            </span>
          </div>
          {task.description && (
            <p className="text-xs text-slate-500 mb-2 line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-slate-500">
            {task.assignee && (
              <span>Assigned: {task.assignee.firstName}</span>
            )}
            {task.status === 'IN_PROGRESS' && (
              <span className="text-cyan-400">In Progress</span>
            )}
          </div>
        </div>

        {/* Actions */}
        {!isCompleted && (
          <div className="flex items-center gap-1">
            {isAssignedToMe && task.status === 'OPEN' && (
              <button
                onClick={() => onAction(task.id, 'start')}
                className="p-1.5 text-cyan-400 hover:bg-cyan-500/20 rounded-lg transition"
                title="Start task"
              >
                ▶
              </button>
            )}
            {isAssignedToMe && task.status === 'IN_PROGRESS' && (
              <button
                onClick={() => onAction(task.id, 'complete')}
                className="p-1.5 text-green-400 hover:bg-green-500/20 rounded-lg transition"
                title="Complete task"
              >
                ✓
              </button>
            )}
            {isCoordinator && (
              <button
                onClick={() => onAction(task.id, 'cancel')}
                className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition"
                title="Cancel task"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
