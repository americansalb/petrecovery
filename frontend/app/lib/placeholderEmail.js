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

/**
 * True for an address mail can be sent to. Not for a placeholder, and not
 * for the words "Not provided", which phone-only lost reports stored as
 * the case's ownerEmail: the cascade used to queue follow-up email to
 * that and record the recovery email as sent.
 */
export function isDeliverableEmail(email) {
  if (typeof email !== 'string') return false;
  const value = email.trim();
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value) && !isPlaceholderEmail(value);
}
