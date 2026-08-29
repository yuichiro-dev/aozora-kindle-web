import { ANNOTATION_PATTERN, IMAGE_ANNOTATION_PATTERN, RUBY_PATTERN } from '../constants';

import { escapeHtml, escapeXml, parseJapaneseOrArabicNumber, zenToHanDigits } from '../escape';
import { headingInfo } from './headings';

import type { InlineStyle } from '../types';

/* ============================================================================
 * 定義: 傍点・傍線スタイルマッピング
 * ============================================================================ */

const FORWARD_EMPHASIS: Array<{ suffix: string; className: InlineStyle }> = [
  { suffix: '傍点', className: 'sesame_dot' },
  { suffix: '白ゴマ傍点', className: 'white_sesame_dot' },
  { suffix: '丸傍点', className: 'black_circle' },
  { suffix: '白丸傍点', className: 'white_circle' },
  { suffix: '黒三角傍点', className: 'black_up-pointing_triangle' },
  { suffix: '白三角傍点', className: 'white_up-pointing_triangle' },
  { suffix: '二重丸傍点', className: 'bullseye' },
  { suffix: '蛇の目傍点', className: 'fisheye' },
  { suffix: 'ばつ傍点', className: 'saltire' },
];

const FORWARD_UNDERLINES: Array<{ suffix: string; className: InlineStyle }> = [
  { suffix: '傍線', className: 'underline_solid' },
  { suffix: '二重傍線', className: 'underline_double' },
  { suffix: '鎖線', className: 'underline_dotted' },
  { suffix: '破線', className: 'underline_dashed' },
  { suffix: '波線', className: 'underline_wave' },
];

const LEFT_EMPHASIS: Array<{ suffix: string; className: InlineStyle }> = [
  { suffix: '傍点', className: 'sesame_dot_after' },
  { suffix: '白ゴマ傍点', className: 'white_sesame_dot_after' },
  { suffix: '丸傍点', className: 'black_circle_after' },
  { suffix: '白丸傍点', className: 'white_circle_after' },
  { suffix: '黒三角傍点', className: 'black_up-pointing_triangle_after' },
  { suffix: '白三角傍点', className: 'white_up-pointing_triangle_after' },
  { suffix: '二重丸傍点', className: 'bullseye_after' },
  { suffix: '蛇の目傍点', className: 'fisheye_after' },
  { suffix: 'ばつ傍点', className: 'saltire_after' },
];

const LEFT_UNDERLINES: Array<{ suffix: string; className: InlineStyle }> = [
  { suffix: '傍線', className: 'overline_solid' },
  { suffix: '二重傍線', className: 'overline_double' },
  { suffix: '鎖線', className: 'overline_dotted' },
  { suffix: '破線', className: 'overline_dashed' },
  { suffix: '波線', className: 'overline_wave' },
];

/* ============================================================================
 * ユーティリティ: ルビ適用およびHTMLエスケープ
 * ============================================================================ */

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

/* ============================================================================
 * 前方参照型注記の適用処理 (例: 「〜」は太字, 「〜」はママ)
 * ============================================================================ */

function applyForwardReferenceAnnotations(line: string): string {
  let working = zenToHanDigits(line);

  const matches = [...working.matchAll(ANNOTATION_PATTERN)];

  // 後ろからループ処理することで、文字列インデックスのズレを防止
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];

    const raw = match[0];
    const index = match.index ?? -1;

    if (index < 0) continue;

    const body = raw.slice(2, -1);

    /* ------------------------------------------------------------------------
     * A-1. 見出し注記 (例: 「〜」は大見出し)
     * ------------------------------------------------------------------------ */
    const headingMatch = body.match(/^「(.+?)」は(同行|窓)?(大|中|小)見出し$/);

    if (headingMatch) {
      const target = headingMatch[1];
      const formType = headingMatch[2];

      const info = headingInfo(`${headingMatch[3]}見出し`);

      if (!info) continue;

      const headingClass =
        formType === '同行'
          ? `dogyo-${info.className}`
          : formType === '窓'
            ? `mado-${info.className}`
            : info.className;

      const before = working.slice(0, index);

      if (before.endsWith(target)) {
        const targetStart = index - target.length;
        const renderedTarget = applyRubyAndEscape(target);
        const replacement = `[[AOZORA_HEADING:${info.tag}:${headingClass}:${encodeURIComponent(renderedTarget)}]]`;
        working = working.slice(0, targetStart) + replacement + working.slice(index + raw.length);
      } else {
        const renderedTarget = applyRubyAndEscape(target);
        const replacement = `[[AOZORA_HEADING:${info.tag}:${headingClass}:${encodeURIComponent(renderedTarget)}]]`;
        working = working.slice(0, index) + replacement + working.slice(index + raw.length);
      }

      continue;
    }

    /* ------------------------------------------------------------------------
     * A-2. ママ・校正・注記関係 (例: 「〜」はママ, ［＃「潮風洗［＃レ］…」はママ］)
     * ------------------------------------------------------------------------ */
    const mamaRubyMatch = body.match(
      /^(?:ルビの)?「([\s\S]+?)」(?:\s*に\s*「ママ」の注記|はママ|に「.+?」の注記|の左に「.+?」の注記|の左に「.+?」のルビ)$/
    );

    if (mamaRubyMatch) {
      const target = mamaRubyMatch[1];
      const before = working.slice(0, index);

      // 比較用のプレーンテキスト生成（内部のプレースホルダーや注記を除去して比較）
      const plainTarget = target
        .replace(ANNOTATION_PATTERN, '')
        .replace(/\[\[AOZORA_(?:HTML|INLINE):.*?\]\]/g, '');

      const plainBefore = before
        .replace(ANNOTATION_PATTERN, '')
        .replace(/\[\[AOZORA_(?:HTML|INLINE):.*?\]\]/g, '');

      if (plainBefore.endsWith(plainTarget)) {
        let plainCount = 0;
        let targetStart = before.length;

        for (let p = before.length - 1; p >= 0; p--) {
          const chunk = before.slice(p);

          const placeholderMatch = chunk.match(/^\[\[AOZORA_(?:HTML|INLINE):.*?\]\]/);

          if (placeholderMatch) {
            p -= placeholderMatch[0].length - 1;
            continue;
          }

          plainCount++;

          if (plainCount >= plainTarget.length) {
            targetStart = p;
            break;
          }
        }

        if (targetStart < 0 || targetStart > before.length) {
          working = working.slice(0, index) + working.slice(index + raw.length);
          continue;
        }

        const originalTarget = before.slice(targetStart);

        const replacement = `[[AOZORA_HTML:${encodeURIComponent(
          `<ruby><rb>${escapeHtml(originalTarget)}</rb><rp>（</rp><rt>ママ</rt><rp>）</rp></ruby>`
        )}]]`;

        working = working.slice(0, targetStart) + replacement + working.slice(index + raw.length);
      } else {
        working = working.slice(0, index) + working.slice(index + raw.length);
      }

      continue;
    }

    /* ------------------------------------------------------------------------
     * A-3. 伏字傍記 (例: 「〜」に「×」の傍記)
     * ------------------------------------------------------------------------ */
    const fusejiMatch = body.match(/^「(.+?)」に「(.+?)」の傍記$/);

    if (fusejiMatch) {
      const target = fusejiMatch[1];
      const mark = fusejiMatch[2];
      const before = working.slice(0, index);

      if (before.endsWith(target)) {
        const targetStart = index - target.length;
        const replacement = `[[AOZORA_HTML:${encodeURIComponent(
          `<span class="fuseji" title="傍記: ${escapeHtml(mark)}">${escapeHtml(target)}</span>`
        )}]]`;
        working = working.slice(0, targetStart) + replacement + working.slice(index + raw.length);
      }

      continue;
    }

    /* ------------------------------------------------------------------------
     * A-4. ローマ数字変換 (例: 「10」はローマ数字)
     * ------------------------------------------------------------------------ */
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

    /* ------------------------------------------------------------------------
     * A-5. 傍点・傍線 (例: 「〜」に傍点, 「〜」の左に傍線)
     * ------------------------------------------------------------------------ */
    const leftMatch = body.match(/^「(.+?)」の左に(.+)$/);
    const normalMatch = body.match(/^「(.+?)」[には](.+)$/);

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

    if (before.endsWith(target)) {
      const targetStart = before.lastIndexOf(target);
      const replacement = `[[AOZORA_INLINE:${style.className}:${encodeURIComponent(target)}]]`;
      working = working.slice(0, targetStart) + replacement + working.slice(index + raw.length);
    } else {
      const renderedTarget = applyRubyAndEscape(target);
      const replacement = `[[AOZORA_HTML:${encodeURIComponent(`<em class="${style.className}">${renderedTarget}</em>`)}]]`;
      working = working.slice(0, index) + replacement + working.slice(index + raw.length);
    }
  }

  /* ------------------------------------------------------------------------
   * A-6. 簡易パターン適用 (太字, 斜体, 縦中横, 横組み, 小書き, 指数, 大きな文字, 小さな文字)
   * ------------------------------------------------------------------------ */
  interface SimpleForwardRule {
    re: RegExp;
    getClassName: (match: RegExpExecArray) => string;
  }

  const simplePatterns: SimpleForwardRule[] = [
    { re: /「(.+?)」は罫囲み/, getClassName: () => 'keigakomi' },
    { re: /「(.+?)」は枠囲み/, getClassName: () => 'keigakomi' },
    { re: /「(.+?)」は太字/, getClassName: () => 'futoji' },
    { re: /「(.+?)」は斜体/, getClassName: () => 'shatai' },
    { re: /「(.+?)」は縦中横/, getClassName: () => 'tcy' },
    { re: /「(.+?)」は横組み/, getClassName: () => 'yokogumi' },
    { re: /「(.+?)」は(?:行右|上付き)?小書き/, getClassName: () => 'superscript' },
    { re: /「(.+?)」は指数/, getClassName: () => 'superscript' },
    { re: /「(.+?)」は(?:行左|下付き)小書き/, getClassName: () => 'subscript' },
    {
      re: /「(.+?)」は([０-９\d一二三]+)段階大きな文字/,
      getClassName: (m) => `dai${parseJapaneseOrArabicNumber(m[2])}`,
    },
    {
      re: /「(.+?)」は([０-９\d一二三]+)段階小さな文字/,
      getClassName: (m) => `sho${parseJapaneseOrArabicNumber(m[2])}`,
    },
    { re: /「(.+?)」はキャプション/, getClassName: () => 'caption' },
  ];

  for (const { re, getClassName } of simplePatterns) {
    const annotationRe = new RegExp(`［＃${re.source}］`, 'g');

    let m: RegExpExecArray | null;

    while ((m = annotationRe.exec(working)) !== null) {
      const rawTarget = m[1];
      const className = getClassName(m);

      const start = m.index;
      const before = working.slice(0, start);

      const matchedText = matchTargetAllowingRuby(before, rawTarget);

      if (matchedText) {
        const targetStart = start - matchedText.length;
        const replacement = `[[AOZORA_INLINE:${className}:${encodeURIComponent(matchedText)}]]`;
        working = working.slice(0, targetStart) + replacement + working.slice(start + m[0].length);
      } else {
        // 対象文字列が直前に見つからない場合（記号や変則文字）のセーフティ救済
        const replacement = `[[AOZORA_INLINE:${className}:${encodeURIComponent(rawTarget)}]]`;
        working = working.slice(0, start) + replacement + working.slice(start + m[0].length);
      }

      annotationRe.lastIndex = 0;
    }
  }

  return working;
}

/* ============================================================================
 * メイン関数: インライン要素レンダリング
 * ============================================================================ */

export function renderInline(line: string, gaijiImages: Map<string, string> = new Map()): string {
  // STEP 1: 全角英数を半角化し、外字（画像/約物）を安全なプレースホルダーに置換
  let working = zenToHanDigits(line);
  working = resolveGaiji(working, gaijiImages);

  // STEP 2: 漢文の返り点注記を先行処理 (［＃レ］, ［＃一］, ［＃二］, ［＃上］, ［＃下］ 等)
  // ※ 後置注記判定（applyForwardReferenceAnnotations）の前にプレースホルダー化することで、
  //   未対応ログへの誤検知や文字列崩れを防止します。
  working = working.replace(
    /［＃([一二三四五六七八九十上下甲乙丙丁レ]+)］/g,
    (_match, kaeriten) => {
      const html = `<sub class="kaeriten">${escapeHtml(kaeriten)}</sub>`;
      return `[[AOZORA_HTML:${encodeURIComponent(html)}]]`;
    }
  );

  // STEP 3: 本文中の注記記号 (例: ［＃（ガ）］, ［＃（１）］) の先行処理
  working = working.replace(/［＃（(.+?)）］/g, (_match, noteMark) => {
    const html = `<sup class="note-mark">（${escapeHtml(noteMark)}）</sup>`;
    return `[[AOZORA_HTML:${encodeURIComponent(html)}]]`;
  });

  // STEP 4: 地上げ（地から◯字上げ / 地より◯字上げ）のインライン一括変換
  working = working.replace(
    /［＃地(?:から|より)([0-9０-９一二三四五六七八九十]+)字上げ］/g,
    (_match, numStr) => {
      const n = parseJapaneseOrArabicNumber(numStr);

      if (!Number.isFinite(n) || n <= 0) {
        return '';
      }

      return `[[AOZORA_HTML:${encodeURIComponent(
        `<div class="chitsuki chitsuki-${n}" style="text-align:right;margin-right:${n}em"><br/></div>`
      )}]]`;
    }
  );

  // STEP 5: 天から〜字下げ（範囲指定および単発）の処理
  working = working.replace(
    /［＃(?:ここから)?天から([０-９\d一二三四五六七八九十]+)字下げ］([\s\S]+?)［＃(?:ここで)?天から\1字下げ終わり］/g,
    (_m, numStr, content) => {
      const n = parseJapaneseOrArabicNumber(numStr);
      return `[[AOZORA_HTML:${encodeURIComponent(
        `<div class="jisage-${n}">${renderInline(content, gaijiImages)}</div>`
      )}]]`;
    }
  );

  working = working.replace(/［＃天から([０-９\d一二三四五六七八九十]+)字下げ］/g, (_m, numStr) => {
    const n = parseJapaneseOrArabicNumber(numStr);
    if (n <= 0) return '';
    return `[[AOZORA_HTML:<div class="jisage-${n}">]]`;
  });

  // STEP 6: JISコードのない約物注記の代替テキスト化
  working = working.replace(/※?［＃([^、］]+)[、,]\s*\d+-\d+］/g, (_match, description) => {
    const altText = approximateGaijiText(description);
    return `[[AOZORA_HTML:${encodeURIComponent(escapeHtml(altText))}]]`;
  });

  // STEP 7: 前方参照型注記・ママ注記等の解釈実行
  working = applyForwardReferenceAnnotations(working);

  // STEP 8: 画像注記の変換
  working = working.replace(IMAGE_ANNOTATION_PATTERN, (_match, fileName) => {
    const cleanFileName = fileName.trim();

    return `[[AOZORA_HTML:${encodeURIComponent(
      `<div class="illust"><img src="../images/${escapeXml(cleanFileName)}" alt="" /></div>`
    )}]]`;
  });

  // STEP 9: 単発の開始・終了指定注記（太字、斜体、横組み、キャプション、罫囲み、文字サイズ等）
  working = working.replace(
    /［＃(?:ここから)?太字］/g,
    `[[AOZORA_HTML:${encodeURIComponent('<strong class="futoji">')}]]`
  );
  working = working.replace(
    /［＃ここで太字終わり］/g,
    `[[AOZORA_HTML:${encodeURIComponent('</strong>')}]]`
  );
  working = working.replace(
    /［＃(?:ここから)?斜体］/g,
    `[[AOZORA_HTML:${encodeURIComponent('<em class="shatai">')}]]`
  );
  working = working.replace(
    /［＃ここで斜体終わり］/g,
    `[[AOZORA_HTML:${encodeURIComponent('</em>')}]]`
  );
  working = working.replace(
    /［＃(?:ここから)?横組み］/g,
    `[[AOZORA_HTML:${encodeURIComponent('<span class="yokogumi">')}]]`
  );
  working = working.replace(
    /［＃ここで横組み終わり］/g,
    `[[AOZORA_HTML:${encodeURIComponent('</span>')}]]`
  );
  working = working.replace(
    /［＃(?:ここから)?キャプション］/g,
    `[[AOZORA_HTML:${encodeURIComponent('<figcaption class="caption">')}]]`
  );
  working = working.replace(
    /［＃ここでキャプション終わり］/g,
    `[[AOZORA_HTML:${encodeURIComponent('</figcaption>')}]]`
  );
  working = working.replace(
    /［＃(?:ここから)?罫囲み］/g,
    `[[AOZORA_HTML:${encodeURIComponent('<div class="keigakomi">')}]]`
  );
  working = working.replace(
    /［＃ここで罫囲み終わり］/g,
    `[[AOZORA_HTML:${encodeURIComponent('</div>')}]]`
  );

  working = working.replace(
    /［＃(?:ここから)?([０-９\d一二三四五六七八九十]+段階)?大きな文字］/g,
    (_m, numStr) => {
      const n = numStr ? parseJapaneseOrArabicNumber(numStr.replace('段階', '')) : 1;
      return `[[AOZORA_HTML:${encodeURIComponent(`<span class="dai${n}">`)}]]`;
    }
  );
  working = working.replace(
    /［＃ここで(?:[０-９\d一二三四五六七八九十]+段階)?大きな文字終わり］/g,
    `[[AOZORA_HTML:${encodeURIComponent('</span>')}]]`
  );

  working = working.replace(
    /［＃(?:ここから)?([０-９\d一二三四五六七八九十]+段階)?小さな文字］/g,
    (_m, numStr) => {
      const n = numStr ? parseJapaneseOrArabicNumber(numStr.replace('段階', '')) : 1;
      return `[[AOZORA_HTML:${encodeURIComponent(`<small class="sho${n}">`)}]]`;
    }
  );
  working = working.replace(
    /［＃ここで(?:[０-９\d一二三四五六七八九十]+段階)?小さな文字終わり］/g,
    `[[AOZORA_HTML:${encodeURIComponent('</small>')}]]`
  );

  // STEP 10: ペア型（囲み・傍点・傍線・割り注など）範囲指定注記の構造化
  const rangePatterns: Array<{
    start: string;
    end: string;
    className: string;
    tag?: string;
  }> = [
    { start: '罫囲み', end: '罫囲み終わり', className: 'keigakomi', tag: 'span' },
    { start: '横組み', end: '横組み終わり', className: 'yokogumi', tag: 'span' },
    { start: '傍点', end: '傍点終わり', className: 'sesame_dot', tag: 'em' },
    { start: '白ゴマ傍点', end: '白ゴマ傍点終わり', className: 'white_sesame_dot', tag: 'em' },
    { start: '丸傍点', end: '丸傍点終わり', className: 'black_circle', tag: 'em' },
    { start: '白丸傍点', end: '白丸傍点終わり', className: 'white_circle', tag: 'em' },
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
    { start: '二重丸傍点', end: '二重丸傍点終わり', className: 'bullseye', tag: 'em' },
    { start: '蛇の目傍点', end: '蛇の目傍点終わり', className: 'fisheye', tag: 'em' },
    { start: 'ばつ傍点', end: 'ばつ傍点終わり', className: 'saltire', tag: 'em' },

    { start: '左に傍点', end: '左に傍点終わり', className: 'sesame_dot_after', tag: 'em' },
    {
      start: '左に白ゴマ傍点',
      end: '左に白ゴマ傍点終わり',
      className: 'white_sesame_dot_after',
      tag: 'em',
    },
    { start: '左に丸傍点', end: '左に丸傍点終わり', className: 'black_circle_after', tag: 'em' },
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
    { start: '左に蛇の目傍点', end: '左に蛇の目傍点終わり', className: 'fisheye_after', tag: 'em' },
    { start: '左にばつ傍点', end: '左にばつ傍点終わり', className: 'saltire_after', tag: 'em' },

    { start: '傍線', end: '傍線終わり', className: 'underline_solid', tag: 'em' },
    { start: '二重傍線', end: '二重傍線終わり', className: 'underline_double', tag: 'em' },
    { start: '鎖線', end: '鎖線終わり', className: 'underline_dotted', tag: 'em' },
    { start: '破線', end: '破線終わり', className: 'underline_dashed', tag: 'em' },
    { start: '波線', end: '波線終わり', className: 'underline_wave', tag: 'em' },

    { start: '左に傍線', end: '左に傍線終わり', className: 'overline_solid', tag: 'em' },
    { start: '左に二重傍線', end: '左に二重傍線終わり', className: 'overline_double', tag: 'em' },
    { start: '左に鎖線', end: '左に鎖線終わり', className: 'overline_dotted', tag: 'em' },
    { start: '左に破線', end: '左に破線終わり', className: 'overline_dashed', tag: 'em' },
    { start: '左に波線', end: '左に波線終わり', className: 'overline_wave', tag: 'em' },

    { start: '太字', end: '太字終わり', className: 'futoji', tag: 'span' },
    { start: '斜体', end: '斜体終わり', className: 'shatai', tag: 'span' },
    { start: '縦中横', end: '縦中横終わり', className: 'tcy', tag: 'span' },
    { start: '行右小書き', end: '行右小書き終わり', className: 'superscript', tag: 'sup' },
    { start: '行左小書き', end: '行左小書き終わり', className: 'subscript', tag: 'sub' },
    { start: '上付き小文字', end: '上付き小文字終わり', className: 'superscript', tag: 'sup' },
    { start: '下付き小文字', end: '下付き小文字終わり', className: 'subscript', tag: 'sub' },

    { start: '割り注', end: '割り注終わり', className: 'warichu', tag: 'span' },
    { start: 'キャプション', end: 'キャプション終わり', className: 'caption', tag: 'span' },
    { start: '同行中見出し', end: '同行中見出し終わり', className: 'inline-heading', tag: 'span' },
  ];

  for (const range of rangePatterns) {
    const startCandidates = [`［＃${range.start}］`, `［＃ここから${range.start}］`];
    const endCandidates = [`［＃${range.end}］`, `［＃ここで${range.start}終わり］`];

    while (true) {
      let startToken = '';
      let startIndex = -1;
      for (const candidate of startCandidates) {
        const idx = working.indexOf(candidate);
        if (idx !== -1 && (startIndex === -1 || idx < startIndex)) {
          startToken = candidate;
          startIndex = idx;
        }
      }

      if (startIndex === -1) break;

      const contentStart = startIndex + startToken.length;

      let endToken = '';
      let endIndex = -1;
      for (const candidate of endCandidates) {
        const idx = working.indexOf(candidate, contentStart);
        if (idx !== -1 && (endIndex === -1 || idx < endIndex)) {
          endToken = candidate;
          endIndex = idx;
        }
      }

      if (endIndex === -1) break;

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
  }

  // STEP 11: 内部表現プレースホルダー (AOZORA_INLINE) のHTML化
  working = working.replace(
    /\[\[AOZORA_INLINE:([^:\]]+):([^\]]+)\]\]/g,
    (_match, className, encodedTarget) => {
      const target = decodeURIComponent(encodedTarget);

      let html = '';

      if (className === 'tcy') {
        html = `<span class="tcy">${applyRubyAndEscape(target)}</span>`;
      } else if (className === 'keigakomi') {
        html = `<span class="keigakomi">${applyRubyAndEscape(target)}</span>`;
      } else if (className === 'yokogumi') {
        html = `<span class="yokogumi">${applyRubyAndEscape(target)}</span>`;
      } else if (className === 'superscript') {
        html = `<sup class="superscript">${applyRubyAndEscape(target)}</sup>`;
      } else if (className === 'subscript') {
        html = `<sub class="subscript">${applyRubyAndEscape(target)}</sub>`;
      } else if (className === 'caption') {
        html = `<span class="caption">${applyRubyAndEscape(target)}</span>`;
      } else if (className.startsWith('dai') || className.startsWith('sho')) {
        const n = Number(className.replace(/\D/g, '')) || 1;
        const isDai = className.startsWith('dai');
        const sizeMap: Record<number, string> = isDai
          ? { 1: 'large', 2: 'x-large' }
          : { 1: 'small', 2: 'x-small' };

        const size = sizeMap[n] ?? (isDai ? 'xx-large' : 'xx-small');

        html = `<span class="${className}" style="font-size: ${size};">${applyRubyAndEscape(target)}</span>`;
      } else {
        html = `<em class="${className}">${applyRubyAndEscape(target)}</em>`;
      }

      return `[[AOZORA_HTML:${encodeURIComponent(html)}]]`;
    }
  );

  // STEP 12: 見出しプレースホルダー (AOZORA_HEADING) のHTML化
  working = working.replace(
    /\[\[AOZORA_HEADING:([^:]+):([^:]+):([^\]]+)\]\]/g,
    (_match, tag, className, encodedTarget) =>
      `[[AOZORA_HTML:${encodeURIComponent(
        `<${tag} class="${className}">${decodeURIComponent(encodedTarget)}</${tag}>`
      )}]]`
  );

  // STEP 13: 不要なメタ注記・底本情報・単体見出し記号の消去
  working = working.replace(/［＃[大中小]］/g, '');
  working = working.replace(/［＃(?:[ルる][ビび]の)?(?:「.+?」は)?底本では.+?］/g, '');
  working = working.replace(/［＃「.+?[頁ページ]」は.+?］/g, '');
  working = working.replace(/［＃図(?:が入るが)?省略.*?］/g, '');
  working = working.replace(/［＃底本の親本では.*?］/g, '');
  working = working.replace(/［＃現代語訳.+?］/g, '');
  working = working.replace(/［＃.+?に(?:鋭|曲|平息|帯気)アクセント.*?］/g, '');
  working = working.replace(/［＃.+?は(?:小書き片仮名|上ドット付き|下ドット付き).*?］/g, '');

  // STEP 14: レイアウト指示・残余ブロック注記の安全な一括消去
  working = working.replace(
    /［＃(?:ここから|ここまで|ここで)?(?:地[からより])?(?:[０-９\d一二三四五六七八九十]+字)?(?:下げ|上げ|詰め|天付き|地付き|改ページ|改丁|改行|改段|改見開き|段組|本文終わり|ページの左右中央|大見出し|中見出し|小見出し|右寄せ|左寄せ).*?］/g,
    ''
  );

  // STEP 15: 孤立した「終了注記」の一括消去
  const UNPAIRED_END_ANNOTATION =
    /［＃(?:ここで)?(?:横組み|太字|斜体|傍点|傍線|縦中横|割り注|キャプション|字下げ|地付き|字上げ|字詰め|段組|大きな文字|小さな文字|罫囲み|枠囲み|行右小書き|行左小書き|(?:大|中|小)?見出し)(?:終わり|おわり)］/g;

  working = working.replace(UNPAIRED_END_ANNOTATION, '');

  // STEP 16: 未対応注記の検出・ログ出力・可視化タグ化
  working = working.replace(ANNOTATION_PATTERN, (raw) => {
    console.warn('[Aozora] unsupported inline annotation:', raw);
    return `[[AOZORA_HTML:${encodeURIComponent(`<span class="notes">${escapeHtml(raw)}</span>`)}]]`;
  });

  // STEP 17: 本文生テキスト部分へのルビ適用 + HTMLエスケープ処理
  working = applyRubyAndEscape(working);

  // STEP 18: AOZORA_HTML プレースホルダーの最終展開
  while (working.includes('[[AOZORA_HTML:')) {
    working = working.replace(/\[\[AOZORA_HTML:([^\]]+)\]\]/g, (_match, encodedHtml) =>
      decodeURIComponent(encodedHtml)
    );
  }

  return working;
}

/* ============================================================================
 * 補助関数: ルビ付きテキストの一致判定
 * ============================================================================ */

export function matchTargetAllowingRuby(before: string, target: string): string | null {
  const escapedChars = [...target].map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = escapedChars.join('(?:《[^》]*》)?') + '(?:《[^》]*》)?';
  const regex = new RegExp(pattern + '$');
  const match = before.match(regex);

  return match ? match[0] : null;
}

/* ============================================================================
 * 外字処理関連
 * ============================================================================ */

export const GAIJI_PATTERN = /※?［＃(.+?)[、,]\s*(?:第[34]水準)?(\d+-\d+-\d+)(?:[、,][^］]+)*］/g;

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

export function resolveGaiji(line: string, gaijiImages: Map<string, string>): string {
  return line.replace(GAIJI_PATTERN, (_match, description: string, jisCode?: string) => {
    if (jisCode) {
      const filename = gaijiImages.get(jisCode);

      if (filename) {
        const imgTag = `<img class="gaiji-inline" src="../images/${escapeHtml(filename)}" alt="${escapeHtml(description)}"/>`;
        return `[[AOZORA_HTML:${encodeURIComponent(imgTag)}]]`;
      }
    }

    const altText = approximateGaijiText(description);
    return `[[AOZORA_HTML:${encodeURIComponent(escapeHtml(altText))}]]`;
  });
}
