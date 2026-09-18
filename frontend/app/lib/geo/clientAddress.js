/** Edge-compatible address selection shared by middleware and route limiters. */
export function clientAddress(request, env = process.env) {
  const trusted = String(env.RATELIMIT_TRUSTED_IP_HEADER || '').trim().toLowerCase();
  // Once a proxy header is configured, its absence must not silently restore
  // a client-controlled fallback. Misrouted requests share a conservative key.
  const raw = trusted ? request.headers.get(trusted)
    : request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for');
  const value = String(raw || '').split(',')[0].trim();
  return value && value.length <= 128 ? value : 'unknown';
}
