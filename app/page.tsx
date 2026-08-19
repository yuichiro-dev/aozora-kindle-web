'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Recommendations, { Book } from '@/components/Recommendations';
import StepGuide from '@/components/StepGuide';

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [bookCount, setBookCount] = useState<number | null>(null);

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
    name: '青空文庫Kindle保存',
    operatingSystem: 'All',
    applicationCategory: 'UtilitiesApplication',
    description: '[完全無料・登録不要・広告なし]青空文庫の本を保存して、すぐにKindleで読めます。',
    url: 'https://aozora-kindle-web.vercel.app/',
    inLanguage: 'ja',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'JPY',
    },
    featureList: [
      '青空文庫の作品を縦書き・右開きのKindle本に保存',
      '作品名や著者名からすぐに見つかる高速検索',
      '面倒な会員登録・ログインなしで全機能が無料',
      'Send to Kindle対応で端末への送信もかんたん',
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-stone-50 p-4 md:p-10">
        <div className="max-w-4xl mx-auto space-y-5">
          <header
            className={`border-b border-stone-200 transition-all ${hasQuery ? 'pb-2' : 'pb-4'} text-center md:text-left`}
          >
            <h1 className="font-bold font-serif tracking-tight text-xl md:text-2xl">
              青空文庫Kindle保存
            </h1>
            <p className={`text-xs sm:text-sm font-medium mt-1.5 ${hasQuery ? 'hidden sm:block' : 'block'}`}>
              [完全無料・登録不要・広告なし]青空文庫の本を保存して、すぐにKindleで読めます。
              <br className="hidden sm:inline" />
              {bookCount !== null && ` 収録数: ${bookCount.toLocaleString()}冊`}
              (作品リストは毎日自動更新)
            </p>
          </header>

          {!hasQuery && (
            <div className="-mt-3 mb-4">
              <StepGuide />
            </div>
          )}

          {/* 検索バー */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 rounded-2xl blur-md opacity-60 group-hover:opacity-100 animate-pulse transition duration-500"></div>

            <div className="relative bg-white rounded-xl shadow-md flex items-center">
              <div className="pl-4 text-stone-500 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              <input
                type="text"
                placeholder="著者名や作品名で検索"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCurrentPage(1);
                }}
                disabled={loading}
                className="w-full pl-3 pr-4 py-3 bg-transparent rounded-xl focus:outline-none text-base font-medium placeholder-stone-400 disabled:bg-stone-100"
              />
            </div>
          </div>

          <p className="text-xs sm:text-sm mt-2 px-1 flex items-center gap-1.5 font-bold">
            <span>「夏目漱石 こころ」のようにスペースを空けて検索結果を絞り込めます</span>
          </p>

          <Recommendations
            books={books}
            searchQuery={query}
            onSelectAuthor={(author) => {
              setQuery(author);
              setCurrentPage(1);
            }}
          />

          {hasQuery && (
            <>
              <div className="flex justify-between items-center text-sm font-bold">
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
                    className="p-3.5 sm:p-4 bg-white border border-stone-300 rounded-xl shadow-sm flex items-center justify-between gap-3 hover:border-stone-400 transition-all"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <h2 className="text-base sm:text-lg font-bold leading-snug break-words">
                          {book.title}
                        </h2>
                        {book.sub_title && (
                          <span className="text-sm font-medium leading-snug break-words">
                            {book.sub_title}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium leading-tight break-words">
                        {book.author}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDownload(book)}
                      disabled={downloadingId === book.id || !book.zip_url}
                      className={`shrink-0 whitespace-nowrap px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg font-bold text-sm transition-all duration-200 shadow-sm ${
                        !book.zip_url
                          ? 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed shadow-none'
                          : downloadingId === book.id
                            ? 'bg-stone-600 text-white cursor-wait animate-pulse'
                            : 'bg-stone-900 text-white hover:bg-stone-800 active:bg-black shadow'
                      }`}
                    >
                      {downloadingId === book.id ? '生成中...' : '保存'}
                    </button>
                  </div>
                ))}

                {!loading && currentBooks.length === 0 && (
                  <div className="text-center py-10 font-medium text-base">
                    該当する作品が見つかりませんでした。
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 pt-4">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border border-stone-300 rounded-md text-sm font-bold bg-white disabled:opacity-40"
                  >
                    前へ
                  </button>
                  <span className="text-sm font-bold px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 border border-stone-300 rounded-md text-sm font-bold bg-white disabled:opacity-40"
                  >
                    次へ
                  </button>
                </div>
              )}
            </>
          )}

          {/* フッター（色を --color-text-muted で一括管理） */}
          <footer className="max-w-2xl mx-auto w-full mt-12 pt-6 border-t border-stone-200 text-center text-xs text-[var(--color-text-muted)] space-y-2">
            <p>
              青空文庫の注釈・ルビ記号を解析し、縦書き・右開き（vertical-rl /
              rtl）仕様のEPUB3ファイルへオンデマンド変換します。 ※Send to Kindle完全対応 /
              クライアント・サーバー間暗号化通信。すべてのソースコードは{' '}
              <a
                href="https://github.com/yuichiro-dev/aozora-kindle-web"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-stone-600"
              >
                GitHub
              </a>{' '}
              にて公開されています。
            </p>
            <p>© {new Date().getFullYear()} 青空文庫Kindle保存</p>
          </footer>
        </div>
      </main>
    </>
  );
}