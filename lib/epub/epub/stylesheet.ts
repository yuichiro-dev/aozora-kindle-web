export const EPUB_CSS = `
@charset "UTF-8";

@page {
  margin: 0;
}

html {
  writing-mode: vertical-rl;
  -webkit-writing-mode: vertical-rl;
  -epub-writing-mode: vertical-rl;
}

body {
  margin: 0;
  padding: 0;
  font-family:
    "Yu Mincho",
    "Hiragino Mincho ProN",
    "Hiragino Mincho Pro",
    serif;
  line-height: 1.8;
}

.main {
  writing-mode: vertical-rl;
  -webkit-writing-mode: vertical-rl;
  -epub-writing-mode: vertical-rl;
}

.chapter {
  writing-mode: vertical-rl;
  -webkit-writing-mode: vertical-rl;
  -epub-writing-mode: vertical-rl;
}

p {
  margin: 0 0 1em 0;
}

ruby {
  ruby-position: over;
}

rt {
  font-size: 0.5em;
}

.o-midashi {
  font-size: 1.5em;
  font-weight: bold;
  margin: 1em 0;
}

.naka-midashi {
  font-size: 1.25em;
  font-weight: bold;
  margin: 1em 0;
}

.ko-midashi {
  font-size: 1.1em;
  font-weight: bold;
  margin: 1em 0;
}

.dogyo-o-midashi,
.dogyo-naka-midashi,
.dogyo-ko-midashi,
.mado-o-midashi,
.mado-naka-midashi,
.mado-ko-midashi {
  font-weight: bold;
}

.jisage-1 {
  margin-right: 1em;
}

.jisage-2 {
  margin-right: 2em;
}

.jisage-3 {
  margin-right: 3em;
}

.jisage-4 {
  margin-right: 4em;
}

.burasage {
  display: block;
}

.jizume_1 {
  max-width: 1em;
}

.jizume_2 {
  max-width: 2em;
}

.jizume_3 {
  max-width: 3em;
}

.dai1 {
  font-size: large;
}

.dai2 {
  font-size: x-large;
}

.sho1 {
  font-size: small;
}

.sho2 {
  font-size: x-small;
}

.sesame_dot {
  text-emphasis-style: dot;
  -webkit-text-emphasis-style: dot;
}

.white_sesame_dot {
  text-emphasis-style: open-dot;
  -webkit-text-emphasis-style: open-dot;
}

.black_circle {
  text-emphasis-style: filled circle;
  -webkit-text-emphasis-style: filled circle;
}

.white_circle {
  text-emphasis-style: open circle;
  -webkit-text-emphasis-style: open circle;
}

.black_up-pointing_triangle {
  text-emphasis-style: filled triangle;
  -webkit-text-emphasis-style: filled triangle;
}

.white_up-pointing_triangle {
  text-emphasis-style: open triangle;
  -webkit-text-emphasis-style: open triangle;
}

.bullseye {
  text-emphasis-style: double-circle;
  -webkit-text-emphasis-style: double-circle;
}

.fisheye {
  text-emphasis-style: "◉";
  -webkit-text-emphasis-style: "◉";
}

.saltire {
  text-emphasis-style: "×";
  -webkit-text-emphasis-style: "×";
}

.sesame_dot_after,
.white_sesame_dot_after,
.black_circle_after,
.white_circle_after,
.black_up-pointing_triangle_after,
.white_up-pointing_triangle_after,
.bullseye_after,
.fisheye_after,
.saltire_after {
  text-emphasis-position: under left;
  -webkit-text-emphasis-position: under left;
}

.sesame_dot_after {
  text-emphasis-style: dot;
  -webkit-text-emphasis-style: dot;
}

.white_sesame_dot_after {
  text-emphasis-style: open-dot;
  -webkit-text-emphasis-style: open-dot;
}

.black_circle_after {
  text-emphasis-style: filled circle;
  -webkit-text-emphasis-style: filled circle;
}

.white_circle_after {
  text-emphasis-style: open circle;
  -webkit-text-emphasis-style: open circle;
}

.black_up-pointing_triangle_after {
  text-emphasis-style: filled triangle;
  -webkit-text-emphasis-style: filled triangle;
}

.white_up-pointing_triangle_after {
  text-emphasis-style: open triangle;
  -webkit-text-emphasis-style: open triangle;
}

.bullseye_after {
  text-emphasis-style: double-circle;
  -webkit-text-emphasis-style: double-circle;
}

.fisheye_after {
  text-emphasis-style: "◉";
  -webkit-text-emphasis-style: "◉";
}

.saltire_after {
  text-emphasis-style: "×";
  -webkit-text-emphasis-style: "×";
}

.underline_solid {
  text-decoration-line: underline;
  text-decoration-style: solid;
}

.underline_double {
  text-decoration-line: underline;
  text-decoration-style: double;
}

.underline_dotted {
  text-decoration-line: underline;
  text-decoration-style: dotted;
}

.underline_dashed {
  text-decoration-line: underline;
  text-decoration-style: dashed;
}

.underline_wave {
  text-decoration-line: underline;
  text-decoration-style: wavy;
}

.overline_solid {
  text-decoration-line: overline;
  text-decoration-style: solid;
}

.overline_double {
  text-decoration-line: overline;
  text-decoration-style: double;
}

.overline_dotted {
  text-decoration-line: overline;
  text-decoration-style: dotted;
}

.overline_dashed {
  text-decoration-line: overline;
  text-decoration-style: dashed;
}

.overline_wave {
  text-decoration-line: overline;
  text-decoration-style: wavy;
}

.futoji {
  font-weight: bold;
}

.shatai {
  font-style: italic;
}

.tcy {
  text-combine-upright: all;
  -webkit-text-combine: horizontal;
  -epub-text-combine: horizontal;
}

.warichu {
  font-size: 0.65em;
}

.superscript {
  vertical-align: super;
  font-size: 0.6em;
}

.subscript {
  vertical-align: sub;
  font-size: 0.6em;
}

.kaeriten {
  font-size: 0.5em;
  vertical-align: sub;
  line-height: 1;
  font-family: serif;
}

.keigakomi {
  border: solid 1px;
  padding: 0.5em;
}

.yokogumi {
  writing-mode: horizontal-tb;
  -webkit-writing-mode: horizontal-tb;
  -epub-writing-mode: horizontal-tb;
}

.illust {
  text-align: center;
  margin: 1em 0;
}

.illust img {
  max-width: 100%;
  height: auto;
}

.caption {
  display: block;
  font-size: 0.85em;
  text-align: center;
  margin: 0.5em 0;
}

.page-center {
  text-align: center;
}

.page-break {
  page-break-before: always;
  break-before: page;
}

.notes {
  font-size: 0.75em;
  color: #666;
}
`;
