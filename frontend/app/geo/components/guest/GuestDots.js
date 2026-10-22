/**
 * The guest pass at a glance: one dot a game, green while it is still
 * to play. The same dots in the header, the menu and the end of a game,
 * so a guest learns the count once and reads it everywhere after.
 */
export default function GuestDots({ left = 0, limit = 3, size = 8 }) {
  const spent = Math.max(0, limit - left);
  return (
    <span className="pe-guest-dots" aria-hidden="true">
      {Array.from({ length: limit }, (_, i) => (
        <span key={i} data-left={i >= spent ? '' : undefined} style={{ width: size, height: size }} />
      ))}
    </span>
  );
}
