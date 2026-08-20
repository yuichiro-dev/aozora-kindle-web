'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Recommendations, { Book } from '@/components/Recommendations';
import { Code2, X } from 'lucide-react';
import Header from '@/components/Header';

// 履歴保存用のヘルパー関数
const saveToHistory = (id: string | number, title: string, author: string) => {
  if (typeof window === 'undefined') return;

  try {
    const currentHistory = JSON.parse(localStorage.getItem('aozora_history') || '[]');

    // 重複を除外して先頭に追加（最大20件）
    const updated = [
      { id: String(id), title, author, timestamp: Date.now() },
      ...currentHistory.filter((item: { id: string }) => item.id !== String(id)),
    ].slice(0, 20);

    localStorage.setItem('aozora_history', JSON.stringify(updated));

    // ★ 同一タブ内のコンポーネントへ更新を通知
    window.dispatchEvent(new Event('history-updated'));
  } catch (e) {
    console.error('履歴の保存に失敗しました:', e);
  }
};

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [bookCount, setBookCount] = useState<number | null>(null);

  // サジェスチョン用の状態とRef
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [lastUpdated, setLastUpdated] = useState<string>('');
  // 履歴にある書籍IDと最終保存日時のマップを保持する State（初期値で一度だけローカルストレージを読む）
  const [savedHistoryMap, setSavedHistoryMap] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem('aozora_history');
      if (raw) {
        const parsed: { id: string; timestamp: number }[] = JSON.parse(raw);
        const map: Record<string, number> = {};
        parsed.forEach((item) => {
          map[String(item.id)] = item.timestamp;
        });
        return map;
      }
    } catch (e) {
      console.error('初期履歴の読み込みに失敗しました:', e);
    }
    return {};
  });

  // 日付フォーマット用ヘルパー
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 外部（履歴ページなどでの削除・追加）からの変更を監視するリスナー
  useEffect(() => {
    const handleSync = () => {
      try {
        const raw = localStorage.getItem('aozora_history');
        if (raw) {
          const parsed: { id: string; timestamp: number }[] = JSON.parse(raw);
          const map: Record<string, number> = {};
          parsed.forEach((item) => {
            map[String(item.id)] = item.timestamp;
          });
          setSavedHistoryMap(map);
        } else {
          setSavedHistoryMap({});
        }
      } catch (e) {
        console.error('履歴マップの同期に失敗しました:', e);
      }
    };

    window.addEventListener('history-updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('history-updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  useEffect(() => {
    fetch('/books.json')
      .then((res) => {
        // レスポンスヘッダーから Last-Modified を取得
        const lastModified = res.headers.get('Last-Modified');
        if (lastModified) {
          const date = new Date(lastModified);
          const formattedDate = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
          setLastUpdated(formattedDate);
        }
        return res.json();
      })
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

  // 検索バーの外側をクリックした時にサジェスチョンを閉じる処理
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ひらがなをカタカナに変換するヘルパー関数
  const toKatakana = (str: string) =>
    str.replace(/[\u3041-\u3096]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));

  const cleanStr = (str: string | null) =>
    str ? str.replace(/[\s\u3000・\.\,]+/g, '').toLowerCase() : '';

  const filteredBooks = useMemo(() => {
    if (!query.trim()) return [];

    const fullCleanQuery = cleanStr(query);
    const katakanaQuery = toKatakana(fullCleanQuery);

    const keywords = query
      .trim()
      .split(/[\s\u3000・\.\,]+/)
      .map((k) => cleanStr(k))
      .filter(Boolean);

    const katakanaKeywords = keywords.map((k) => toKatakana(k));

    return books.filter((b) => {
      const title = cleanStr(b.title);
      const titleKana = cleanStr(b.title_kana);
      const subTitle = cleanStr(b.sub_title);
      const subTitleKana = cleanStr(b.sub_title_kana);
      const author = cleanStr(b.author);
      const authorKana = cleanStr(b.author_kana);
      const authorEn = cleanStr(b.author_en);

      // 英語の姓名逆転用（例: "poe edgar" -> "edgarpoe"）
      const authorEnParts = (b.author_en || '').split(/[\s\u3000]+/);
      const authorEnReversed =
        authorEnParts.length > 1
          ? cleanStr(`${authorEnParts.slice(1).join('')}${authorEnParts[0]}`)
          : '';

      const isDirectMatch =
        (author && (author.includes(fullCleanQuery) || author.includes(katakanaQuery))) ||
        (authorKana &&
          (authorKana.includes(fullCleanQuery) || authorKana.includes(katakanaQuery))) ||
        (authorEn && authorEn.includes(fullCleanQuery)) ||
        (authorEnReversed && authorEnReversed.includes(fullCleanQuery)) ||
        (title && (title.includes(fullCleanQuery) || title.includes(katakanaQuery))) ||
        (titleKana && (titleKana.includes(fullCleanQuery) || titleKana.includes(katakanaQuery)));

      if (isDirectMatch) return true;

      return keywords.every((kw, idx) => {
        const kKata = katakanaKeywords[idx];
        return (
          title.includes(kw) ||
          title.includes(kKata) ||
          titleKana.includes(kw) ||
          titleKana.includes(kKata) ||
          subTitle.includes(kw) ||
          subTitle.includes(kKata) ||
          subTitleKana.includes(kw) ||
          subTitleKana.includes(kKata) ||
          author.includes(kw) ||
          author.includes(kKata) ||
          authorKana.includes(kw) ||
          authorKana.includes(kKata) ||
          authorEn.includes(kw) ||
          authorEnReversed.includes(kw)
        );
      });
    });
  }, [books, query]);

  // 入力途中のサジェスチョン候補（著者名・作品名から最大6件生成）
  const suggestions = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed || books.length === 0) return [];

    const cleanQ = cleanStr(trimmed);
    const katakanaQ = toKatakana(cleanQ);

    const matchedAuthors = new Set<string>();
    const matchedTitles = new Set<string>();

    for (const book of books) {
      if (matchedAuthors.size + matchedTitles.size >= 8) break;

      const author = book.author ? book.author.replace(/[\s\u3000]+/g, '') : '';
      const authorKana = cleanStr(book.author_kana);
      const authorEn = cleanStr(book.author_en);
      const title = book.title;
      const titleKana = cleanStr(book.title_kana);

      // 著者名（漢字・かな・カタカナ・英語）のマッチング
      if (
        author &&
        !matchedAuthors.has(author) &&
        (cleanStr(author).includes(cleanQ) ||
          cleanStr(author).includes(katakanaQ) ||
          authorKana.includes(cleanQ) ||
          authorKana.includes(katakanaQ) ||
          authorEn.includes(cleanQ))
      ) {
        matchedAuthors.add(author);
      }

      // 作品名のマッチング
      if (
        title &&
        !matchedTitles.has(title) &&
        (cleanStr(title).includes(cleanQ) ||
          cleanStr(title).includes(katakanaQ) ||
          titleKana.includes(cleanQ) ||
          titleKana.includes(katakanaQ))
      ) {
        matchedTitles.add(title);
      }
    }

    const list: { type: 'author' | 'title'; text: string }[] = [];
    matchedAuthors.forEach((a) => list.push({ type: 'author', text: a }));
    matchedTitles.forEach((t) => list.push({ type: 'title', text: t }));

    return list.slice(0, 6);
  }, [books, query]);

  // サジェスチョン選択時の処理（文字セット ＆ キーボードを隠す）
  const handleSelectSuggestion = (text: string) => {
    setQuery(text);
    setCurrentPage(1);
    setIsFocused(false);

    // スマホのキーボードを閉じる
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  const handleClear = () => {
    setQuery('');
    setCurrentPage(1);
    setIsFocused(false);
  };

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
      saveToHistory(book.id, fullTitle, book.author);
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
    name: '青空保存 to Kindle',
    operatingSystem: 'All',
    applicationCategory: 'UtilitiesApplication',
    description: '青空文庫の作品を縦書きEPUBでKindleに保存するツール。',
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
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <main className="min-h-screen bg-stone-50 p-4 md:p-10">
        <div className="max-w-4xl mx-auto space-y-5">
          {/* 収録数・最終更新日時：検索時は非表示 */}
          <div className={`transition-all ${hasQuery ? 'hidden' : 'block pb-1'}`}>
            <p className="text-xs sm:text-sm font-medium text-stone-700">
              {bookCount !== null && `収録数: ${bookCount.toLocaleString()}冊`}
              {lastUpdated && `（最終更新: ${lastUpdated}）`}
            </p>
          </div>

          {/* 検索バー ＆ サジェスチョンコンテナ */}
          <div ref={searchContainerRef} className="relative group z-30">
            <div className="relative bg-white border-2 border-stone-400 focus-within:border-stone-900 rounded-xl shadow-md flex items-center transition-colors">
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
                ref={inputRef}
                type="text"
                placeholder="著者名や作品名で検索"
                value={query}
                onFocus={() => setIsFocused(true)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCurrentPage(1);
                  setIsFocused(true);
                }}
                disabled={loading}
                className="w-full pl-3 pr-2 py-3 bg-transparent rounded-xl focus:outline-none text-base font-medium text-stone-900 placeholder-stone-400 disabled:bg-stone-100"
              />

              {query.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="pr-4 text-stone-400 hover:text-stone-800 transition-colors cursor-pointer shrink-0"
                  aria-label="検索をクリアしてホームに戻る"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* サジェスチョンドロップダウンメニュー */}
            {isFocused && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-stone-300 rounded-xl shadow-xl overflow-hidden z-50 divide-y divide-stone-100">
                {suggestions.map((item, idx) => (
                  <button
                    key={`${item.type}-${item.text}-${idx}`}
                    type="button"
                    onClick={() => handleSelectSuggestion(item.text)}
                    className="w-full text-left px-4 py-3 hover:bg-stone-100 active:bg-stone-200 flex items-center gap-2.5 transition-colors"
                  >
                    <span className="text-sm shrink-0">{item.type === 'author' ? '👤' : '📖'}</span>
                    <span className="text-sm sm:text-base font-bold text-stone-900 truncate">
                      {item.text}
                    </span>
                    <span className="text-xs font-medium text-stone-500 ml-auto shrink-0">
                      {item.type === 'author' ? '作者' : '作品'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs sm:text-sm mt-2 px-1 flex items-center gap-1.5 font-bold text-stone-900">
            <span>「夏目漱石 こころ」のようにスペースを空けて作品名も絞り込めます</span>
          </p>

          <Recommendations
            books={books}
            searchQuery={query}
            onSelectAuthor={(author) => {
              handleSelectSuggestion(author);
            }}
          />

          {hasQuery && (
            <>
              <div className="flex justify-between items-center text-sm font-bold text-stone-900">
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
                        <h2 className="text-base sm:text-lg font-bold text-stone-900 leading-snug break-words">
                          {book.title}
                        </h2>
                        {book.sub_title && (
                          <span className="text-sm font-medium text-stone-800 leading-snug break-words">
                            {book.sub_title}
                          </span>
                        )}
                      </div>
                      <p className="text-base font-medium text-stone-800 leading-tight break-words flex flex-wrap items-center gap-2">
                        <span>{book.author}</span>
                        {savedHistoryMap[String(book.id)] && (
                          <span className="text-sm text-blue-700 font-normal">
                            （前回保存: {formatDate(savedHistoryMap[String(book.id)])}）
                          </span>
                        )}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDownload(book)}
                      disabled={downloadingId === book.id || !book.zip_url}
                      className={`shrink-0 whitespace-nowrap px-5 py-2.5 sm:px-6 sm:py-3 rounded-lg font-bold text-base sm:text-lg transition-all duration-200 shadow-sm ${
                        !book.zip_url
                          ? 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed shadow-none'
                          : downloadingId === book.id
                            ? 'bg-stone-600 text-white cursor-wait animate-pulse'
                            : savedHistoryMap[String(book.id)]
                              ? 'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 active:bg-blue-200 shadow-sm'
                              : 'bg-stone-900 text-white hover:bg-stone-800 active:bg-black shadow'
                      }`}
                    >
                      {downloadingId === book.id
                        ? '生成中...'
                        : savedHistoryMap[String(book.id)]
                          ? '再保存'
                          : '保存'}
                    </button>
                  </div>
                ))}

                {!loading && currentBooks.length === 0 && (
                  <div className="text-center py-10 font-medium text-base text-stone-800">
                    該当する作品が見つかりませんでした。
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 pt-4">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border border-stone-300 rounded-md text-sm font-bold text-stone-900 bg-white disabled:opacity-40"
                  >
                    前へ
                  </button>
                  <span className="text-sm font-bold text-stone-900 px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 border border-stone-300 rounded-md text-sm font-bold text-stone-900 bg-white disabled:opacity-40"
                  >
                    次へ
                  </button>
                </div>
              )}
            </>
          )}

          <footer className="max-w-2xl mx-auto w-full mt-12 pt-6 border-t border-stone-200 text-center text-xs text-[var(--color-text-muted)]">
            <div className="flex items-center justify-center gap-2.5">
              <p>© {new Date().getFullYear()} 青空保存 to Kindle</p>
              <span className="opacity-40">|</span>
              <a
                href="https://github.com/yuichiro-dev/aozora-kindle-web"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-stone-900 transition-colors"
                aria-label="GitHub Repository"
              >
                <Code2 className="h-3.5 w-3.5" />
                <span>GitHub</span>
              </a>
              <span className="opacity-40">|</span>
              <a
                href="https://x.com/yuichiro1dev"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-stone-900 transition-colors"
                aria-label="X (Twitter)"
              >
                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span>@yuichiro1dev</span>
              </a>
            </div>
          </footer>
        </div>
      </main>
    </>
  );
}
