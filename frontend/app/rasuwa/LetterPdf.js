/**
 * Client-side PDF for the /rasuwa letter tool: one printable letter per
 * recipient in a single file, for printing, faxing, and district office
 * visits. Loaded with a dynamic import so react-pdf stays out of the
 * initial page bundle, and rendered in the browser so the letter's
 * contents never leave the device.
 *
 * Fonts: the vendored Noto Serif pair (public/rasuwa/fonts, OFL). The
 * built-in Times-Roman only encodes Latin-1 and silently mangled the
 * names this tool exists for ("Śrestha" printed as "Zrestha", Devanagari
 * printed as garbage). react-pdf has no font fallback, so pdfText.js
 * splits each paragraph into Latin and Devanagari runs. The fonts are
 * fetched only when a PDF is actually built.
 */

import React from 'react';
import { Document, Font, Page, StyleSheet, Text, pdf } from '@react-pdf/renderer';
import { splitScriptRuns } from './pdfText';

const SERIF = 'Rasuwa Serif';
const DEVANAGARI = 'Rasuwa Devanagari';

let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  fontsRegistered = true;
  Font.register({ family: SERIF, src: '/rasuwa/fonts/NotoSerif-Regular.ttf' });
  Font.register({ family: DEVANAGARI, src: '/rasuwa/fonts/NotoSerifDevanagari-Regular.ttf' });
  // A letter must never hyphenate a person's name across lines.
  Font.registerHyphenationCallback((word) => [word]);
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 64,
    paddingBottom: 64,
    paddingHorizontal: 72,
    fontFamily: SERIF,
    fontSize: 11,
    lineHeight: 1.45,
    color: '#111111',
  },
  paragraph: { marginBottom: 10 },
  devanagari: { fontFamily: DEVANAGARI },
  footer: {
    position: 'absolute',
    bottom: 36,
    left: 72,
    right: 72,
    fontSize: 8,
    color: '#666666',
  },
});

function ParagraphText({ text }) {
  const runs = splitScriptRuns(text);
  return (
    <Text style={styles.paragraph}>
      {runs.map((run, i) =>
        run.deva ? (
          <Text key={i} style={styles.devanagari}>{run.text}</Text>
        ) : (
          <Text key={i}>{run.text}</Text>
        )
      )}
    </Text>
  );
}

function LetterDocument({ letters, footerNote }) {
  return (
    <Document>
      {letters.map((letter, i) => (
        <Page key={i} size="LETTER" style={styles.page} wrap>
          {letter.body.split('\n\n').map((para, j) => (
            <ParagraphText key={j} text={para} />
          ))}
          {footerNote ? <Text style={styles.footer} fixed>{footerNote}</Text> : null}
        </Page>
      ))}
    </Document>
  );
}

/**
 * letters: [{ body }] (body is the full letter text, paragraphs split
 * by blank lines; single newlines inside a paragraph are preserved by
 * react-pdf as line breaks in the Text run).
 */
export async function buildLetterPdfBlob({ letters, footerNote }) {
  registerFonts();
  return pdf(<LetterDocument letters={letters} footerNote={footerNote} />).toBlob();
}
