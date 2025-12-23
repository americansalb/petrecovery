'use client';

/**
 * TasksPanel - Actions and task management
 *
 * Features:
 * - View available tasks/actions
 * - Claim and complete tasks
 * - Priority indicators
 * - Progress tracking
 */

import { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  MapPin,
  Share2,
  FileText,
  Phone,
  Printer,
  Users,
  AlertTriangle,
  ChevronRight,
  Star,
  Zap
} from 'lucide-react';

// Task categories with their actions
const TASK_CATEGORIES = [
  {
    id: 'immediate',
    label: 'Immediate Actions',
    color: 'red',
    icon: Zap,
    tasks: [
      { id: 'search', label: 'GPS Search the Area', icon: MapPin, points: 100, description: 'Walk around and track your search path', priority: 'high' },
      { id: 'sighting', label: 'Report a Sighting', icon: '👁', points: 50, description: 'Saw the pet? Report it immediately' },
      { id: 'share', label: 'Share on Social Media', icon: Share2, points: 25, description: 'Spread the word on Facebook, Nextdoor' },
    ]
  },
  {
    id: 'outreach',
    label: 'Community Outreach',
    color: 'amber',
    icon: Users,
    tasks: [
      { id: 'flyers', label: 'Print & Post Flyers', icon: Printer, points: 30, description: 'Put up flyers in high-traffic areas' },
      { id: 'neighbors', label: 'Talk to Neighbors', icon: Users, points: 20, description: 'Ask if anyone has seen the pet' },
      { id: 'shelters', label: 'Contact Local Shelters', icon: Phone, points: 25, description: 'Check with nearby animal shelters' },
    ]
  },
  {
    id: 'documentation',
    label: 'Documentation',
    color: 'blue',
    icon: FileText,
    tasks: [
      { id: 'photos', label: 'Upload More Photos', icon: '📷', points: 10, description: 'Add clear photos of the pet' },
      { id: 'details', label: 'Update Pet Details', icon: FileText, points: 10, description: 'Add any identifying features' },
      { id: 'timeline', label: 'Document Timeline', icon: Clock, points: 15, description: 'Record when and where last seen' },
    ]
  },
];

const colorClasses = {
  red: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', badge: 'bg-red-500' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', badge: 'bg-amber-500' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', badge: 'bg-blue-500' },
  green: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', badge: 'bg-emerald-500' },
};

export default function TasksPanel({
  completedTasks = [],
  onTaskAction,
  onStartSearch,
  onReportSighting,
}) {
  const [expandedCategory, setExpandedCategory] = useState('immediate');

  const isTaskCompleted = (taskId) => completedTasks.includes(taskId);

  const handleTaskClick = (task) => {
    if (task.id === 'search') {
      onStartSearch?.();
    } else if (task.id === 'sighting') {
      onReportSighting?.();
    } else {
      onTaskAction?.(task.id);
    }
  };

  // Calculate progress
  const totalTasks = TASK_CATEGORIES.reduce((sum, cat) => sum + cat.tasks.length, 0);
  const completedCount = completedTasks.length;
  const progressPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
      {/* Header with Progress */}
      <div className="p-4 bg-slate-900/50 border-b border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white">Tasks & Actions</h2>
          <span className="text-sm text-slate-400">{completedCount}/{totalTasks} done</span>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Points summary */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-slate-500">Complete tasks to earn points!</span>
          <div className="flex items-center gap-1 text-amber-400 text-sm font-medium">
            <Star size={14} />
            <span>Earn up to 285 pts</span>
          </div>
        </div>
      </div>

      {/* Task Categories */}
      <div className="flex-1 overflow-y-auto">
        {TASK_CATEGORIES.map(category => {
          const colors = colorClasses[category.color];
          const isExpanded = expandedCategory === category.id;
          const categoryCompleted = category.tasks.filter(t => isTaskCompleted(t.id)).length;

          return (
            <div key={category.id} className="border-b border-slate-800">
              {/* Category Header */}
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : category.id)}
                className={`w-full p-4 flex items-center gap-3 transition ${
                  isExpanded ? colors.bg : 'hover:bg-slate-900/50'
                }`}
              >
                <div className={`p-2 rounded-lg ${colors.bg} ${colors.text}`}>
                  <category.icon size={18} />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-white">{category.label}</p>
                  <p className="text-xs text-slate-500">
                    {categoryCompleted}/{category.tasks.length} completed
                  </p>
                </div>
                <ChevronRight
                  size={20}
                  className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                />
              </button>

              {/* Tasks */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-2">
                  {category.tasks.map(task => {
                    const completed = isTaskCompleted(task.id);
                    const IconComponent = typeof task.icon === 'string' ? null : task.icon;

                    return (
                      <button
                        key={task.id}
                        onClick={() => !completed && handleTaskClick(task)}
                        disabled={completed}
                        className={`
                          w-full p-3 rounded-xl border text-left transition
                          ${completed
                            ? 'bg-emerald-500/10 border-emerald-500/30'
                            : `${colors.bg} ${colors.border} hover:bg-slate-800`
                          }
                        `}
                      >
                        <div className="flex items-start gap-3">
                          {/* Status icon */}
                          <div className="mt-0.5">
                            {completed ? (
                              <CheckCircle2 size={20} className="text-emerald-400" />
                            ) : (
                              <Circle size={20} className="text-slate-600" />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {IconComponent ? (
                                <IconComponent size={16} className={completed ? 'text-emerald-400' : colors.text} />
                              ) : (
                                <span>{task.icon}</span>
                              )}
                              <p className={`font-medium ${completed ? 'text-emerald-400 line-through' : 'text-white'}`}>
                                {task.label}
                              </p>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{task.description}</p>
                          </div>

                          {/* Points */}
                          <div className={`
                            flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
                            ${completed
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                            }
                          `}>
                            <Star size={12} />
                            {task.points}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
