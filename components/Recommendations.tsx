'use client';

import React, { useState, useEffect } from 'react';

export interface Book {
  id: number;
  title: string;
  title_kana: string;
  sub_title: string | null;
  sub_title_kana: string | null;
  original_title: string | null;
  author: string;
  author_birth: string | null;
  author_death: string | null;
  author_kana: string;
  author_en: string;
  zip_url: string | null;
  html_url: string | null;
}

interface RecommendationCard {
  type: 'birthday' | 'deathday' | 'contemporary';
  title: string;
  description: string;
  authors: string[];
}

interface Props {
  books: Book[];
  selectedBook?: Book | null;
  onSelectAuthor?: (author: string) => void;
}

function getTodayRecommendations(
  books: Book[],
  selectedBook?: Book | null
): RecommendationCard[] {
  const results: RecommendationCard[] = [];

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayMMDD = `-${month}-${day}`;

  // 1. 本日の生誕作家
  const birthdayBooks = books.filter(
    (b) => b.author_birth && b.author_birth.endsWith(todayMMDD)
  );
  if (birthdayBooks.length > 0) {
    const authors = Array.from(new Set(birthdayBooks.map((b) => b.author))).slice(0, 8);
    results.push({
      type: 'birthday',
      title: '🎂 本日の生誕作家',
      description: `${month}月${day}日生まれ`,
      authors,
    });
  }

  // 2. 本日の命日作家
  const deathdayBooks = books.filter(
    (b) => b.author_death && b.author_death.endsWith(todayMMDD)
  );
  if (deathdayBooks.length > 0) {
    const authors = Array.from(new Set(deathdayBooks.map((b) => b.author))).slice(0, 8);
    results.push({
      type: 'deathday',
      title: '🕯️ 本日の命日作家',
      description: `${month}月${day}日に没`,
      authors,
    });
  }

  // 3. 選択中の作品の同世代作家
  if (selectedBook && selectedBook.author_birth) {
    const baseBirthYear = parseInt(selectedBook.author_birth.split('-')[0], 10);

    if (!isNaN(baseBirthYear)) {
      const contemporaryBooks = books.filter((b) => {
        if (!b.author_birth) return false;
        const year = parseInt(b.author_birth.split('-')[0], 10);
        return (
          Math.abs(year - baseBirthYear) <= 10 &&
          b.author !== selectedBook.author
        );
      });

      if (contemporaryBooks.length > 0) {
        const authors = Array.from(
          new Set(contemporaryBooks.map((b) => b.author))
        )
          .sort(() => 0.5 - Math.random())
          .slice(0, 6);

        results.push({
          type: 'contemporary',
          title: `📜 ${selectedBook.author} と同世代`,
          description: `${baseBirthYear}年前後（±10年）生まれ`,
          authors,
        });
      }
    }
  }

  return results;
}

export default function Recommendations({
  books,
  selectedBook,
  onSelectAuthor,
}: Props) {
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [recommendations, setRecommendations] = useState<RecommendationCard[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedSetting = localStorage.getItem('hide_recommendations');
    if (savedSetting === 'true') {
      setShowRecommendations(false);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (books && books.length > 0) {
      setRecommendations(getTodayRecommendations(books, selectedBook));
    }
  }, [books, selectedBook]);

  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    setShowRecommendations(isChecked);
    localStorage.setItem('hide_recommendations', isChecked ? 'false' : 'true');
  };

  if (!isLoaded || recommendations.length === 0) return null;

  return (
    <section className="w-full my-4">
      <div className="flex justify-between items-center mb-2 px-1 text-xs text-stone-500">
        <span className="font-semibold">おすすめ・今日の一冊</span>
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showRecommendations}
            onChange={handleToggle}
            className="rounded border-stone-300 text-stone-800 focus:ring-stone-500"
          />
          <span>レコメンドを表示する</span>
        </label>
      </div>

      {showRecommendations && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {recommendations.map((item, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl border bg-white border-stone-200/80 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="font-bold text-sm text-stone-900">{item.title}</h3>
                  <span className="text-[10px] text-stone-400">{item.description}</span>
                </div>

                {/* 作家名タグのみを並べる */}
                <div className="flex flex-wrap gap-1.5">
                  {item.authors.map((author) => (
                    <button
                      key={author}
                      onClick={() => onSelectAuthor?.(author)}
                      className="text-xs bg-stone-100 hover:bg-stone-800 hover:text-white border border-stone-200 text-stone-700 px-2.5 py-1 rounded-lg transition-all duration-150"
                    >
                      {author}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}