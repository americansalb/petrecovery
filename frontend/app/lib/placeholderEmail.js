/**
 * Placeholder emails for phone-only reporters.
 *
 * `User.email` is required + unique, but a lost-pet reporter may only have a
 * phone. We synthesize a deterministic, undeliverable address from the phone
 * digits so the same phone always maps back to the same account. The
 * `.invalid` TLD is reserved (RFC 2606) and can never receive mail - every
 * email-send site must skip these addresses via isPlaceholderEmail().
 */

const PLACEHOLDER_EMAIL_DOMAIN = 'phone-only.invalid';

export function placeholderEmailForPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return `p${digits}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

export function isPlaceholderEmail(email) {
  return typeof email === 'string' && email.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
}
