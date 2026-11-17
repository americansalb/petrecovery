/**
 * A legal document's text, as blocks to set as elements.
 *
 * The documents in prisma/legal/*.js are markdown that uses only headings,
 * paragraphs, lists, rules and **bold** inside a line, so this reads those
 * and nothing else, and nothing is ever injected as HTML. The words come
 * out exactly as written, without the marks: "# Liability Waiver" is a
 * heading that says "Liability Waiver", "- You will ..." is a list item
 * that says "You will ...".
 *
 * Read by the waiver's own page (app/legal/waiver) and by the join card on
 * a search, which opens the safety rules and the waiver full screen on a
 * phone (app/mission-control/components/ReadSheet.js). They used to be
 * poured raw into a small box on the card, "# Liability Waiver" and all.
 */

/**
 * `content` as [{ kind: 'h1' | 'h2' | 'h3' | 'p', text }, { kind: 'list', items: [text] }, { kind: 'rule' }].
 * Lines one after another that start "- " are one list; an empty line ends a paragraph.
 */
export function legalBlocks(content = '') {
  const blocks = [];
  let list = null;
  const flush = () => {
    if (list) blocks.push({ kind: 'list', items: list });
    list = null;
  };
  String(content || '')
    .split('\n')
    .forEach((raw) => {
      const line = raw.trim();
      if (line.startsWith('- ')) {
        list = list || [];
        list.push(line.slice(2));
        return;
      }
      flush();
      if (!line) return;
      if (line === '---') blocks.push({ kind: 'rule' });
      else if (line.startsWith('### ')) blocks.push({ kind: 'h3', text: line.slice(4) });
      else if (line.startsWith('## ')) blocks.push({ kind: 'h2', text: line.slice(3) });
      else if (line.startsWith('# ')) blocks.push({ kind: 'h1', text: line.slice(2) });
      else blocks.push({ kind: 'p', text: line });
    });
  flush();
  return blocks;
}

/** "**bold** text" as runs to set: [{ text: 'bold', bold: true }, { text: ' text', bold: false }]. */
export function boldRuns(text = '') {
  return String(text || '')
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) => (part.length > 4 && part.startsWith('**') && part.endsWith('**') ? { text: part.slice(2, -2), bold: true } : { text: part, bold: false }));
}
