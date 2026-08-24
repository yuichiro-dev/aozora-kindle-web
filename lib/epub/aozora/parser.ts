import { ANNOTATION_PATTERN, IMAGE_ANNOTATION_PATTERN } from '../constants';

import { escapeXml, parseJapaneseOrArabicNumber, zenToHanDigits } from '../escape';

import { blockEndType, blockTags, isBlockEnd, parseBlockStart } from './blocks';

import { headingInfo } from './headings';

import { renderInline } from './inline';

import type { BlockState } from '../types';

const CHITSUKI_INLINE = /［＃地付き］/;
const CHIYOSE_INLINE = /［＃地から(\d+|[０-９]+)字上げ］/;

function tryRenderTrailingAlignment(
  line: string,
  gaijiImages: Map<string, string>
): string[] | null {
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

  const amount = isChiyose ? parseJapaneseOrArabicNumber((chiyoseMatch as RegExpMatchArray)[1]) : 0;
  const out: string[] = [];

  if (prefix.trim() !== '') {
    out.push(`<p>${renderInline(prefix, gaijiImages)}</p>`);
  }

  out.push(
    `<div class="chitsuki_${amount}" ` +
      `style="text-align:right; margin-right: ${amount}em">` +
      `${renderInline(suffix, gaijiImages)}` +
      `</div>`
  );

  return out;
}

function renderNormalLine(line: string, gaijiImages: Map<string, string>): string {
  let working = zenToHanDigits(line);

  let inlineIndent = 0;

  const inlineIndentMatches = [...working.matchAll(/［＃(\d+)字下げ］/g)];

  for (const match of inlineIndentMatches) {
    inlineIndent = Math.max(inlineIndent, parseJapaneseOrArabicNumber(match[1]));
  }

  working = working.replace(/［＃\d+字下げ］/g, '');

  const content = renderInline(working, gaijiImages);

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
 * gaijiImages は「JISコード → EPUB内の画像ファイル名」のマップ（省略時は外字画像を使わずテキスト近似のみ）。
 */
export function parseAozoraTxtToHtml(
  rawTxt: string,
  gaijiImages: Map<string, string> = new Map()
): string {
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
     * ブロック注記（単独行・複合注記・スペース付き注記）
     */
    const annotations = [...trimmed.matchAll(ANNOTATION_PATTERN)].map((m) => m[0].slice(2, -1));
    const isAnnotationOnlyLine = trimmed.replace(ANNOTATION_PATTERN, '').trim() === '';

    if (annotations.length > 0 && isAnnotationOnlyLine) {
      let handled = false;

      for (const annotation of annotations) {
        // 1. ブロック終了（「ここで〜終わり」）
        if (isBlockEnd(annotation)) {
          closeBlock(blockEndType()); // ★ 引数なしで呼び出し
          handled = true;
          continue;
        }

        // 2. ブロック開始の判定
        const state = parseBlockStart(annotation);

        if (state) {
          // もし直前が字下げ/ぶら下げブロックで、閉じタグのないまま新しい字下げ注記が来たら
          // 自動で前の字下げブロックをポップして閉じる（スタック蓄積の防止）
          if (blockStack.length > 0 && (state.type === 'indent' || state.type === 'burasage')) {
            const top = blockStack[blockStack.length - 1];
            if (top.type === 'indent' || top.type === 'burasage') {
              closeBlock(null);
            }
          }

          const { open } = blockTags(state);
          htmlResult.push(open);
          blockStack.push(state);
          handled = true;
          continue;
        }
      }

      if (handled) {
        continue;
      }
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

          const indent = indentMatch ? parseJapaneseOrArabicNumber(indentMatch[1]) : 0;

          const headingClass =
            formType === '同行'
              ? `dogyo-${info.className}`
              : formType === '窓'
                ? `mado-${info.className}`
                : info.className;

          const renderedHeading =
            `<${info.tag} class="${headingClass}">` +
            `${renderInline(target, gaijiImages)}` +
            `</${info.tag}>`;

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
    const leadingIndentMatch = trimmed.match(/^［＃([\d０-９]+)字下げ］/);
    const afterIndent = leadingIndentMatch ? trimmed.slice(leadingIndentMatch[0].length) : trimmed;
    const leadingIndent = leadingIndentMatch
      ? parseJapaneseOrArabicNumber(leadingIndentMatch[1])
      : 0;

    const headingOpenClose = afterIndent.match(
      /^［＃((?:同行|窓)?(大|中|小)見出し)］(.+?)［＃\1終わり］/
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

        const renderedHeading =
          `<${info.tag} class="${className}">` +
          `${renderInline(content, gaijiImages)}` +
          `</${info.tag}>`;

        htmlResult.push(
          leadingIndent > 0
            ? `<div class="jisage-${leadingIndent}">${renderedHeading}</div>`
            : renderedHeading
        );

        continue;
      }
    }

    /*
     * 地付き / 字上げ
     */
    const alignmentResult = tryRenderTrailingAlignment(line, gaijiImages);

    if (alignmentResult) {
      htmlResult.push(...alignmentResult);

      continue;
    }

    /*
     * 通常行
     */
    const rendered = renderNormalLine(line, gaijiImages);

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
