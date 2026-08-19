'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Recommendations, { Book } from '@/components/Recommendations';

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [bookCount, setBookCount] = useState<number | null>(null);

  // インデックスデータ (/books.json) の取得
  useEffect(() => {
    fetch('/books.json')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setBooks(data);
          setBookCount(data.length);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('インデックスデータの読み込みエラー:', err);
        setBookCount(0);
        setLoading(false);
      });
  }, []);

  const cleanStr = (str: string | null) =>
    str ? str.replace(/[\s\u3000・\.\,]+/g, '').toLowerCase() : '';

  const filteredBooks = useMemo(() => {
    if (!query.trim()) return [];

    const fullCleanQuery = cleanStr(query);

    const keywords = query
      .trim()
      .split(/[\s\u3000・\.\,]+/)
      .map((k) => cleanStr(k))
      .filter(Boolean);

    return books.filter((b) => {
      const title = cleanStr(b.title);
      const titleKana = cleanStr(b.title_kana);
      const subTitle = cleanStr(b.sub_title);
      const subTitleKana = cleanStr(b.sub_title_kana);
      const author = cleanStr(b.author);
      const authorKana = cleanStr(b.author_kana);
      const authorEn = cleanStr(b.author_en);

      const authorParts = (b.author || '').split(/[\s\u3000]+/);
      const authorReversed =
        authorParts.length > 1 ? cleanStr(`${authorParts.slice(1).join('')}${authorParts[0]}`) : '';

      const authorKanaParts = (b.author_kana || '').split(/[\s\u3000]+/);
      const authorKanaReversed =
        authorKanaParts.length > 1
          ? cleanStr(`${authorKanaParts.slice(1).join('')}${authorKanaParts[0]}`)
          : '';

      const authorEnParts = (b.author_en || '').split(/[\s\u3000]+/);
      const authorEnReversed =
        authorEnParts.length > 1
          ? cleanStr(`${authorEnParts.slice(1).join('')}${authorEnParts[0]}`)
          : '';

      const isDirectMatch =
        (author && author.includes(fullCleanQuery)) ||
        (authorKana && authorKana.includes(fullCleanQuery)) ||
        (authorEn && authorEn.includes(fullCleanQuery)) ||
        (authorReversed && authorReversed.includes(fullCleanQuery)) ||
        (authorKanaReversed && authorKanaReversed.includes(fullCleanQuery)) ||
        (authorEnReversed && authorEnReversed.includes(fullCleanQuery)) ||
        (title && title.includes(fullCleanQuery)) ||
        (titleKana && titleKana.includes(fullCleanQuery));

      if (isDirectMatch) return true;

      return keywords.every((kw) => {
        return (
          title.includes(kw) ||
          titleKana.includes(kw) ||
          subTitle.includes(kw) ||
          subTitleKana.includes(kw) ||
          author.includes(kw) ||
          authorKana.includes(kw) ||
          authorEn.includes(kw) ||
          authorReversed.includes(kw) ||
          authorKanaReversed.includes(kw) ||
          authorEnReversed.includes(kw)
        );
      });
    });
  }, [books, query]);

  const totalPages = Math.ceil(filteredBooks.length / itemsPerPage);
  const currentBooks = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredBooks.slice(start, start + itemsPerPage);
  }, [filteredBooks, currentPage]);

  const handleDownload = async (book: Book) => {
    if (!book.zip_url) {
      alert('この作品にはテキスト形式のZIPファイルが用意されていません。');
      return;
    }

    setDownloadingId(book.id);

    const fullTitle = book.sub_title ? `${book.title} - ${book.sub_title}` : book.title;

    try {
      const res = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: book.id,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'EPUBの生成に失敗しました。');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fullTitle}.epub`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '不明なエラーが発生しました';
      alert(`エラー: ${message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const hasQuery = query.trim().length > 0;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: '青空文庫 Kindle 変換ツール',
    operatingSystem: 'All',
    applicationCategory: 'UtilitiesApplication',
    description:
      '青空文庫の作品を縦書き・右開き用のKindleファイル(EPUB)に瞬時に変換してダウンロードできる無料Webツール。',
    url: 'https://aozora-kindle-web.vercel.app/',
    inLanguage: 'ja',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'JPY',
    },
    featureList: [
      '青空文庫作品のEPUB変換（縦書き・右開き）',
      '作品名・著者名での高速リアルタイム検索',
      'ジャンル・同世代作家の自動レコメンド',
      '毎日自動更新される作品データベース',
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-stone-50 text-gray-800 p-6 md:p-12">
        <div className="max-w-4xl mx-auto space-y-6">
          <header
            className={`border-b transition-all ${hasQuery ? 'pb-2' : 'pb-4'} text-center md:text-left`}
          >
            <h1
              className={`font-bold font-serif tracking-tight text-gray-900 transition-all ${hasQuery ? 'text-xl md:text-3xl' : 'text-3xl'}`}
            >
              青空文庫 Kindle 変換ツール
            </h1>
            <p className={`text-sm text-gray-500 mt-1 ${hasQuery ? 'hidden sm:block' : 'block'}`}>
              青空文庫の作品を縦書き・右開き用のKindleファイル(EPUB)に瞬時に変換してダウンロードします。
              <br className="hidden sm:inline" />
              作品リストは1日1回自動更新されます
              {bookCount !== null && ` / 現在の収録数: ${bookCount.toLocaleString()} 作品`}
            </p>
          </header>

          {/* 検索バー */}
          <div className="relative">
            <input
              type="text"
              placeholder="例：夏目漱石 こころ、走れメロス などで検索..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCurrentPage(1);
              }}
              disabled={loading}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg bg-white disabled:bg-gray-100"
            />
          </div>

          {/* おすすめ作家（検索クエリのみで連動） */}
          <Recommendations
            books={books}
            searchQuery={query}
            onSelectAuthor={(author) => {
              setQuery(author);
              setCurrentPage(1);
            }}
          />

          {/* 入力時のみ表示される検索結果エリア */}
          {hasQuery && (
            <>
              <div className="flex justify-between items-center text-sm text-gray-600">
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

              <div className="space-y-3">
                {currentBooks.map((book, index) => (
                  <div
                    key={`${book.id}-${index}`}
                    className="p-4 bg-white border border-stone-200/80 rounded-xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-gray-300 transition-all"
                  >
                    <div>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <h2 className="text-xl font-semibold text-gray-900">{book.title}</h2>
                        {book.sub_title && (
                          <span className="text-sm font-normal text-gray-800">
                            {book.sub_title}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{book.author}</p>
                    </div>
                    <button
                      onClick={() => handleDownload(book)}
                      disabled={downloadingId === book.id || !book.zip_url}
                      className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 shadow-sm whitespace-nowrap ${
                        !book.zip_url
                          ? 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed shadow-none'
                          : downloadingId === book.id
                            ? 'bg-stone-500 text-white cursor-wait animate-pulse'
                            : 'bg-gradient-to-r from-stone-800 to-stone-700 text-stone-100 hover:from-stone-700 hover:to-stone-600 active:from-stone-900 active:to-stone-800 shadow'
                      }`}
                    >
                      {downloadingId === book.id ? 'EPUB生成中...' : 'ダウンロード'}
                    </button>
                  </div>
                ))}

                {!loading && currentBooks.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    該当する作品が見つかりませんでした。
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 pt-6">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border rounded-md text-sm bg-white disabled:opacity-50"
                  >
                    前へ
                  </button>
                  <span className="text-sm px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 border rounded-md text-sm bg-white disabled:opacity-50"
                  >
                    次へ
                  </button>
                </div>
              )}
            </>
          )}

          <footer className="max-w-2xl mx-auto w-full mt-16 pt-6 border-t border-stone-200 text-center text-xs text-stone-400 space-y-2">
            <p>
              すべてのソースコードは{' '}
              <a
                href="https://github.com/yuichiro-dev/aozora-kindle-web"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-stone-600"
              >
                GitHub
              </a>{' '}
              にて公開されています。不具合はIssuesにて報告して下さい。
            </p>
            <p>© {new Date().getFullYear()} 青空文庫 Kindle 変換ツール</p>
          </footer>
        </div>
      </main>
    </>
  );
}
