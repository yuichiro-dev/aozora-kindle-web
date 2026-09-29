'use client';

import { useCallback, useState } from 'react';
import type { Book } from '@/components/Recommendations';

type SaveHistory = (id: string | number, title: string, author: string) => void;

export interface PreparedBook {
  title: string;
  file: File;
  blob: Blob;
}

export function useDownloadBook(saveHistory: SaveHistory) {
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [preparedBook, setPreparedBook] = useState<PreparedBook | null>(null);

  const downloadBook = useCallback(
    async (book: Book) => {
      if (!book.zip_url) {
        alert('この作品にはテキスト形式のZIPファイルが用意されていません。');
        return;
      }

      setDownloadingId(book.id);
      const fullTitle = book.sub_title ? `${book.title} - ${book.sub_title}` : book.title;

      try {
        const res = await fetch('/api/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: book.id }),
        });

        if (!res.ok) {
          throw new Error('EPUBの生成に失敗しました。');
        }

        const blob = await res.blob();
        saveHistory(book.id, fullTitle, book.author);

        const fileName = `${fullTitle}.epub`;
        const file = new File([blob], fileName, { type: 'application/epub+zip' });

        // 生成完了したらモーダルに渡す準備データとして保持
        setPreparedBook({
          title: fullTitle,
          file,
          blob,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '不明なエラーが発生しました';
        alert(`エラー: ${message}`);
      } finally {
        setDownloadingId(null);
      }
    },
    [saveHistory]
  );

  return {
    downloadingId,
    downloadBook,
    preparedBook,
    clearPreparedBook: () => setPreparedBook(null),
  };
}