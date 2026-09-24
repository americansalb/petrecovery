/**
 * Every page of one Rescue Force. Members (and platform admins) get the
 * force's tabs under the navbar; everyone else sees the public page alone.
 * The global navbar itself never changes (CLAUDE.md): these are subtabs,
 * anchored below it with sticky top-16.
 */

import { getForceViewer } from '@/app/lib/forceViewer';
import ForceTabs from './ForceTabs';

export default async function ForceLayout({ children, params }) {
  const { id } = await params;
  const viewer = await getForceViewer(id);
  const showTabs = Boolean(viewer.force && (viewer.membership || viewer.isAdmin));
  return (
    <>
      {showTabs && <ForceTabs forceId={id} isLeader={viewer.isLeader || viewer.isAdmin} />}
      {children}
    </>
  );
}
