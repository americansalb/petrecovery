/**
 * The sheet's texture: fine paper grain, drawn over the yellow at a few
 * percent so a flat fill reads as stock. One small greyscale tile, loaded
 * once from the file (like the fonts) and tiled by the renderers.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'app', 'lib', 'cascade', 'render', 'textures');
let grain = null;

/** The grain tile as a PNG data URL. */
export function grainDataUrl() {
  if (!grain) grain = `data:image/png;base64,${readFileSync(join(DIR, 'grain.png')).toString('base64')}`;
  return grain;
}

export const GRAIN_TILE = 200; // px, the tile's side
