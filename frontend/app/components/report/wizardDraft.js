/**
 * Session-scoped draft persistence for the report wizards.
 *
 * Drafts hold plain field values (photo entries are stable CDN URLs, never
 * in-flight uploads) under one sessionStorage key per flow
 * (reportDraft:lost / reportDraft:found). Restoring is always an explicit
 * user choice — see DraftPrompt — never a silent prefill.
 */

export function loadDraft(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDraft(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* storage full/blocked — drafts are best-effort */
  }
}

export function clearDraft(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
