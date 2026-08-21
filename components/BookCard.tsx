import type { Book } from '@/components/Recommendations';
import { formatHistoryDate } from '@/lib/bookHistory';

type BookCardProps = {
  book: Book & {
    isDuplicate?: boolean;
  };
  savedAt?: number;
  downloading: boolean;
  onDownload: (book: Book) => void;
};

export default function BookCard({ book, savedAt, downloading, onDownload }: BookCardProps) {
  const metadata = [
    book.kana_type,
    book.publication_year ? `${book.publication_year}年` : null,
    book.publisher,
  ]
    .filter(Boolean)
    .join(' / ');

  return (
    <div className="p-3.5 sm:p-4 bg-card border border-border rounded-xl shadow-sm flex items-center justify-between gap-3 hover:border-foreground/40 transition-all">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-foreground leading-snug break-words">
            {book.title}
          </h2>

          {book.sub_title && (
            <span className="text-sm font-medium text-foreground/80 leading-snug break-words">
              {book.sub_title}
            </span>
          )}

          {book.isDuplicate && metadata && (
            <span
              className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-normal border border-border shrink-0 max-w-full truncate"
              title={metadata}
            >
              {metadata}
            </span>
          )}
        </div>

        <p className="text-base font-medium text-foreground/80 leading-tight break-words flex flex-wrap items-center gap-2">
          <span>{book.author}</span>

          {savedAt && (
            <span className="text-sm text-primary font-normal">
              （前回保存: {formatHistoryDate(savedAt)}）
            </span>
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onDownload(book)}
        disabled={downloading || !book.zip_url}
        className={`shrink-0 whitespace-nowrap px-5 py-2.5 sm:px-6 sm:py-3 rounded-lg font-bold text-base sm:text-lg transition-all duration-200 shadow-sm ${
          !book.zip_url
            ? 'bg-muted text-muted-foreground border border-border cursor-not-allowed shadow-none'
            : downloading
              ? 'bg-muted-foreground text-background cursor-wait animate-pulse'
              : savedAt
                ? 'bg-success/10 border border-success/30 text-success hover:bg-success/20 active:bg-success/30'
                : 'bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] shadow'
        }`}
      >
        {downloading ? '生成中...' : savedAt ? '再保存' : '保存'}
      </button>
    </div>
  );
}
