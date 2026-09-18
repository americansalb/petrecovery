/** Sign-in tokens must never be emailed to a host supplied by an attacker. */
export function geoAuthOrigin(candidate, env = process.env) {
  const trusted = new Set([
    'https://probablyearth.com', 'https://www.probablyearth.com',
    'https://reunitepets.org', 'https://www.reunitepets.org',
  ]);
  let fallback = 'https://probablyearth.com';
  for (const configured of [env.NEXT_PUBLIC_BASE_URL, env.GEO_AUTH_ORIGIN]) {
    try {
      const url = new URL(configured);
      if (url.protocol === 'https:' && !url.username && !url.password) {
        trusted.add(url.origin);
        if (configured === env.GEO_AUTH_ORIGIN) fallback = url.origin;
      }
    } catch { /* An unset or invalid setting does not trust arbitrary hosts. */ }
  }
  try {
    const url = new URL(candidate);
    if (url.username || url.password) return fallback;
    if (trusted.has(url.origin)) return url.origin;
    if (env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      && ['http:', 'https:'].includes(url.protocol)) return url.origin;
  } catch { /* Use the canonical site. */ }
  return fallback;
}
