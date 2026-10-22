import { Bricolage_Grotesque } from 'next/font/google';

// Display face for the homepage headlines. Body text stays Inter
// (app/layout.js); only the big headings use this.
export const displayFont = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['700', '800'],
  display: 'swap',
});
