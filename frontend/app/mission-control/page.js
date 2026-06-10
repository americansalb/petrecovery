'use client';

/**
 * Mission Control Page
 *
 * One mission, three instruments: the device-aware MissionShell
 * renders a command center on desktop, the field unit in the native
 * app, and the bridge on mobile web. The map is the mission.
 */

import MissionShell from './MissionShell';

export default function MissionControl() {
  return <MissionShell />;
}
