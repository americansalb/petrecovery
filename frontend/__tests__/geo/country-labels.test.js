/**
 * Country names have to stop landing on each other.
 *
 * The bug this covers is visible in one screenshot of the world at its
 * starting zoom: UNITED KINGDOM, GERMANY, FRANCE, ITALY and SPAIN all
 * written over the same corner of the map, EGYPT across SAUDI ARABIA,
 * KENYA across DEM. REP. CONGO. Every one of those anchors is correct.
 * Drawing all of them is what is wrong.
 */

import { chooseLabels, labelBox, LABEL_FONT } from '@/app/geo/lib/countryLabels';
import labelData from '@/app/lib/geo/data/country-labels.json';

// A flat projection, so a test can reason in degrees: 2 pixels per
// degree of longitude across a 720 by 360 map.
const flat = (width, height) => (lat, lng) => ({ x: (lng + 180) * (width / 360), y: (90 - lat) * (height / 180) });

const view = (rows, zoom, width = 720, height = 360) =>
  chooseLabels(rows, { zoom, project: flat(width, height), width, height });

describe('choosing which country names to draw', () => {
  test('two names in the same place: the more important one is drawn and the other is not', () => {
    const rows = [
      { n: 'France', x: 2, y: 47, z: 3 },
      { n: 'Switzerland', x: 8, y: 47, z: 4 },
    ];
    expect(view(rows, 4).map((row) => row.n)).toEqual(['France']);
  });

  test('the same two are both drawn once there is room for them', () => {
    const rows = [
      { n: 'France', x: 2, y: 47, z: 3 },
      { n: 'Switzerland', x: 8, y: 47, z: 4 },
    ];
    // Ten times the pixels per degree is ten times the gap.
    expect(view(rows, 4, 7200, 3600).map((row) => row.n).sort()).toEqual(['France', 'Switzerland']);
  });

  test('a name outside the viewport is not competing for space', () => {
    const rows = [
      { n: 'Fiji', x: 178, y: -17, z: 3 },
      { n: 'France', x: 2, y: 47, z: 3 },
    ];
    // A 100 pixel wide window over the Atlantic: Fiji is off the far side.
    const project = (lat, lng) => ({ x: (lng + 20) * 5, y: (60 - lat) * 5 });
    const kept = chooseLabels(rows, { zoom: 4, project, width: 100, height: 100 });
    expect(kept.map((row) => row.n)).toEqual(['France']);
  });

  test('the same view chooses the same names every time', () => {
    const rows = labelData.labels;
    const once = view(rows, 3).map((row) => row.n);
    const twice = view(rows, 3).map((row) => row.n);
    expect(once).toEqual(twice);
  });

  test('zoom bands still apply: a name below its zoom is never offered', () => {
    const rows = [{ n: 'Andorra', x: 1.5, y: 42.5, z: 6 }];
    expect(view(rows, 3)).toEqual([]);
    expect(view(rows, 6).map((row) => row.n)).toEqual(['Andorra']);
    expect(view(rows, 99)).toEqual([]);
  });

  test('nothing drawn overlaps anything else drawn', () => {
    const width = 1200;
    const height = 600;
    for (const zoom of [2, 3, 4, 5]) {
      const kept = view(labelData.labels, zoom, width, height);
      const project = flat(width, height);
      const boxes = kept.map((row) => labelBox(row, project(row.y, row.x), row.z <= 2 ? LABEL_FONT.big : LABEL_FONT.small));
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          const apart = a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top;
          expect({ zoom, a: kept[i].n, b: kept[j].n, apart }).toEqual({ zoom, a: kept[i].n, b: kept[j].n, apart: true });
        }
      }
    }
  });

  test('the real world at its starting zoom drops the European pile-up', () => {
    // 1200 by 600 is a laptop window. At zoom 2 the whole world is in
    // it, and western Europe cannot hold five names at once.
    const kept = view(labelData.labels, 2, 1200, 600).map((row) => row.n);
    // Three of the five survive and they do not touch, which is what a
    // map is supposed to look like: the other two arrive on zoom-in.
    const crowd = ['United Kingdom', 'Germany', 'France', 'Italy', 'Spain'].filter((name) => kept.includes(name));
    expect(crowd.length).toBeLessThan(5);
    // It still draws a world map, not an empty one.
    expect(kept.length).toBeGreaterThan(8);
  });

  test('bad input is empty, not a crash', () => {
    expect(chooseLabels(null, {})).toEqual([]);
    expect(chooseLabels([{ n: 'X', x: 0, y: 0, z: 1 }], {})).toEqual([]);
  });
});
