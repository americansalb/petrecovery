'use client';

/**
 * TaskCard Component
 *
 * Modern task card with:
 * - Progress indicators (completion status, time spent)
 * - Owner-requested badge with bonus indicator
 * - Hidden time-specific naming (algorithm still applies bonuses internally)
 * - Action status indicators
 * - Points preview with potential bonuses
 *
 * Per Actions_Guide.md Phase 1 specification.
 */

import { useState, useMemo } from 'react';
import {
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  AlertCircle,
  Star,
  ChevronRight,
  Loader2,
  Camera,
  Phone,
  Mail,
  Navigation,
} from 'lucide-react';

// =============================================================================
// CONSTANTS
// =============================================================================

// Category colors - per Actions_Guide.md spec
// SEARCH = Blue (#3B82F6), OUTREACH = Orange (#F97316), AT_HOME = Green (#22C55E), OTHER = Gray (#6B7280)
const CATEGORY_COLORS = {
  SEARCH: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/50',
    text: 'text-blue-400',
    icon: 'text-blue-400',
  },
  OUTREACH: {
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/50',
    text: 'text-orange-400',
    icon: 'text-orange-400',
  },
  AT_HOME: {
    bg: 'bg-green-500/20',
    border: 'border-green-500/50',
    text: 'text-green-400',
    icon: 'text-green-400',
  },
  OTHER: {
    bg: 'bg-slate-500/20',
    border: 'border-slate-500/50',
    text: 'text-slate-400',
    icon: 'text-slate-400',
  },
};

// Status colors
const STATUS_COLORS = {
  AVAILABLE: { bg: 'bg-slate-700', text: 'text-slate-300' },
  IN_PROGRESS: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  NEEDS_HELP: { bg: 'bg-red-500/20', text: 'text-red-400' },
  COMPLETED: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  BLOCKED: { bg: 'bg-red-500/20', text: 'text-red-400' },
};

// Priority labels
const PRIORITY_LABELS = {
  LOW: { label: 'Low', color: 'text-slate-400' },
  MEDIUM: { label: 'Medium', color: 'text-amber-400' },
  HIGH: { label: 'High', color: 'text-orange-400' },
  URGENT: { label: 'Urgent', color: 'text-red-400' },
};

// Map time-specific task names to generic display names
// This hides the time component from UI while algorithm still uses it internally
const GENERIC_TASK_NAMES = {
  'dawn_search': 'Search Area',
  'dusk_search': 'Search Area',
  'morning_search': 'Search Area',
  'night_search': 'Search Area',
  'dawn_patrol': 'Patrol Neighborhood',
  'dusk_patrol': 'Patrol Neighborhood',
  'morning_shelter_call': 'Contact Shelters',
  'business_hours_call': 'Contact Shelters',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get display name for task, hiding time-specific variants
 */
function getDisplayName(task) {
  // Check if this is a time-specific variant
  const genericName = GENERIC_TASK_NAMES[task.actionId?.toLowerCase()];
  if (genericName) {
    return genericName;
  }
  return task.title || task.displayName || 'Task';
}

/**
 * Calculate progress percentage based on task type
 */
function calculateProgress(task) {
  if (task.status === 'COMPLETED') return 100;
  if (task.status === 'AVAILABLE') return 0;

  // For tasks with participants, show participation rate
  if (task.participants?.length > 0) {
    const completed = task.participants.filter(p => p.status === 'COMPLETED').length;
    return Math.round((completed / task.participants.length) * 100);
  }

  // For in-progress tasks, show 50%
  if (task.status === 'IN_PROGRESS') return 50;

  return 0;
}

/**
 * Format time duration
 */
function formatDuration(minutes) {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Calculate potential points with bonuses
 */
function calculatePotentialPoints(task, bonuses = []) {
  const basePoints = task.basePoints || 5;
  let total = basePoints;
  const appliedBonuses = [];

  // Owner requested bonus (+25%)
  if (task.ownerRequested) {
    const bonus = Math.round(basePoints * 0.25);
    total += bonus;
    appliedBonuses.push({ label: 'Owner requested', amount: bonus });
  }

  // Add any passed-in bonuses (time, urgency, etc.)
  bonuses.forEach(b => {
    const bonus = Math.round(basePoints * (b.multiplier - 1));
    total += bonus;
    appliedBonuses.push({ label: b.label, amount: bonus });
  });

  return { basePoints, total, bonuses: appliedBonuses };
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function TaskCard({
  task,
  onClick,
  onStart,
  onComplete,
  onNeedHelp,
  variant = 'default', // 'default' | 'compact' | 'expanded'
  showProgress = true,
  showPoints = true,
  activeBonuses = [], // Current active bonuses (time, urgency, etc.)
  loading = false,
  disabled = false,
}) {
  const [isHovered, setIsHovered] = useState(false);

  // Get category styling
  const category = task.category || task.type || 'OTHER';
  const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.OTHER;
  const statusColors = STATUS_COLORS[task.status] || STATUS_COLORS.AVAILABLE;

  // Get display name (hiding time-specific variants)
  const displayName = useMemo(() => getDisplayName(task), [task]);

  // Calculate progress
  const progress = useMemo(() => calculateProgress(task), [task]);

  // Calculate potential points
  const points = useMemo(
    () => calculatePotentialPoints(task, activeBonuses),
    [task, activeBonuses]
  );

  // Check if task has verification method
  const hasVerification = task.verificationMethod && task.verificationMethod !== 'SELF_REPORT';
  const verificationIcon = {
    GPS: Navigation,
    PLATFORM_EMAIL: Mail,
    PHOTO: Camera,
  }[task.verificationMethod];

  // Compact variant
  if (variant === 'compact') {
    return (
      <button
        onClick={onClick}
        disabled={disabled || loading}
        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'
        } ${colors.bg} ${colors.border} border`}
      >
        {/* Icon */}
        <div className={`text-2xl flex-shrink-0`}>
          {task.icon || '📋'}
        </div>

        {/* Content */}
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold truncate">{displayName}</span>
            {task.ownerRequested && (
              <Star size={14} className="text-amber-400 flex-shrink-0" fill="currentColor" />
            )}
          </div>
          {showPoints && (
            <span className={`text-xs ${colors.text}`}>
              +{points.total} pts
              {points.bonuses.length > 0 && (
                <span className="text-emerald-400 ml-1">
                  (+{points.bonuses.reduce((sum, b) => sum + b.amount, 0)} bonus)
                </span>
              )}
            </span>
          )}
        </div>

        {/* Status/Action */}
        {loading ? (
          <Loader2 size={20} className="text-slate-400 animate-spin" />
        ) : (
          <ChevronRight size={20} className="text-slate-500" />
        )}
      </button>
    );
  }

  // Default/Expanded variant
  return (
    <div
      className={`rounded-xl border transition-all duration-200 overflow-hidden ${
        isHovered && !disabled ? 'scale-[1.01] shadow-lg' : ''
      } ${colors.bg} ${colors.border} ${disabled ? 'opacity-50' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`text-3xl flex-shrink-0 ${colors.icon}`}>
            {task.icon || '📋'}
          </div>

          {/* Title & Meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-white font-bold text-lg truncate">{displayName}</h3>

              {/* Owner Requested Badge */}
              {task.ownerRequested && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-400 text-xs font-semibold">
                  <Star size={12} fill="currentColor" />
                  Owner Requested
                </span>
              )}

              {/* Priority Badge */}
              {task.priority && task.priority !== 'MEDIUM' && (
                <span className={`text-xs font-semibold ${PRIORITY_LABELS[task.priority]?.color || 'text-slate-400'}`}>
                  {PRIORITY_LABELS[task.priority]?.label}
                </span>
              )}
            </div>

            {/* Description */}
            {task.description && (
              <p className="text-slate-400 text-sm mt-1 line-clamp-2">
                {task.description}
              </p>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
              {/* Category */}
              <span className={colors.text}>{category}</span>

              {/* Location */}
              {task.address && (
                <span className="flex items-center gap-1">
                  <MapPin size={12} />
                  <span className="truncate max-w-[120px]">{task.address}</span>
                </span>
              )}

              {/* Participants */}
              {task.participants?.length > 0 && (
                <span className="flex items-center gap-1">
                  <Users size={12} />
                  {task.participants.length}
                </span>
              )}

              {/* Verification method */}
              {verificationIcon && (
                <span className="flex items-center gap-1 text-emerald-400">
                  {(() => {
                    const Icon = verificationIcon;
                    return <Icon size={12} />;
                  })()}
                  Verified
                </span>
              )}
            </div>
          </div>

          {/* Points */}
          {showPoints && (
            <div className="text-right flex-shrink-0">
              <div className="text-xl font-bold text-white">+{points.total}</div>
              <div className="text-xs text-slate-500">points</div>
              {points.bonuses.length > 0 && (
                <div className="text-xs text-emerald-400 mt-1">
                  +{points.bonuses.reduce((sum, b) => sum + b.amount, 0)} bonus
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {showProgress && progress > 0 && (
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progress === 100 ? 'bg-emerald-500' : 'bg-flash-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Bonus Breakdown (expanded view) */}
      {variant === 'expanded' && points.bonuses.length > 0 && (
        <div className="px-4 pb-3">
          <div className="bg-slate-800/50 rounded-lg p-2">
            <div className="text-xs text-slate-400 mb-1">Active Bonuses</div>
            <div className="space-y-1">
              {points.bonuses.map((bonus, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-slate-300">{bonus.label}</span>
                  <span className="text-emerald-400">+{bonus.amount} pts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Owner Request Notes */}
      {task.ownerRequested && task.requestNotes && variant === 'expanded' && (
        <div className="px-4 pb-3">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Star size={14} className="text-amber-400 mt-0.5" fill="currentColor" />
              <div>
                <div className="text-xs text-amber-400 font-semibold mb-1">Owner&apos;s Note</div>
                <p className="text-sm text-amber-200">{task.requestNotes}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className={`px-4 py-3 border-t border-slate-700/50 flex items-center justify-between ${statusColors.bg}`}>
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {task.status === 'COMPLETED' ? (
            <CheckCircle2 size={16} className="text-emerald-400" />
          ) : task.status === 'BLOCKED' || task.status === 'NEEDS_HELP' ? (
            <AlertCircle size={16} className="text-red-400" />
          ) : task.status === 'IN_PROGRESS' ? (
            <Clock size={16} className="text-amber-400" />
          ) : null}
          <span className={`text-sm font-medium ${statusColors.text}`}>
            {task.status === 'AVAILABLE' ? 'Ready to start' :
             task.status === 'IN_PROGRESS' ? 'In progress' :
             task.status === 'NEEDS_HELP' ? 'Needs help' :
             task.status === 'COMPLETED' ? 'Completed' :
             task.status === 'BLOCKED' ? `Blocked: ${task.blockedReason || 'Unknown'}` :
             task.status}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {task.status === 'AVAILABLE' && onStart && (
            <button
              onClick={(e) => { e.stopPropagation(); onStart(task); }}
              disabled={loading || disabled}
              className="px-3 py-1.5 rounded-lg bg-flash-500 text-white text-sm font-semibold hover:bg-flash-600 transition disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : 'Start'}
            </button>
          )}

          {task.status === 'IN_PROGRESS' && (
            <>
              {onNeedHelp && (
                <button
                  onClick={(e) => { e.stopPropagation(); onNeedHelp(task); }}
                  disabled={loading || disabled}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-sm font-semibold hover:bg-red-500/30 transition disabled:opacity-50"
                >
                  Need Help
                </button>
              )}
              {onComplete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onComplete(task); }}
                  disabled={loading || disabled}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition disabled:opacity-50"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : 'Complete'}
                </button>
              )}
            </>
          )}

          {/* View details arrow */}
          {onClick && (
            <button
              onClick={onClick}
              className="p-1.5 rounded-lg hover:bg-slate-700/50 transition"
            >
              <ChevronRight size={18} className="text-slate-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TASK LIST COMPONENT
// =============================================================================

export function TaskList({
  tasks,
  category,
  onTaskClick,
  onTaskStart,
  onTaskComplete,
  onTaskNeedHelp,
  showProgress = true,
  showPoints = true,
  activeBonuses = [],
  emptyMessage = 'No tasks available',
  loading = false,
}) {
  // Filter tasks by category if specified
  const filteredTasks = category
    ? tasks.filter(t => (t.category || t.type) === category)
    : tasks;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-xl bg-slate-800/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (filteredTasks.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filteredTasks.map(task => (
        <TaskCard
          key={task.id}
          task={task}
          onClick={() => onTaskClick?.(task)}
          onStart={onTaskStart}
          onComplete={onTaskComplete}
          onNeedHelp={onTaskNeedHelp}
          showProgress={showProgress}
          showPoints={showPoints}
          activeBonuses={activeBonuses}
        />
      ))}
    </div>
  );
}

// =============================================================================
// TASK PROGRESS SUMMARY COMPONENT
// =============================================================================

export function TaskProgressSummary({
  tasks,
  className = '',
}) {
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'COMPLETED').length;
    const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
    const needsHelp = tasks.filter(t => t.status === 'NEEDS_HELP').length;
    const available = tasks.filter(t => t.status === 'AVAILABLE').length;
    const ownerRequested = tasks.filter(t => t.ownerRequested).length;
    const ownerRequestedCompleted = tasks.filter(t => t.ownerRequested && t.status === 'COMPLETED').length;

    return {
      total,
      completed,
      inProgress,
      needsHelp,
      available,
      ownerRequested,
      ownerRequestedCompleted,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [tasks]);

  return (
    <div className={`bg-slate-800/50 rounded-xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold">Task Progress</h3>
        <span className="text-2xl font-bold text-flash-400">{stats.percentage}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-flash-500 to-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${stats.percentage}%` }}
        />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <div className="text-lg font-bold text-emerald-400">{stats.completed}</div>
          <div className="text-xs text-slate-500">Done</div>
        </div>
        <div>
          <div className="text-lg font-bold text-amber-400">{stats.inProgress}</div>
          <div className="text-xs text-slate-500">Active</div>
        </div>
        <div>
          <div className="text-lg font-bold text-red-400">{stats.needsHelp}</div>
          <div className="text-xs text-slate-500">Help</div>
        </div>
        <div>
          <div className="text-lg font-bold text-slate-400">{stats.available}</div>
          <div className="text-xs text-slate-500">Ready</div>
        </div>
      </div>

      {/* Owner requested indicator */}
      {stats.ownerRequested > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star size={14} className="text-amber-400" fill="currentColor" />
            <span className="text-sm text-slate-400">Owner Requested</span>
          </div>
          <span className="text-sm font-semibold text-amber-400">
            {stats.ownerRequestedCompleted}/{stats.ownerRequested} done
          </span>
        </div>
      )}
    </div>
  );
}
