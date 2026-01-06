'use client';

/**
 * ActionsTabV2 - V4 Actions View
 *
 * Features:
 * - Points header with verification breakdown
 * - Task categories (Search, Outreach, At Home, Other)
 * - Shelter contact integration
 * - Flyer generation
 * - Leaderboard
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Star,
  Trophy,
  CheckCircle,
  Zap,
  ChevronDown,
  ChevronUp,
  Search,
  Megaphone,
  Home,
  Edit3,
  MapPin,
  Camera,
  Mail,
  Phone,
  Building2,
  FileText,
  Navigation,
  Users,
  Crown,
  Loader2,
  X,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';

// ============================================================================
// TASK DEFINITIONS (from Actions_Guide.md)
// ============================================================================
const TASK_DEFINITIONS = {
  // SEARCH
  search_area: {
    id: 'search_area',
    category: 'SEARCH',
    displayName: 'Search Area',
    description: 'Walk through the neighborhood looking for your pet',
    icon: '🔍',
    basePoints: 10,
    verificationMethod: 'GPS',
    tips: ['Bring treats and a favorite toy', 'Call their name in a calm voice'],
  },
  check_hiding: {
    id: 'check_hiding',
    category: 'SEARCH',
    displayName: 'Check Hiding Spots',
    description: 'Look in common hiding places like under decks, in sheds, and behind bushes',
    icon: '👀',
    basePoints: 8,
    verificationMethod: 'GPS',
    tips: ['Use a flashlight even during the day', 'Check high places for cats'],
  },

  // OUTREACH
  contact_shelters: {
    id: 'contact_shelters',
    category: 'OUTREACH',
    displayName: 'Contact Shelters',
    description: 'Call or email local animal shelters',
    icon: '🏥',
    basePoints: { call: 8, email: 15 },
    verificationMethod: 'PLATFORM_EMAIL',
    tips: ['Call during business hours', 'Request to be notified if a match comes in'],
  },
  contact_vets: {
    id: 'contact_vets',
    category: 'OUTREACH',
    displayName: 'Contact Vets',
    description: 'Call or email local veterinarians',
    icon: '🩺',
    basePoints: { call: 8, email: 15 },
    verificationMethod: 'PLATFORM_EMAIL',
    tips: ['Vets often see found pets brought in for checkups'],
  },
  post_flyers: {
    id: 'post_flyers',
    category: 'OUTREACH',
    displayName: 'Post Flyers',
    description: 'Put up flyers in the neighborhood',
    icon: '📌',
    basePoints: 8,
    verificationMethod: 'GPS',
    tips: ['Post at eye level', 'Include a clear photo and phone number'],
  },
  knock_doors: {
    id: 'knock_doors',
    category: 'OUTREACH',
    displayName: 'Talk to Neighbors',
    description: 'Go door-to-door asking if anyone has seen your pet',
    icon: '🚪',
    basePoints: 5,
    verificationMethod: 'GPS',
    tips: ['Bring a photo to show', 'Ask if they have outdoor cameras'],
  },
  share_online: {
    id: 'share_online',
    category: 'OUTREACH',
    displayName: 'Share Online',
    description: 'Post on social media, Nextdoor, and lost pet sites',
    icon: '📱',
    basePoints: 5,
    verificationMethod: 'SELF_REPORT',
    tips: ['Post in local community groups', 'Use relevant hashtags'],
  },

  // AT_HOME
  litter_outside: {
    id: 'litter_outside',
    category: 'AT_HOME',
    displayName: 'Put Litter Box Outside',
    description: 'Place used litter box near entry points',
    icon: '🚽',
    basePoints: 8,
    verificationMethod: 'PHOTO',
    petType: 'CAT',
    tips: ['Cats can smell their litter from very far away'],
  },
  scent_items: {
    id: 'scent_items',
    category: 'AT_HOME',
    displayName: 'Leave Scent Items',
    description: 'Put worn clothing outside for your pet to smell',
    icon: '👕',
    basePoints: 8,
    verificationMethod: 'PHOTO',
    tips: ['Use unwashed clothing that smells like you'],
  },
  food_station: {
    id: 'food_station',
    category: 'AT_HOME',
    displayName: 'Set Up Food Station',
    description: 'Leave food and water outside',
    icon: '🍽️',
    basePoints: 8,
    verificationMethod: 'PHOTO',
    tips: ['Use their favorite food', 'Place near a hiding spot'],
  },
  camera_setup: {
    id: 'camera_setup',
    category: 'AT_HOME',
    displayName: 'Set Up Camera',
    description: 'Monitor your food station with a camera',
    icon: '📹',
    basePoints: 10,
    verificationMethod: 'PHOTO',
    tips: ['Check footage regularly'],
  },
};

const CATEGORY_CONFIG = {
  SEARCH: {
    label: 'Search',
    icon: Search,
    emoji: '🔍',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
    description: 'Physical searching for your pet',
  },
  OUTREACH: {
    label: 'Outreach',
    icon: Megaphone,
    emoji: '📢',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500/30',
    description: 'Contacting shelters & spreading the word',
  },
  AT_HOME: {
    label: 'At Home',
    icon: Home,
    emoji: '🏠',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30',
    description: 'Actions at home to attract pet back',
  },
  OTHER: {
    label: 'Other',
    icon: Edit3,
    emoji: '✏️',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/20',
    borderColor: 'border-slate-500/30',
    description: 'Custom activity logging',
  },
};

// ============================================================================
// POINTS HEADER
// ============================================================================
function PointsHeader({ missionId, userId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!missionId) return;

    const fetchPoints = async () => {
      try {
        const res = await fetch(`/api/mission/${missionId}/points`);
        if (res.ok) {
          const result = await res.json();
          const userEntry = result.leaderboard?.find(e => e.userId === userId);
          setData({
            caseTotal: userEntry?.points || 0,
            rank: userEntry?.rank || null,
            todayVerified: result.summary?.todayVerified || 0,
            todaySelfReported: result.summary?.todaySelfReported || 0,
          });
        }
      } catch (err) {
        console.error('Error fetching points:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPoints();
  }, [missionId, userId]);

  if (loading) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50 animate-pulse">
        <div className="h-12 bg-slate-700/50 rounded"></div>
      </div>
    );
  }

  const selfReportedCap = 100;
  const remaining = selfReportedCap - (data?.todaySelfReported || 0);

  return (
    <div className="bg-gradient-to-r from-slate-800/80 to-slate-800/50 rounded-xl p-3 border border-slate-700/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Total Points */}
          <div className="flex items-center gap-2">
            <Star className="text-flash-400" size={20} />
            <span className="text-2xl font-bold text-flash-400">{data?.caseTotal || 0}</span>
            <span className="text-xs text-slate-400">pts</span>
          </div>

          <div className="h-6 w-px bg-slate-600"></div>

          {/* Today's Breakdown */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <CheckCircle size={14} className="text-green-400" />
              <span className="text-sm font-medium text-green-400">{data?.todayVerified || 0}</span>
              <span className="text-xs text-slate-500">verified</span>
            </div>
            <div className="flex items-center gap-1">
              <Zap size={14} className="text-yellow-400" />
              <span className="text-sm font-medium text-yellow-400">{data?.todaySelfReported || 0}/100</span>
              <span className="text-xs text-slate-500">logged</span>
            </div>
          </div>
        </div>

        {/* Rank */}
        {data?.rank && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
            <Trophy size={14} className="text-yellow-400" />
            <span className="text-sm font-bold text-yellow-400">#{data.rank}</span>
          </div>
        )}
      </div>

      {remaining <= 20 && remaining > 0 && (
        <div className="mt-2 text-xs text-yellow-400 flex items-center gap-1">
          <AlertCircle size={12} />
          Only {remaining} self-reported points left today
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TASK CARD
// ============================================================================
function TaskCard({ task, onAction, actionLabel = 'Log' }) {
  const [loading, setLoading] = useState(false);

  const getPointsDisplay = () => {
    if (typeof task.basePoints === 'object') {
      return `${task.basePoints.call}–${task.basePoints.email} pts`;
    }
    return `${task.basePoints} pts`;
  };

  const getVerificationBadge = () => {
    switch (task.verificationMethod) {
      case 'GPS':
        return (
          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full flex items-center gap-1 border border-blue-500/30">
            <MapPin size={10} /> GPS
          </span>
        );
      case 'PHOTO':
        return (
          <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full flex items-center gap-1 border border-purple-500/30">
            <Camera size={10} /> Photo
          </span>
        );
      case 'PLATFORM_EMAIL':
        return (
          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1 border border-green-500/30">
            <Mail size={10} /> Verified
          </span>
        );
      default:
        return (
          <span className="text-xs bg-slate-600/50 text-slate-400 px-2 py-0.5 rounded-full border border-slate-500/30">
            Self-report
          </span>
        );
    }
  };

  const handleAction = async () => {
    setLoading(true);
    try {
      await onAction(task);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/30 hover:border-slate-600/50 transition">
      <div className="flex items-start gap-3">
        <div className="text-2xl">{task.icon}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-white font-medium">{task.displayName}</span>
          </div>
          <p className="text-slate-400 text-sm mb-2">{task.description}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {getVerificationBadge()}
            <span className="text-xs text-flash-400 font-medium">{getPointsDisplay()}</span>
          </div>
        </div>

        <button
          onClick={handleAction}
          disabled={loading}
          className="flex-shrink-0 px-3 py-2 bg-flash-500 hover:bg-flash-400 disabled:bg-slate-600 text-slate-900 font-bold text-sm rounded-lg transition flex items-center gap-1"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// CATEGORY SECTION
// ============================================================================
function CategorySection({ category, tasks, expanded, onToggle, onTaskAction, isOwner }) {
  const config = CATEGORY_CONFIG[category];
  if (!config) return null;

  // Filter tasks by pet type if needed
  const filteredTasks = tasks; // TODO: Filter by mission.petType

  return (
    <div className={`border rounded-xl overflow-hidden ${expanded ? config.borderColor : 'border-slate-700/50'}`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-4 transition ${expanded ? config.bgColor : 'bg-slate-800/30 hover:bg-slate-800/50'}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${config.bgColor} flex items-center justify-center text-xl`}>
            {config.emoji}
          </div>
          <div className="text-left">
            <div className="text-white font-semibold">{config.label}</div>
            <div className="text-xs text-slate-400">{config.description}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${config.color}`}>{filteredTasks.length}</span>
          {expanded ? (
            <ChevronUp className={config.color} size={20} />
          ) : (
            <ChevronDown className="text-slate-400" size={20} />
          )}
        </div>
      </button>

      {expanded && (
        <div className="p-3 space-y-2 bg-slate-900/50 border-t border-slate-700/30">
          {filteredTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onAction={onTaskAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SHELTER QUICK ACCESS
// ============================================================================
function ShelterQuickAccess({ missionId, onOpenShelters }) {
  const [shelterCount, setShelterCount] = useState({ total: 0, notContacted: 0 });

  useEffect(() => {
    if (!missionId) return;

    const fetchShelters = async () => {
      try {
        const res = await fetch(`/api/mission/${missionId}/shelters`);
        if (res.ok) {
          const data = await res.json();
          const shelters = data.shelters || [];
          setShelterCount({
            total: shelters.length,
            notContacted: shelters.filter(s => s.status === 'NOT_CONTACTED').length,
          });
        }
      } catch (err) {
        console.error('Error fetching shelters:', err);
      }
    };

    fetchShelters();
  }, [missionId]);

  return (
    <button
      onClick={onOpenShelters}
      className="w-full bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded-xl p-4 flex items-center justify-between transition"
    >
      <div className="flex items-center gap-3">
        <Building2 className="text-orange-400" size={24} />
        <div className="text-left">
          <div className="text-white font-semibold">Contact Shelters</div>
          <div className="text-orange-300/80 text-sm">
            {shelterCount.notContacted > 0
              ? `${shelterCount.notContacted} not contacted`
              : shelterCount.total > 0
                ? `${shelterCount.total} tracked`
                : 'Find nearby shelters'}
          </div>
        </div>
      </div>
      <ChevronDown className="text-orange-400 rotate-[-90deg]" size={20} />
    </button>
  );
}

// ============================================================================
// FLYER QUICK ACCESS
// ============================================================================
function FlyerQuickAccess({ missionId, onGenerateFlyer }) {
  return (
    <button
      onClick={onGenerateFlyer}
      className="w-full bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-xl p-4 flex items-center justify-between transition"
    >
      <div className="flex items-center gap-3">
        <FileText className="text-purple-400" size={24} />
        <div className="text-left">
          <div className="text-white font-semibold">Generate Flyer</div>
          <div className="text-purple-300/80 text-sm">Create printable PDF</div>
        </div>
      </div>
      <ChevronDown className="text-purple-400 rotate-[-90deg]" size={20} />
    </button>
  );
}

// ============================================================================
// LEADERBOARD
// ============================================================================
function Leaderboard({ missionId, userId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!missionId) return;

    const fetchLeaderboard = async () => {
      try {
        const res = await fetch(`/api/mission/${missionId}/points`);
        if (res.ok) {
          const data = await res.json();
          setEntries(data.leaderboard || []);
        }
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [missionId]);

  if (loading) {
    return (
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50 animate-pulse">
        <div className="h-20 bg-slate-700/50 rounded"></div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50 text-center">
        <Users className="text-slate-500 mx-auto mb-2" size={24} />
        <p className="text-slate-400 text-sm">No contributions yet</p>
      </div>
    );
  }

  const displayEntries = expanded ? entries : entries.slice(0, 3);

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 border-b border-slate-700/30"
      >
        <div className="flex items-center gap-2">
          <Trophy className="text-yellow-400" size={18} />
          <span className="text-white font-medium">Leaderboard</span>
          <span className="text-xs text-slate-500">({entries.length})</span>
        </div>
        {expanded ? (
          <ChevronUp className="text-slate-400" size={18} />
        ) : (
          <ChevronDown className="text-slate-400" size={18} />
        )}
      </button>

      <div className="divide-y divide-slate-700/30">
        {displayEntries.map(entry => (
          <div
            key={entry.userId}
            className={`flex items-center justify-between p-3 ${entry.userId === userId ? 'bg-flash-500/10' : ''}`}
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

// ============================================================================
// OTHER ACTIVITY MODAL
// ============================================================================
function OtherActivityModal({ isOpen, onClose, onSubmit, submitting }) {
  const [description, setDescription] = useState('');
  const [timeSpent, setTimeSpent] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!description.trim()) return;
    await onSubmit({ description, timeSpent: parseInt(timeSpent) || 0 });
    setDescription('');
    setTimeSpent('');
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl max-w-md w-full border border-slate-700 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="text-white font-semibold">Log Other Activity</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">What did you do?</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the activity..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-500 focus:border-flash-500 focus:outline-none resize-none"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Time spent (minutes, optional)</label>
            <input
              type="number"
              value={timeSpent}
              onChange={(e) => setTimeSpent(e.target.value)}
              placeholder="15"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-500 focus:border-flash-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="p-4 border-t border-slate-700">
          <button
            onClick={handleSubmit}
            disabled={submitting || !description.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-flash-500 hover:bg-flash-400 disabled:bg-slate-600 text-slate-900 font-bold rounded-lg transition"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
            Log Activity (+3 pts)
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN ACTIONS TAB
// ============================================================================
export default function ActionsTabV2({ mission, userId, isOwner, showNotification }) {
  const [expandedCategory, setExpandedCategory] = useState('OUTREACH');
  const [showOtherModal, setShowOtherModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Organize tasks by category
  const tasksByCategory = {
    SEARCH: [],
    OUTREACH: [],
    AT_HOME: [],
    OTHER: [],
  };

  Object.values(TASK_DEFINITIONS).forEach(task => {
    if (tasksByCategory[task.category]) {
      // Filter AT_HOME tasks for non-owners
      if (task.category === 'AT_HOME' && !isOwner) return;
      tasksByCategory[task.category].push(task);
    }
  });

  const handleTaskAction = async (task) => {
    // TODO: Open appropriate modal for task type
    showNotification?.({ type: 'info', message: `Opening ${task.displayName}...` });
  };

  const handleOtherSubmit = async (data) => {
    setSubmitting(true);
    try {
      // TODO: Submit to API
      showNotification?.({ type: 'success', message: '+3 points for logging activity!' });
      setShowOtherModal(false);
    } catch (err) {
      showNotification?.({ type: 'error', message: 'Failed to log activity' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenShelters = () => {
    // TODO: Open shelter modal
    showNotification?.({ type: 'info', message: 'Shelter finder opening...' });
  };

  const handleGenerateFlyer = () => {
    // TODO: Open flyer generator modal
    showNotification?.({ type: 'info', message: 'Flyer generator opening...' });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-4 pb-24">
        {/* Points Header */}
        <PointsHeader missionId={mission?.id} userId={userId} />

        {/* Quick Access: Shelters & Flyers */}
        <div className="grid grid-cols-2 gap-3">
          <ShelterQuickAccess missionId={mission?.id} onOpenShelters={handleOpenShelters} />
          <FlyerQuickAccess missionId={mission?.id} onGenerateFlyer={handleGenerateFlyer} />
        </div>

        {/* Task Categories */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-400">Tasks</h3>

          {Object.entries(tasksByCategory).map(([category, tasks]) => {
            if (tasks.length === 0) return null;
            if (category === 'OTHER') return null; // Handle separately

            return (
              <CategorySection
                key={category}
                category={category}
                tasks={tasks}
                expanded={expandedCategory === category}
                onToggle={() => setExpandedCategory(expandedCategory === category ? null : category)}
                onTaskAction={handleTaskAction}
                isOwner={isOwner}
              />
            );
          })}

          {/* Log Other Activity */}
          <button
            onClick={() => setShowOtherModal(true)}
            className="w-full flex items-center justify-between p-3 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/50 rounded-xl transition"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">✏️</span>
              <span className="text-slate-300 font-medium">Log Other Activity</span>
            </div>
            <span className="text-xs text-slate-500">+3 pts</span>
          </button>
        </div>

        {/* Leaderboard */}
        <Leaderboard missionId={mission?.id} userId={userId} />

        {/* Other Activity Modal */}
        <OtherActivityModal
          isOpen={showOtherModal}
          onClose={() => setShowOtherModal(false)}
          onSubmit={handleOtherSubmit}
          submitting={submitting}
        />
      </div>
    </div>
  );
}
