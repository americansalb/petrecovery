/**
 * rescue_force action (tier 0) — surface the rescue force(s) the create route
 * already assigned this case to, so the reporter can see the neighborhood
 * search team that's now on it. Read-only. SKIPPED (via the runner) when there
 * is no assignment.
 */

import prisma from '@/app/lib/prisma';

export async function runRescueForce(ctx) {
  const assignments = await prisma.caseAssignment.findMany({
    where: { missionId: ctx.case.id }, // CaseAssignment.missionId is @map("caseId")
    include: { rescueSquad: true },
  });

  const forces = [];
  for (const a of assignments) {
    const force = a.rescueSquad;
    if (!force) continue;
    let memberCount = null;
    try {
      memberCount = await prisma.rescueForceMember.count({ where: { rescueSquadId: force.id } });
    } catch {
      /* non-fatal */
    }
    forces.push({ id: force.id, name: force.name, city: force.city, memberCount });
  }

  // No assignment -> throw a soft signal so the runner records SKIPPED and the
  // card hides, rather than showing an empty "rescue force" item.
  if (forces.length === 0) {
    const err = new Error('No rescue force assigned');
    err.skip = true;
    throw err;
  }

  return { count: forces.length, result: { forces } };
}
