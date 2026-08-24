import { parseJapaneseOrArabicNumber, zenToHanDigits } from '../escape';
import type { BlockState } from '../types';

export function parseBlockStart(annotation: string): BlockState | null {
  const cleanAnno = zenToHanDigits(annotation);

  // 「ここから」があってもなくても解析できるようにプレフィックスを除去
  const body = cleanAnno.replace(/^ここから/, '').trim();

  // 1. 天から〜字下げ
  const tenIndent = body.match(/^天から([０-９\d一二三四五六七八九十]+)字下げ$/);
  if (tenIndent) {
    const n = parseJapaneseOrArabicNumber(tenIndent[1]);
    if (n > 0) return { type: 'indent', className: `jisage-${n}` };
  }

  // 2. 〜字下げ
  const indent = body.match(/^([０-９\d一二三四五六七八九十]+)字下げ$/);
  if (indent) {
    const n = parseJapaneseOrArabicNumber(indent[1]);
    if (n > 0) return { type: 'indent', className: `jisage-${n}` };
  }

  // 3. ぶら下げ (〜字下げ、折り返して〜字下げ)
  const burasageOtsu = body.match(
    /^([０-９\d一二三四五六七八九十]+)字下げ、折り返して([０-９\d一二三四五六七八九十]+)字下げ$/
  );
  if (burasageOtsu) {
    return {
      type: 'burasage',
      amount: parseJapaneseOrArabicNumber(burasageOtsu[1]),
      wrapIndent: parseJapaneseOrArabicNumber(burasageOtsu[2]),
    };
  }

  // 4. 改行天付きぶら下げ
  const burasageTentsuki = body.match(
    /^(?:改行)?天付き、折り返して([０-９\d一二三四五六七八九十]+)字下げ$/
  );
  if (burasageTentsuki) {
    return {
      type: 'burasage',
      amount: 0,
      wrapIndent: parseJapaneseOrArabicNumber(burasageTentsuki[1]),
    };
  }

  if (body === '地付き') return { type: 'chitsuki' };

  const chiyose = body.match(/^地から([０-９\d一二三四五六七八九十]+)字上げ$/);
  if (chiyose) return { type: 'chiyose', amount: parseJapaneseOrArabicNumber(chiyose[1]) };

  const jizume = body.match(/^([０-９\d一二三四五六七八九十]+)字詰め$/);
  if (jizume) return { type: 'jizume', amount: parseJapaneseOrArabicNumber(jizume[1]) };

  const dai = body.match(/^([０-９\d一二三四五六七八九十]+)段階大きな文字$/);
  if (dai) return { type: 'dai', amount: parseJapaneseOrArabicNumber(dai[1]) };

  const sho = body.match(/^([０-９\d一二三四五六七八九十]+)段階小さな文字$/);
  if (sho) return { type: 'sho', amount: parseJapaneseOrArabicNumber(sho[1]) };

  if (body === 'キャプション') return { type: 'caption' };
  if (body === '罫囲み' || body === '枠囲み') return { type: 'keigakomi', className: 'keigakomi' };
  if (body === '横組み') return { type: 'yokogumi', className: 'yokogumi' };

  // 複合指定 (例: ２字下げ、２２字詰め、罫囲み)
  if (body.includes('、')) {
    const parts = body.split(/[、,]/).map((p) => p.trim());
    const classes: string[] = [];

    for (const part of parts) {
      const partIndent = part.match(/([０-９\d一二三四五六七八九十]+)字下げ/);
      if (partIndent) {
        classes.push(`jisage-${parseJapaneseOrArabicNumber(partIndent[1])}`);
        continue;
      }
      const partJizume = part.match(/([０-９\d一二三四五六七八九十]+)字詰め/);
      if (partJizume) {
        classes.push(`jizume_${parseJapaneseOrArabicNumber(partJizume[1])}`);
        continue;
      }
      if (part === '罫囲み' || part === '枠囲み') {
        classes.push('keigakomi');
        continue;
      }
      if (part === '横組み') {
        classes.push('yokogumi');
        continue;
      }
    }

    if (classes.length > 0) {
      return { type: 'composite', classes };
    }
  }

  return null;
}

export function isBlockEnd(annotation: string): boolean {
  const a = zenToHanDigits(annotation);
  return a.startsWith('ここで') || a.endsWith('終わり') || a.endsWith('おわり');
}

export function blockEndType(): BlockState['type'] | null {
  return null;
}

export function blockTags(state: BlockState): { open: string; close: string } {
  switch (state.type) {
    case 'composite':
      return {
        open: `<div class="${(state.classes ?? []).join(' ')}">`,
        close: '</div>',
      };
    case 'indent':
      return {
        open: `<div class="${state.className}">`,
        close: '</div>',
      };
    case 'burasage': {
      const wrap = state.wrapIndent ?? 0;
      const indent = state.amount ?? 0;
      return {
        open: `<div class="burasage" style="margin-left: ${wrap}em; text-indent: ${indent - wrap}em;">`,
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
      const size = n === 1 ? 'large' : n === 2 ? 'x-large' : 'xx-large';
      return {
        open: `<div class="dai${n}" style="font-size:${size};">`,
        close: '</div>',
      };
    }
    case 'sho': {
      const n = state.amount ?? 1;
      const size = n === 1 ? 'small' : n === 2 ? 'x-small' : 'xx-small';
      return {
        open: `<div class="sho${n}" style="font-size:${size};">`,
        close: '</div>',
      };
    }
    case 'caption':
      return { open: '<div class="caption">', close: '</div>' };
    case 'emphasis':
    case 'underline':
    case 'overline':
    case 'bold':
    case 'italic':
    case 'keigakomi':
    case 'yokogumi':
      return { open: `<div class="${state.className}">`, close: '</div>' };
    default:
      return { open: '<div>', close: '</div>' };
  }
}
