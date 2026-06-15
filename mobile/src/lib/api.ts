/**
 * The data connection — the "same body".
 *
 * The app talks to the exact backend the website uses, so accounts, pets,
 * cases, and everything else are one shared source of truth: add a pet in the
 * app and it's on the website instantly, and vice versa.
 *
 * Override the base URL for local testing via app.json → expo.extra.apiBaseUrl.
 */
import Constants from 'expo-constants';

export const API_BASE_URL =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ||
  'https://www.reunitepets.org';

let authToken: string | null = null;

/** Set after login so requests are authenticated; cleared on logout. */
export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {}),
    },
  });

  const body = await res.text();
  const data = body ? JSON.parse(body) : null;

  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body?: unknown) =>
    request(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: (path: string, body?: unknown) =>
    request(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
};
