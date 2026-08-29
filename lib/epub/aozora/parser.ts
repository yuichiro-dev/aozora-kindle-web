import { ANNOTATION_PATTERN, IMAGE_ANNOTATION_PATTERN } from '../constants';

import { escapeXml, parseJapaneseOrArabicNumber, zenToHanDigits } from '../escape';

import { blockEndType, blockTags, isBlockEnd, parseBlockStart } from './blocks';

import { headingInfo } from './headings';

import { renderInline } from './inline';

import type { BlockState } from '../types';

function renderNormalLine(line: string, gaijiImages: Map<string, string>): string {
  let working = zenToHanDigits(line);

  let inlineIndent = 0;

  const inlineIndentPattern = /［＃([0-9０-９一二三四五六七八九十]+)字下げ］/g;

  for (const match of working.matchAll(inlineIndentPattern)) {
    inlineIndent = Math.max(inlineIndent, parseJapaneseOrArabicNumber(match[1]));
  }

  working = working.replace(inlineIndentPattern, '');

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

export function parseAozoraTxtToHtml(
  rawTxt: string,
  gaijiImages: Map<string, string> = new Map()
): string {
  const lines = rawTxt.split(/\r?\n/);

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
     * 改ページ・改丁・改見開き・改頁（すべての表記ゆれを網羅）
     */
    if (
      trimmed === '［＃改ページ］' ||
      trimmed === '［＃改頁］' ||
      trimmed === '［＃改丁］' ||
      trimmed === '［＃改見開き］'
    ) {
      if (inPageCenter) {
        htmlResult.push('</div>');
        inPageCenter = false;
      }

      htmlResult.push('<div class="page-break"></div>');
      continue;
    }

    /*
     * 改段・段組
     */
    if (trimmed === '［＃改段］') {
      htmlResult.push('<span class="notes">［＃改段］</span>');
      continue;
    }

    if (trimmed.includes('［＃ここから') && trimmed.includes('段組］')) {
      htmlResult.push('<div class="multicolumn">');
      continue;
    }

    if (trimmed.includes('［＃ここで段組終わり］') || trimmed.includes('［＃段組終わり］')) {
      htmlResult.push('</div>');
      continue;
    }

    /*
     * 単独行画像（汎用判定＋既存パターン）
     */
    const generalImageMatch = trimmed.match(
      /^［＃.*?[（(]([a-zA-Z0-9_\-]+\.(?:png|jpg|jpeg|gif))[）].*?］$/
    );

    if (generalImageMatch) {
      const fileName = generalImageMatch[1].trim();

      htmlResult.push(
        `<div class="illust">` +
          `<img src="../images/${escapeXml(fileName)}" alt="挿絵・外字" />` +
          `</div>`
      );

      continue;
    }

    IMAGE_ANNOTATION_PATTERN.lastIndex = 0;
    const imageMatch = IMAGE_ANNOTATION_PATTERN.exec(trimmed);

    if (imageMatch && trimmed === imageMatch[0]) {
      const fileName = imageMatch[1].trim();

      htmlResult.push(
        `<div class="illust">` + `<img src="../images/${escapeXml(fileName)}" alt="" />` + `</div>`
      );

      continue;
    }

    /*
     * ブロック注記
     */
    const annotations = [...trimmed.matchAll(ANNOTATION_PATTERN)].map((m) => m[0].slice(2, -1));
    const isAnnotationOnlyLine = trimmed.replace(ANNOTATION_PATTERN, '').trim() === '';

    if (annotations.length > 0 && isAnnotationOnlyLine) {
      let handled = false;

      for (const annotation of annotations) {
        if (isBlockEnd(annotation)) {
          closeBlock(blockEndType());
          handled = true;
          continue;
        }

        const state = parseBlockStart(annotation);

        if (state) {
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
     * 見出し処理
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
            htmlResult.push(`<div class="jisage-${indent}">${renderedHeading}</div>`);
          } else {
            htmlResult.push(renderedHeading);
          }

          continue;
        }
      }
    }

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
     * 通常行（地上げ・地付きのインライン／ブロック共通処理を renderInline 内で一括吸収）
     */
    const rendered = renderNormalLine(line, gaijiImages);

    htmlResult.push(rendered);
  }

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
