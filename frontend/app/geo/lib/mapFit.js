/** Keep room for actual map content, even in a short mobile reveal drawer. */
export function revealMapPadding(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 32 || height < 32) return null;
  const side = Math.min(44, width * 0.1);
  return { paddingTopLeft: [side, Math.min(44, height * 0.1)], paddingBottomRight: [side, Math.min(230, height * 0.35)] };
}
