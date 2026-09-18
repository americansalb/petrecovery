import { isDeepStrictEqual } from 'node:util';

/** JSONB does not preserve object key order. Arrays and values still must match. */
export function sameSavedCheckpoint(a, b) {
  return Boolean(a && b && a.kind === b.kind && a.url === b.url
    && isDeepStrictEqual(a.snapshot, b.snapshot));
}
