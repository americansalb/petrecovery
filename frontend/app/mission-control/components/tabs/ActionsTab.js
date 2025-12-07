'use client';

/**
 * ActionsTab - Mission Actions & Points System
 *
 * Displays:
 * - Points summary (today + all-time)
 * - Task categories with available actions
 * - Task completion UI
 * - Case leaderboard
 */

import { useState, useEffect } from 'react';
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
} from 'lucide-react';

// Category icons and colors
const CATEGORY_CONFIG = {
  SEARCH: { icon: Search, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Search' },
  OUTREACH: { icon: Phone, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Outreach' },
  VISIBILITY: { icon: FileText, color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Visibility' },
  AT_HOME: { icon: Home, color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'At Home' },
  DIGITAL: { icon: Mail, color: 'text-cyan-400', bg: 'bg-cyan-500/20', label: 'Digital' },
};

// Points display component
function PointsSummary({ points, loading }) {
  if (loading) {
    return (
      <div className="bg-gradient-to-r from-flash-600/20 to-purple-600/20 rounded-xl p-4 border border-flash-500/30 animate-pulse">
        <div className="h-20 bg-slate-700/50 rounded"></div>
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
        <div className="flex items-center gap-1 text-flash-400">
          <Zap size={16} />
          <span className="text-sm">+{points?.today?.total || 0} today</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-white">{points?.today?.verified || 0}</div>
          <div className="text-xs text-slate-400">Verified Today</div>
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

      {points?.today?.remaining !== undefined && points.today.remaining < 100 && (
        <div className="mt-3 text-xs text-slate-400 text-center">
          {points.today.remaining} self-report points remaining today
        </div>
      )}
    </div>
  );
}

// Task card component
function TaskCard({ task, onComplete, completing }) {
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

  return (
    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 hover:border-flash-500/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{task.icon}</span>
            <span className="text-white font-medium">{task.displayName}</span>
          </div>
          <p className="text-sm text-slate-400 mb-2">{task.description}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {getVerificationBadge()}
            <span className="text-xs text-flash-400 font-medium">{getPointsDisplay()}</span>
          </div>
        </div>
        <button
          onClick={() => onComplete(task)}
          disabled={completing === task.id}
          className="shrink-0 px-3 py-2 bg-flash-600 hover:bg-flash-500 disabled:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
        >
          {completing === task.id ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <>
              <CheckCircle size={14} />
              <span>Log</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Category section component
function CategorySection({ category, tasks, expanded, onToggle, onCompleteTask, completing }) {
  const config = CATEGORY_CONFIG[category] || { icon: Target, color: 'text-slate-400', bg: 'bg-slate-500/20', label: category };
  const Icon = config.icon;

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
            <div className="text-white font-medium">{config.label}</div>
            <div className="text-xs text-slate-400">{tasks.length} actions available</div>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="text-slate-400" size={20} />
        ) : (
          <ChevronDown className="text-slate-400" size={20} />
        )}
      </button>

      {expanded && (
        <div className="p-3 space-y-2 bg-slate-900/30">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={onCompleteTask}
              completing={completing}
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
        <p className="text-slate-400 text-sm">No contributions yet. Be the first!</p>
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
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
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
export default function ActionsTab({ mission, userId, onTaskComplete }) {
  const [points, setPoints] = useState(null);
  const [tasks, setTasks] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState('SEARCH');
  const [completing, setCompleting] = useState(null);

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

        // Fetch task definitions (client-side for now)
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

  // Handle task completion
  const handleCompleteTask = async (task) => {
    setCompleting(task.id);
    try {
      // For self-reported tasks, just log them
      const res = await fetch('/api/tasks/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: mission.id,
          taskId: task.id,
          actionType: task.id,
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

        // Notify parent
        if (onTaskComplete) {
          onTaskComplete(task, data);
        }
      }
    } catch (err) {
      console.error('Error logging task:', err);
    } finally {
      setCompleting(null);
    }
  };

  const categories = Object.keys(tasks).sort((a, b) => {
    const order = ['SEARCH', 'OUTREACH', 'VISIBILITY', 'AT_HOME', 'DIGITAL'];
    return order.indexOf(a) - order.indexOf(b);
  });

  return (
    <div className="space-y-4 pb-20">
      {/* Points Summary */}
      <PointsSummary points={points} loading={loading} />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/50 text-center">
          <div className="text-lg font-bold text-green-400">
            {points?.today?.verified || 0}
          </div>
          <div className="text-xs text-slate-400">Verified Actions</div>
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
              <div key={i} className="h-16 bg-slate-800/30 rounded-xl animate-pulse"></div>
            ))}
          </div>
        ) : (
          categories.map((category) => (
            <CategorySection
              key={category}
              category={category}
              tasks={tasks[category] || []}
              expanded={expandedCategory === category}
              onToggle={() => setExpandedCategory(expandedCategory === category ? null : category)}
              onCompleteTask={handleCompleteTask}
              completing={completing}
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
    </div>
  );
}
