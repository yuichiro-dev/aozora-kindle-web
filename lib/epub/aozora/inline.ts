import { ANNOTATION_PATTERN, IMAGE_ANNOTATION_PATTERN, RUBY_PATTERN } from '../constants';

import { escapeHtml, escapeXml, zenToHanDigits } from '../escape';

import { headingInfo } from './headings';

import type { InlineStyle } from '../types';

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

export function applyRubyAndEscape(text: string): string {
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
      re: /「(.+?)」は([０-９\d]+)段階大きな文字/,
      getClassName: (m) => `dai${m[2]}`,
    },
    {
      re: /「(.+?)」は([０-９\d]+)段階小さな文字/,
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

      // ★ ルビ《...》が挟まっていてもマッチする関数を使用
      const matchedText = matchTargetAllowingRuby(before, rawTarget);

      if (!matchedText) continue;

      const targetStart = start - matchedText.length;

      // 実際にマッチしたルビ込みのテキストに対してクラスを適用
      const replacement = `[[AOZORA_INLINE:${className}:` + `${encodeURIComponent(matchedText)}]]`;

      working = working.slice(0, targetStart) + replacement + working.slice(start + m[0].length);

      annotationRe.lastIndex = 0;
    }
  }

  return working;
}

export function renderInline(line: string, gaijiImages: Map<string, string> = new Map()): string {
  let working = resolveGaiji(line, gaijiImages);
  /*
   * JISコードのない約物注記（例: ※［＃感嘆符三つ、626-10］など）の安全な置換
   */
  working = working.replace(/※?［＃([^、］]+)[、,]\s*\d+-\d+］/g, (_match, description) => {
    const altText = approximateGaijiText(description);
    return `[[AOZORA_HTML:${encodeURIComponent(escapeHtml(altText))}]]`;
  });

  working = applyForwardReferenceAnnotations(working);

  working = applyForwardReferenceAnnotations(working);

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
          `${renderInline(content, gaijiImages)}` +
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
          `${renderInline(content, gaijiImages)}` +
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
        ? `<span class="warichu">（${renderInline(content, gaijiImages)}）</span>`
        : `<${range.tag} class="${range.className}">` +
          `${renderInline(content, gaijiImages)}` +
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
   * 漢文の返り点注記 (［＃レ］, ［＃一］, ［＃二］, ［＃上］, ［＃下］ など)
   */
  working = working.replace(/［＃([一二三四上下甲乙丙丁レ]+)］/g, (_match, kaeriten) => {
    const html = `<sub class="kaeriten">${escapeHtml(kaeriten)}</sub>`;
    return `[[AOZORA_HTML:${encodeURIComponent(html)}]]`;
  });

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
/**
 * target の各文字の直後にルビ注記（《…》）が挟まっていても
 * 前方一致とみなし、実際にマッチした（ルビ込みの）部分文字列を返す。
 * 一致しなければ null。
 */
export function matchTargetAllowingRuby(before: string, target: string): string | null {
  const escapedChars = [...target].map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = escapedChars.join('(?:《[^》]*》)?') + '(?:《[^》]*》)?';
  const regex = new RegExp(pattern + '$');
  const match = before.match(regex);

  return match ? match[0] : null;
}

/**
 * 外字注記のパターン。
 * 例1: ※［＃感嘆符三つ、626-10］                          → JISコード無し
 * 例2: ※［＃「てへん+劣」、第3水準1-84-77、361-9］          → JISコード（水準-区-点）あり
 */
export const GAIJI_PATTERN = /※?［＃(.+?)[、,]\s*(?:第[34]水準)?(\d+-\d+-\d+)(?:[、,][^］]+)*］/g;
/**
 * JISコードが無い外字（活字の説明のみ）をテキストで近似する。
 * よくあるパターン以外は説明文をそのまま角括弧で見える化する。
 */
export function approximateGaijiText(description: string): string {
  const countMatch = description.match(/^(.+?)(二つ|三つ|四つ)$/);

  if (countMatch) {
    const charMap: Record<string, string> = {
      感嘆符: '！',
      疑問符: '？',
    };
    const countMap: Record<string, number> = { 二つ: 2, 三つ: 3, 四つ: 4 };
    const base = charMap[countMatch[1]];
    const count = countMap[countMatch[2]];

    if (base && count) {
      return base.repeat(count);
    }
  }

  return `〔${description}〕`;
}

/**
 * 外字注記を解決する。
 * gaijiImages は「JISコード → EPUB内の画像ファイル名」のマップ
 * （fetchAozora.ts の fetchGaijiImages で事前に取得済みのもの）。
 * ネットワークアクセスはここでは行わない（純粋関数として保つため）。
 */
export function resolveGaiji(line: string, gaijiImages: Map<string, string>): string {
  return line.replace(GAIJI_PATTERN, (_match, description: string, jisCode?: string) => {
    if (jisCode) {
      const filename = gaijiImages.get(jisCode);

      if (filename) {
        const imgTag = `<img class="gaiji-inline" src="../images/${escapeHtml(filename)}" alt="${escapeHtml(description)}"/>`;

        return `[[AOZORA_HTML:${encodeURIComponent(imgTag)}]]`;
      }
    }

    return escapeHtml(approximateGaijiText(description));
  });
}
