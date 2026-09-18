/** A pending local write is newer only if it was based on this exact cloud revision. */
export function selectSavedGame(local, cloud, accountId, revision, { adoptGuest = false } = {}) {
  if (!accountId) return local?.owner === null ? local : null;
  // The magic-link return tab may arrive before the original game has synced.
  // Only that explicit signup return may adopt a guest save into an empty account.
  if (adoptGuest && !cloud && revision === 0 && local?.owner === null) return local;
  if (local?.owner === accountId && local.pending && local.baseRevision === revision) return local;
  return cloud || (local?.owner === accountId && local.baseRevision === revision ? local : null);
}
