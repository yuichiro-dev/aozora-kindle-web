// lib/genres.ts
export interface GenreGroup {
  name: string;
  authors: string[];
}

export const GENRE_GROUPS: GenreGroup[] = [
  // 中身はこれまで確定した最終版をそのまま移動
  // (ミステリー・怪奇探偵小説 〜 変格探偵小説・異端の探偵作家たち の15グループ)
];

/**
 * 空白・全角スペースを除去して比較用に正規化する。
 * books.json の author 表記ゆれ（"夏目 漱石" 等）を吸収する。
 */
export function normalizeAuthorName(name: string): string {
  return name.replace(/[\s\u3000・.,-]+/g, '');
}

/** GENRE_GROUPSに登場する著者を重複無しで一覧化する */
export function getAllGenreAuthors(): string[] {
  const set = new Set<string>();
  for (const group of GENRE_GROUPS) {
    for (const author of group.authors) {
      set.add(author);
    }
  }
  return [...set];
}

/** 著者名から、その著者が属するジャンル名一覧を返す */
export function getGenresForAuthor(author: string): string[] {
  const normalized = normalizeAuthorName(author);
  return GENRE_GROUPS.filter((g) =>
    g.authors.some((a) => normalizeAuthorName(a) === normalized)
  ).map((g) => g.name);
}
