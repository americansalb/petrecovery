import { accountFromRequest } from './identity';
import { hashToken } from './rooms';

/** A cached seat is not permission to act as a different signed-in account. */
export async function roomTokenForAccount(store, request, code, token) {
  if (!token) return '';
  const { accountId } = accountFromRequest(request);
  if (!accountId) return null;
  const account = await store.getAccountById(accountId);
  if (!account || account.suspendedAt) return null;
  const room = await store.getRoomByCode(code);
  const player = room?.players.find((entry) => entry.tokenHash === hashToken(token) && !entry.leftAt);
  // Missing rooms/tokens retain the service's existing 404/401 behavior.
  if (!player) return token;
  // Pre-account rooms can finish with their original bearer seat, but even
  // those actions now require a live account. New seats are profile-bound.
  if (!player.profileId) return token;
  const profile = await store.getProfileByAccountId(accountId);
  return profile?.id === player.profileId ? token : null;
}
