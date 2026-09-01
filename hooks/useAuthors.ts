'use client';

import { useEffect, useState } from 'react';

export interface AuthorEntry {
  author: string;
  author_kana: string;
  author_birth: string | null;
  author_death: string | null;
}

type UseAuthorsResult = {
  authors: AuthorEntry[];
  loading: boolean;
};

// books.json（数MB・全作品分）とは別に、著者の生没日だけを持つ
// 軽量な authors.json（数十〜百数十KB）を取得する。
// Recommendations は検索用インデックスの読み込みを待たずに描画できる。
export function useAuthors(): UseAuthorsResult {
  const [authors, setAuthors] = useState<AuthorEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch('/authors.json')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data)) {
          setAuthors(data);
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error('著者データの読み込みエラー:', error);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { authors, loading };
}
