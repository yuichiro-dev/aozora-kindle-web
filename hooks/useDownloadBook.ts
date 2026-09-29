'use client';

import { useCallback, useState } from 'react';

import type { Book } from '@/components/Recommendations';

type SaveHistory = (id: string | number, title: string, author: string) => void;

export function useDownloadBook(saveHistory: SaveHistory) {
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  // ダウンロード直後に上部案内を表示するためのフラグ
  const [showGuide, setShowGuide] = useState(false);

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
          throw new Error('EPUBの生成に失敗しました。');
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

        // ダウンロード実行直後に上部誘導のブラー画面を表示
        setShowGuide(true);
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
    showGuide,
    closeGuide: () => setShowGuide(false),
  };
}