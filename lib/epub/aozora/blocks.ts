import { zenToHanDigits } from '../escape';

import { headingInfo } from './headings';

import type { BlockState } from '../types';


export function parseBlockStart(annotation: string): BlockState | null {
  const cleanAnno = zenToHanDigits(annotation);

  // --- 既存の単一判定 ---
  const indent = cleanAnno.match(/^ここから(\d+)字下げ$/);
  if (indent) {
    return { type: 'indent', className: `jisage-${Number(indent[1])}` };
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
    return { type: 'burasage', amount: 0, wrapIndent: Number(burasageTentsuki[1]) };
  }

  if (cleanAnno === 'ここから地付き') return { type: 'chitsuki' };

  const chiyose = cleanAnno.match(/^ここから地から(\d+)字上げ$/);
  if (chiyose) return { type: 'chiyose', amount: Number(chiyose[1]) };

  const jizume = cleanAnno.match(/^ここから(\d+)字詰め$/);
  if (jizume) return { type: 'jizume', amount: Number(jizume[1]) };

  const dai = cleanAnno.match(/^ここから(\d+)段階大きな文字$/);
  if (dai) return { type: 'dai', amount: Number(dai[1]) };

  const sho = cleanAnno.match(/^ここから(\d+)段階小さな文字$/);
  if (sho) return { type: 'sho', amount: Number(sho[1]) };

  if (cleanAnno === 'ここからキャプション') return { type: 'caption' };

  const heading = cleanAnno.match(/^ここから(大|中|小)見出し$/);
  if (heading) {
    const info = headingInfo(`${heading[1]}見出し`);
    if (info) {
      return {
        type: 'heading',
        level: info.level,
        tag: info.tag,
        className: info.className,
      };
    }
  }

  const emphasis: Record<string, string> = {
    ここから傍点: 'sesame_dot',
    ここから白ゴマ傍点: 'white_sesame_dot',
    ここから丸傍点: 'black_circle',
    ここから白丸傍点: 'white_circle',
    ここから黒三角傍点: 'black_up-pointing_triangle',
    ここから白三角傍点: 'white_up-pointing_triangle',
    ここから二重丸傍点: 'bullseye',
    ここから蛇の目傍点: 'fisheye',
    ここからばつ傍点: 'saltire',
  };
  if (emphasis[cleanAnno]) return { type: 'emphasis', className: emphasis[cleanAnno] };

  const underline: Record<string, string> = {
    ここから傍線: 'underline_solid',
    ここから二重傍線: 'underline_double',
    ここから鎖線: 'underline_dotted',
    ここから破線: 'underline_dashed',
    ここから波線: 'underline_wave',
  };
  if (underline[cleanAnno]) return { type: 'underline', className: underline[cleanAnno] };

  if (cleanAnno === 'ここから左に傍点') return { type: 'emphasis', className: 'sesame_dot_after' };
  if (cleanAnno === 'ここから左に傍線') return { type: 'overline', className: 'overline_solid' };
  if (cleanAnno === 'ここから太字') return { type: 'bold', className: 'futoji' };
  if (cleanAnno === 'ここから斜体') return { type: 'italic', className: 'shatai' };
  if (cleanAnno === 'ここから罫囲み') return { type: 'keigakomi', className: 'keigakomi' };
  if (cleanAnno === 'ここから横組み') return { type: 'yokogumi', className: 'yokogumi' };

  // --- ★ 複合ブロック注記の分解解析 (フォールバック) ---
  if (cleanAnno.startsWith('ここから') && cleanAnno.includes('、')) {
    const body = cleanAnno.replace(/^ここから/, '').trim();
    const parts = body.split(/[、,]/).map((p) => p.trim());
    const classes: string[] = [];

    for (const part of parts) {
      const partIndent = part.match(/(\d+)字下げ/);
      if (partIndent) {
        classes.push(`jisage-${partIndent[1]}`);
        continue;
      }

      const partJizume = part.match(/(\d+)字詰め/);
      if (partJizume) {
        classes.push(`jizume_${partJizume[1]}`);
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

      if (part === '太字') {
        classes.push('futoji');
        continue;
      }

      if (part === '斜体') {
        classes.push('shatai');
        continue;
      }
    }

    if (classes.length > 0) {
      return {
        type: 'composite',
        classes,
      };
    }
  }

  return null;
}

export function isBlockEnd(annotation: string): boolean {
  const a = zenToHanDigits(annotation);

  return (
    /^ここで(大|中|小)見出し終わり$/.test(a) ||
    /^ここで\d+字下げ.*終わり$/.test(a) ||
    a.startsWith('ここで') ||
    a.endsWith('終わり') ||
    a.endsWith('おわり')
  );
}

export function blockEndType(annotation: string): BlockState['type'] | null {
  const a = zenToHanDigits(annotation);

  if (/ここで(大|中|小)見出し終わり$/.test(a)) return 'heading';
  if (/ここで\d+字下げ.*終わり$/.test(a) || a === 'ここで字下げ終わり') return null;

  // 複合指定の終了（例: ［＃ここで字下げ、罫囲み終わり］）は型チェックを緩和
  if (a.startsWith('ここで') && a.includes('、')) return null;

  if (a === 'ここで地付き終わり') return 'chitsuki';
  if (a === 'ここで字上げ終わり') return 'chiyose';
  if (a === 'ここで字詰め終わり') return 'jizume';
  if (a === 'ここで大きな文字終わり') return 'dai';
  if (a === 'ここで小さな文字終わり') return 'sho';
  if (a === 'ここでキャプション終わり') return 'caption';
  if (a.includes('傍点終わり')) return 'emphasis';
  if (a.includes('傍線終わり')) return a.includes('左に') ? 'overline' : 'underline';
  if (a === 'ここで太字終わり') return 'bold';
  if (a === 'ここで斜体終わり') return 'italic';
  if (a === 'ここで罫囲み終わり') return 'keigakomi';
  if (a === 'ここで横組み終わり') return 'yokogumi';

  return null;
}

export function blockTags(state: BlockState): {
  open: string;
  close: string;
} {
  switch (state.type) {
    case 'composite':
      return {
        open: `<div class="${(state.classes ?? []).join(' ')}">`,
        close: '</div>',
      };

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
      return {
        open: '<div class="caption">',
        close: '</div>',
      };

    case 'emphasis':
    case 'underline':
    case 'overline':
    case 'bold':
    case 'italic':
    case 'keigakomi':
    case 'yokogumi':
    case 'indent':
      return {
        open: `<div class="${state.className}">`,
        close: '</div>',
      };

    default:
      return {
        open: '',
        close: '',
      };
  }
}