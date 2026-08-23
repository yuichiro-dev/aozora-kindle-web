// components/AuthorBookList.tsx
'use client';

interface Book {
  id: number;
  title: string;
  author: string;
  zip_url: string | null;
}

async function downloadEpub(id: number, title: string) {
  const res = await fetch('/api/convert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });

  if (!res.ok) {
    alert('ダウンロードに失敗しました。');
    return;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title}.epub`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuthorBookList({ books }: { books: Book[] }) {
  return (
    <ul className="space-y-2">
      {books.map((book) => (
        <li key={book.id} className="flex items-center justify-between border-b border-border py-2">
          <span className="text-sm text-foreground">{book.title}</span>
          <button
            onClick={() => downloadEpub(book.id, book.title)}
            disabled={!book.zip_url}
            className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-40"
          >
            Kindle用に変換
          </button>
        </li>
      ))}
    </ul>
  );
}
