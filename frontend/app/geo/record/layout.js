/**
 * /geo/record: Voices (beta) recordings from the public. A server layout
 * so the link a speaker is sent has its own preview
 * (docs/LINK_PREVIEWS.md), and so the sentences have their fonts: every
 * non-Latin script in the corpus is attached here, as on the Script
 * pages (app/geo/script/fonts.js).
 */

import { buildShareMetadata } from '@/app/lib/geo/meta';
import { scriptFontClasses } from '../script/fonts';

export const metadata = buildShareMetadata({
  title: 'Record your language | Probably Earth',
  description: 'Read a few sentences aloud in your language. Players of Probably Earth hear them and guess where in the world the language is spoken.',
  index: false,
});

export default function RecordLayout({ children }) {
  return <div className={scriptFontClasses}>{children}</div>;
}
