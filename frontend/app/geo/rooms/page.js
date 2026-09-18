/**
 * /geo/rooms: the multiplayer room browser. Keeps the universal chrome;
 * the rooms themselves (/geo/room/<code>) are immersive.
 */

import RoomBrowser from '../components/rooms/RoomBrowser';

export default async function GeoRoomsPage({ searchParams }) {
  const params = await searchParams;
  return <RoomBrowser initialGame={params?.game} resumeRequest={params?.resumeRoom} />;
}
