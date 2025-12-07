'use client';

/**
 * ActionsTab - Mission Actions & Points System
 *
 * Features:
 * - Points summary (today + all-time)
 * - Task categories with available actions
 * - Task completion modal with photo upload
 * - GPS task integration
 * - Recent activity
 * - Case leaderboard
 */

import { useState, useEffect, useRef } from 'react';
import {
  Trophy,
  Star,
  CheckCircle,
  Clock,
  MapPin,
  Phone,
  Mail,
  Camera,
  Search,
  FileText,
  Home,
  ChevronDown,
  ChevronUp,
  Zap,
  Target,
  Users,
  Award,
  X,
  Upload,
  Navigation,
  MessageSquare,
  History,
  Loader2,
  AlertCircle,
} from 'lucide-react';

// Category icons and colors
const CATEGORY_CONFIG = {
  SEARCH: { icon: Search, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Search', desc: 'Walk and search the area' },
  OUTREACH: { icon: Phone, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Outreach', desc: 'Contact shelters and neighbors' },
  VISIBILITY: { icon: FileText, color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Visibility', desc: 'Flyers and online posts' },
  AT_HOME: { icon: Home, color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'At Home', desc: 'Attract your pet back home' },
  DIGITAL: { icon: Mail, color: 'text-cyan-400', bg: 'bg-cyan-500/20', label: 'Digital', desc: 'Online outreach' },
};

// Task Completion Modal
function TaskCompletionModal({ task, isOpen, onClose, onSubmit, submitting }) {
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen || !task) return null;

  const isPhotoRequired = task.verificationMethod === 'PHOTO';
  const isGPSTask = task.verificationMethod === 'GPS';

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = () => {
    onSubmit({ notes, photo });
    setNotes('');
    setPhoto(null);
    setPhotoPreview(null);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl max-w-md w-full border border-slate-700 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{task.icon}</span>
            <div>
              <h3 className="text-white font-semibold">{task.displayName}</h3>
              <p className="text-xs text-flash-400">+{typeof task.basePoints === 'object' ? task.basePoints.default : task.basePoints} pts</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <X className="text-slate-400" size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* GPS Task Notice */}
          {isGPSTask && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-start gap-3">
              <Navigation className="text-blue-400 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-blue-300 text-sm font-medium">GPS Verification Available</p>
                <p className="text-blue-400/70 text-xs mt-1">
                  For verified points, use the Map tab to track your search with GPS.
                  You can also log this manually below.
                </p>
              </div>
            </div>
          )}

          {/* Photo Upload for PHOTO tasks */}
          {isPhotoRequired && (
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Photo Proof {isPhotoRequired && <span className="text-flash-400">*</span>}
              </label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoChange}
                accept="image/*"
                className="hidden"
              />
              {photoPreview ? (
                <div className="relative">
                  <img src={photoPreview} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
                  <button
                    onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                    className="absolute top-2 right-2 p-1 bg-black/50 rounded-full"
                  >
                    <X size={16} className="text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 border-2 border-dashed border-slate-600 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-flash-500/50 transition-colors"
                >
                  <Camera className="text-slate-500" size={24} />
                  <span className="text-slate-400 text-sm">Tap to add photo</span>
                </button>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Notes <span className="text-slate-500">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any details about this action..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:border-flash-500"
              rows={3}
            />
          </div>

          {/* Tips */}
          {task.tips && task.tips.length > 0 && (
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-xs text-slate-400 font-medium mb-2">Tips:</p>
              <ul className="space-y-1">
                {task.tips.slice(0, 2).map((tip, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-flash-400">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || (isPhotoRequired && !photo)}
            className="flex-1 px-4 py-2.5 bg-flash-600 text-white rounded-lg font-medium hover:bg-flash-500 disabled:bg-slate-700 disabled:text-slate-500 transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Logging...
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                Log Action
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Points display component
function PointsSummary({ points, loading, recentActions }) {
  if (loading) {
    return (
      <div className="bg-gradient-to-r from-flash-600/20 to-purple-600/20 rounded-xl p-4 border border-flash-500/30 animate-pulse">
        <div className="h-24 bg-slate-700/50 rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-flash-600/20 to-purple-600/20 rounded-xl p-4 border border-flash-500/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="text-flash-400" size={20} />
          <span className="text-white font-semibold">Your Points</span>
        </div>
        {points?.today?.total > 0 && (
          <div className="flex items-center gap-1 text-flash-400">
            <Zap size={16} />
            <span className="text-sm font-medium">+{points.today.total} today</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-white">{points?.today?.verified || 0}</div>
          <div className="text-xs text-slate-400">Verified</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-white">{points?.allTime?.total || 0}</div>
          <div className="text-xs text-slate-400">All Time</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-flash-400">{points?.caseTotal || 0}</div>
          <div className="text-xs text-slate-400">This Case</div>
        </div>
      </div>

      {/* Recent Activity */}
      {recentActions && recentActions.length > 0 && (
        <div className="border-t border-slate-700/50 pt-3 mt-3">
          <div className="flex items-center gap-1 text-xs text-slate-400 mb-2">
            <History size={12} />
            <span>Recent</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentActions.slice(0, 3).map((action) => (
              <div key={action.id} className="flex-shrink-0 bg-slate-800/50 px-2 py-1 rounded text-xs">
                <span className="text-flash-400">+{action.points}</span>
                <span className="text-slate-400 ml-1">{action.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {points?.today?.remaining !== undefined && points.today.remaining < 100 && (
        <div className="mt-3 text-xs text-slate-400 text-center flex items-center justify-center gap-1">
          <AlertCircle size={12} />
          {points.today.remaining} self-report points left today
        </div>
      )}
    </div>
  );
}

// Task card component
function TaskCard({ task, onComplete, completing, completedToday }) {
  const getPointsDisplay = () => {
    if (typeof task.basePoints === 'object') {
      return `${task.basePoints.call || task.basePoints.default}–${task.basePoints.email || task.basePoints.default} pts`;
    }
    return `${task.basePoints} pts`;
  };

  const getVerificationBadge = () => {
    switch (task.verificationMethod) {
      case 'GPS':
        return <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full flex items-center gap-1"><MapPin size={10} /> GPS</span>;
      case 'PHOTO':
        return <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full flex items-center gap-1"><Camera size={10} /> Photo</span>;
      case 'PLATFORM_EMAIL':
        return <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1"><Mail size={10} /> Email</span>;
      default:
        return <span className="text-xs bg-slate-500/20 text-slate-400 px-2 py-0.5 rounded-full">Self-report</span>;
    }
  };

  const isCompleting = completing === task.id;

  return (
    <div className={`bg-slate-800/50 rounded-lg p-3 border transition-colors ${
      completedToday ? 'border-green-500/30 bg-green-500/5' : 'border-slate-700/50 hover:border-flash-500/30'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{task.icon}</span>
            <span className="text-white font-medium truncate">{task.displayName}</span>
            {completedToday && <CheckCircle size={14} className="text-green-400 shrink-0" />}
          </div>
          <p className="text-sm text-slate-400 mb-2 line-clamp-2">{task.description}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {getVerificationBadge()}
            <span className="text-xs text-flash-400 font-medium">{getPointsDisplay()}</span>
          </div>
        </div>
        <button
          onClick={() => onComplete(task)}
          disabled={isCompleting}
          className="shrink-0 px-3 py-2 bg-flash-600 hover:bg-flash-500 disabled:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
        >
          {isCompleting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <CheckCircle size={14} />
          )}
          <span>{completedToday ? 'Again' : 'Log'}</span>
        </button>
      </div>
    </div>
  );
}

// Category section component
function CategorySection({ category, tasks, expanded, onToggle, onCompleteTask, completing, completedTasks }) {
  const config = CATEGORY_CONFIG[category] || { icon: Target, color: 'text-slate-400', bg: 'bg-slate-500/20', label: category, desc: '' };
  const Icon = config.icon;
  const completedCount = tasks.filter(t => completedTasks?.includes(t.id)).length;

  return (
    <div className="border border-slate-700/50 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${config.bg}`}>
            <Icon className={config.color} size={20} />
          </div>
          <div className="text-left">
            <div className="text-white font-medium flex items-center gap-2">
              {config.label}
              {completedCount > 0 && (
                <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
                  {completedCount} done
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400">{config.desc}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{tasks.length}</span>
          {expanded ? (
            <ChevronUp className="text-slate-400" size={20} />
          ) : (
            <ChevronDown className="text-slate-400" size={20} />
          )}
        </div>
      </button>

      {expanded && (
        <div className="p-3 space-y-2 bg-slate-900/30">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={onCompleteTask}
              completing={completing}
              completedToday={completedTasks?.includes(task.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Leaderboard component
function Leaderboard({ entries, userId, loading }) {
  if (loading) {
    return (
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50 animate-pulse">
        <div className="h-32 bg-slate-700/50 rounded"></div>
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50 text-center">
        <Users className="text-slate-500 mx-auto mb-2" size={24} />
        <p className="text-slate-400 text-sm">No contributions yet</p>
        <p className="text-slate-500 text-xs mt-1">Be the first to help!</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="p-3 border-b border-slate-700/50 flex items-center gap-2">
        <Award className="text-flash-400" size={18} />
        <span className="text-white font-medium">Top Contributors</span>
      </div>
      <div className="divide-y divide-slate-700/30">
        {entries.slice(0, 5).map((entry) => (
          <div
            key={entry.userId}
            className={`flex items-center justify-between p-3 ${
              entry.userId === userId ? 'bg-flash-500/10' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                entry.rank === 1 ? 'bg-yellow-500 text-yellow-900' :
                entry.rank === 2 ? 'bg-slate-300 text-slate-700' :
                entry.rank === 3 ? 'bg-amber-600 text-amber-100' :
                'bg-slate-600 text-slate-300'
              }`}>
                {entry.rank}
              </div>
              <span className={`text-sm ${entry.userId === userId ? 'text-flash-400 font-medium' : 'text-white'}`}>
                {entry.userName}
                {entry.userId === userId && ' (You)'}
              </span>
            </div>
            <span className="text-flash-400 font-medium">{entry.points} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main ActionsTab component
export default function ActionsTab({ mission, userId, onTaskComplete, onNavigateToMap }) {
  const [points, setPoints] = useState(null);
  const [tasks, setTasks] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState('SEARCH');
  const [completing, setCompleting] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [completedTasks, setCompletedTasks] = useState([]);

  // Fetch points and tasks
  useEffect(() => {
    if (!mission?.id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch points summary
        const pointsRes = await fetch(`/api/users/me/points?caseId=${mission.id}`);
        if (pointsRes.ok) {
          const data = await pointsRes.json();
          setPoints(data);
        }

        // Fetch leaderboard
        const leaderRes = await fetch(`/api/mission/${mission.id}/points/leaderboard`);
        if (leaderRes.ok) {
          const data = await leaderRes.json();
          setLeaderboard(data.entries || []);
        }

        // Fetch task definitions
        const tasksRes = await fetch('/api/tasks/definitions');
        if (tasksRes.ok) {
          const data = await tasksRes.json();
          // Group by category
          const grouped = {};
          Object.values(data.tasks || {}).forEach((task) => {
            if (!grouped[task.category]) grouped[task.category] = [];
            grouped[task.category].push(task);
          });
          setTasks(grouped);
        }
      } catch (err) {
        console.error('Error fetching actions data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [mission?.id]);

  // Handle opening task modal
  const handleOpenTask = (task) => {
    setSelectedTask(task);
  };

  // Handle task completion
  const handleCompleteTask = async ({ notes, photo }) => {
    if (!selectedTask) return;

    setCompleting(selectedTask.id);
    try {
      // TODO: If photo, upload to storage first
      let photoUrl = null;
      if (photo) {
        // For now, we'll skip actual upload - just note that photo was provided
        console.log('Photo provided:', photo.name);
      }

      const res = await fetch('/api/tasks/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: mission.id,
          taskId: selectedTask.id,
          actionType: selectedTask.id,
          notes,
          photoUrl,
        }),
      });

      if (res.ok) {
        const data = await res.json();

        // Update points display
        setPoints((prev) => ({
          ...prev,
          today: {
            ...prev?.today,
            selfReported: (prev?.today?.selfReported || 0) + (data.pointsEarned || 0),
            total: (prev?.today?.total || 0) + (data.pointsEarned || 0),
            remaining: data.remainingDaily ?? prev?.today?.remaining,
          },
          caseTotal: (prev?.caseTotal || 0) + (data.pointsEarned || 0),
        }));

        // Track completed task
        setCompletedTasks((prev) => [...new Set([...prev, selectedTask.id])]);

        // Notify parent
        if (onTaskComplete) {
          onTaskComplete(selectedTask, data);
        }
      }
    } catch (err) {
      console.error('Error logging task:', err);
    } finally {
      setCompleting(null);
      setSelectedTask(null);
    }
  };

  const categories = Object.keys(tasks).sort((a, b) => {
    const order = ['SEARCH', 'OUTREACH', 'AT_HOME', 'VISIBILITY', 'DIGITAL'];
    return order.indexOf(a) - order.indexOf(b);
  });

  return (
    <div className="space-y-4 pb-20">
      {/* Points Summary */}
      <PointsSummary
        points={points}
        loading={loading}
        recentActions={points?.recentActions}
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/50 text-center">
          <div className="text-lg font-bold text-green-400">
            {points?.today?.verified || 0}
          </div>
          <div className="text-xs text-slate-400">Verified Today</div>
        </div>
        <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/50 text-center">
          <div className="text-lg font-bold text-purple-400">
            {leaderboard.find((e) => e.userId === userId)?.rank || '–'}
          </div>
          <div className="text-xs text-slate-400">Your Rank</div>
        </div>
      </div>

      {/* Task Categories */}
      <div className="space-y-3">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Target size={18} className="text-flash-400" />
          Available Actions
        </h3>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-slate-800/30 rounded-xl animate-pulse"></div>
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Target size={32} className="mx-auto mb-2 opacity-50" />
            <p>No actions available</p>
          </div>
        ) : (
          categories.map((category) => (
            <CategorySection
              key={category}
              category={category}
              tasks={tasks[category] || []}
              expanded={expandedCategory === category}
              onToggle={() => setExpandedCategory(expandedCategory === category ? null : category)}
              onCompleteTask={handleOpenTask}
              completing={completing}
              completedTasks={completedTasks}
            />
          ))
        )}
      </div>

      {/* Leaderboard */}
      <div className="space-y-3">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Trophy size={18} className="text-flash-400" />
          Leaderboard
        </h3>
        <Leaderboard entries={leaderboard} userId={userId} loading={loading} />
      </div>

      {/* Task Completion Modal */}
      <TaskCompletionModal
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onSubmit={handleCompleteTask}
        submitting={completing === selectedTask?.id}
      />
    </div>
  );
}
