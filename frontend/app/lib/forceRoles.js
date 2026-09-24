/**
 * Rescue Force member roles, for checks that run on the server and in the
 * browser alike (no imports, so client components can use it).
 *
 * FORCE_COMMAND_ROLES run a search: founders, leaders and coordinators, and
 * the legacy names for the same jobs (RescueForceMemberRole in the schema).
 * The checks that use it used to ask for 'MODERATOR' and 'ADMIN', or for
 * 'DIVISION_LEAD', 'SQUAD_LEAD' and 'ADMIN'. None but MODERATOR is a force
 * role: Prisma rejected the query outright (a 500 for every force leader who
 * was not a platform admin or the pet's owner, from the mission command
 * center, the live search and "notify my force"), and nobody could post an
 * announcement.
 */
export const FORCE_COMMAND_ROLES = ['FOUNDER', 'LEADER', 'COORDINATOR', 'ADMINISTRATOR', 'MODERATOR', 'DIVISION_LEADER'];

/** How a role reads on the member pages. Legacy roles read as today's. */
export const FORCE_ROLE_LABEL = {
  FOUNDER: 'Founder',
  LEADER: 'Leader',
  ADMINISTRATOR: 'Leader',
  DIVISION_LEADER: 'Leader',
  COORDINATOR: 'Coordinator',
  MODERATOR: 'Coordinator',
  MEMBER: 'Member',
};

/**
 * "Kim L.": a member's name as the other members see it, the rule
 * /api/rescue-forces/[id]/members applies. Posts and comments used to show
 * the full surname, and chat printed "Kim ." when there was none.
 */
export function memberName(user) {
  const first = (user?.firstName || '').trim();
  const initial = (user?.lastName || '').trim().charAt(0).toUpperCase();
  return [first, initial && `${initial}.`].filter(Boolean).join(' ') || 'A member';
}
