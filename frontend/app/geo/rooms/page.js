'use client';

/**
 * /geo/rooms: the multiplayer room browser. Keeps the universal chrome;
 * the rooms themselves (/geo/room/<code>) are immersive.
 */

import RoomBrowser from '../components/rooms/RoomBrowser';

export default function GeoRoomsPage() {
  return <RoomBrowser />;
}
