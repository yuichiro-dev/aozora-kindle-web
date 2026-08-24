export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const escapeHtml = escapeXml;

export function zenToHanDigits(str: string): string {
  return str.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
}

/**
 * 全角・半角・漢数字（1〜99）を数値に変換する
 */
export function parseJapaneseOrArabicNumber(str: string): number {
  const normalized = zenToHanDigits(str);
  const num = parseInt(normalized, 10);
  if (!isNaN(num)) return num;

  const kanjiMap: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };

  if (str === '十') return 10;
  if (kanjiMap[str]) return kanjiMap[str];

  if (str.startsWith('十')) return 10 + (kanjiMap[str[1]] || 0);
  if (str.endsWith('十')) return (kanjiMap[str[0]] || 1) * 10;
  if (str.length === 3 && str[1] === '十') {
    return (kanjiMap[str[0]] || 1) * 10 + (kanjiMap[str[2]] || 0);
  }

  return 0;
}
