'use client';

import { useCallback, useState } from 'react';

import type { Book } from '@/components/Recommendations';

type SaveHistory = (id: string | number, title: string, author: string) => void;
type FallbackCallback = (title: string) => void;

export function useDownloadBook(
  saveHistory: SaveHistory,
  onFallbackDownload?: FallbackCallback
) {
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
            // JSONではないレスポンスの場合はデフォルトメッセージを使用
          }

          throw new Error(message);
        }

        const blob = await res.blob();

        // 読書履歴の保存
        saveHistory(book.id, fullTitle, book.author);

        // Web Share API 用の File オブジェクトを作成
        const fileName = `${fullTitle}.epub`;
        const file = new File([blob], fileName, { type: 'application/epub+zip' });

        // 1. Android / iPhone等で共有APIがサポートされている場合
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: fullTitle,
            text: `${fullTitle} を開く`,
          });
        } else {
          // 2. PCなどの非対応環境は通常のダウンロード ＋ モーダル（またはダイアログ）通知
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');

          a.href = url;
          a.download = fileName;

          document.body.appendChild(a);
          a.click();
          a.remove();

          window.URL.revokeObjectURL(url);

          // フォールバック用の通知（モーダル等）を表示するコールバック呼び出し
          if (onFallbackDownload) {
            onFallbackDownload(fullTitle);
          }
        }
      } catch (error: unknown) {
        // ユーザーがスマホの共有パネルで「キャンセル」を押した際の中断はエラーアラートを出さない
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        const message = error instanceof Error ? error.message : '不明なエラーが発生しました';
        alert(`エラー: ${message}`);
      } finally {
        setDownloadingId(null);
      }
    },
    [saveHistory, onFallbackDownload]
  );

  return {
    downloadingId,
    downloadBook,
  };
}