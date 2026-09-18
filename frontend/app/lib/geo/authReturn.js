/** Only navigable game pages can be a sign-in destination. */
export function safeReturnTo(value, fallback = '/geo/me') {
  if (typeof value !== 'string' || value.length > 1500 || /[\\\r\n]/.test(value)) return fallback;
  try {
    const url = new URL(value, 'https://game.invalid');
    if (!value.startsWith('/') || url.origin !== 'https://game.invalid') return fallback;
    if (url.pathname !== '/geo' && !url.pathname.startsWith('/geo/')) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
