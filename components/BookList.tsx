import type { Book } from '@/components/Recommendations';
import type { SearchResultBook } from '@/lib/bookSearch';

import BookCard from './BookCard';

type BookListProps = {
  books: SearchResultBook[];
  loading: boolean;
  savedHistoryMap: Record<string, number>;
  downloadingId: number | null;
  onDownload: (book: Book) => void;
};

export default function BookList({
  books,
  loading,
  savedHistoryMap,
  downloadingId,
  onDownload,
}: BookListProps) {
  if (!loading && books.length === 0) {
    return (
      <div className="text-center py-10 font-medium text-base text-foreground/80">
        該当する作品が見つかりませんでした。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {books.map((book, index) => (
        <BookCard
          key={`${book.id}-${index}`}
          book={book}
          savedAt={savedHistoryMap[String(book.id)]}
          downloading={downloadingId === book.id}
          onDownload={onDownload}
        />
      ))}
    </div>
  );
}
