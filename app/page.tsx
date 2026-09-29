'use client';

import { useMemo, useState } from 'react';

import Header from '@/components/Header';
import Recommendations from '@/components/Recommendations';

import BookCount from '@/components/BookCount';
import BookList from '@/components/BookList';
import Footer from '@/components/Footer';
import Pagination from '@/components/Pagination';
import SearchBar from '@/components/SearchBar';

import { useBookHistory } from '@/hooks/useBookHistory';
import { useBookSearch } from '@/hooks/useBookSearch';
import { useBooks } from '@/hooks/useBooks';
import { useDownloadBook } from '@/hooks/useDownloadBook';

const ITEMS_PER_PAGE = 20;

export default function Home() {
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const { books, loading, bookCount, lastUpdated } = useBooks();
  const { savedHistoryMap, saveHistory } = useBookHistory();
  const { filteredBooks, suggestions } = useBookSearch(books, query);

  const { downloadingId, downloadBook, preparedBook, clearPreparedBook } =
    useDownloadBook(saveHistory);

  const totalPages = Math.ceil(filteredBooks.length / ITEMS_PER_PAGE);

  const currentBooks = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;

    return filteredBooks.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredBooks, currentPage]);

  const hasQuery = query.trim().length > 0;

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setCurrentPage(1);
  };

  const handleSelectSuggestion = (text: string) => {
    setQuery(text);
    setCurrentPage(1);
  };

  const handleClear = () => {
    setQuery('');
    setCurrentPage(1);
  };

  // モーダル内の「開く」ボタンが押された時の処理（ユーザー操作の直後なので Permission denied にならない）
  const handleOpenApp = async () => {
    if (!preparedBook) return;

    // スマホの Web Share API が使える場合
    if (navigator.canShare && navigator.canShare({ files: [preparedBook.file] })) {
      try {
        await navigator.share({
          files: [preparedBook.file],
          title: preparedBook.title,
          text: `${preparedBook.title} を開く`,
        });
        clearPreparedBook(); // 共有完了したらモーダルを閉じる
        return;
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          // ユーザーが共有メニューをキャンセルした場合は何もしない
          return;
        }
      }
    }

    // 非対応（PC等）の場合は通常のダウンロードを実行
    const url = window.URL.createObjectURL(preparedBook.blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = `${preparedBook.title}.epub`;

    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
    clearPreparedBook();
  };

  return (
    <>
      <Header />

      <main className="min-h-screen bg-background p-4 md:p-10">
        <div className="max-w-4xl mx-auto space-y-5">
          <BookCount count={bookCount} lastUpdated={lastUpdated} hidden={hasQuery} />

          <SearchBar
            value={query}
            suggestions={suggestions}
            disabled={loading}
            onChange={handleQueryChange}
            onSelect={handleSelectSuggestion}
            onClear={handleClear}
          />

          <p className="text-xs sm:text-sm mt-2 px-1 flex items-center gap-1.5 font-bold text-foreground">
            <span>「夏目漱石 こころ」のようにスペースを空けて作品名も絞り込めます</span>
          </p>

          <Recommendations searchQuery={query} onSelectAuthor={handleSelectSuggestion} />

          {hasQuery && (
            <>
              <div className="flex justify-between items-center text-sm font-bold text-foreground">
                <span>
                  {loading
                    ? 'データ読み込み中...'
                    : `該当作品: ${filteredBooks.length.toLocaleString()} 件`}
                </span>

                {totalPages > 1 && (
                  <span>
                    ページ {currentPage} / {totalPages}
                  </span>
                )}
              </div>

              <BookList
                books={currentBooks}
                loading={loading}
                savedHistoryMap={savedHistoryMap}
                downloadingId={downloadingId}
                onDownload={downloadBook}
              />

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </>
          )}

          <Footer />
        </div>
      </main>

      {/* EPUB準備完了モーダル */}
      {preparedBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-background rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl space-y-5 border border-border animate-fade-in">
            <div className="text-4xl">📚</div>

            <div>
              <h3 className="text-lg font-bold text-foreground">{preparedBook.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">本の準備が完了しました</p>
            </div>

            {/* この「開く」ボタンをユーザーが直接タップすることで、100%確実にアプリ共有パネルが起動します */}
            <button
              onClick={handleOpenApp}
              className="w-full py-4 bg-orange-500 text-white font-bold text-lg rounded-2xl shadow-lg hover:bg-orange-600 active:scale-95 transition"
            >
              📖 Kindle・アプリで開く
            </button>

            <button
              onClick={clearPreparedBook}
              className="text-xs text-muted-foreground underline pt-1 block mx-auto"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </>
  );
}