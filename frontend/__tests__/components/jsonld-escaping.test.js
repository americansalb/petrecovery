/**
 * The JSON-LD escaping in OpenGraphMeta.js.
 *
 * That component embeds structured data in an inline <script>, so any
 * user-controlled field (a pet's name, an address) that contains
 * </script> would break out of the tag - stored XSS on the public case
 * page. The escaping chain neutralises <, >, & and the two Unicode line
 * separators, which are valid in JSON strings but terminate a line in
 * JavaScript.
 *
 * The last two .replace() calls used to contain RAW U+2028 and U+2029
 * characters inside their regex literals. A raw line separator inside a
 * regex ends the line as far as a strict parser is concerned: ESLint
 * reported "Unterminated regular expression", and plain `node` refuses to
 * load a file written that way. SWC tolerated it, which is the only
 * reason the build passed and nobody noticed. They are \u escapes now.
 *
 * This test pins both halves: the source must not carry the literal
 * characters again, and the chain must still neutralise everything.
 */

const fs = require('fs');
const path = require('path');

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

const SOURCE = fs.readFileSync(
  path.join(__dirname, '..', '..', 'app', 'components', 'OpenGraphMeta.js'),
  'utf8'
);

/** The same chain the component runs, built without literal separators. */
function escapeForInlineScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(new RegExp(LS, 'g'), '\\u2028')
    .replace(new RegExp(PS, 'g'), '\\u2029');
}

describe('inline JSON-LD escaping', () => {
  it('has no raw line separator left in the source', () => {
    expect(SOURCE.includes(LS)).toBe(false);
    expect(SOURCE.includes(PS)).toBe(false);
  });

  it('still escapes them, via the \\u form', () => {
    expect(SOURCE).toMatch(/\\u2028\/g/);
    expect(SOURCE).toMatch(/\\u2029\/g/);
  });

  it('neutralises a </script> breakout in a pet name', () => {
    const out = escapeForInlineScript({ petName: '</script><img src=x onerror=alert(1)>' });
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
  });

  it('neutralises the line separators', () => {
    const out = escapeForInlineScript({ note: `a${LS}b${PS}c` });
    expect(out.includes(LS)).toBe(false);
    expect(out.includes(PS)).toBe(false);
  });

  it('is still valid JSON that round-trips', () => {
    const data = { petName: '</script>', note: `a${LS}b${PS}c`, amp: 'x&y' };
    expect(JSON.parse(escapeForInlineScript(data))).toEqual(data);
  });
});
