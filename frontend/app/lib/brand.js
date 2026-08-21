/**
 * What this thing is called, in one place.
 *
 * The site was PetRecovery before it was ReunitePets, and the old name
 * was still reaching people: seven email footers, four SMS messages, the
 * STOP/START/HELP replies carriers require, the siteName in every search
 * result and social card, and the From name on any email sent over SMTP.
 * Someone reporting a lost dog on reunitepets.org got a text from
 * "PetRecovery" and had no reason to trust it.
 *
 * Import from here rather than typing the name into a template.
 */

export const SITE_NAME = 'ReunitePets';
export const SITE_DOMAIN = 'reunitepets.org';
export const SITE_URL = 'https://www.reunitepets.org';

/**
 * Contact of record. Overridable because the mailbox moves before the
 * code does; the default stays what the legal pages already promise.
 */
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@petrecovery.org';

/**
 * Identifies us to third-party APIs that require it, notably Nominatim,
 * whose usage policy asks for a contactable address.
 */
export const USER_AGENT = `${SITE_NAME} (${SUPPORT_EMAIL})`;
