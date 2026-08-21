type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex justify-center items-center gap-2 pt-4">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
        className="px-3 py-1.5 border border-border rounded-md text-sm font-bold text-foreground bg-card disabled:opacity-40"
      >
        前へ
      </button>

      <span className="text-sm font-bold text-foreground px-2">
        {currentPage} / {totalPages}
      </span>

      <button
        type="button"
        onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
        className="px-3 py-1.5 border border-border rounded-md text-sm font-bold text-foreground bg-card disabled:opacity-40"
      >
        次へ
      </button>
    </div>
  );
}
