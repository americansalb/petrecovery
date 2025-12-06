'use client';

/**
 * ActionsTab - Smart SAR Task Management
 *
 * Uses priority algorithm to show most important tasks first.
 *
 * Layout:
 * - DO FIRST: Top 3 priority tasks regardless of role (with role badges)
 * - Your Tasks: Remaining owner-only tasks
 * - Squad Can Help: Tasks anyone can do
 * - Completed: Done tasks at the bottom
 *
 * Integrates with debug panel for algorithm testing.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Phone,
  Search,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Check,
  Clock,
  AlertTriangle,
  Users,
  User,
  HelpCircle,
  Play,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { DebugProvider, useDebug } from '@/app/lib/missionControl/debugContext';
import DebugPanel from '../DebugPanel';
import {
  ACTION_TYPES,
  calculatePriorityScoreWithBreakdown,
  generateTasksForCase,
  filterTasksByRole,
  generateWhyExplanation,
  generateCallScript,
} from '@/app/lib/missionControl/taskPriority';

// Status icons and colors
const STATUS_CONFIG = {
  AVAILABLE: { icon: null, color: 'slate', label: 'Available' },
  IN_PROGRESS: { icon: Play, color: 'yellow', label: 'In Progress' },
  NEEDS_HELP: { icon: HelpCircle, color: 'orange', label: 'Needs Help' },
  COMPLETED: { icon: Check, color: 'emerald', label: 'Done' },
  BLOCKED: { icon: AlertTriangle, color: 'red', label: 'Blocked' },
};

export default function TeamTab({ mission, showNotification, session }) {
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN';
  const isOwner = mission?.reporterId === session?.user?.id;

  return (
    <DebugProvider isAdmin={isAdmin}>
      <ActionsContent
        mission={mission}
        showNotification={showNotification}
        session={session}
        isOwner={isOwner}
        isAdmin={isAdmin}
      />
    </DebugProvider>
  );
}

function ActionsContent({ mission, showNotification, session, isOwner, isAdmin }) {
  const debug = useDebug();
  const [selectedTask, setSelectedTask] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [scoreBreakdown, setScoreBreakdown] = useState(null);

  // Build case data for algorithm
  const caseData = useMemo(() => {
    const realData = {
      petType: mission?.petSpecies || 'CAT',
      petName: mission?.petName,
      petBreed: mission?.petBreed,
      petColor: mission?.petColor,
      missingAt: mission?.createdAt || new Date(),
      lastSeenLatitude: mission?.lastSeenLatitude,
      lastSeenLongitude: mission?.lastSeenLongitude,
      lastSeenAddress: mission?.lastSeenAddress,
      lastSeenCity: mission?.lastSeenCity,
      isMicrochipped: mission?.isMicrochipped || false,
      temperament: mission?.temperament || 'FRIENDLY',
    };

    return debug.getEffectiveCaseData(realData);
  }, [mission, debug]);

  // Build context for algorithm
  const context = useMemo(() => {
    const realContext = {
      currentTime: new Date(),
      userLocation: null, // Would come from geolocation
    };

    return debug.getEffectiveContext(realContext);
  }, [debug]);

  // Get effective role
  const effectiveRole = debug.getEffectiveRole(isOwner ? 'OWNER' : 'SQUAD');

  // Generate and prioritize tasks
  useEffect(() => {
    // Generate mock tasks from action types
    const generatedTasks = Object.entries(ACTION_TYPES).map(([actionId, actionDef]) => ({
      id: actionId,
      actionId,
      title: actionDef.title,
      description: actionDef.description,
      role: actionDef.role,
      petType: actionDef.petType,
      phase: actionDef.phase,
      status: 'AVAILABLE',
      latitude: caseData.lastSeenLatitude,
      longitude: caseData.lastSeenLongitude,
    }));

    // Calculate scores
    const scoredTasks = generatedTasks.map(task => {
      const { score, breakdown } = calculatePriorityScoreWithBreakdown(task, caseData, context);
      return { ...task, priorityScore: score, _breakdown: breakdown };
    });

    // Filter by pet type and sort
    const filteredTasks = scoredTasks
      .filter(t => {
        const actionDef = ACTION_TYPES[t.actionId];
        return actionDef.petType === 'BOTH' || actionDef.petType === caseData.petType;
      })
      .sort((a, b) => b.priorityScore - a.priorityScore);

    setTasks(filteredTasks);
  }, [caseData, context]);

  // Split tasks by role
  const { ownerTasks, squadTasks } = useMemo(() => {
    return filterTasksByRole(tasks, effectiveRole);
  }, [tasks, effectiveRole]);

  // Handle task selection
  const handleSelectTask = (task) => {
    setSelectedTask(task);
    if (debug.isEnabled && task._breakdown) {
      setScoreBreakdown(task._breakdown);
    }
  };

  // Handle task action
  const handleTaskAction = async (task, action) => {
    switch (action) {
      case 'start':
        setTasks(prev => prev.map(t =>
          t.id === task.id ? { ...t, status: 'IN_PROGRESS' } : t
        ));
        showNotification?.('success', 'Started! Others can see you\'re on it.');
        break;

      case 'complete':
        setTasks(prev => prev.map(t =>
          t.id === task.id ? { ...t, status: 'COMPLETED', completedAt: new Date() } : t
        ));
        showNotification?.('success', 'Marked as done!');
        setSelectedTask(null);
        break;

      case 'need_help':
        setTasks(prev => prev.map(t =>
          t.id === task.id ? { ...t, needsHelp: true, status: 'NEEDS_HELP' } : t
        ));
        showNotification?.('info', 'Help request sent to team!');
        break;

      case 'call':
        // Would open phone dialer
        showNotification?.('info', 'Opening dialer...');
        break;

      case 'copy_script':
        const script = generateCallScript(task, caseData);
        if (script) {
          await navigator.clipboard?.writeText(script);
          showNotification?.('success', 'Script copied!');
        }
        break;
    }
  };

  // Full-screen task detail view
  if (selectedTask) {
    return (
      <TaskDetailView
        task={selectedTask}
        caseData={caseData}
        context={context}
        onBack={() => setSelectedTask(null)}
        onAction={handleTaskAction}
        showNotification={showNotification}
        debug={debug}
      />
    );
  }

  // Calculate hours missing for display
  const hoursMissing = caseData.missingAt
    ? (new Date() - new Date(caseData.missingAt)) / (1000 * 60 * 60)
    : 0;

  // Get top 3 priority tasks (regardless of role) for "DO FIRST" section
  const doFirstTasks = useMemo(() => {
    return tasks
      .filter(t => t.status === 'AVAILABLE' || t.status === 'NEEDS_HELP')
      .slice(0, 3);
  }, [tasks]);

  // Get remaining owner-only tasks (not in DO FIRST)
  const remainingOwnerTasks = useMemo(() => {
    const doFirstIds = new Set(doFirstTasks.map(t => t.id));
    return tasks.filter(t =>
      t.role === 'OWNER' &&
      !doFirstIds.has(t.id) &&
      t.status !== 'COMPLETED'
    );
  }, [tasks, doFirstTasks]);

  // Get remaining squad/shared tasks (not in DO FIRST, not OWNER-only)
  const remainingSquadTasks = useMemo(() => {
    const doFirstIds = new Set(doFirstTasks.map(t => t.id));
    return tasks.filter(t =>
      (t.role === 'BOTH' || t.role === 'SQUAD') &&
      !doFirstIds.has(t.id) &&
      t.status !== 'COMPLETED'
    );
  }, [tasks, doFirstTasks]);

  // Completed tasks
  const completedTasks = useMemo(() => {
    return tasks.filter(t => t.status === 'COMPLETED');
  }, [tasks]);

  return (
    <div className="space-y-6 pb-20">
      {/* Debug indicator */}
      {debug.isEnabled && (
        <div className="p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-xl">
          <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium">
            <AlertTriangle size={16} />
            Debug Mode Active
          </div>
          <div className="text-yellow-300/70 text-xs mt-1">
            Simulating: {caseData.petType} missing {hoursMissing.toFixed(1)}h,
            role: {effectiveRole}, time: {context.currentTime?.getHours()}:00
          </div>
        </div>
      )}

      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Actions</h2>
          <p className="text-sm text-slate-400">
            Sorted by priority for {caseData.petType?.toLowerCase() || 'pet'}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">
            {completedTasks.length}/{tasks.length}
          </div>
          <div className="text-xs text-slate-400">completed</div>
        </div>
      </div>

      {/* DO FIRST - Top 3 Priority Tasks */}
      {doFirstTasks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded bg-red-500/20">
              <AlertTriangle size={14} className="text-red-400" />
            </div>
            <div>
              <h3 className="text-white font-bold">DO FIRST</h3>
              <p className="text-red-400/70 text-xs">Most important right now</p>
            </div>
          </div>

          <div className="space-y-2">
            {doFirstTasks.map((task, index) => (
              <TaskRow
                key={task.id}
                task={task}
                rank={index + 1}
                onSelect={() => handleSelectTask(task)}
                showScore={debug.isEnabled}
                isTopPriority={index === 0}
                showRoleBadge={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Remaining Owner Tasks */}
      {remainingOwnerTasks.length > 0 && (
        <TaskSection
          title="Your Tasks"
          subtitle={`${remainingOwnerTasks.length} remaining`}
          icon={<User size={16} />}
          tasks={remainingOwnerTasks}
          onSelect={handleSelectTask}
          showScore={debug.isEnabled}
          startRank={doFirstTasks.length + 1}
        />
      )}

      {/* Squad Can Help */}
      {remainingSquadTasks.length > 0 && (
        <TaskSection
          title="Squad Can Help"
          subtitle="Share these with your team"
          icon={<Users size={16} />}
          tasks={remainingSquadTasks}
          onSelect={handleSelectTask}
          showScore={debug.isEnabled}
          startRank={doFirstTasks.length + remainingOwnerTasks.length + 1}
        />
      )}

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-700/50">
          <div className="flex items-center gap-2 mb-3">
            <Check size={16} className="text-emerald-400" />
            <span className="text-slate-400 text-sm">{completedTasks.length} completed</span>
          </div>
          <div className="space-y-1">
            {completedTasks.slice(0, 3).map(task => (
              <div
                key={task.id}
                className="flex items-center gap-2 py-1.5 text-slate-500 text-sm"
              >
                <Check size={14} className="text-emerald-500" />
                <span className="line-through">{task.title}</span>
              </div>
            ))}
            {completedTasks.length > 3 && (
              <div className="text-slate-600 text-xs pl-6">
                +{completedTasks.length - 3} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Debug Panel */}
      <DebugPanel
        selectedTask={selectedTask}
        scoreBreakdown={scoreBreakdown}
      />
    </div>
  );
}

// Task section component
function TaskSection({ title, subtitle, icon, tasks, onSelect, showScore, startRank = 1 }) {
  const availableTasks = tasks.filter(t => t.status === 'AVAILABLE' || t.status === 'NEEDS_HELP');
  const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS');

  if (availableTasks.length === 0 && inProgressTasks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-slate-400">{icon}</span>
        <div>
          <h3 className="text-white font-semibold">{title}</h3>
          <p className="text-slate-500 text-xs">{subtitle}</p>
        </div>
      </div>

      <div className="space-y-2">
        {/* In progress first */}
        {inProgressTasks.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            onSelect={() => onSelect(task)}
            showScore={showScore}
          />
        ))}

        {/* Available tasks - show first 5 */}
        {availableTasks.slice(0, 5).map((task, index) => (
          <TaskRow
            key={task.id}
            task={task}
            rank={startRank + index}
            onSelect={() => onSelect(task)}
            showScore={showScore}
          />
        ))}

        {/* Show more available */}
        {availableTasks.length > 5 && (
          <div className="text-center py-2 text-slate-500 text-sm">
            +{availableTasks.length - 5} more tasks
          </div>
        )}
      </div>
    </div>
  );
}

// Role badge config
const ROLE_BADGE = {
  OWNER: { label: 'Owner only', icon: '🏠', color: 'text-amber-400 bg-amber-500/10' },
  BOTH: { label: 'Anyone', icon: '👥', color: 'text-emerald-400 bg-emerald-500/10' },
  SQUAD: { label: 'Squad', icon: '👥', color: 'text-blue-400 bg-blue-500/10' },
};

// Individual task row
function TaskRow({ task, rank, onSelect, showScore, isTopPriority, showRoleBadge }) {
  const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.AVAILABLE;
  const StatusIcon = statusConfig.icon;
  const roleBadge = ROLE_BADGE[task.role] || ROLE_BADGE.BOTH;

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 p-4 rounded-xl text-left transition-all ${
        isTopPriority
          ? 'bg-gradient-to-r from-flash-500/20 to-flash-600/10 border-2 border-flash-500/50 hover:border-flash-400'
          : task.status === 'NEEDS_HELP'
            ? 'bg-orange-500/10 border border-orange-500/30 hover:border-orange-400'
            : task.status === 'IN_PROGRESS'
              ? 'bg-yellow-500/10 border border-yellow-500/30 hover:border-yellow-400'
              : 'bg-slate-800/50 border border-slate-700/50 hover:border-slate-600'
      }`}
    >
      {/* Rank or status */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
        task.status === 'COMPLETED'
          ? 'bg-emerald-500/20 text-emerald-400'
          : task.status === 'IN_PROGRESS'
            ? 'bg-yellow-500/20 text-yellow-400'
            : task.status === 'NEEDS_HELP'
              ? 'bg-orange-500/20 text-orange-400'
              : isTopPriority
                ? 'bg-flash-500/20 text-flash-400'
                : 'bg-slate-700 text-slate-400'
      }`}>
        {StatusIcon ? <StatusIcon size={16} /> : rank || '#'}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`font-medium truncate ${
            task.status === 'COMPLETED' ? 'text-slate-500 line-through' : 'text-white'
          }`}>
            {task.title}
          </p>
          {/* Role badge */}
          {showRoleBadge && (
            <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge.color}`}>
              {roleBadge.icon} {roleBadge.label}
            </span>
          )}
        </div>
        <p className="text-slate-400 text-sm truncate">
          {task.description}
        </p>
      </div>

      {/* Score (debug mode) */}
      {showScore && (
        <div className="text-right">
          <div className="text-xs font-mono text-slate-500">
            {task.priorityScore}
          </div>
        </div>
      )}

      <ChevronRight size={18} className="text-slate-500 flex-shrink-0" />
    </button>
  );
}

// Full-screen task detail view
function TaskDetailView({ task, caseData, context, onBack, onAction, showNotification, debug }) {
  const actionDef = ACTION_TYPES[task.actionId] || {};
  const whyReasons = generateWhyExplanation(task, caseData, context);
  const callScript = generateCallScript(task, caseData);

  // Get breakdown for debug
  const { breakdown } = debug.isEnabled
    ? calculatePriorityScoreWithBreakdown(task, caseData, context)
    : { breakdown: [] };

  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white"
        >
          <ChevronLeft size={20} />
          Back
        </button>
        <div className="px-3 py-1 bg-flash-500/20 text-flash-400 text-sm font-bold rounded-full">
          Priority #{task._rank || 1}
        </div>
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-white mb-2">{task.title}</h1>
      <p className="text-slate-400 mb-6">{task.description}</p>

      {/* Why this is important */}
      <div className="mb-6">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-flash-400" />
          Why This is Priority #{task._rank || 1}
        </h3>
        <div className="bg-slate-800/50 rounded-xl p-4 space-y-2">
          {whyReasons.map((reason, i) => (
            <div key={i} className="flex items-start gap-2 text-slate-300 text-sm">
              <span className="text-flash-400 mt-0.5">•</span>
              {reason}
            </div>
          ))}
        </div>
      </div>

      {/* Call script (for shelter calls) */}
      {callScript && (
        <div className="mb-6">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Phone size={16} className="text-emerald-400" />
            What to Say
          </h3>
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
            <p className="text-emerald-200 text-sm italic">{callScript}</p>
            <button
              onClick={() => onAction(task, 'copy_script')}
              className="mt-3 flex items-center gap-2 text-emerald-400 text-sm hover:text-emerald-300"
            >
              <Copy size={14} />
              Copy to clipboard
            </button>
          </div>
        </div>
      )}

      {/* Debug: Score breakdown */}
      {debug.isEnabled && breakdown.length > 0 && (
        <div className="mb-6">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            Score Breakdown
          </h3>
          <div className="bg-gray-800 rounded-xl p-4 font-mono text-xs">
            {breakdown.map((item, i) => (
              <div key={i} className="flex justify-between py-1">
                <span className="text-slate-400">
                  {item.label}
                  <span className="text-slate-600 ml-2">({item.description})</span>
                </span>
                <span className={item.value >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {item.value >= 0 ? '+' : ''}{item.value}
                </span>
              </div>
            ))}
            <div className="border-t border-slate-700 mt-2 pt-2 flex justify-between font-bold">
              <span className="text-white">TOTAL</span>
              <span className="text-yellow-400">{task.priorityScore}</span>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent">
        <div className="max-w-lg mx-auto space-y-3">
          {task.status === 'AVAILABLE' && (
            <>
              {task.actionId === 'call_shelter' && task.shelter?.phone && (
                <a
                  href={`tel:${task.shelter.phone}`}
                  className="w-full flex items-center justify-center gap-2 p-4 bg-emerald-500 text-white font-bold rounded-xl"
                >
                  <Phone size={20} />
                  Tap to Call
                </a>
              )}
              <button
                onClick={() => onAction(task, 'start')}
                className="w-full flex items-center justify-center gap-2 p-4 bg-yellow-500 text-slate-900 font-bold rounded-xl"
              >
                <Play size={20} />
                I'm Working on This
              </button>
            </>
          )}

          {task.status === 'IN_PROGRESS' && (
            <>
              <button
                onClick={() => onAction(task, 'complete')}
                className="w-full flex items-center justify-center gap-2 p-4 bg-emerald-500 text-white font-bold rounded-xl"
              >
                <Check size={20} />
                Mark as Done
              </button>
              <button
                onClick={() => onAction(task, 'need_help')}
                className="w-full flex items-center justify-center gap-2 p-4 bg-orange-500/20 border border-orange-500/50 text-orange-400 font-bold rounded-xl"
              >
                <HelpCircle size={20} />
                I Need Help
              </button>
            </>
          )}

          {task.status === 'COMPLETED' && (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 text-emerald-400">
                <Check size={20} />
                Completed
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
