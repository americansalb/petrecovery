import { createHmac } from 'node:crypto';
import { getGeoServerConfig } from './config';

/** Stable per profile-backed seat, so a second signup tab cannot kick out the first. */
export function accountSeatToken(roomId, playerId, profileId) {
  return createHmac('sha256', getGeoServerConfig().tokenSecret)
    .update(`geo-account-seat:${roomId}:${playerId}:${profileId}`).digest('base64url');
}
