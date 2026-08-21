/**
 * Next.js boot hook - runs once per server process, before any request.
 *
 * Used for the checks that should fail loudly at startup rather than silently
 * at 3am. Today that is one thing: whether production has anywhere to send an
 * exception. Add other boot assertions here rather than scattering them
 * through route modules.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { assertProductionErrorSink } = await import('./app/lib/errorTracking');
  assertProductionErrorSink();
}
