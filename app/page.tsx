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

  const { downloadingId, downloadBook } = useDownloadBook(saveHistory);

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
    </>
  );
}
