'use client';

import { useCallback, useState } from 'react';

import type { Book } from '@/components/Recommendations';

type SaveHistory = (id: string | number, title: string, author: string) => void;

export function useDownloadBook(saveHistory: SaveHistory) {
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

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
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: book.id,
          }),
        });

        if (!res.ok) {
          let message = 'EPUBの生成に失敗しました。';

          try {
            const errorData = await res.json();

            if (errorData?.error) {
              message = errorData.error;
            }
          } catch {
            // JSONではないレスポンスの場合は
            // デフォルトメッセージを使用
          }

          throw new Error(message);
        }

        const blob = await res.blob();

        saveHistory(book.id, fullTitle, book.author);

        const url = window.URL.createObjectURL(blob);

        const a = document.createElement('a');

        a.href = url;
        a.download = `${fullTitle}.epub`;

        document.body.appendChild(a);
        a.click();
        a.remove();

        window.URL.revokeObjectURL(url);
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
  };
}
