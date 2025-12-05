'use client';

/**
 * TeamTab - Team Management & Tasks
 *
 * Features preserved from original:
 * - GPS search tracking (start/stop)
 * - Team members list with active indicators
 * - Full 25-item task checklist with categories
 * - Task completion tracking
 * - Suggested next steps
 * - Custom action logging
 * - Progress tracking
 */

import { useState, useEffect } from 'react';
import {
  Navigation,
  Users,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

// Default tasks list - 25 items categorized
const DEFAULT_TASKS = [
  { id: 1, label: 'Search property & immediate area thoroughly', type: 'SEARCH_PROPERTY', completed: false, completions: [] },
  { id: 2, label: 'Alert neighbors & nearby residents', type: 'ALERT_NEIGHBORS', completed: false, completions: [] },
  { id: 3, label: 'Post flyers in the area', type: 'POST_FLYERS', completed: false, completions: [] },
  { id: 4, label: 'Set up food/water/scent station', type: 'SETUP_STATION', completed: false, completions: [] },
  { id: 5, label: 'Call local animal shelters', type: 'CALL_SHELTERS', completed: false, completions: [] },
  { id: 6, label: 'Visit local shelters in person', type: 'VISIT_SHELTERS', completed: false, completions: [] },
  { id: 7, label: 'Contact animal control', type: 'CONTACT_ANIMAL_CONTROL', completed: false, completions: [] },
  { id: 8, label: 'Call local veterinary offices', type: 'CALL_VETS', completed: false, completions: [] },
  { id: 9, label: 'Contact microchip company', type: 'CONTACT_MICROCHIP', completed: false, completions: [] },
  { id: 10, label: 'Post on social media & lost pet sites', type: 'POST_SOCIAL_MEDIA', completed: false, completions: [] },
  { id: 11, label: 'Contact local rescue groups', type: 'CONTACT_RESCUES', completed: false, completions: [] },
  { id: 12, label: 'Alert mail carriers & delivery drivers', type: 'ALERT_MAIL_CARRIERS', completed: false, completions: [] },
  { id: 13, label: 'Contact nearby businesses', type: 'CONTACT_BUSINESSES', completed: false, completions: [] },
  { id: 14, label: 'Search at dawn/dusk', type: 'SEARCH_DAWN_DUSK', completed: false, completions: [] },
  { id: 15, label: 'Walk area calling their name', type: 'WALK_CALLING', completed: false, completions: [] },
  { id: 16, label: 'Check hiding spots (sheds, garages)', type: 'CHECK_HIDING_SPOTS', completed: false, completions: [] },
  { id: 17, label: 'Search construction sites & dumpsters', type: 'SEARCH_CONSTRUCTION', completed: false, completions: [] },
  { id: 18, label: 'Set up humane trap', type: 'SETUP_TRAP', completed: false, completions: [] },
  { id: 19, label: 'Set up wildlife/security cameras', type: 'SETUP_CAMERAS', completed: false, completions: [] },
  { id: 20, label: 'Check found pet listings online', type: 'CHECK_FOUND_LISTINGS', completed: false, completions: [] },
  { id: 21, label: 'Monitor Craigslist & marketplace sites', type: 'MONITOR_MARKETPLACES', completed: false, completions: [] },
  { id: 22, label: 'File lost pet report with police', type: 'FILE_POLICE_REPORT', completed: false, completions: [] },
  { id: 23, label: 'Contact local dog parks & pet stores', type: 'CONTACT_PET_LOCATIONS', completed: false, completions: [] },
  { id: 24, label: 'Alert schools in the area', type: 'ALERT_SCHOOLS', completed: false, completions: [] },
  { id: 25, label: 'Contact breed-specific rescue groups', type: 'CONTACT_BREED_RESCUES', completed: false, completions: [] },
];

const CATEGORIES = [
  { id: 'immediate', name: 'Immediate', icon: '🚨', range: [0, 4] },
  { id: 'shelters', name: 'Shelters & Authorities', icon: '🏥', range: [4, 7] },
  { id: 'veterinary', name: 'Veterinary', icon: '💉', range: [7, 9] },
  { id: 'community', name: 'Community', icon: '👥', range: [9, 13] },
  { id: 'search', name: 'Search Operations', icon: '🔍', range: [13, 17] },
  { id: 'advanced', name: 'Advanced Tactics', icon: '🎯', range: [17, 19] },
  { id: 'online', name: 'Online & Documentation', icon: '💻', range: [19, 22] },
  { id: 'extended', name: 'Extended Outreach', icon: '🌟', range: [22, 25] },
];

export default function TeamTab({
  team = [],
  mission,
  tasks,
  setTasks,
  gpsPath = [],
  setGpsPath,
  isGPSTracking,
  setIsGPSTracking,
  expandedCategories,
  setExpandedCategories,
  selectedTask,
  setSelectedTask,
  showCustomActionModal,
  setShowCustomActionModal,
  showNotification,
  session,
}) {
  // Initialize tasks if empty
  useEffect(() => {
    if (!tasks || tasks.length === 0) {
      setTasks(DEFAULT_TASKS);
    } else if (tasks.length < 25) {
      // Upgrade tasks if we have an older version
      const upgradedTasks = DEFAULT_TASKS.map(newTask => {
        const oldTask = tasks.find(t => t.type === newTask.type);
        if (oldTask?.completed) {
          return { ...newTask, completed: oldTask.completed, completions: oldTask.completions || [] };
        }
        return newTask;
      });
      setTasks(upgradedTasks);
    }
  }, []);

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const startGPSTracking = () => {
    if (!('geolocation' in navigator)) {
      showNotification?.('error', 'GPS not available on this device');
      return;
    }
    setIsGPSTracking(true);
    setGpsPath([]);
    showNotification?.('info', 'GPS tracking started. Your search path is being recorded.');
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsPath(prev => [...prev, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: Date.now(),
        }]);
      },
      (error) => {
        console.error('GPS error:', error);
        setIsGPSTracking(false);
        showNotification?.('error', 'Unable to access GPS. Please check your location permissions.');
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    window._gpsWatchId = watchId;
  };

  const stopGPSTracking = () => {
    if (window._gpsWatchId) {
      navigator.geolocation.clearWatch(window._gpsWatchId);
      window._gpsWatchId = null;
    }
    setIsGPSTracking(false);
    if (gpsPath.length > 0) {
      showNotification?.('success', `Recorded ${gpsPath.length} GPS points. View your search path on the Map tab.`);
    }
  };

  const completedCount = tasks?.filter(t => t.completed).length || 0;
  const totalTasks = tasks?.length || 25;

  return (
    <div className="space-y-4 pb-20">
      {/* GPS Tracking Section */}
      <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-4">
        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
          <Navigation size={18} className="text-purple-400" />
          GPS Search Tracking
        </h3>
        {!isGPSTracking ? (
          <div className="space-y-2">
            <p className="text-slate-400 text-sm">
              Going out to search? Track your path so everyone knows which areas have been covered.
            </p>
            <button
              onClick={startGPSTracking}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:scale-105 transition shadow-lg shadow-purple-500/30"
            >
              Start GPS Tracking
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-purple-400">
              <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse" />
              <span className="font-semibold">Recording... {gpsPath.length} points</span>
            </div>
            <button
              onClick={stopGPSTracking}
              className="w-full py-3 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-bold rounded-xl hover:bg-emerald-500/30 transition"
            >
              ✓ Done Searching - Save My Path
            </button>
          </div>
        )}
      </div>

      {/* Team Members Section */}
      <div className="bg-slate-800/50 border border-flash-500/30 rounded-xl p-4">
        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
          <Users size={18} className="text-flash-400" />
          Search Team ({team.length})
        </h3>
        {team.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-slate-400 mb-2">No team members yet</p>
            <button className="px-4 py-2 bg-flash-500/20 border border-flash-500/50 text-flash-400 font-semibold rounded-lg text-sm hover:bg-flash-500/30 transition">
              + Invite Volunteers
            </button>
          </div>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {team.map(member => (
              <div key={member.id} className="flex items-center gap-3 p-2 bg-slate-900/50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-flash-500/20 flex items-center justify-center text-flash-400 font-bold text-sm">
                  {member.firstName?.[0]}{member.lastName?.[0] || ''}
                </div>
                <span className="text-white text-sm flex-1">{member.name}</span>
                {member.isActive && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-emerald-400 text-xs">Active</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions/Tasks Section */}
      <div className="bg-slate-800/50 border border-emerald-500/30 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-400" />
            Actions ({completedCount}/{totalTasks})
          </h3>
          <button
            onClick={() => setShowCustomActionModal(true)}
            className="px-3 py-1 bg-flash-500/20 border border-flash-500/50 text-flash-400 text-sm font-semibold rounded-lg hover:bg-flash-500/30 transition"
          >
            + Log Action
          </button>
        </div>

        {/* Overall Progress Bar */}
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all duration-300"
            style={{ width: `${(completedCount / totalTasks) * 100}%` }}
          />
        </div>

        {/* Suggested Next Steps */}
        {(() => {
          const incompleteTasks = tasks?.filter(t => !t.completed) || [];
          const suggestedTasks = incompleteTasks.slice(0, 3);
          if (suggestedTasks.length > 0) {
            return (
              <div className="mb-4 p-3 bg-flash-500/10 border border-flash-500/30 rounded-lg">
                <h4 className="text-sm font-bold text-flash-400 mb-2 flex items-center gap-2">
                  <Sparkles size={14} />
                  Suggested Next Steps
                </h4>
                <div className="space-y-1">
                  {suggestedTasks.map(task => (
                    <button
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className="w-full text-left p-2 rounded bg-slate-800/50 border border-slate-700 hover:bg-slate-800 hover:border-slate-600 transition flex items-center gap-2 text-sm"
                    >
                      <div className="w-4 h-4 rounded-full bg-slate-700 border border-slate-600 flex-shrink-0" />
                      <span className="flex-1 text-white truncate">{task.label}</span>
                      <ChevronRight size={14} className="text-slate-500" />
                    </button>
                  ))}
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* Categorized Tasks */}
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {CATEGORIES.map(category => {
            const categoryTasks = tasks?.slice(category.range[0], category.range[1]) || [];
            const completed = categoryTasks.filter(t => t.completed).length;
            const total = categoryTasks.length;
            const isExpanded = expandedCategories?.includes(category.id);
            const progressPercent = total > 0 ? (completed / total) * 100 : 0;

            return (
              <div key={category.id}>
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="w-full flex items-center justify-between p-2 bg-slate-900/30 hover:bg-slate-900/50 rounded-lg transition border border-slate-700/50"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown size={14} className="text-slate-400" />
                    ) : (
                      <ChevronRight size={14} className="text-slate-400" />
                    )}
                    <span className="text-sm">{category.icon}</span>
                    <span className="text-sm font-semibold text-white">{category.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{completed}/{total}</span>
                    <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-1 space-y-1 pl-4">
                    {categoryTasks.map(task => (
                      <button
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className={`w-full text-left p-2 rounded-lg flex items-center gap-2 transition text-sm ${
                          task.completed
                            ? 'bg-emerald-500/10 border border-emerald-500/30'
                            : 'bg-slate-900/50 border border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${
                          task.completed ? 'bg-emerald-500 text-white' : 'bg-slate-700 border border-slate-600'
                        }`}>
                          {task.completed && '✓'}
                        </div>
                        <span className={`flex-1 ${task.completed ? 'text-slate-500 line-through' : 'text-white'}`}>
                          {task.label}
                        </span>
                        {task.completions?.length > 0 && (
                          <span className="text-xs bg-flash-500/20 text-flash-400 px-1.5 py-0.5 rounded">
                            {task.completions.length}×
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
