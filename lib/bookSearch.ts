import type { Book } from '@/components/Recommendations';

export type SearchResultBook = Book & {
  isDuplicate: boolean;
};

export type Suggestion = {
  type: 'author' | 'title';
  text: string;
};

export const toKatakana = (str: string): string =>
  str.replace(/[\u3041-\u3096]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));

export const cleanStr = (str: string | null | undefined): string =>
  str ? str.replace(/[\s\u3000・\.\,]+/g, '').toLowerCase() : '';

export function searchBooks(books: Book[], query: string): SearchResultBook[] {
  if (!query.trim()) return [];

  const fullCleanQuery = cleanStr(query);
  const katakanaQuery = toKatakana(fullCleanQuery);

  const keywords = query
    .trim()
    .split(/[\s\u3000・\.\,]+/)
    .map((k) => cleanStr(k))
    .filter(Boolean);

  const katakanaKeywords = keywords.map(toKatakana);

  const matched = books.filter((b) => {
    const title = cleanStr(b.title);
    const titleKana = cleanStr(b.title_kana);
    const subTitle = cleanStr(b.sub_title);
    const subTitleKana = cleanStr(b.sub_title_kana);
    const author = cleanStr(b.author);
    const authorKana = cleanStr(b.author_kana);
    const authorEn = cleanStr(b.author_en);

    const authorEnParts = (b.author_en || '').split(/[\s\u3000]+/);

    const authorEnReversed =
      authorEnParts.length > 1
        ? cleanStr(`${authorEnParts.slice(1).join('')}${authorEnParts[0]}`)
        : '';

    const isDirectMatch =
      (author && (author.includes(fullCleanQuery) || author.includes(katakanaQuery))) ||
      (authorKana && (authorKana.includes(fullCleanQuery) || authorKana.includes(katakanaQuery))) ||
      (authorEn && authorEn.includes(fullCleanQuery)) ||
      (authorEnReversed && authorEnReversed.includes(fullCleanQuery)) ||
      (title && (title.includes(fullCleanQuery) || title.includes(katakanaQuery))) ||
      (titleKana && (titleKana.includes(fullCleanQuery) || titleKana.includes(katakanaQuery)));

    if (isDirectMatch) return true;

    return keywords.every((kw, idx) => {
      const kKata = katakanaKeywords[idx];

      return (
        title.includes(kw) ||
        title.includes(kKata) ||
        titleKana.includes(kw) ||
        titleKana.includes(kKata) ||
        subTitle.includes(kw) ||
        subTitle.includes(kKata) ||
        subTitleKana.includes(kw) ||
        subTitleKana.includes(kKata) ||
        author.includes(kw) ||
        author.includes(kKata) ||
        authorKana.includes(kw) ||
        authorKana.includes(kKata) ||
        authorEn.includes(kw) ||
        authorEnReversed.includes(kw)
      );
    });
  });

  const countMap = new Map<string, number>();

  matched.forEach((b) => {
    const key = `${b.title}_${b.sub_title || ''}_${b.author}`;
    countMap.set(key, (countMap.get(key) || 0) + 1);
  });

  return matched
    .map((b) => {
      const key = `${b.title}_${b.sub_title || ''}_${b.author}`;

      return {
        ...b,
        isDuplicate: (countMap.get(key) || 0) > 1,
      };
    })
    .sort((a, b) => {
      // ① 新字新仮名を優先
      const isNewA = a.kana_type ? /新/.test(a.kana_type) : true;
      const isNewB = b.kana_type ? /新/.test(b.kana_type) : true;

      if (isNewA !== isNewB) {
        return isNewA ? -1 : 1;
      }

      // ② 親タイトル
      const mainTitleA = (a.title || '').replace(/[“”"'「」『』【】（）()]/g, '').trim();

      const mainTitleB = (b.title || '').replace(/[“”"'「」『』【】（）()]/g, '').trim();

      const mainDiff = mainTitleA.localeCompare(mainTitleB, 'ja');

      if (mainDiff !== 0) {
        return mainDiff;
      }

      // ③ 副題・話数
      const subA = (a.sub_title || '').trim();
      const subB = (b.sub_title || '').trim();

      const numA = parseInt((subA.match(/\d+/) || [])[0] || '-1', 10);

      const numB = parseInt((subB.match(/\d+/) || [])[0] || '-1', 10);

      if (numA !== -1 && numB !== -1 && numA !== numB) {
        return numA - numB;
      }

      const subDiff = subA.localeCompare(subB, 'ja', { numeric: true });

      if (subDiff !== 0) {
        return subDiff;
      }

      // ④ 出版年の新しい順
      const yearA = parseInt(a.publication_year || '0', 10);

      const yearB = parseInt(b.publication_year || '0', 10);

      if (yearA !== yearB) {
        return yearB - yearA;
      }

      return a.id - b.id;
    });
}

export function getSuggestions(books: Book[], query: string): Suggestion[] {
  const trimmed = query.trim();

  if (!trimmed || books.length === 0) {
    return [];
  }

  const cleanQ = cleanStr(trimmed);
  const katakanaQ = toKatakana(cleanQ);

  const matchedAuthors = new Set<string>();
  const matchedTitles = new Set<string>();

  for (const book of books) {
    if (matchedAuthors.size + matchedTitles.size >= 8) {
      break;
    }

    const author = book.author ? book.author.replace(/[\s\u3000]+/g, '') : '';

    const authorKana = cleanStr(book.author_kana);
    const authorEn = cleanStr(book.author_en);
    const title = book.title;
    const titleKana = cleanStr(book.title_kana);

    if (
      author &&
      !matchedAuthors.has(author) &&
      (cleanStr(author).includes(cleanQ) ||
        cleanStr(author).includes(katakanaQ) ||
        authorKana.includes(cleanQ) ||
        authorKana.includes(katakanaQ) ||
        authorEn.includes(cleanQ))
    ) {
      matchedAuthors.add(author);
    }

    if (
      title &&
      !matchedTitles.has(title) &&
      (cleanStr(title).includes(cleanQ) ||
        cleanStr(title).includes(katakanaQ) ||
        titleKana.includes(cleanQ) ||
        titleKana.includes(katakanaQ))
    ) {
      matchedTitles.add(title);
    }
  }

  const list: Suggestion[] = [];

  matchedAuthors.forEach((author) => {
    list.push({
      type: 'author',
      text: author,
    });
  });

  matchedTitles.forEach((title) => {
    list.push({
      type: 'title',
      text: title,
    });
  });

  return list.slice(0, 6);
}
