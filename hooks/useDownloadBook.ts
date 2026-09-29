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
            // JSONでない場合はデフォルトメッセージ
          }
          throw new Error(message);
        }

        const blob = await res.blob();
        saveHistory(book.id, fullTitle, book.author);

        const fileName = `${fullTitle}.epub`;
        const file = new File([blob], fileName, { type: 'application/epub+zip' });

        // 標準ダウンロード処理（使い回すための共通処理）
        const triggerFallbackDownload = () => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);

          if (onFallbackDownload) {
            onFallbackDownload(String(fullTitle));
          }
        };

        // Web Share API に対応しており、HTTPS環境の場合
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: fullTitle,
              text: `${fullTitle} を開く`,
            });
          } catch (shareError: any) {
            // ユーザーが共有ダイアログを「キャンセル」した場合は何もせず終了
            if (shareError.name === 'AbortError') {
              return;
            }
            // Permission denied や NotAllowedError の場合は通常のダウンロードに切り替え
            console.warn('Web Share API 呼び出し制限のため、通常のダウンロードに切り替えます:', shareError);
            triggerFallbackDownload();
          }
        } else {
          // 非対応環境（PCブラウザ等）
          triggerFallbackDownload();
        }
      } catch (error: unknown) {
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