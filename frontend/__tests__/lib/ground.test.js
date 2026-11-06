/**
 * The ground under the flyers and share images (app/lib/cascade/render/ground.js):
 * the rays from behind the photo and the caution stripes, cut to the sheet.
 */

jest.mock('@/app/lib/cascade/render/photo', () => ({ __esModule: true, getSharp: jest.fn(async () => null) }));

import { GROUND, LIGHT, clipToRect, rayPolygons, stripePolygons, bands, groundSvg, groundOverlayDataUrl } from '@/app/lib/cascade/render/ground';

const inside = (poly, { x = 0, y = 0, w, h }) => poly.every(([px, py]) => px >= x - 1e-6 && px <= x + w + 1e-6 && py >= y - 1e-6 && py <= y + h + 1e-6);
const area = (poly) => Math.abs(poly.reduce((a, [x, y], i) => a + x * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * y, 0) / 2);

describe('clipToRect', () => {
  test('a polygon inside the rectangle is left as it is', () => {
    const tri = [[10, 10], [50, 10], [30, 40]];
    expect(clipToRect(tri, { w: 100, h: 100 })).toEqual(tri);
  });

  test('a polygon crossing the edge is cut at it', () => {
    const cut = clipToRect([[-50, 20], [50, 20], [50, 60], [-50, 60]], { w: 100, h: 100 });
    expect(inside(cut, { w: 100, h: 100 })).toBe(true);
    expect(area(cut)).toBeCloseTo(50 * 40, 5);
  });

  test('a polygon outside it is gone', () => {
    expect(clipToRect([[200, 200], [300, 200], [250, 300]], { w: 100, h: 100 })).toEqual([]);
  });
});

describe('rayPolygons', () => {
  test('every other wedge around the centre, each cut to the sheet, together half of it', () => {
    const rays = rayPolygons({ w: 612, h: 792, cx: 306, cy: 170 });
    expect(rays).toHaveLength(GROUND.rayCount / 2);
    expect(rays.every((p) => inside(p, { w: 612, h: 792 }))).toBe(true);
    const covered = rays.reduce((a, p) => a + area(p), 0);
    expect(covered / (612 * 792)).toBeCloseTo(0.5, 1);
  });

  test('the centre can sit off the sheet, for a photo at its edge', () => {
    const rays = rayPolygons({ w: 400, h: 300, cx: 0, cy: 0 });
    expect(rays.length).toBeGreaterThan(0);
    expect(rays.every((p) => inside(p, { w: 400, h: 300 }))).toBe(true);
  });
});

describe('stripePolygons and bands', () => {
  test('the stripes lean across the band and cover half of it, inside it', () => {
    const s = 12;
    const stripes = stripePolygons({ w: 612, y: 780, s });
    expect(stripes.every((p) => inside(p, { y: 780, w: 612, h: s }))).toBe(true);
    const covered = stripes.reduce((a, p) => a + area(p), 0);
    expect(covered / (612 * s)).toBeCloseTo(0.5, 1);
  });

  test('a band at the head, and at the foot unless the foot is taken', () => {
    expect(bands({ h: 792, s: 12 })).toEqual([{ y: 0, s: 12 }, { y: 780, s: 12 }]);
    expect(bands({ h: 792, s: 12, foot: false })).toEqual([{ y: 0, s: 12 }]);
    expect(bands({ h: 396, top: 396, s: 7 })).toEqual([{ y: 396, s: 7 }, { y: 785, s: 7 }]);
  });
});

describe('groundSvg', () => {
  test('one SVG the size of the image: the rays faint in ink, the bands in the brand yellow with ink stripes', () => {
    const svg = groundSvg({ w: 1200, h: 630, cx: 316, cy: 315, band: 16 });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">')).toBe(true);
    expect(svg).toContain(`fill="${GROUND.ink}" fill-opacity="${GROUND.rayOpacity}"`);
    expect(svg).toContain(`<rect x="0" y="0" width="1200" height="16" fill="${GROUND.yellow}"/>`);
    expect(svg).toContain(`<rect x="0" y="614" width="1200" height="16" fill="${GROUND.yellow}"/>`);
    expect((svg.match(/<polygon /g) || []).length).toBeGreaterThan(GROUND.rayCount / 2 + 2 * (1200 / 32));
    expect(groundSvg({ w: 100, h: 100, cx: 50, cy: 50, band: 10, foot: false })).not.toContain('y="90"');
  });

  test('the lit gradient runs from the lemon centre through the brand yellow to amber', () => {
    expect(LIGHT.map(([o]) => o)).toEqual([0, 0.42, 1]);
    expect(LIGHT[1][1]).toBe(GROUND.yellow);
    expect(LIGHT[0][1]).toBe(GROUND.lemon);
    expect(LIGHT[2][1]).toBe(GROUND.amber);
  });
});

describe('groundOverlayDataUrl', () => {
  test('without sharp there is no overlay, and the sheet is the lit yellow and grain', async () => {
    await expect(groundOverlayDataUrl({ w: 100, h: 100, cx: 50, cy: 50, band: 10 })).resolves.toBeNull();
  });
});
