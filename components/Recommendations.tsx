'use client';

import React, { useMemo, useSyncExternalStore } from 'react';

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

// ★ description を完全に削除
interface RecommendationCard {
  type: 'birthday' | 'deathday' | 'genre' | 'contemporary';
  title: string;
  authors: string[];
}

interface Props {
  books: Book[];
  searchQuery?: string;
  selectedBook?: Book | null;
  onSelectAuthor?: (author: string) => void;
}

function subscribeLocalStorage(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getHideRecsSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('hide_recommendations') === 'true';
}

function getServerHideRecsSnapshot(): boolean {
  return false;
}

const normalize = (str?: string | null) =>
  str ? str.replace(/[\s\u3000・\.\,-]+/g, '').toLowerCase() : '';

const hasKatakana = (str: string) => /[\u30A0-\u30FF]/.test(str);

export const GENRE_GROUPS = [
  {
    name: 'ミステリー・怪奇探偵小説',
    authors: [
      '江戸川乱歩',
      '夢野久作',
      '小栗虫太郎',
      '甲賀三郎',
      '海野十三',
      '谷崎潤一郎',
      '平林初之輔',
      '久生十蘭',
      '大阪圭吉',
      '大下宇陀児',
    ],
  },
  {
    name: '翻案・古典翻訳ミステリー',
    authors: ['黒岩涙香', '江戸川乱歩', '森鴎外', '楠山正雄'],
  },
  {
    name: '伝奇・怪奇・幻想文学',
    authors: [
      '国枝史郎',
      '泉鏡花',
      '夢野久作',
      '江戸川乱歩',
      '谷崎潤一郎',
      '岡本綺堂',
      '黒岩涙香',
      '田中貢太郎',
      '三遊亭円朝',
    ],
  },
  {
    name: '童話・児童文学',
    authors: [
      '宮沢賢治',
      '新美南吉',
      '小川未明',
      '楠山正雄',
      '鈴木三重吉',
      '島崎藤村',
      '有島武郎',
      '豊島与志雄',
    ],
  },
  {
    name: '時代小説・歴史ロマン',
    authors: ['岡本綺堂', '野村胡堂', '吉川英治', '中里介山', '直木三十五', '長谷川伸', '国枝史郎'],
  },
  {
    name: 'プロレタリア・社会派文学',
    authors: ['小林多喜二', '葉山嘉樹', '黒島伝治', '徳永直', '宮本百合子'],
  },
  {
    name: '自然主義・写実主義文学',
    authors: ['田山花袋', '島崎藤村', '国木田独歩', '徳田秋声', '正宗白鳥', '岩野泡鳴'],
  },
  {
    name: '新感覚派・新心理主義・抒情文学',
    authors: ['堀辰雄', '横光利一', '梶井基次郎', '中島敦', '牧野信一'],
  },
  {
    name: '近代名作純文学・文豪',
    authors: [
      '夏目漱石',
      '芥川竜之介',
      '太宰治',
      '森鴎外',
      '島崎藤村',
      '正岡子規',
      '寺田寅彦',
      '樋口一葉',
      '菊池寛',
      '佐藤春夫',
      '有島武郎',
      '国木田独歩',
      '倉田百三',
    ],
  },
  {
    name: '無頼派・退廃的近代文学',
    authors: [
      '太宰治',
      '坂口安吾',
      '織田作之助',
      '梶井基次郎',
      '中原中也',
      '田中英光',
      '葛西善蔵',
      '嘉村礒多',
      '近松秋江',
    ],
  },
  {
    name: '唯美主義・浪漫文学',
    authors: [
      '谷崎潤一郎',
      '泉鏡花',
      '永井荷風',
      '尾崎紅葉',
      '佐藤春夫',
      '堀辰雄',
      '高村光太郎',
      '岡本かの子',
    ],
  },
  {
    name: '初期SF・空想科学小説',
    authors: [
      '海野十三',
      '黒岩涙香',
      '蘭郁二郎',
      '押川春浪',
      '平林初之輔',
      '黒島伝治',
      '小栗虫太郎',
    ],
  },
  {
    name: '近代詩歌・抒情詩',
    authors: [
      '萩原朔太郎',
      '室生犀星',
      '中原中也',
      '高村光太郎',
      '与謝野晶子',
      '宮沢賢治',
      '種田山頭火',
      '若山牧水',
    ],
  },
  {
    name: '変格探偵小説・異端の探偵作家たち',
    authors: ['小酒井不木', '渡辺温', '夢野久作', '甲賀三郎', '大阪圭吉', '橘外男', '田中貢太郎'],
  },
];

function findGenreInfo(authorName: string) {
  const cleanAuthorName = normalize(authorName);

  const matchedGroups = GENRE_GROUPS.filter((group) =>
    group.authors.some((a) => normalize(a) === cleanAuthorName)
  );

  if (matchedGroups.length === 0) return null;

  const randomGroup = matchedGroups[Math.floor(Math.random() * matchedGroups.length)];

  return {
    genreName: randomGroup.name,
    relatedAuthors: randomGroup.authors
      .filter((a) => normalize(a) !== cleanAuthorName)
      .sort(() => 0.5 - Math.random()),
  };
}

function parseMonthDay(
  dateStr: string | null
): { year?: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const nums = dateStr.match(/\d+/g);
  if (!nums) return null;

  if (nums.length >= 3) {
    return {
      year: parseInt(nums[0], 10),
      month: parseInt(nums[1], 10),
      day: parseInt(nums[2], 10),
    };
  } else if (nums.length === 2) {
    return {
      month: parseInt(nums[0], 10),
      day: parseInt(nums[2], 10),
    };
  }
  return null;
}

const MAX_AUTHORS_PER_CARD = 3;

function getRecommendations(
  books: Book[],
  searchQuery?: string,
  selectedBook?: Book | null
): RecommendationCard[] {
  const results: RecommendationCard[] = [];

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  const cleanQuery = normalize(searchQuery);

  const isKatakanaQuery = hasKatakana(cleanQuery);
  let forceBirthdayOnly = isKatakanaQuery;

  const allKnownAuthors = Array.from(new Set(GENRE_GROUPS.flatMap((g) => g.authors)));

  let matchedAuthor = selectedBook?.author;

  if (!matchedAuthor && cleanQuery.length >= 1) {
    matchedAuthor = allKnownAuthors.find((author) => {
      const cleanAuthor = normalize(author);
      return cleanAuthor.includes(cleanQuery) || cleanQuery.includes(cleanAuthor);
    });

    if (!matchedAuthor) {
      const matchedBook = books.find((b) => {
        const title = normalize(b.title);
        const titleKana = normalize(b.title_kana);
        return (
          (title && title.includes(cleanQuery)) || (titleKana && titleKana.includes(cleanQuery))
        );
      });

      if (matchedBook && matchedBook.author) {
        matchedAuthor = matchedBook.author;
      }
    }
  }

  if (matchedAuthor && hasKatakana(matchedAuthor)) {
    forceBirthdayOnly = true;
  }

  if (!forceBirthdayOnly) {
    if (matchedAuthor) {
      const info = findGenreInfo(matchedAuthor);
      if (info && info.relatedAuthors.length > 0) {
        const displayAuthor = matchedAuthor.replace(/[\s\u3000]+/g, '');
        results.push({
          type: 'genre',
          title: `🔍 ${displayAuthor} 好きにおすすめ`,
          authors: info.relatedAuthors.slice(0, MAX_AUTHORS_PER_CARD),
        });
      }
    }

    if (results.length === 0) {
      let fallbackAuthorBook = selectedBook;

      if (!fallbackAuthorBook && cleanQuery.length >= 1) {
        fallbackAuthorBook = books.find((b) => {
          const author = normalize(b.author);
          return author && (author.includes(cleanQuery) || cleanQuery.includes(author));
        });
      }

      if (fallbackAuthorBook && fallbackAuthorBook.author_birth) {
        const parsed = parseMonthDay(fallbackAuthorBook.author_birth);
        const baseBirthYear = parsed?.year;

        if (baseBirthYear) {
          const targetAuthorName = fallbackAuthorBook.author;
          const contemporaryBooks = books.filter((b) => {
            if (!b.author_birth) return false;
            const p = parseMonthDay(b.author_birth);
            return (
              p?.year &&
              Math.abs(p.year - baseBirthYear) <= 10 &&
              normalize(b.author) !== normalize(targetAuthorName)
            );
          });

          if (contemporaryBooks.length > 0) {
            const authors = Array.from(
              new Set(contemporaryBooks.map((b) => b.author.replace(/[\s\u3000]+/g, '')))
            )
              .sort(() => 0.5 - Math.random())
              .slice(0, MAX_AUTHORS_PER_CARD);

            const displayAuthor = targetAuthorName.replace(/[\s\u3000]+/g, '');
            results.push({
              type: 'contemporary',
              title: `📜 ${displayAuthor} と同世代の作家`,
              authors,
            });
          }
        }
      }
    }
  }

  const todayBirthAuthors = Array.from(
    new Set(
      books
        .filter((b) => {
          const p = parseMonthDay(b.author_birth);
          return p && p.month === currentMonth && p.day === currentDay && !hasKatakana(b.author);
        })
        .map((b) => b.author.replace(/[\s\u3000]+/g, ''))
    )
  );

  if (todayBirthAuthors.length > 0) {
    results.push({
      type: 'birthday',
      title: '🎂 本日の生誕作家',
      authors: todayBirthAuthors.slice(0, MAX_AUTHORS_PER_CARD),
    });
  } else {
    const monthBirthAuthors = Array.from(
      new Set(
        books
          .filter((b) => {
            const p = parseMonthDay(b.author_birth);
            return p && p.month === currentMonth && !hasKatakana(b.author);
          })
          .map((b) => b.author.replace(/[\s\u3000]+/g, ''))
      )
    ).sort(() => 0.5 - Math.random());

    if (monthBirthAuthors.length > 0) {
      results.push({
        type: 'birthday',
        title: `🎂 ${currentMonth}月生まれの作家`,
        authors: monthBirthAuthors.slice(0, MAX_AUTHORS_PER_CARD),
      });
    }
  }

  if (!forceBirthdayOnly) {
    const todayDeathAuthors = Array.from(
      new Set(
        books
          .filter((b) => {
            const p = parseMonthDay(b.author_death);
            return p && p.month === currentMonth && p.day === currentDay && !hasKatakana(b.author);
          })
          .map((b) => b.author.replace(/[\s\u3000]+/g, ''))
      )
    );

    if (todayDeathAuthors.length > 0) {
      results.push({
        type: 'deathday',
        title: '🕯️ 本日の命日作家',
        authors: todayDeathAuthors.slice(0, MAX_AUTHORS_PER_CARD),
      });
    } else {
      const monthDeathAuthors = Array.from(
        new Set(
          books
            .filter((b) => {
              const p = parseMonthDay(b.author_death);
              return p && p.month === currentMonth && !hasKatakana(b.author);
            })
            .map((b) => b.author.replace(/[\s\u3000]+/g, ''))
        )
      ).sort(() => 0.5 - Math.random());

      if (monthDeathAuthors.length > 0) {
        results.push({
          type: 'deathday',
          title: `🕯️ ${currentMonth}月に没した作家`,
          authors: monthDeathAuthors.slice(0, MAX_AUTHORS_PER_CARD),
        });
      }
    }
  }

  return results.slice(0, 3);
}

export default function Recommendations({
  books,
  searchQuery,
  selectedBook,
  onSelectAuthor,
}: Props) {
  const isHidden = useSyncExternalStore(
    subscribeLocalStorage,
    getHideRecsSnapshot,
    getServerHideRecsSnapshot
  );
  const showRecommendations = !isHidden;

  const recommendations = useMemo(() => {
    if (!books || books.length === 0) return [];
    return getRecommendations(books, searchQuery, selectedBook);
  }, [books, searchQuery, selectedBook]);

  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    localStorage.setItem('hide_recommendations', isChecked ? 'false' : 'true');
    window.dispatchEvent(new Event('storage'));
  };

  if (!books || books.length === 0) return null;

  return (
    <section className="w-full my-4">
      <div className="flex justify-end items-center mb-2 px-1 text-sm font-bold text-stone-800">
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showRecommendations}
            onChange={handleToggle}
            className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-600"
          />
          <span>レコメンドを表示する</span>
        </label>
      </div>

      {showRecommendations && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {recommendations.map((item, idx) => {
            const isSearching = Boolean(searchQuery && searchQuery.trim().length > 0);
            const hideOnMobile = isSearching && idx > 0;

            return (
              <div
                key={idx}
                className={`p-4 rounded-xl border bg-white border-stone-300 shadow-sm flex-col justify-between ${
                  hideOnMobile ? 'hidden sm:flex' : 'flex'
                }`}
              >
                <div>
                  <div className="mb-2.5">
                    <h3 className="font-bold text-base sm:text-lg text-stone-900 leading-snug">
                      {item.title}
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {item.authors.map((author) => (
                      <button
                        key={author}
                        onClick={() => onSelectAuthor?.(author)}
                        className="text-sm font-bold bg-stone-100 hover:bg-stone-900 hover:text-white border border-stone-300 text-stone-800 px-3 py-1.5 rounded-lg transition-all duration-150"
                      >
                        {author}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
