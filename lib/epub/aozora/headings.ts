export interface HeadingInfo {
  level: 1 | 2 | 3;
  tag: 'h2' | 'h3' | 'h4';
  className: 'o-midashi' | 'naka-midashi' | 'ko-midashi';
}

export function headingInfo(levelText: string): HeadingInfo | null {
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
