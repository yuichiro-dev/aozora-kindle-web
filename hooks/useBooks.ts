'use client';

import { useEffect, useState } from 'react';
import type { Book } from '@/components/Recommendations';

type UseBooksResult = {
  books: Book[];
  loading: boolean;
  bookCount: number | null;
  lastUpdated: string;
};

export function useBooks(): UseBooksResult {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookCount, setBookCount] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    fetch('/books.json')
      .then((res) => {
        const lastModified = res.headers.get('Last-Modified');

        if (lastModified) {
          const date = new Date(lastModified);

          const formattedDate =
            `${date.getFullYear()}/` +
            `${String(date.getMonth() + 1).padStart(2, '0')}/` +
            `${String(date.getDate()).padStart(2, '0')}`;

          setLastUpdated(formattedDate);
        }

        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setBooks(data);
          setBookCount(data.length);
        }

        setLoading(false);
      })
      .catch((error) => {
        console.error('インデックスデータの読み込みエラー:', error);

        setBookCount(0);
        setLoading(false);
      });
  }, []);

  return {
    books,
    loading,
    bookCount,
    lastUpdated,
  };
}
