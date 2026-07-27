/**
 * Per-case cascade activation SSE - lights up the "Recovery Kit" success
 * screen live as each action completes. Keyed on caseNumber (which exists the
 * instant the case does, unlike the mission stream's MissionControl record) and
 * guest-accessible (reporters have no session). Purely additive: the durable
 * CaseActivation/CaseAsset rows are the source of truth, so a dropped or
 * wrong-instance connection just falls back to the client's poll.
 *
 * In-memory Map = correct for a single dyno; documented redis pub/sub upgrade
 * for horizontal scale (see realtime.js note).
 */

export const cascadeConnections = new Map(); // caseNumber -> Set<controller>

export function broadcastActivation(caseNumber, event) {
  const set = cascadeConnections.get(caseNumber);
  if (!set || set.size === 0) return;
  const encoder = new TextEncoder();
  const message = encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
  set.forEach((controller) => {
    try {
      controller.enqueue(message);
    } catch {
      /* closed - cleaned up on abort */
    }
  });
}
