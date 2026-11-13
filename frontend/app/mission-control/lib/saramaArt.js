/**
 * Sarama, drawn: the search dog in her vest and headlamp, in the poses the
 * search screen uses.
 *
 * Founder, 2026-11-13: "You can redraw her using claude design and make
 * dynamic images". The one picture of her was a standing dog cropped to a
 * face, so she looked the same whether she was saying hello, sending
 * someone to an area or saying thank you. These are drawings made for the
 * size she is shown at, one for each thing she does:
 *
 *   sit    she is talking to you
 *   ask    she is asking you something (the debrief)
 *   point  she is sending you somewhere (an area, a sighting)
 *   sniff  she is searching (where to look)
 *   cheer  something is done
 *
 * Each pose is a string of SVG for a 160 by 160 box. The parts that move
 * carry a class (`sarama-tail`, `sarama-eyes`, `sarama-glow`, `sarama-nod`,
 * `sarama-hop`) and app/globals.css moves them; nothing
 * moves for anyone who has asked their device for less motion.
 *
 * The same drawings are on the design canvas, "Sarama, redrawn".
 */

export const SARAMA_POSES = Object.freeze(['sit', 'ask', 'point', 'sniff', 'cheer']);

const C = Object.freeze({
  line: '#3d1f0d',
  fur: '#b9652b',
  shade: '#8f4819',
  light: '#dfa468',
  nose: '#2a1509',
  vest: '#f1ee1f',
  stripe: '#e6eaef',
  stripeEdge: '#8d97a3',
  strap: '#f1ee1f',
  lamp: '#4b5563',
  lens: '#fff6bf',
  glow: '#fde047',
  mouth: '#6b1d14',
  tongue: '#f28b8b',
});

const OUT = `stroke="${C.line}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"`;

/** A leg, a neck or a tail: a thick round line with the outline round it. */
function limb(d, width, fill = C.fur) {
  return (
    `<path d="${d}" fill="none" stroke="${C.line}" stroke-width="${width + 5.2}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

/** A reflective stripe on the vest. */
function stripe(d, width = 5) {
  return (
    `<path d="${d}" fill="none" stroke="${C.stripeEdge}" stroke-width="${width + 2}" stroke-linecap="butt" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${C.stripe}" stroke-width="${width}" stroke-linecap="butt" stroke-linejoin="round"/>`
  );
}

function paw(cx, cy, rx = 9, ry = 5.5, fill = C.fur) {
  return (
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${OUT}/>` +
    `<path d="M ${cx - rx / 3} ${cy - 1} v ${ry - 1.5} M ${cx + rx / 3} ${cy - 1} v ${ry - 1.5}" fill="none" stroke="${C.line}" stroke-width="1.5" stroke-linecap="round"/>`
  );
}

/** A tail that wags about where it joins the body. */
function tail(d, at, width = 7, quick = false) {
  return `<g class="sarama-tail${quick ? ' sarama-quick' : ''}" style="transform-origin:${at[0]}px ${at[1]}px">${limb(d, width)}</g>`;
}

/**
 * Her head from the front, drawn round (0, 0): ears, skull, muzzle, eyes
 * and the headlamp with its light.
 */
function headFront({ happy = false, earUp = false } = {}) {
  const ear = (side) => {
    const s = side;
    const d = `M ${s * 20} -27 C ${s * 40} -30, ${s * 50} -6, ${s * 43} 14 C ${s * 39} 24, ${s * 29} 21, ${s * 27} 9 C ${s * 25} -2, ${s * 22} -12, ${s * 16} -20 Z`;
    const up = earUp && side > 0 ? ` transform="rotate(-38 ${s * 20} -24)"` : '';
    return `<path d="${d}" fill="${C.shade}" ${OUT}${up}/>`;
  };
  const eyes = happy
    ? `<path d="M -18 -6 C -16 -11, -10 -11, -8 -6 M 8 -6 C 10 -11, 16 -11, 18 -6" fill="none" stroke="${C.nose}" stroke-width="2.8" stroke-linecap="round"/>`
    : `<g class="sarama-eyes" style="transform-origin:0px -7px">` +
      `<ellipse cx="-13" cy="-7" rx="4.2" ry="5.2" fill="${C.nose}"/><ellipse cx="13" cy="-7" rx="4.2" ry="5.2" fill="${C.nose}"/>` +
      `<circle cx="-11.6" cy="-9" r="1.6" fill="#fff"/><circle cx="14.4" cy="-9" r="1.6" fill="#fff"/></g>` +
      `<path d="M -19 -16 C -16 -19, -11 -19, -8 -17 M 8 -17 C 11 -19, 16 -19, 19 -16" fill="none" stroke="${C.line}" stroke-width="1.6" stroke-linecap="round" opacity="0.55"/>`;
  const mouth = happy
    ? `<path d="M -10 15 C -7 29, 7 29, 10 15 Z" fill="${C.mouth}" ${OUT}/><path d="M -4.5 22 C -4.5 18, 4.5 18, 4.5 22 C 4.5 26.5, -4.5 26.5, -4.5 22 Z" fill="${C.tongue}"/>`
    : `<path d="M 0 10 V 15 M 0 15 C -3 20, -9 19, -11 15 M 0 15 C 3 20, 9 19, 11 15" fill="none" stroke="${C.line}" stroke-width="2" stroke-linecap="round"/>`;
  return (
    ear(-1) +
    ear(1) +
    `<path d="M 0 -35 C 22 -35, 33 -21, 32 -5 C 31 9, 25 19, 15 25 C 8 30, -8 30, -15 25 C -25 19, -31 9, -32 -5 C -33 -21, -22 -35, 0 -35 Z" fill="${C.fur}" ${OUT}/>` +
    `<path d="M -16 10 C -16 0, -8 -5, 0 -5 C 8 -5, 16 0, 16 10 C 16 21, 8 27.5, 0 27.5 C -8 27.5, -16 21, -16 10 Z" fill="${C.light}"/>` +
    mouth +
    `<path d="M -7 3 C -7 -2, 7 -2, 7 3 C 7 8, 2 11, 0 11 C -2 11, -7 8, -7 3 Z" fill="${C.nose}"/><ellipse cx="-2.2" cy="1.6" rx="2.2" ry="1.2" fill="#fff" opacity="0.45"/>` +
    eyes +
    `<path d="M -31 -15 C -16 -25, 16 -25, 31 -15 L 32 -8 C 16 -18, -16 -18, -32 -8 Z" fill="${C.strap}" ${OUT}/>` +
    `<circle class="sarama-glow" cx="0" cy="-25" r="19" fill="url(#sarama-light)"/>` +
    `<rect x="-9.5" y="-32" width="19" height="14" rx="4.5" fill="${C.lamp}" ${OUT}/><rect x="-6" y="-29" width="12" height="8" rx="3" fill="${C.lens}"/>`
  );
}

/** Her head from the side, looking right, drawn round (0, 0). */
function headSide() {
  const shape = 'M -19 2 C -21 -14, -7 -23, 6 -21 C 14 -20, 19 -15, 22 -9 L 38 -4 C 45 -2, 45 9, 38 11 L 22 14 C 14 21, 2 23, -8 19 C -15 16, -18 10, -19 2 Z';
  return (
    `<circle class="sarama-glow" cx="25" cy="-15" r="16" fill="url(#sarama-light)"/>` +
    `<path d="${shape}" fill="${C.fur}"/>` +
    `<path d="M 24 -3 L 38 -4 C 45 -2, 45 9, 38 11 L 24 13 C 20 8, 20 2, 24 -3 Z" fill="${C.light}"/>` +
    `<path d="${shape}" fill="none" ${OUT}/>` +
    `<ellipse cx="41" cy="1.5" rx="4.6" ry="4.2" fill="${C.nose}"/>` +
    `<path d="M 40 8 C 34 11.5, 28 11.5, 24 9" fill="none" stroke="${C.line}" stroke-width="1.8" stroke-linecap="round"/>` +
    `<ellipse cx="11" cy="-5" rx="3.4" ry="4.4" fill="${C.nose}"/><circle cx="12.2" cy="-6.8" r="1.3" fill="#fff"/>` +
    `<path d="M -19 -3 L 19 -16 L 22 -9 L -18 5 Z" fill="${C.strap}" ${OUT}/>` +
    `<rect x="17" y="-21" width="9" height="13" rx="3.5" fill="${C.lamp}" ${OUT} transform="rotate(-14 21 -14)"/><rect x="22.5" y="-18.5" width="3.4" height="8" rx="1.7" fill="${C.lens}" transform="rotate(-14 21 -14)"/>` +
    `<path d="M -9 -13 C -21 -11, -23 9, -15 21 C -9 27, -3 19, -3 9 C -3 0, -4 -8, -9 -13 Z" fill="${C.shade}" ${OUT}/>`
  );
}

/** Sitting, facing you. `up` raises both front paws for a cheer. */
function sitting({ up = false, happy = false, earUp = false, tilt = 0, quick = false } = {}) {
  const vest =
    `<path d="M 57 88 C 61 74, 71 68, 80 68 C 89 68, 99 74, 103 88 L 105 110 C 96 116, 64 116, 55 110 Z" fill="${C.vest}" ${OUT}/>` +
    stripe('M 63 80 L 80 106 L 97 80') +
    stripe('M 56 107 C 66 113, 94 113, 104 107', 4.5);
  const front = up
    ? limb('M 66 96 L 50 78', 12) + paw(47, 73, 8, 7) + limb('M 94 96 L 110 78', 12) + paw(113, 73, 8, 7)
    : limb('M 69 108 L 68 143', 12) + limb('M 91 108 L 92 143', 12) + paw(67, 146.5) + paw(93, 146.5);
  const body =
    tail('M 104 134 C 124 136, 138 124, 136 106', [104, 134], 7, quick) +
    `<ellipse cx="53" cy="127" rx="16" ry="19" fill="${C.fur}" ${OUT}/><ellipse cx="107" cy="127" rx="16" ry="19" fill="${C.fur}" ${OUT}/>` +
    paw(46, 146.5, 10, 5.5) +
    paw(114, 146.5, 10, 5.5) +
    `<path d="M 80 70 C 100 70, 108 92, 106 120 C 105 137, 96 147, 80 147 C 64 147, 55 137, 54 120 C 52 92, 60 70, 80 70 Z" fill="${C.fur}" ${OUT}/>` +
    (up ? `<path d="M 80 116 C 86 120, 88 130, 85 139 C 83 144, 77 144, 75 139 C 72 130, 74 120, 80 116 Z" fill="${C.light}"/>` + vest + front : front + vest);
  const head = `<g transform="translate(80 46) rotate(${tilt})">${headFront({ happy, earUp })}</g>`;
  return up ? `<g class="sarama-hop">${body}${head}</g>` : body + head;
}

/** Standing side on, looking right. `down` puts her nose to the ground. */
function standing({ down = false } = {}) {
  const farHind = limb('M 43 102 L 37 125 L 42 143', 9, C.shade) + paw(46, 146.5, 7.5, 4.8, C.shade);
  const farFront = limb(down ? 'M 89 102 L 91 143' : 'M 92 102 L 93 143', 9, C.shade) + paw(down ? 95 : 97, 146.5, 7.5, 4.8, C.shade);
  const nearHind = `<ellipse cx="38" cy="102" rx="12.5" ry="15.5" fill="${C.fur}" ${OUT}/>` + limb('M 35 113 L 27 129 L 32 143', 9.5) + paw(36, 146.5, 8, 5);
  // Pointing, she lifts the near front paw the way a dog does when it has found something.
  const nearFront = down ? limb('M 80 106 L 79 143', 10.5) + paw(83, 146.5, 8, 5) : limb('M 84 104 L 99 111 L 98 124', 10) + paw(98.5, 128, 6.5, 5.5);
  const torso = `<path d="M 26 90 C 26 77, 42 74, 58 76 C 72 76, 86 72, 94 80 C 101 88, 100 105, 90 111 C 78 117, 62 110, 48 113 C 36 115, 26 104, 26 90 Z" fill="${C.fur}" ${OUT}/>`;
  const vest =
    `<path d="M 62 76 C 73 74, 85 71, 93 78 C 101 87, 100 102, 91 110 C 83 115, 72 112, 63 111 C 59 100, 59 86, 62 76 Z" fill="${C.vest}" ${OUT}/>` +
    stripe('M 70 75 C 67 87, 67 100, 70 112', 4.5) +
    stripe('M 82 73 C 89 84, 91 98, 87 112', 4.5);
  const neck = down ? limb('M 88 92 C 96 95, 104 100, 110 106', 18) : limb('M 88 90 C 92 81, 94 73, 96 65', 18);
  const head = down
    ? `<g class="sarama-nod" style="transform-origin:98px 98px"><g transform="translate(112 107) rotate(35) scale(1.15)">${headSide()}</g></g>`
    : `<g transform="translate(96 51) rotate(-4) scale(1.26)">${headSide()}</g>`;
  const wag = down ? tail('M 28 86 C 19 74, 18 60, 24 48', [28, 86], 6.5, true) : tail('M 28 86 C 20 84, 13 80, 8 74', [28, 86], 6.5);
  return wag + farHind + farFront + neck + torso + nearHind + (down ? nearFront + vest : vest + nearFront) + head;
}

/** The light of her lamp: bright at the lens and gone at the edge, so it reads on a light card and a dark desk. */
const LIGHT = `<defs><radialGradient id="sarama-light"><stop offset="0" stop-color="${C.lens}" stop-opacity="0.95"/><stop offset="0.45" stop-color="${C.glow}" stop-opacity="0.55"/><stop offset="1" stop-color="${C.glow}" stop-opacity="0"/></radialGradient></defs>`;

function drawn(pose) {
  switch (pose) {
    case 'ask':
      return sitting({ tilt: 13, earUp: true });
    case 'point':
      return standing();
    case 'sniff':
      return standing({ down: true });
    case 'cheer':
      return sitting({ up: true, happy: true, quick: true });
    default:
      return sitting();
  }
}

/** The inside of the SVG for a pose (the box is 0 0 160 160). */
export function saramaArt(pose = 'sit') {
  return LIGHT + drawn(SARAMA_POSES.includes(pose) ? pose : 'sit');
}

export const SARAMA_BOX = '0 0 160 160';
