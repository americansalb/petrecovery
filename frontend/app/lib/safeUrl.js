/**
 * A web address that is safe to put in a link.
 *
 * A shelter's website, and the social pages on its profile, are stored as
 * whatever was sent, and the pages show them as `<a href>`. An address
 * that starts `javascript:` or `data:` is not a place on the web: opened,
 * it runs in this site's own page. So what is kept and what is linked is
 * an http or https address, and anything else is no address at all.
 */

export const WEB_URL_MAX = 500;

/** The address as written out by the URL parser when it is http(s) and of a sensible length, or null. */
export function safeWebUrl(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.length > WEB_URL_MAX) return null;
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  // A name and a password in the address are for getting past a reader, not for getting to a site.
  if (url.username || url.password) return null;
  return url.toString();
}
