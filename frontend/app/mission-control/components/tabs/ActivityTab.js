'use client';

/**
 * ActivityTab - Full Activity Timeline
 *
 * Features preserved from original:
 * - Unified timeline from sightings, tasks, and GPS searches
 * - Detailed who/what/when for each activity
 * - Clickable items to navigate to map locations
 * - Task-specific detail rendering (shelters, flyers, social media, etc.)
 * - Empty state handling
 */

import { Activity as ActivityIcon } from 'lucide-react';

export default function ActivityTab({
  sightings = [],
  tasks = [],
  gpsPath = [],
  onLocationClick,
}) {
  // Build unified timeline from all activities
  const buildTimeline = () => {
    const items = [];

    // Add sightings
    sightings.forEach(s => {
      items.push({
        type: 'sighting',
        timestamp: new Date(s.sightedAt || s.createdAt).getTime(),
        data: s
      });
    });

    // Add task completions
    tasks.forEach(task => {
      task.completions?.forEach(completion => {
        items.push({
          type: 'task',
          timestamp: new Date(completion.completedAt).getTime(),
          data: { ...completion, task }
        });
      });
    });

    // Add GPS search if exists
    if (gpsPath && gpsPath.length > 0) {
      const startTime = gpsPath[0].timestamp;
      const endTime = gpsPath[gpsPath.length - 1].timestamp;
      items.push({
        type: 'gps_search',
        timestamp: startTime,
        data: { startTime, endTime, pointCount: gpsPath.length, path: gpsPath }
      });
    }

    // Sort by timestamp (newest first)
    return items.sort((a, b) => b.timestamp - a.timestamp);
  };

  const timelineItems = buildTimeline();

  // Helper to extract location from sighting
  const getSightingLocation = (s) => {
    if (s.latitude && s.longitude) {
      return { lat: s.latitude, lng: s.longitude, label: 'Sighting', description: s.address };
    }
    return null;
  };

  // Helper to extract first location from task
  const getTaskLocation = (details) => {
    if (!details) return null;

    // Check multi-location GPS fields
    if (details.flyerLocations?.length > 0) {
      const loc = details.flyerLocations[0];
      return { lat: loc.lat, lng: loc.lng, label: 'Flyer Location', description: loc.description };
    }
    if (details.areasGPS?.length > 0) {
      const loc = details.areasGPS[0];
      return { lat: loc.lat, lng: loc.lng, label: 'Search Area', description: loc.description };
    }
    if (details.searchGPS?.length > 0) {
      const loc = details.searchGPS[0];
      return { lat: loc.lat, lng: loc.lng, label: 'Search Point', description: loc.description };
    }
    // Check single-location GPS fields
    if (details.stationGPS) {
      return { lat: details.stationGPS.lat, lng: details.stationGPS.lng, label: 'Station', description: details.stationLocation };
    }
    if (details.trapGPS) {
      return { lat: details.trapGPS.lat, lng: details.trapGPS.lng, label: 'Trap', description: details.trapLocation };
    }
    if (details.cameraGPS) {
      return { lat: details.cameraGPS.lat, lng: details.cameraGPS.lng, label: 'Camera', description: details.cameraLocation };
    }
    return null;
  };

  const renderTimelineItem = (item, index) => {
    const timestamp = new Date(item.timestamp);

    switch (item.type) {
      case 'sighting':
        const s = item.data;
        const sightingLocation = getSightingLocation(s);
        return (
          <div
            key={`sighting-${index}`}
            onClick={() => sightingLocation && onLocationClick?.(sightingLocation)}
            className={`bg-slate-800/50 rounded-xl p-4 border border-amber-500/30 hover:border-amber-500/50 transition ${sightingLocation ? 'cursor-pointer hover:bg-slate-800/70' : ''}`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 text-xl">
                👁
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-amber-400 font-bold">Sighting Reported</span>
                    {sightingLocation && (
                      <span className="text-xs text-flash-400">Click to view on map →</span>
                    )}
                  </div>
                  <span className="text-slate-500 text-xs whitespace-nowrap">
                    {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-slate-300 text-sm mb-2">{s.description || 'Sighting reported'}</p>
                {s.address && (
                  <p className="text-slate-500 text-xs mb-2">📍 {s.address}</p>
                )}
                {s.confidence && (
                  <span className={`inline-block text-xs px-2 py-1 rounded font-semibold ${
                    s.confidence === 'HIGH' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' :
                    s.confidence === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' :
                    'bg-slate-500/20 text-slate-400 border border-slate-500/50'
                  }`}>
                    {s.confidence} confidence
                  </span>
                )}
              </div>
            </div>
          </div>
        );

      case 'task':
        const { task, taskType, details, completedBy } = item.data;
        const taskLocation = details ? getTaskLocation(details) : null;
        return (
          <div
            key={`task-${index}`}
            onClick={() => taskLocation && onLocationClick?.(taskLocation)}
            className={`bg-slate-800/50 rounded-xl p-4 border border-emerald-500/30 hover:border-emerald-500/50 transition ${taskLocation ? 'cursor-pointer hover:bg-slate-800/70' : ''}`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 text-xl">
                ✓
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-emerald-400 font-bold">{task?.label || 'Task Completed'}</span>
                      {taskLocation && (
                        <span className="text-xs text-flash-400">Click to view on map →</span>
                      )}
                    </div>
                    {completedBy && (
                      <p className="text-slate-400 text-xs mt-1">
                        👤 {completedBy.name || completedBy.email || 'Team member'}
                      </p>
                    )}
                  </div>
                  <span className="text-slate-500 text-xs whitespace-nowrap">
                    {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Render task-specific details */}
                {details && (taskType === 'CALL_SHELTERS' || taskType === 'VISIT_SHELTERS') && (
                  <div className="space-y-1 text-sm">
                    {details.shelterName && <p className="text-white">🏥 <strong>{details.shelterName}</strong></p>}
                    {details.shelterResult && (
                      <p className="text-slate-300">
                        {details.shelterResult === 'POSSIBLE_MATCH' ? '🎉 They might have them!' :
                         details.shelterResult === 'VISITED' ? '✓ Visited in person - no match yet' :
                         details.shelterResult === 'CALLED' ? '📞 Called - no match yet' :
                         details.shelterResult === 'LEFT_INFO' ? '📝 Left contact info' : details.shelterResult}
                      </p>
                    )}
                    {details.shelterContact && <p className="text-slate-400 text-xs">Contact: {details.shelterContact}</p>}
                    {details.notes && <p className="text-slate-400 text-xs mt-2">{details.notes}</p>}
                  </div>
                )}

                {details && taskType === 'POST_FLYERS' && (
                  <div className="space-y-1 text-sm">
                    {details.flyerLocations?.length > 0 && (
                      <div>
                        <p className="text-white">📍 Posted at {details.flyerLocations.length} location{details.flyerLocations.length !== 1 ? 's' : ''}:</p>
                        {details.flyerLocations.map((loc, i) => (
                          <p key={i} className="text-slate-300 text-xs ml-4">• {loc.description || 'Flyer posted'}</p>
                        ))}
                      </div>
                    )}
                    {details.notes && <p className="text-slate-400 text-xs mt-2">{details.notes}</p>}
                  </div>
                )}

                {details && taskType === 'POST_SOCIAL_MEDIA' && (
                  <div className="space-y-1 text-sm">
                    {details.platform && <p className="text-white">📱 Posted on <strong>{details.platform}</strong></p>}
                    {details.postUrl && (
                      <a href={details.postUrl} target="_blank" rel="noopener noreferrer" className="text-flash-400 hover:text-flash-300 text-xs underline block">
                        View post →
                      </a>
                    )}
                    {details.notes && <p className="text-slate-400 text-xs mt-2">{details.notes}</p>}
                  </div>
                )}

                {details && taskType === 'SEARCH_PROPERTY' && (
                  <div className="space-y-1 text-sm">
                    {details.areasChecked && <p className="text-slate-300">🔍 {details.areasChecked}</p>}
                    {details.notes && <p className="text-slate-400 text-xs mt-2">{details.notes}</p>}
                  </div>
                )}

                {/* Generic notes for other task types */}
                {details && details.notes && !['CALL_SHELTERS', 'VISIT_SHELTERS', 'POST_FLYERS', 'POST_SOCIAL_MEDIA', 'SEARCH_PROPERTY'].includes(taskType) && (
                  <p className="text-slate-300 text-sm">{details.notes}</p>
                )}
              </div>
            </div>
          </div>
        );

      case 'gps_search':
        const { startTime, endTime, pointCount } = item.data;
        const duration = Math.round((endTime - startTime) / 60000); // minutes
        return (
          <div key={`gps-${index}`} className="bg-slate-800/50 rounded-xl p-4 border border-purple-500/30 hover:border-purple-500/50 transition">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 text-xl">
                📍
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-purple-400 font-bold">Area Searched (GPS Tracked)</span>
                  <span className="text-slate-500 text-xs">
                    {new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-slate-300 text-sm">
                  Searched for {duration} minute{duration !== 1 ? 's' : ''} • {pointCount} GPS points recorded
                </p>
                <p className="text-slate-400 text-xs mt-1">View the purple path on the Map tab to see where they searched</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-3 pb-20">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <ActivityIcon size={20} className="text-flash-400" />
        Search Activity Timeline
      </h3>

      {timelineItems.length === 0 ? (
        <div className="text-center py-12 text-slate-400 bg-slate-800/30 rounded-xl border border-slate-700/50">
          <ActivityIcon size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-white font-semibold mb-2">No Activity Yet</p>
          <p className="text-sm px-4">
            As people complete tasks, report sightings, and search areas,
            everything will show up here with all the details.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {timelineItems.map((item, index) => renderTimelineItem(item, index))}
        </div>
      )}
    </div>
  );
}
