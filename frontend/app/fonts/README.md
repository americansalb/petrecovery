# The site's fonts, in the repo

Every face the site uses is a file in `files/`, loaded with `next/font/local`.
Nothing is fetched from Google Fonts at build time.

It used to be. `next/font/google` downloads each family from Google while
`next build` runs, and from Oct 21 to Nov 5 2026 every Render deploy failed
that way: one of the twenty-eight script fonts (Noto Sans Myanmar) came back
in a shape next/font's loader could not read ("Cannot read properties of
null (reading '1')" in `@next/font/dist/google/loader.js`), and the whole
build went down with it. The same fetch failed once in CI the day before.
A build must not depend on a third party answering well.

## Where each file came from

Google Fonts' own files, taken once on 2026-11-05 with the URL next/font
builds for the same request, so what is served is what was served before:

- `inter-latin-var.woff2`: Inter, latin, variable 100 to 900. Body text (`app/layout.js`).
- `bricolage-latin-{600,700,800}.woff2`: Bricolage Grotesque, latin. Headlines (`app/lib/fonts.js`, `app/geo/fonts.js`).
- `instrument-all-{400,500,600,700}.ttf`: Instrument Sans, every subset in one file (next/font/local has no unicode-range, so latin and latin-ext cannot be two files). The game's body face (`app/geo/fonts.js`).
- `jetbrains-latin-{500,700}.woff2`: JetBrains Mono, latin. The game's mono face.
- `noto-<script>-<subset>-var.woff2` (or `-400`, `-600` where Google publishes no variable font): one Noto family per script the game draws, the script's own subset only (`app/geo/script/fonts.js`).

All are licensed under the SIL Open Font License, as on Google Fonts.

## Adding or refreshing one

Fetch the CSS next would ask for, with a current Chrome user agent so Google
serves woff2, take the `url(...)` of the subset you want, save the file here,
and point the `localFont` call at it with the weight (a range for a variable
font). For a whole-charset file (Instrument Sans) ask with an Android 4
browser user agent instead: Google then serves one TrueType file per weight.
An MSIE user agent gets Embedded OpenType, which next/font cannot read.
Check with `file` before committing. The weight ranges are in
`node_modules/next/dist/compiled/@next/font/dist/google/font-data.json`.
