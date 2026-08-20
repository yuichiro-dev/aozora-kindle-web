'use client';

import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

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

interface Props {
  books: Book[];
  searchQuery?: string;
  onSelectAuthor?: (author: string) => void;
}

interface RecommendationData {
  title: string;
  authors: string[];
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

function parseMonthDay(dateStr: string | null): { month: number; day: number } | null {
  if (!dateStr) return null;
  const nums = dateStr.match(/\d+/g);
  if (!nums) return null;

  if (nums.length >= 3) {
    return { month: parseInt(nums[1], 10), day: parseInt(nums[2], 10) };
  } else if (nums.length === 2) {
    return { month: parseInt(nums[0], 10), day: parseInt(nums[1], 10) };
  }
  return null;
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function Recommendations({ books, searchQuery, onSelectAuthor }: Props) {
  const [recommendations, setRecommendations] = useState<RecommendationData[]>([]);

  useEffect(() => {
    const buildRecommendations = () => {
      if (searchQuery && searchQuery.trim().length > 0) {
        setRecommendations([]);
        return;
      }

      if (!books || books.length === 0) {
        setRecommendations([]);
        return;
      }

      const historyAuthors: string[] = [];
      try {
        const raw = localStorage.getItem('aozora_history');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const item of parsed.slice(0, 10)) {
              const authorName = item?.author || item?.author_name;
              if (authorName) {
                const clean = authorName.replace(/[\s\u3000]+/g, '');
                if (clean && !historyAuthors.includes(clean)) {
                  historyAuthors.push(clean);
                }
              }
            }
          }
        }
      } catch {
        // ignore
      }

      const results: RecommendationData[] = [];

      // 1. 履歴からの関連作家（厳密に「最大1枚」限定）
      if (historyAuthors.length > 0) {
        const matchedCandidates: { sourceAuthor: string; relatedAuthors: string[] }[] = [];

        historyAuthors.forEach((author) => {
          const cleanA = normalize(author);
          GENRE_GROUPS.forEach((group) => {
            if (group.authors.some((a) => normalize(a) === cleanA)) {
              const related = group.authors.filter((a) => normalize(a) !== cleanA);
              if (related.length > 0) {
                matchedCandidates.push({
                  sourceAuthor: author,
                  relatedAuthors: related,
                });
              }
            }
          });
        });

        if (matchedCandidates.length > 0) {
          const selected = shuffleArray(matchedCandidates)[0];
          const shuffledRelated = shuffleArray(selected.relatedAuthors).slice(0, 3);
          results.push({
            title: `🔍 「${selected.sourceAuthor}」好きにおすすめ`,
            authors: shuffledRelated,
          });
        }
      }

      // 2. 残りの枠を生誕・命日作家で埋める（計3枚）
      const now = new Date();
      const month = now.getMonth() + 1;
      const day = now.getDate();

      // 生誕作家
      const todayBirth = Array.from(
        new Set(
          books
            .filter((b) => {
              const p = parseMonthDay(b.author_birth);
              return p && p.month === month && p.day === day && !hasKatakana(b.author);
            })
            .map((b) => b.author.replace(/[\s\u3000]+/g, ''))
        )
      );

      if (todayBirth.length > 0) {
        results.push({
          title: '🎂 本日の生誕作家',
          authors: todayBirth.slice(0, 3),
        });
      } else {
        const monthBirth = shuffleArray(
          Array.from(
            new Set(
              books
                .filter((b) => {
                  const p = parseMonthDay(b.author_birth);
                  return p && p.month === month && !hasKatakana(b.author);
                })
                .map((b) => b.author.replace(/[\s\u3000]+/g, ''))
            )
          )
        );
        if (monthBirth.length > 0) {
          results.push({
            title: `🎂 ${month}月生まれの作家`,
            authors: monthBirth.slice(0, 3),
          });
        }
      }

      // 命日作家
      const todayDeath = Array.from(
        new Set(
          books
            .filter((b) => {
              const p = parseMonthDay(b.author_death);
              return p && p.month === month && p.day === day && !hasKatakana(b.author);
            })
            .map((b) => b.author.replace(/[\s\u3000]+/g, ''))
        )
      );

      if (todayDeath.length > 0) {
        results.push({
          title: '🕯️ 本日の命日作家',
          authors: todayDeath.slice(0, 3),
        });
      } else {
        const monthDeath = shuffleArray(
          Array.from(
            new Set(
              books
                .filter((b) => {
                  const p = parseMonthDay(b.author_death);
                  return p && p.month === month && !hasKatakana(b.author);
                })
                .map((b) => b.author.replace(/[\s\u3000]+/g, ''))
            )
          )
        );
        if (monthDeath.length > 0) {
          results.push({
            title: `🕯️ ${month}月に没した作家`,
            authors: monthDeath.slice(0, 3),
          });
        }
      }

      setRecommendations(results.slice(0, 3));
    };

    buildRecommendations();

    window.addEventListener('storage', buildRecommendations);
    window.addEventListener('history-updated', buildRecommendations);

    return () => {
      window.removeEventListener('storage', buildRecommendations);
      window.removeEventListener('history-updated', buildRecommendations);
    };
  }, [books, searchQuery]);

  if (searchQuery && searchQuery.trim().length > 0) return null;
  if (recommendations.length === 0) return null;

  return (
    <section className="w-full my-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {recommendations.map((item, idx) => (
          <div
            key={idx}
            className="p-4 rounded-xl border bg-white border-stone-200 shadow-sm flex flex-col justify-between"
          >
            <div>
              <h3 className="font-bold text-sm sm:text-base text-stone-800 mb-2.5">{item.title}</h3>
              <div className="flex flex-wrap gap-2">
                {item.authors.map((author) => (
                  <button
                    key={author}
                    onClick={() => onSelectAuthor?.(author)}
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold bg-white hover:bg-stone-900 hover:text-white border border-stone-300 text-stone-800 px-3 py-1.5 rounded-lg shadow-sm hover:shadow transition-all duration-150 cursor-pointer active:translate-y-0.5"
                  >
                    <Search className="w-3.5 h-3.5 opacity-60" />
                    <span>{author}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
