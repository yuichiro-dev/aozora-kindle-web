'use client';

import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { GENRE_GROUPS } from '@/lib/genres';
import { useAuthors } from '@/hooks/useAuthors';

export interface Book {
  id: number;
  title: string;
  title_kana: string;
  sub_title: string | null;
  sub_title_kana: string | null;
  original_title: string | null;
  kana_type: string | null;
  publisher: string | null;
  publication_year: string | null;
  author: string;
  author_birth: string | null;
  author_death: string | null;
  author_kana: string;
  author_en: string | null;
  zip_url: string | null;
  html_url: string | null;
}

interface Props {
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

export default function Recommendations({ searchQuery, onSelectAuthor }: Props) {
  const { authors } = useAuthors();
  const [recommendations, setRecommendations] = useState<RecommendationData[]>([]);

  useEffect(() => {
    const buildRecommendations = () => {
      if (searchQuery && searchQuery.trim().length > 0) {
        setRecommendations([]);
        return;
      }

      if (!authors || authors.length === 0) {
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
          authors
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
              authors
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
          authors
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
              authors
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
  }, [authors, searchQuery]);

  if (searchQuery && searchQuery.trim().length > 0) return null;
  if (recommendations.length === 0) return null;

  return (
    <section className="w-full my-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {recommendations.map((item, idx) => (
          <div
            key={idx}
            /* カードの背景をページ背景と同じ bg-background にする */
            className="p-4 rounded-xl border border-border bg-background shadow-sm flex flex-col justify-between"
          >
            <div>
              <h3 className="font-bold text-sm sm:text-base text-foreground mb-2.5">
                {item.title}
              </h3>
              <div className="flex flex-wrap gap-2">
                {item.authors.map((author) => (
                  <button
                    key={author}
                    onClick={() => onSelectAuthor?.(author)}
                    /* ボタンは bg-card なので、背景（bg-background）からしっかり浮き上がる */
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold bg-card hover:bg-primary hover:text-primary-foreground border border-border text-foreground px-3 py-1.5 rounded-lg shadow-sm transition-all duration-150 cursor-pointer active:translate-y-0.5"
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
