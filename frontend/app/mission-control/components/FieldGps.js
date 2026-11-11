'use client';

/**
 * The GPS walk, for the app only.
 *
 * One mission, three instruments (app/hooks/useInstrument.js): a desk
 * plans, a phone browser reports and takes a street, and the app walks
 * with GPS. A browser cannot record a walk with the screen off, so only
 * the app mounts this. It hands the screen three things: whether a walk
 * is recording, how to start one, how to end it. Starting needs an
 * account, because the path is kept in that person's name.
 */
import { useEffect } from 'react';
import useSearchLeg from '../hooks/useSearchLeg';

export default function FieldGps({ caseId, lastSeen, onChange }) {
  const leg = useSearchLeg(caseId, lastSeen);
  const { isSearching, startLeg, endLeg, path } = leg;
  useEffect(() => {
    onChange({ recording: isSearching, start: startLeg, stop: endLeg, path });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSearching, path?.length]);
  useEffect(() => () => onChange(null), [onChange]);
  return null;
}
