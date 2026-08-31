/**
 * Server-side fetch of the live joint-letter document for /rasuwa/letter.
 *
 * The coordinating family keeps the letter and the list of the missing
 * in a link-shared Google Doc; its plain-text export needs no key or
 * owner action. The page that calls this is ISR-revalidated, so the
 * site serves a mirror that refreshes itself every few minutes; when
 * the fetch fails, the page falls back to linking the document
 * directly. Public document, no visitor data involved.
 */

import { JOINT_LETTER_DOC_ID } from './letterData';

const MAX_BYTES = 800000;

export async function fetchJointLetterText() {
  try {
    const res = await fetch(
      `https://docs.google.com/document/d/${JOINT_LETTER_DOC_ID}/export?format=txt`,
      {
        redirect: 'follow',
        signal: AbortSignal.timeout(9000),
        // Next caches this fetch for five minutes, so the page stays a
        // cached mirror: visitors read the cache, not Google, and the
        // document refreshes on the next request after the window.
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) return null;
    const raw = await res.text();
    if (!raw || raw.length > MAX_BYTES) return null;
    // An auth or interstitial page instead of the export means the doc
    // is not link-shared any more; treat it as unavailable.
    if (/<html|<head|accounts\.google\.com/i.test(raw.slice(0, 400))) return null;
    return normalizeJointLetterText(raw);
  } catch {
    return null;
  }
}

/** Export text into renderable paragraphs: BOM off, CRLF folded, blank-line splits. */
export function normalizeJointLetterText(raw) {
  const text = String(raw || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!text) return null;
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paragraphs.length ? paragraphs : null;
}
