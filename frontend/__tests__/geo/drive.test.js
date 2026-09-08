/**
 * Kidnapped mode's driver (app/geo/lib/drive.js): straight on where it
 * can, a bend when the road bends, never back unless the road ends.
 */

const { pickLink, angleDiff, normalizeHeading, DRIVE_STEP_MS } = require('@/app/geo/lib/drive');

describe('the driver', () => {
  const link = (pano, heading) => ({ pano, heading });

  test('takes the link closest to the direction of travel', () => {
    const links = [link('back', 180), link('left', 275), link('on', 5), link('right', 80)];
    expect(pickLink(links, 0).pano).toBe('on');
    expect(pickLink(links, 90).pano).toBe('right');
    expect(pickLink(links, 300).pano).toBe('left');
  });

  test('follows a bend rather than turning back, and turns around only at a dead end', () => {
    expect(pickLink([link('back', 180), link('bend', 95)], 0).pano).toBe('bend');
    expect(pickLink([link('back', 180), link('sharp', 110)], 0).pano).toBe('back');
    expect(pickLink([link('back', 178)], 0).pano).toBe('back');
    expect(pickLink([], 0)).toBeNull();
    expect(pickLink(null, 0)).toBeNull();
    expect(pickLink([{ heading: 0 }, link('ok', 350)], 0).pano).toBe('ok');
  });

  test('angles wrap around north', () => {
    expect(angleDiff(10, 350)).toBe(20);
    expect(angleDiff(350, 10)).toBe(-20);
    expect(angleDiff(180, 0)).toBe(180);
    expect(normalizeHeading(-30)).toBe(330);
    expect(normalizeHeading(725)).toBe(5);
    expect(DRIVE_STEP_MS).toBeGreaterThan(500);
  });
});
