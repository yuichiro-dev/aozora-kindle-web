import { ANNOTATION_PATTERN, IMAGE_ANNOTATION_PATTERN, RUBY_PATTERN } from '../constants';

function zenToHanDigits(str: string): string {
  return str.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const escapeHtml = escapeXml;

type InlineStyle =
  | 'sesame_dot'
  | 'white_sesame_dot'
  | 'black_circle'
  | 'white_circle'
  | 'black_up-pointing_triangle'
  | 'white_up-pointing_triangle'
  | 'bullseye'
  | 'fisheye'
  | 'saltire'
  | 'sesame_dot_after'
  | 'white_sesame_dot_after'
  | 'black_circle_after'
  | 'white_circle_after'
  | 'black_up-pointing_triangle_after'
  | 'white_up-pointing_triangle_after'
  | 'bullseye_after'
  | 'fisheye_after'
  | 'saltire_after'
  | 'underline_solid'
  | 'underline_double'
  | 'underline_dotted'
  | 'underline_dashed'
  | 'underline_wave'
  | 'overline_solid'
  | 'overline_double'
  | 'overline_dotted'
  | 'overline_dashed'
  | 'overline_wave'
  | 'futoji'
  | 'shatai';

interface BlockState {
  type:
    | 'indent'
    | 'chitsuki'
    | 'chiyose'
    | 'burasage'
    | 'jizume'
    | 'emphasis'
    | 'underline'
    | 'overline'
    | 'bold'
    | 'italic'
    | 'heading'
    | 'keigakomi'
    | 'yokogumi'
    | 'caption'
    | 'dai'
    | 'sho';

  className?: string;
  level?: 1 | 2 | 3;
  tag?: 'h2' | 'h3' | 'h4';
  amount?: number;
  wrapIndent?: number;
}

function headingInfo(levelText: string): {
  level: 1 | 2 | 3;
  tag: 'h2' | 'h3' | 'h4';
  className: string;
} | null {
  if (levelText === '大見出し') {
    return {
      level: 1,
      tag: 'h2',
      className: 'o-midashi',
    };
  }

  if (levelText === '中見出し') {
    return {
      level: 2,
      tag: 'h3',
      className: 'naka-midashi',
    };
  }

  if (levelText === '小見出し') {
    return {
      level: 3,
      tag: 'h4',
      className: 'ko-midashi',
    };
  }

  return null;
}

function blockTags(state: BlockState): {
  open: string;
  close: string;
} {
  switch (state.type) {
    case 'heading':
      return {
        open: `<${state.tag} class="${state.className}">`,
        close: `</${state.tag}>`,
      };

    case 'chitsuki':
      return {
        open: '<div class="chitsuki_0" style="text-align:right; margin-right: 0em">',
        close: '</div>',
      };

    case 'chiyose': {
      const n = state.amount ?? 0;

      return {
        open: `<div class="chitsuki_${n}" style="text-align:right; margin-right: ${n}em">`,
        close: '</div>',
      };
    }

    case 'burasage': {
      const wrap = state.wrapIndent ?? 0;
      const indent = state.amount ?? 0;
      const textIndent = indent - wrap;

      return {
        open: `<div class="burasage" style="margin-left: ${wrap}em; text-indent: ${textIndent}em;">`,
        close: '</div>',
      };
    }

    case 'jizume': {
      const n = state.amount ?? 0;

      return {
        open: `<div class="jizume_${n}" style="width: ${n}em">`,
        close: '</div>',
      };
    }

    case 'dai': {
      const n = state.amount ?? 1;
      const sizeMap: Record<number, string> = {
        1: 'large',
        2: 'x-large',
      };

      const size = sizeMap[n] ?? 'xx-large';

      return {
        open: `<div class="dai${n}" style="font-size: ${size};">`,
        close: '</div>',
      };
    }

    case 'sho': {
      const n = state.amount ?? 1;
      const sizeMap: Record<number, string> = {
        1: 'small',
        2: 'x-small',
      };

      const size = sizeMap[n] ?? 'xx-small';

      return {
        open: `<div class="sho${n}" style="font-size: ${size};">`,
        close: '</div>',
      };
    }

    case 'caption':
      return {
        open: '<div class="caption">',
        close: '</div>',
      };

    case 'emphasis':
    case 'underline':
    case 'overline':
      return {
        open: `<em class="${state.className}">`,
        close: '</em>',
      };

    default:
      return {
        open: `<div class="${state.className}">`,
        close: '</div>',
      };
  }
}

const FORWARD_EMPHASIS: Array<{
  suffix: string;
  className: InlineStyle;
}> = [
  { suffix: '傍点', className: 'sesame_dot' },
  { suffix: '白ゴマ傍点', className: 'white_sesame_dot' },
  { suffix: '丸傍点', className: 'black_circle' },
  { suffix: '白丸傍点', className: 'white_circle' },
  {
    suffix: '黒三角傍点',
    className: 'black_up-pointing_triangle',
  },
  {
    suffix: '白三角傍点',
    className: 'white_up-pointing_triangle',
  },
  { suffix: '二重丸傍点', className: 'bullseye' },
  { suffix: '蛇の目傍点', className: 'fisheye' },
  { suffix: 'ばつ傍点', className: 'saltire' },
];

const FORWARD_UNDERLINES: Array<{
  suffix: string;
  className: InlineStyle;
}> = [
  { suffix: '傍線', className: 'underline_solid' },
  { suffix: '二重傍線', className: 'underline_double' },
  { suffix: '鎖線', className: 'underline_dotted' },
  { suffix: '破線', className: 'underline_dashed' },
  { suffix: '波線', className: 'underline_wave' },
];

const LEFT_EMPHASIS: Array<{
  suffix: string;
  className: InlineStyle;
}> = [
  {
    suffix: '傍点',
    className: 'sesame_dot_after',
  },
  {
    suffix: '白ゴマ傍点',
    className: 'white_sesame_dot_after',
  },
  {
    suffix: '丸傍点',
    className: 'black_circle_after',
  },
  {
    suffix: '白丸傍点',
    className: 'white_circle_after',
  },
  {
    suffix: '黒三角傍点',
    className: 'black_up-pointing_triangle_after',
  },
  {
    suffix: '白三角傍点',
    className: 'white_up-pointing_triangle_after',
  },
  {
    suffix: '二重丸傍点',
    className: 'bullseye_after',
  },
  {
    suffix: '蛇の目傍点',
    className: 'fisheye_after',
  },
  {
    suffix: 'ばつ傍点',
    className: 'saltire_after',
  },
];

const LEFT_UNDERLINES: Array<{
  suffix: string;
  className: InlineStyle;
}> = [
  {
    suffix: '傍線',
    className: 'overline_solid',
  },
  {
    suffix: '二重傍線',
    className: 'overline_double',
  },
  {
    suffix: '鎖線',
    className: 'overline_dotted',
  },
  {
    suffix: '破線',
    className: 'overline_dashed',
  },
  {
    suffix: '波線',
    className: 'overline_wave',
  },
];

function applyRubyAndEscape(text: string): string {
  let result = '';
  let lastIndex = 0;

  RUBY_PATTERN.lastIndex = 0;

  for (const match of text.matchAll(RUBY_PATTERN)) {
    const index = match.index ?? 0;

    result += escapeHtml(text.slice(lastIndex, index));

    const rubyBase = match[1] ?? match[3];
    const rubyText = match[2] ?? match[4];

    result +=
      `<ruby>${escapeHtml(rubyBase)}` +
      `<rp>（</rp>` +
      `<rt>${escapeHtml(rubyText)}</rt>` +
      `<rp>）</rp>` +
      `</ruby>`;

    lastIndex = index + match[0].length;
  }

  result += escapeHtml(text.slice(lastIndex));

  return result;
}

function applyForwardReferenceAnnotations(line: string): string {
  let working = zenToHanDigits(line);

  const matches = [...working.matchAll(ANNOTATION_PATTERN)];

  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];

    const raw = match[0];
    const index = match.index ?? -1;

    if (index < 0) continue;

    const body = raw.slice(2, -1);

    /*
     * 「〜」は大見出し
     */
    const headingMatch = body.match(/^「(.+?)」は(同行|窓)?(大|中|小)見出し$/);

    if (headingMatch) {
      const target = headingMatch[1];
      const formType = headingMatch[2];

      const info = headingInfo(`${headingMatch[3]}見出し`);

      if (!info) continue;

      const before = working.slice(0, index);

      if (!before.endsWith(target)) continue;

      const targetStart = index - target.length;

      const renderedTarget = applyRubyAndEscape(target);

      const headingClass =
        formType === '同行'
          ? `dogyo-${info.className}`
          : formType === '窓'
            ? `mado-${info.className}`
            : info.className;

      const replacement =
        `[[AOZORA_HEADING:${info.tag}:` +
        `${headingClass}:` +
        `${encodeURIComponent(renderedTarget)}]]`;

      working = working.slice(0, targetStart) + replacement + working.slice(index + raw.length);

      continue;
    }

    /*
     * 「〜」に「ママ」の注記
     */
    const mamaRubyMatch = body.match(/^「(.+?)」に「ママ」の注記$/);

    if (mamaRubyMatch) {
      const target = mamaRubyMatch[1];
      const before = working.slice(0, index);

      if (before.endsWith(target)) {
        const targetStart = index - target.length;

        const replacement = `[[AOZORA_HTML:${encodeURIComponent(
          `<ruby><rb>${escapeHtml(target)}</rb>` + `<rp>（</rp><rt>ママ</rt><rp>）</rp></ruby>`
        )}]]`;

        working = working.slice(0, targetStart) + replacement + working.slice(index + raw.length);

        continue;
      }
    }

    /*
     * 「〜」はローマ数字（面区点情報の有無に関わらず対応）
     */
    const romanMatch = body.match(/^「(.+?)」はローマ数字(?:、.+)?$/);

    if (romanMatch) {
      const target = romanMatch[1];
      const before = working.slice(0, index);

      if (before.endsWith(target)) {
        const targetStart = index - target.length;

        const ROMAN_MAP: Record<string, string> = {
          '1': 'Ⅰ',
          '2': 'Ⅱ',
          '3': 'Ⅲ',
          '4': 'Ⅳ',
          '5': 'Ⅴ',
          '6': 'Ⅵ',
          '7': 'Ⅶ',
          '8': 'Ⅷ',
          '9': 'Ⅸ',
          '10': 'Ⅹ',
          '11': 'Ⅺ',
          '12': 'Ⅻ',
          I: 'Ⅰ',
          II: 'Ⅱ',
          III: 'Ⅲ',
          IV: 'Ⅳ',
          V: 'Ⅴ',
          VI: 'Ⅵ',
          VII: 'Ⅶ',
          VIII: 'Ⅷ',
          IX: 'Ⅸ',
          X: 'Ⅹ',
        };

        const normalizedKey = zenToHanDigits(target.trim()).toUpperCase();
        const romanChar = ROMAN_MAP[normalizedKey] ?? target;

        working = working.slice(0, targetStart) + romanChar + working.slice(index + raw.length);

        continue;
      }
    }

    /*
     * 「〜」の左に傍点 / 「〜」に傍点
     */
    const leftMatch = body.match(/^「(.+?)」の左に(.+)$/);
    const normalMatch = body.match(/^「(.+?)」に(.+)$/);

    const target = leftMatch?.[1] ?? normalMatch?.[1];
    const styleName = leftMatch?.[2] ?? normalMatch?.[2];

    if (!target || !styleName) continue;

    const style = (
      leftMatch
        ? [...LEFT_EMPHASIS, ...LEFT_UNDERLINES]
        : [...FORWARD_EMPHASIS, ...FORWARD_UNDERLINES]
    ).find((item) => item.suffix === styleName);

    if (!style) continue;

    const before = working.slice(0, index);

    if (!before.endsWith(target)) continue;

    const targetStart = index - target.length;

    const replacement = `[[AOZORA_INLINE:${style.className}:` + `${encodeURIComponent(target)}]]`;

    working = working.slice(0, targetStart) + replacement + working.slice(index + raw.length);
  }

  interface SimpleForwardRule {
    re: RegExp;
    getClassName: (match: RegExpExecArray) => string;
  }

  const simplePatterns: SimpleForwardRule[] = [
    {
      re: /「(.+?)」は太字/,
      getClassName: () => 'futoji',
    },
    {
      re: /「(.+?)」は斜体/,
      getClassName: () => 'shatai',
    },
    {
      re: /「(.+?)」は縦中横/,
      getClassName: () => 'tcy',
    },
    {
      re: /「(.+?)」は行右小書き/,
      getClassName: () => 'superscript',
    },
    {
      re: /「(.+?)」は行左小書き/,
      getClassName: () => 'subscript',
    },
    {
      re: /「(.+?)」は上付き小文字/,
      getClassName: () => 'superscript',
    },
    {
      re: /「(.+?)」は下付き小文字/,
      getClassName: () => 'subscript',
    },
    {
      re: /「(.+?)」は(\d+)段階大きな文字/,
      getClassName: (m) => `dai${m[2]}`,
    },
    {
      re: /「(.+?)」は(\d+)段階小さな文字/,
      getClassName: (m) => `sho${m[2]}`,
    },
    {
      re: /「(.+?)」はキャプション/,
      getClassName: () => 'caption',
    },
  ];

  for (const { re, getClassName } of simplePatterns) {
    const annotationRe = new RegExp(`［＃${re.source}］`, 'g');

    let m: RegExpExecArray | null;

    while ((m = annotationRe.exec(working)) !== null) {
      const rawTarget = m[1];
      const className = getClassName(m);

      const start = m.index;
      const before = working.slice(0, start);

      if (!before.endsWith(rawTarget)) continue;

      const targetStart = start - rawTarget.length;

      const replacement = `[[AOZORA_INLINE:${className}:` + `${encodeURIComponent(rawTarget)}]]`;

      working = working.slice(0, targetStart) + replacement + working.slice(start + m[0].length);

      annotationRe.lastIndex = 0;
    }
  }

  return working;
}

function renderInline(line: string): string {
  let working = applyForwardReferenceAnnotations(line);

  /*
   * 画像注記
   */
  working = working.replace(IMAGE_ANNOTATION_PATTERN, (_match, fileName) => {
    const cleanFileName = fileName.trim();

    return `[[AOZORA_HTML:${encodeURIComponent(
      `<div class="illust">` +
        `<img src="../images/${escapeXml(cleanFileName)}" alt="" />` +
        `</div>`
    )}]]`;
  });

  /*
   * インライン文字サイズ
   */
  working = working.replace(
    /［＃(\d+)段階大きな文字］([\s\S]+?)［＃大きな文字終わり］/g,
    (_m, digits, content) => {
      const n = Number(digits);

      const sizeMap: Record<number, string> = {
        1: 'large',
        2: 'x-large',
      };

      const size = sizeMap[n] ?? 'xx-large';

      return `[[AOZORA_HTML:${encodeURIComponent(
        `<span class="dai${n}" style="font-size: ${size};">` +
          `${renderInline(content)}` +
          `</span>`
      )}]]`;
    }
  );

  working = working.replace(
    /［＃(\d+)段階小さな文字］([\s\S]+?)［＃小さな文字終わり］/g,
    (_m, digits, content) => {
      const n = Number(digits);

      const sizeMap: Record<number, string> = {
        1: 'small',
        2: 'x-small',
      };

      const size = sizeMap[n] ?? 'xx-small';

      return `[[AOZORA_HTML:${encodeURIComponent(
        `<span class="sho${n}" style="font-size: ${size};">` +
          `${renderInline(content)}` +
          `</span>`
      )}]]`;
    }
  );

  /*
   * 範囲指定型の注記
   */
  const rangePatterns: Array<{
    start: string;
    end: string;
    className: string;
    tag?: string;
  }> = [
    {
      start: '傍点',
      end: '傍点終わり',
      className: 'sesame_dot',
      tag: 'em',
    },
    {
      start: '白ゴマ傍点',
      end: '白ゴマ傍点終わり',
      className: 'white_sesame_dot',
      tag: 'em',
    },
    {
      start: '丸傍点',
      end: '丸傍点終わり',
      className: 'black_circle',
      tag: 'em',
    },
    {
      start: '白丸傍点',
      end: '白丸傍点終わり',
      className: 'white_circle',
      tag: 'em',
    },
    {
      start: '黒三角傍点',
      end: '黒三角傍点終わり',
      className: 'black_up-pointing_triangle',
      tag: 'em',
    },
    {
      start: '白三角傍点',
      end: '白三角傍点終わり',
      className: 'white_up-pointing_triangle',
      tag: 'em',
    },
    {
      start: '二重丸傍点',
      end: '二重丸傍点終わり',
      className: 'bullseye',
      tag: 'em',
    },
    {
      start: '蛇の目傍点',
      end: '蛇の目傍点終わり',
      className: 'fisheye',
      tag: 'em',
    },
    {
      start: 'ばつ傍点',
      end: 'ばつ傍点終わり',
      className: 'saltire',
      tag: 'em',
    },

    {
      start: '左に傍点',
      end: '左に傍点終わり',
      className: 'sesame_dot_after',
      tag: 'em',
    },
    {
      start: '左に白ゴマ傍点',
      end: '左に白ゴマ傍点終わり',
      className: 'white_sesame_dot_after',
      tag: 'em',
    },
    {
      start: '左に丸傍点',
      end: '左に丸傍点終わり',
      className: 'black_circle_after',
      tag: 'em',
    },
    {
      start: '左に白丸傍点',
      end: '左に白丸傍点終わり',
      className: 'white_circle_after',
      tag: 'em',
    },
    {
      start: '左に黒三角傍点',
      end: '左に黒三角傍点終わり',
      className: 'black_up-pointing_triangle_after',
      tag: 'em',
    },
    {
      start: '左に白三角傍点',
      end: '左に白三角傍点終わり',
      className: 'white_up-pointing_triangle_after',
      tag: 'em',
    },
    {
      start: '左に二重丸傍点',
      end: '左に二重丸傍点終わり',
      className: 'bullseye_after',
      tag: 'em',
    },
    {
      start: '左に蛇の目傍点',
      end: '左に蛇の目傍点終わり',
      className: 'fisheye_after',
      tag: 'em',
    },
    {
      start: '左にばつ傍点',
      end: '左にばつ傍点終わり',
      className: 'saltire_after',
      tag: 'em',
    },

    {
      start: '傍線',
      end: '傍線終わり',
      className: 'underline_solid',
      tag: 'em',
    },
    {
      start: '二重傍線',
      end: '二重傍線終わり',
      className: 'underline_double',
      tag: 'em',
    },
    {
      start: '鎖線',
      end: '鎖線終わり',
      className: 'underline_dotted',
      tag: 'em',
    },
    {
      start: '破線',
      end: '破線終わり',
      className: 'underline_dashed',
      tag: 'em',
    },
    {
      start: '波線',
      end: '波線終わり',
      className: 'underline_wave',
      tag: 'em',
    },

    {
      start: '左に傍線',
      end: '左に傍線終わり',
      className: 'overline_solid',
      tag: 'em',
    },
    {
      start: '左に二重傍線',
      end: '左に二重傍線終わり',
      className: 'overline_double',
      tag: 'em',
    },
    {
      start: '左に鎖線',
      end: '左に鎖線終わり',
      className: 'overline_dotted',
      tag: 'em',
    },
    {
      start: '左に破線',
      end: '左に破線終わり',
      className: 'overline_dashed',
      tag: 'em',
    },
    {
      start: '左に波線',
      end: '左に波線終わり',
      className: 'overline_wave',
      tag: 'em',
    },

    {
      start: '太字',
      end: '太字終わり',
      className: 'futoji',
      tag: 'span',
    },
    {
      start: '斜体',
      end: '斜体終わり',
      className: 'shatai',
      tag: 'span',
    },
    {
      start: '縦中横',
      end: '縦中横終わり',
      className: 'tcy',
      tag: 'span',
    },
    {
      start: '行右小書き',
      end: '行右小書き終わり',
      className: 'superscript',
      tag: 'sup',
    },
    {
      start: '行左小書き',
      end: '行左小書き終わり',
      className: 'subscript',
      tag: 'sub',
    },
    {
      start: '上付き小文字',
      end: '上付き小文字終わり',
      className: 'superscript',
      tag: 'sup',
    },
    {
      start: '下付き小文字',
      end: '下付き小文字終わり',
      className: 'subscript',
      tag: 'sub',
    },

    {
      start: '割り注',
      end: '割り注終わり',
      className: 'warichu',
      tag: 'span',
    },
    {
      start: 'キャプション',
      end: 'キャプション終わり',
      className: 'caption',
      tag: 'span',
    },
  ];

  for (const range of rangePatterns) {
    const startToken = `［＃${range.start}］`;
    const endToken = `［＃${range.end}］`;

    const startIndex = working.indexOf(startToken);

    if (startIndex === -1) continue;

    const contentStart = startIndex + startToken.length;

    const endIndex = working.indexOf(endToken, contentStart);

    if (endIndex === -1) continue;

    const before = working.slice(0, startIndex);
    const content = working.slice(contentStart, endIndex);
    const after = working.slice(endIndex + endToken.length);

    const rendered =
      range.className === 'warichu'
        ? `<span class="warichu">（${renderInline(content)}）</span>`
        : `<${range.tag} class="${range.className}">` +
          `${renderInline(content)}` +
          `</${range.tag}>`;

    working = before + `[[AOZORA_HTML:${encodeURIComponent(rendered)}]]` + after;
  }

  /*
   * AOZORA_INLINE
   */
  working = working.replace(
    /\[\[AOZORA_INLINE:([^:\]]+):([^\]]+)\]\]/g,
    (_match, className, encodedTarget) => {
      const target = decodeURIComponent(encodedTarget);

      let html = '';

      if (className === 'tcy') {
        html = `<span class="tcy">` + `${applyRubyAndEscape(target)}` + `</span>`;
      } else if (className === 'superscript') {
        html = `<sup class="superscript">` + `${applyRubyAndEscape(target)}` + `</sup>`;
      } else if (className === 'subscript') {
        html = `<sub class="subscript">` + `${applyRubyAndEscape(target)}` + `</sub>`;
      } else if (className === 'caption') {
        html = `<span class="caption">` + `${applyRubyAndEscape(target)}` + `</span>`;
      } else if (className.startsWith('dai') || className.startsWith('sho')) {
        const n = Number(className.replace(/\D/g, '')) || 1;

        const isDai = className.startsWith('dai');

        const sizeMap: Record<number, string> = isDai
          ? {
              1: 'large',
              2: 'x-large',
            }
          : {
              1: 'small',
              2: 'x-small',
            };

        const size = sizeMap[n] ?? (isDai ? 'xx-large' : 'xx-small');

        html =
          `<span class="${className}" style="font-size: ${size};">` +
          `${applyRubyAndEscape(target)}` +
          `</span>`;
      } else {
        html = `<em class="${className}">` + `${applyRubyAndEscape(target)}` + `</em>`;
      }

      return `[[AOZORA_HTML:${encodeURIComponent(html)}]]`;
    }
  );

  /*
   * 見出しプレースホルダー
   */
  working = working.replace(
    /\[\[AOZORA_HEADING:([^:]+):([^:]+):([^\]]+)\]\]/g,
    (_match, tag, className, encodedTarget) =>
      `[[AOZORA_HTML:${encodeURIComponent(
        `<${tag} class="${className}">` + `${decodeURIComponent(encodedTarget)}` + `</${tag}>`
      )}]]`
  );

  /*
   * 未対応注記を可視化
   */
  working = working.replace(ANNOTATION_PATTERN, (raw) => {
    console.warn('[Aozora] unsupported inline annotation:', raw);

    return `[[AOZORA_HTML:${encodeURIComponent(`<span class="notes">${escapeHtml(raw)}</span>`)}]]`;
  });

  /*
   * 生テキストだけをルビ化 + HTML escape
   */
  working = applyRubyAndEscape(working);

  /*
   * AOZORA_HTML を復元
   */
  while (working.includes('[[AOZORA_HTML:')) {
    working = working.replace(/\[\[AOZORA_HTML:([^\]]+)\]\]/g, (_match, encodedHtml) =>
      decodeURIComponent(encodedHtml)
    );
  }

  return working;
}

function parseBlockStart(annotation: string): BlockState | null {
  const cleanAnno = zenToHanDigits(annotation);

  const indent = cleanAnno.match(/^ここから(\d+)字下げ$/);

  if (indent) {
    return {
      type: 'indent',
      className: `jisage-${Number(indent[1])}`,
    };
  }

  const burasageOtsu = cleanAnno.match(/^ここから(\d+)字下げ、折り返して(\d+)字下げ$/);

  if (burasageOtsu) {
    return {
      type: 'burasage',
      amount: Number(burasageOtsu[1]),
      wrapIndent: Number(burasageOtsu[2]),
    };
  }

  const burasageTentsuki = cleanAnno.match(/^ここから改行天付き、折り返して(\d+)字下げ$/);

  if (burasageTentsuki) {
    return {
      type: 'burasage',
      amount: 0,
      wrapIndent: Number(burasageTentsuki[1]),
    };
  }

  if (cleanAnno === 'ここから地付き') {
    return {
      type: 'chitsuki',
    };
  }

  const chiyoseBlock = cleanAnno.match(/^ここから地から(\d+)字上げ$/);

  if (chiyoseBlock) {
    return {
      type: 'chiyose',
      amount: Number(chiyoseBlock[1]),
    };
  }

  const jizumeBlock = cleanAnno.match(/^ここから(\d+)字詰め$/);

  if (jizumeBlock) {
    return {
      type: 'jizume',
      amount: Number(jizumeBlock[1]),
    };
  }

  const daiBlock = cleanAnno.match(/^ここから(\d+)段階大きな文字$/);

  if (daiBlock) {
    return {
      type: 'dai',
      amount: Number(daiBlock[1]),
    };
  }

  const shoBlock = cleanAnno.match(/^ここから(\d+)段階小さな文字$/);

  if (shoBlock) {
    return {
      type: 'sho',
      amount: Number(shoBlock[1]),
    };
  }

  if (cleanAnno === 'ここからキャプション') {
    return {
      type: 'caption',
    };
  }

  const heading = cleanAnno.match(/^ここから(大|中|小)見出し$/);

  if (heading) {
    const info = headingInfo(`${heading[1]}見出し`);

    if (!info) return null;

    return {
      type: 'heading',
      level: info.level,
      tag: info.tag,
      className: info.className,
    };
  }

  if (cleanAnno === 'ここから傍点') {
    return {
      type: 'emphasis',
      className: 'sesame_dot',
    };
  }

  if (cleanAnno === 'ここから白ゴマ傍点') {
    return {
      type: 'emphasis',
      className: 'white_sesame_dot',
    };
  }

  if (cleanAnno === 'ここから丸傍点') {
    return {
      type: 'emphasis',
      className: 'black_circle',
    };
  }

  if (cleanAnno === 'ここから白丸傍点') {
    return {
      type: 'emphasis',
      className: 'white_circle',
    };
  }

  if (cleanAnno === 'ここから黒三角傍点') {
    return {
      type: 'emphasis',
      className: 'black_up-pointing_triangle',
    };
  }

  if (cleanAnno === 'ここから白三角傍点') {
    return {
      type: 'emphasis',
      className: 'white_up-pointing_triangle',
    };
  }

  if (cleanAnno === 'ここから二重丸傍点') {
    return {
      type: 'emphasis',
      className: 'bullseye',
    };
  }

  if (cleanAnno === 'ここから蛇の目傍点') {
    return {
      type: 'emphasis',
      className: 'fisheye',
    };
  }

  if (cleanAnno === 'ここからばつ傍点') {
    return {
      type: 'emphasis',
      className: 'saltire',
    };
  }

  if (cleanAnno === 'ここから傍線') {
    return {
      type: 'underline',
      className: 'underline_solid',
    };
  }

  if (cleanAnno === 'ここから二重傍線') {
    return {
      type: 'underline',
      className: 'underline_double',
    };
  }

  if (cleanAnno === 'ここから鎖線') {
    return {
      type: 'underline',
      className: 'underline_dotted',
    };
  }

  if (cleanAnno === 'ここから破線') {
    return {
      type: 'underline',
      className: 'underline_dashed',
    };
  }

  if (cleanAnno === 'ここから波線') {
    return {
      type: 'underline',
      className: 'underline_wave',
    };
  }

  if (cleanAnno === 'ここから左に傍点') {
    return {
      type: 'emphasis',
      className: 'sesame_dot_after',
    };
  }

  if (cleanAnno === 'ここから左に傍線') {
    return {
      type: 'overline',
      className: 'overline_solid',
    };
  }

  if (cleanAnno === 'ここから太字') {
    return {
      type: 'bold',
      className: 'futoji',
    };
  }

  if (cleanAnno === 'ここから斜体') {
    return {
      type: 'italic',
      className: 'shatai',
    };
  }

  if (cleanAnno === 'ここから罫囲み') {
    return {
      type: 'keigakomi',
      className: 'keigakomi',
    };
  }

  if (cleanAnno === 'ここから横組み') {
    return {
      type: 'yokogumi',
      className: 'yokogumi',
    };
  }

  return null;
}

function isBlockEnd(annotation: string): boolean {
  const cleanAnno = zenToHanDigits(annotation);

  return (
    /^ここで(大|中|小)見出し終わり$/.test(cleanAnno) ||
    /^ここで\d+字下げ終わり$/.test(cleanAnno) ||
    cleanAnno === 'ここで字下げ終わり' ||
    cleanAnno === 'ここで地付き終わり' ||
    cleanAnno === 'ここで字上げ終わり' ||
    cleanAnno === 'ここで字詰め終わり' ||
    cleanAnno === 'ここで大きな文字終わり' ||
    cleanAnno === 'ここで小さな文字終わり' ||
    cleanAnno === 'ここでキャプション終わり' ||
    cleanAnno === 'ここで傍点終わり' ||
    cleanAnno === 'ここで白ゴマ傍点終わり' ||
    cleanAnno === 'ここで丸傍点終わり' ||
    cleanAnno === 'ここで白丸傍点終わり' ||
    cleanAnno === 'ここで黒三角傍点終わり' ||
    cleanAnno === 'ここで白三角傍点終わり' ||
    cleanAnno === 'ここで二重丸傍点終わり' ||
    cleanAnno === 'ここで蛇の目傍点終わり' ||
    cleanAnno === 'ここでばつ傍点終わり' ||
    cleanAnno === 'ここで傍線終わり' ||
    cleanAnno === 'ここで二重傍線終わり' ||
    cleanAnno === 'ここで鎖線終わり' ||
    cleanAnno === 'ここで破線終わり' ||
    cleanAnno === 'ここで波線終わり' ||
    cleanAnno === 'ここで太字終わり' ||
    cleanAnno === 'ここで斜体終わり' ||
    cleanAnno === 'ここで罫囲み終わり' ||
    cleanAnno === 'ここで横組み終わり'
  );
}

function blockEndType(annotation: string): BlockState['type'] | null {
  const cleanAnno = zenToHanDigits(annotation);

  if (/ここで(大|中|小)見出し終わり$/.test(cleanAnno)) {
    return 'heading';
  }

  if (/ここで\d+字下げ終わり$/.test(cleanAnno) || cleanAnno === 'ここで字下げ終わり') {
    return null;
  }

  if (cleanAnno === 'ここで地付き終わり') {
    return 'chitsuki';
  }

  if (cleanAnno === 'ここで字上げ終わり') {
    return 'chiyose';
  }

  if (cleanAnno === 'ここで字詰め終わり') {
    return 'jizume';
  }

  if (cleanAnno === 'ここで大きな文字終わり') {
    return 'dai';
  }

  if (cleanAnno === 'ここで小さな文字終わり') {
    return 'sho';
  }

  if (cleanAnno === 'ここでキャプション終わり') {
    return 'caption';
  }

  if (cleanAnno.includes('傍点終わり')) {
    return 'emphasis';
  }

  if (cleanAnno.includes('傍線終わり')) {
    return cleanAnno.includes('左に') ? 'overline' : 'underline';
  }

  if (cleanAnno === 'ここで太字終わり') {
    return 'bold';
  }

  if (cleanAnno === 'ここで斜体終わり') {
    return 'italic';
  }

  if (cleanAnno === 'ここで罫囲み終わり') {
    return 'keigakomi';
  }

  if (cleanAnno === 'ここで横組み終わり') {
    return 'yokogumi';
  }

  return null;
}

const CHITSUKI_INLINE = /［＃地付き］/;
const CHIYOSE_INLINE = /［＃地から(\d+|[０-９]+)字上げ］/;

function tryRenderTrailingAlignment(line: string): string[] | null {
  const cleanLine = zenToHanDigits(line);

  const chitsukiMatch = cleanLine.match(CHITSUKI_INLINE);

  const chiyoseMatch = cleanLine.match(CHIYOSE_INLINE);

  const candidates = [chitsukiMatch, chiyoseMatch].filter((m): m is RegExpMatchArray => m !== null);

  if (candidates.length === 0) {
    return null;
  }

  const match = candidates.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))[0];

  const index = match.index ?? -1;

  if (index < 0) {
    return null;
  }

  const prefix = cleanLine.slice(0, index);
  const suffix = cleanLine.slice(index + match[0].length);

  const isChiyose = match === chiyoseMatch;

  const amount = isChiyose ? Number((chiyoseMatch as RegExpMatchArray)[1]) : 0;

  const out: string[] = [];

  if (prefix.trim() !== '') {
    out.push(`<p>${renderInline(prefix)}</p>`);
  }

  out.push(
    `<div class="chitsuki_${amount}" ` +
      `style="text-align:right; margin-right: ${amount}em">` +
      `${renderInline(suffix)}` +
      `</div>`
  );

  return out;
}

function renderNormalLine(line: string): string {
  let working = zenToHanDigits(line);

  let inlineIndent = 0;

  const inlineIndentMatches = [...working.matchAll(/［＃(\d+)字下げ］/g)];

  for (const match of inlineIndentMatches) {
    inlineIndent = Math.max(inlineIndent, Number(match[1]));
  }

  working = working.replace(/［＃\d+字下げ］/g, '');

  const content = renderInline(working);

  if (content.trim() === '') {
    return '<p><br/></p>';
  }

  if (content.trim().startsWith('<div')) {
    return content;
  }

  let result = `<p>${content}</p>`;

  if (inlineIndent > 0) {
    result = `<div class="jisage-${inlineIndent}">` + result + `</div>`;
  }

  return result;
}

/**
 * 青空文庫の Shift_JIS TXT を
 * EPUB 用 HTML に変換する。
 */
export function parseAozoraTxtToHtml(rawTxt: string): string {
  const lines = rawTxt.split(/\r?\n/);

  /*
   * 青空文庫 TXT のヘッダー部分を除去。
   */
  const dividerRegex = /^[-―─]{10,}\s*$/;

  let firstDividerIdx = -1;
  let secondDividerIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (dividerRegex.test(lines[i].trim())) {
      if (firstDividerIdx === -1) {
        firstDividerIdx = i;
      } else {
        secondDividerIdx = i;
        break;
      }
    }
  }

  const bodyStart =
    secondDividerIdx !== -1
      ? secondDividerIdx + 1
      : firstDividerIdx !== -1
        ? firstDividerIdx + 1
        : 0;

  const bodyLines = lines.slice(bodyStart);

  const htmlResult: string[] = ['<div class="main"><div class="chapter">'];

  const blockStack: BlockState[] = [];

  let inPageCenter = false;
  let inToc = false;

  const closeBlock = (expectedType: BlockState['type'] | null) => {
    if (blockStack.length === 0) {
      console.warn('[Aozora] block end without start:', expectedType);
      return;
    }

    const top = blockStack[blockStack.length - 1];

    const isIndentFamily = top.type === 'indent' || top.type === 'burasage';

    if (expectedType && top.type !== expectedType && !(expectedType === null && isIndentFamily)) {
      console.warn('[Aozora] mismatched block end:', {
        expected: expectedType,
        actual: top.type,
      });

      return;
    }

    blockStack.pop();

    htmlResult.push(blockTags(top).close);
  };

  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i];
    const trimmed = line.trim();

    /*
     * 目次
     */
    if (trimmed.includes('［＃ここから目次］') || trimmed.includes('［＃目次］')) {
      inToc = true;
      continue;
    }

    if (trimmed.includes('［＃ここで目次終わり］')) {
      inToc = false;
      continue;
    }

    if (inToc) {
      continue;
    }

    /*
     * ページ左右中央
     */
    if (
      trimmed.includes('［＃ページの左右中央］') ||
      trimmed.includes('［＃ここからページの左右中央］')
    ) {
      inPageCenter = true;
      htmlResult.push('<div class="page-center">');
      continue;
    }

    if (trimmed.includes('［＃ここでページの左右中央終わり］')) {
      if (inPageCenter) {
        htmlResult.push('</div>');
        inPageCenter = false;
      }

      continue;
    }

    /*
     * 改ページ
     */
    if (trimmed === '［＃改ページ］' || trimmed === '［＃改丁］' || trimmed === '［＃改見開き］') {
      if (inPageCenter) {
        htmlResult.push('</div>');
        inPageCenter = false;
      }

      htmlResult.push('<div class="page-break"></div>');

      continue;
    }

    /*
     * 改段
     */
    if (trimmed === '［＃改段］') {
      htmlResult.push('<span class="notes">［＃改段］</span>');

      continue;
    }

    /*
     * 単独行画像
     */
    IMAGE_ANNOTATION_PATTERN.lastIndex = 0; // /g フラグのインデックスリセット
    const imageMatch = IMAGE_ANNOTATION_PATTERN.exec(trimmed);

    // 1行丸ごと挿絵注記の場合
    if (imageMatch && trimmed === imageMatch[0]) {
      const fileName = imageMatch[1].trim();

      htmlResult.push(
        `<div class="illust">` + `<img src="../images/${escapeXml(fileName)}" alt="" />` + `</div>`
      );

      continue;
    }

    /*
     * 単独行のブロック注記
     */
    const annotations = [...trimmed.matchAll(ANNOTATION_PATTERN)].map((m) => m[0].slice(2, -1));

    if (annotations.length === 1 && trimmed === `［＃${annotations[0]}］`) {
      const annotation = annotations[0];

      const state = parseBlockStart(annotation);

      if (state) {
        const { open } = blockTags(state);

        htmlResult.push(open);
        blockStack.push(state);

        continue;
      }

      if (isBlockEnd(annotation)) {
        closeBlock(blockEndType(annotation));

        continue;
      }

      console.warn('[Aozora] unsupported block annotation:', trimmed);

      htmlResult.push(`<span class="notes">${escapeHtml(trimmed)}</span>`);

      continue;
    }

    /*
     * 「〜」は大見出し
     */
    const headingForward = line.match(/［＃「(.+?)」は(同行|窓)?(大|中|小)見出し］/) ?? null;

    if (headingForward) {
      const [, target, formType, levelText] = headingForward;

      const info = headingInfo(`${levelText}見出し`);

      if (info && line.trim().endsWith(headingForward[0])) {
        const targetStart = line.lastIndexOf(target);

        if (targetStart >= 0) {
          const prefix = line.slice(0, targetStart);

          const indentMatch = zenToHanDigits(prefix).match(/［＃(\d+)字下げ］/);

          const indent = indentMatch ? Number(indentMatch[1]) : 0;

          const headingClass =
            formType === '同行'
              ? `dogyo-${info.className}`
              : formType === '窓'
                ? `mado-${info.className}`
                : info.className;

          const renderedHeading =
            `<${info.tag} class="${headingClass}">` + `${renderInline(target)}` + `</${info.tag}>`;

          if (indent > 0) {
            htmlResult.push(`<div class="jisage-${indent}">` + renderedHeading + `</div>`);
          } else {
            htmlResult.push(renderedHeading);
          }

          continue;
        }
      }
    }

    /*
     * ［＃大見出し］〜［＃大見出し終わり］
     */
    const headingOpenClose = trimmed.match(
      /^［＃((?:同行|窓)?(大|中|小)見出し)］(.+)［＃\1終わり］$/
    );

    if (headingOpenClose) {
      const [, fullLevel, levelChar, content] = headingOpenClose;

      const info = headingInfo(`${levelChar}見出し`);

      if (info) {
        const className = fullLevel.startsWith('同行')
          ? `dogyo-${info.className}`
          : fullLevel.startsWith('窓')
            ? `mado-${info.className}`
            : info.className;

        htmlResult.push(
          `<${info.tag} class="${className}">` + `${renderInline(content)}` + `</${info.tag}>`
        );

        continue;
      }
    }

    /*
     * 地付き / 字上げ
     */
    const alignmentResult = tryRenderTrailingAlignment(line);

    if (alignmentResult) {
      htmlResult.push(...alignmentResult);

      continue;
    }

    /*
     * 通常行
     */
    const rendered = renderNormalLine(line);

    htmlResult.push(rendered);
  }

  /*
   * EOF で閉じ忘れたブロックを閉じる
   */
  while (blockStack.length > 0) {
    const state = blockStack.pop()!;

    console.warn('[Aozora] unclosed block at EOF:', state);

    htmlResult.push(blockTags(state).close);
  }

  if (inPageCenter) {
    htmlResult.push('</div>');
  }

  htmlResult.push('</div></div>');

  return htmlResult.join('');
}
