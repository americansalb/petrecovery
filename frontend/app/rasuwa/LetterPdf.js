/**
 * Client-side PDF for the /rasuwa letter tool: one printable letter per
 * recipient in a single file, for printing, faxing, and district office
 * visits. Loaded with a dynamic import so react-pdf stays out of the
 * initial page bundle, and rendered in the browser so the letter's
 * contents never leave the device.
 */

import React from 'react';
import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    paddingTop: 64,
    paddingBottom: 64,
    paddingHorizontal: 72,
    fontFamily: 'Times-Roman',
    fontSize: 11,
    lineHeight: 1.45,
    color: '#111111',
  },
  paragraph: { marginBottom: 10 },
  footer: {
    position: 'absolute',
    bottom: 36,
    left: 72,
    right: 72,
    fontSize: 8,
    color: '#666666',
  },
});

function LetterDocument({ letters, footerNote }) {
  return (
    <Document>
      {letters.map((letter, i) => (
        <Page key={i} size="LETTER" style={styles.page} wrap>
          {letter.body.split('\n\n').map((para, j) => (
            <Text key={j} style={styles.paragraph}>
              {para}
            </Text>
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
  return pdf(<LetterDocument letters={letters} footerNote={footerNote} />).toBlob();
}
