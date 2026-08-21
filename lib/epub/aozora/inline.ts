import { ANNOTATION_PATTERN, IMAGE_ANNOTATION_PATTERN, RUBY_PATTERN } from '../constants';

import { escapeHtml, zenToHanDigits } from '../escape';

import { headingInfo } from './headings';

import type { InlineStyle } from '../types';

const FORWARD_EMPHASIS: Array<{
  suffix: string;
  className: InlineStyle;
}> = [
  {
    suffix: '傍点',
    className: 'sesame_dot',
  },
  {
    suffix: '白ゴマ傍点',
    className: 'white_sesame_dot',
  },
  {
    suffix: '丸傍点',
    className: 'black_circle',
  },
  {
    suffix: '白丸傍点',
    className: 'white_circle',
  },
  {
    suffix: '黒三角傍点',
    className: 'black_up-pointing_triangle',
  },
  {
    suffix: '白三角傍点',
    className: 'white_up-pointing_triangle',
  },
  {
    suffix: '二重丸傍点',
    className: 'bullseye',
  },
  {
    suffix: '蛇の目傍点',
    className: 'fisheye',
  },
  {
    suffix: 'ばつ傍点',
    className: 'saltire',
  },
];

const FORWARD_UNDERLINES: Array<{
  suffix: string;
  className: InlineStyle;
}> = [
  {
    suffix: '傍線',
    className: 'underline_solid',
  },
  {
    suffix: '二重傍線',
    className: 'underline_double',
  },
  {
    suffix: '鎖線',
    className: 'underline_dotted',
  },
  {
    suffix: '破線',
    className: 'underline_dashed',
  },
  {
    suffix: '波線',
    className: 'underline_wave',
  },
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

    result += `<ruby>${escapeHtml(rubyBase)}<rp>（</rp><rt>${escapeHtml(
      rubyText
    )}</rt><rp>）</rp></ruby>`;

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

    if (index < 0) {
      continue;
    }

    const body = raw.slice(2, -1);

    const headingMatch = body.match(/^「(.+?)」は(同行|窓)?(大|中|小)見出し$/);

    if (headingMatch) {
      const target = headingMatch[1];

      const formType = headingMatch[2];

      const info = headingInfo(`${headingMatch[3]}見出し`);

      if (!info) {
        continue;
      }

      const before = working.slice(0, index);

      if (!before.endsWith(target)) {
        continue;
      }

      const targetStart = index - target.length;

      const renderedTarget = applyRubyAndEscape(target);

      const headingClass =
        formType === '同行'
          ? `dogyo-${info.className}`
          : formType === '窓'
            ? `mado-${info.className}`
            : info.className;

      const replacement = `[[AOZORA_HEADING:${info.tag}:${headingClass}:${encodeURIComponent(
        renderedTarget
      )}]]`;

      working = working.slice(0, targetStart) + replacement + working.slice(index + raw.length);

      continue;
    }

    const mama = body.match(/^「(.+?)」に「ママ」の注記$/);

    if (mama) {
      const target = mama[1];

      const before = working.slice(0, index);

      if (before.endsWith(target)) {
        const targetStart = index - target.length;

        const replacement = `[[AOZORA_HTML:${encodeURIComponent(
          `<ruby><rb>${escapeHtml(target)}</rb><rp>（</rp><rt>ママ</rt><rp>）</rp></ruby>`
        )}]]`;

        working = working.slice(0, targetStart) + replacement + working.slice(index + raw.length);
      }

      continue;
    }

    const left = body.match(/^「(.+?)」の左に(.+)$/);

    const normal = body.match(/^「(.+?)」に(.+)$/);

    const target = left?.[1] ?? normal?.[1];

    const styleName = left?.[2] ?? normal?.[2];

    if (!target || !styleName) {
      continue;
    }

    const style = (
      left ? [...LEFT_EMPHASIS, ...LEFT_UNDERLINES] : [...FORWARD_EMPHASIS, ...FORWARD_UNDERLINES]
    ).find((item) => item.suffix === styleName);

    if (!style) {
      continue;
    }

    const before = working.slice(0, index);

    if (!before.endsWith(target)) {
      continue;
    }

    const targetStart = index - target.length;

    const replacement = `[[AOZORA_INLINE:${style.className}:${encodeURIComponent(target)}]]`;

    working = working.slice(0, targetStart) + replacement + working.slice(index + raw.length);
  }

  return working;
}

export function renderInline(line: string): string {
  let working = applyForwardReferenceAnnotations(line);

  working = working.replace(
    IMAGE_ANNOTATION_PATTERN,
    (_match, fileName) =>
      `[[AOZORA_HTML:${encodeURIComponent(
        `<div class="illust"><img src="../images/${escapeHtml(
          String(fileName).trim()
        )}" alt="" /></div>`
      )}]]`
  );

  working = working.replace(
    /［＃(\d+)段階大きな文字］([\s\S]+?)［＃大きな文字終わり］/g,
    (_m, digits, content) => {
      const n = Number(digits);

      const size = n === 1 ? 'large' : n === 2 ? 'x-large' : 'xx-large';

      return `[[AOZORA_HTML:${encodeURIComponent(
        `<span class="dai${n}" style="font-size:${size};">${renderInline(content)}</span>`
      )}]]`;
    }
  );

  working = working.replace(
    /［＃(\d+)段階小さな文字］([\s\S]+?)［＃小さな文字終わり］/g,
    (_m, digits, content) => {
      const n = Number(digits);

      const size = n === 1 ? 'small' : n === 2 ? 'x-small' : 'xx-small';

      return `[[AOZORA_HTML:${encodeURIComponent(
        `<span class="sho${n}" style="font-size:${size};">${renderInline(content)}</span>`
      )}]]`;
    }
  );

  const rangePatterns = [
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
      start: '左に傍点',
      end: '左に傍点終わり',
      className: 'sesame_dot_after',
      tag: 'em',
    },
    {
      start: '左に傍線',
      end: '左に傍線終わり',
      className: 'overline_solid',
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

    if (startIndex === -1) {
      continue;
    }

    const contentStart = startIndex + startToken.length;

    const endIndex = working.indexOf(endToken, contentStart);

    if (endIndex === -1) {
      continue;
    }

    const before = working.slice(0, startIndex);

    const content = working.slice(contentStart, endIndex);

    const after = working.slice(endIndex + endToken.length);

    const rendered =
      range.className === 'warichu'
        ? `<span class="warichu">（${renderInline(content)}）</span>`
        : `<${range.tag} class="${range.className}">${renderInline(content)}</${range.tag}>`;

    working = before + `[[AOZORA_HTML:${encodeURIComponent(rendered)}]]` + after;
  }

  working = working.replace(
    /\[\[AOZORA_INLINE:([^:\]]+):([^\]]+)\]\]/g,
    (_match, className, encodedTarget) => {
      const target = decodeURIComponent(encodedTarget);

      let html = '';

      if (className === 'tcy') {
        html = `<span class="tcy">${applyRubyAndEscape(target)}</span>`;
      } else if (className === 'superscript') {
        html = `<sup class="superscript">${applyRubyAndEscape(target)}</sup>`;
      } else if (className === 'subscript') {
        html = `<sub class="subscript">${applyRubyAndEscape(target)}</sub>`;
      } else if (className === 'caption') {
        html = `<span class="caption">${applyRubyAndEscape(target)}</span>`;
      } else {
        html = `<em class="${className}">${applyRubyAndEscape(target)}</em>`;
      }

      return `[[AOZORA_HTML:${encodeURIComponent(html)}]]`;
    }
  );

  working = working.replace(
    /\[\[AOZORA_HEADING:([^:]+):([^:]+):([^\]]+)\]\]/g,
    (_match, tag, className, encodedTarget) =>
      `[[AOZORA_HTML:${encodeURIComponent(
        `<${tag} class="${className}">${decodeURIComponent(encodedTarget)}</${tag}>`
      )}]]`
  );

  working = working.replace(ANNOTATION_PATTERN, (raw) => {
    console.warn('[Aozora] unsupported inline annotation:', raw);

    return `[[AOZORA_HTML:${encodeURIComponent(`<span class="notes">${escapeHtml(raw)}</span>`)}]]`;
  });

  working = applyRubyAndEscape(working);

  while (working.includes('[[AOZORA_HTML:')) {
    working = working.replace(/\[\[AOZORA_HTML:([^\]]+)\]\]/g, (_match, encodedHtml) =>
      decodeURIComponent(encodedHtml)
    );
  }

  return working;
}
