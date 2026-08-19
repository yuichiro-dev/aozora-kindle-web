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
  type: 'birthday' | 'deathday' | 'genre' | 'contemporary';
  title: string;
  description: string;
  authors: string[];
}

interface Props {
  books: Book[];
  searchQuery?: string;
  selectedBook?: Book | null;
  onSelectAuthor?: (author: string) => void;
}

// === ジャンルごとの作家グループ（相互互換リスト） ===
// 配列内に名前がある作家同士は、誰で検索しても相互に関連作家として表示されます
const GENRE_GROUPS = [
  {
    name: 'ミステリー・怪奇探偵小説',
    authors: [
      '江戸川乱歩',
      '夢野久作',
      '横溝正史',
      '小栗虫太郎',
      '甲賀三郎',
      '海野十三',
      '谷崎潤一郎',
      '平林初之輔',
      '久生十蘭',
      '木々高太郎',
    ],
  },
  {
    name: '童話・児童文学',
    authors: [
      '宮沢賢治',
      '新美南吉',
      '小川未明',
      '楠山正雄',
      '坪田譲治',
      '鈴木三重吉',
      '島崎藤村',
    ],
  },
  {
    name: '時代小説・捕物帖',
    authors: [
      '岡本綺堂',
      '野村胡堂',
      '吉川英治',
      '中里介山',
      '直木三十五',
      '長谷川伸',
      '都筑道夫',
    ],
  },
  {
    name: '近代名作純文学・文豪',
    authors: [
      '夏目漱石',
      '芥川龍之介',
      '太宰治',
      '森鴎外',
      '島崎藤村',
      '正岡子規',
      '寺田寅彦',
      '樋口一葉',
      '菊池寛',
      '佐藤春夫',
    ],
  },
  {
    name: '無頼派・退廃的近代文学',
    authors: [
      '太宰治',
      '坂口安吾',
      '織田作之助',
      '梶井基次郎',
      '石川淳',
      '中原中也',
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
    ],
  },
];

// 作家名から所属グループと関連作家（自分以外）を抽出するヘルパー関数
function findGenreInfo(authorName: string) {
  for (const group of GENRE_GROUPS) {
    if (group.authors.includes(authorName)) {
      return {
        genreName: group.name,
        // 自分を除外したリストをランダムに並べ替え
        relatedAuthors: group.authors
          .filter((a) => a !== authorName)
          .sort(() => 0.5 - Math.random()),
      };
    }
  }
  return null;
}

function getRecommendations(
  books: Book[],
  searchQuery?: string,
  selectedBook?: Book | null
): RecommendationCard[] {
  const results: RecommendationCard[] = [];

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayMMDD = `-${month}-${day}`;

  // -------------------------------------------------------------
  // A. 検索クエリまたは選択作品から「相互関連ジャンルカード」を生成
  // -------------------------------------------------------------
  // グループ内に存在する全作家名の中から、検索キーワードや選択中の作品にマッチするものを探す
  const allKnownAuthors = Array.from(
    new Set(GENRE_GROUPS.flatMap((g) => g.authors))
  );

  const matchedAuthor =
    selectedBook?.author ||
    allKnownAuthors.find((author) => searchQuery?.trim().includes(author));

  if (matchedAuthor) {
    const info = findGenreInfo(matchedAuthor);
    if (info && info.relatedAuthors.length > 0) {
      results.push({
        type: 'genre',
        title: `🔍 ${matchedAuthor} 好きにおすすめ`,
        description: `${info.genreName}`,
        authors: info.relatedAuthors.slice(0, 6),
      });
    }
  }

  // -------------------------------------------------------------
  // B. グループにない作家の場合は「同世代（±10年）」にフォールバック
  // -------------------------------------------------------------
  if (results.length === 0 && selectedBook && selectedBook.author_birth) {
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
          title: `📜 ${selectedBook.author} と同世代の作家`,
          description: `${baseBirthYear}年前後（±10年）生まれ`,
          authors,
        });
      }
    }
  }

  // -------------------------------------------------------------
  // C. デイリーコンテンツ：本日の生誕・命日作家
  // -------------------------------------------------------------
  const birthdayBooks = books.filter(
    (b) => b.author_birth && b.author_birth.endsWith(todayMMDD)
  );
  if (birthdayBooks.length > 0) {
    const authors = Array.from(new Set(birthdayBooks.map((b) => b.author))).slice(0, 6);
    results.push({
      type: 'birthday',
      title: '🎂 本日の生誕作家',
      description: `${month}月${day}日生まれ`,
      authors,
    });
  }

  const deathdayBooks = books.filter(
    (b) => b.author_death && b.author_death.endsWith(todayMMDD)
  );
  if (deathdayBooks.length > 0) {
    const authors = Array.from(new Set(deathdayBooks.map((b) => b.author))).slice(0, 6);
    results.push({
      type: 'deathday',
      title: '🕯️ 本日の命日作家',
      description: `${month}月${day}日に没`,
      authors,
    });
  }

  return results;
}

export default function Recommendations({
  books,
  searchQuery,
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
      setRecommendations(getRecommendations(books, searchQuery, selectedBook));
    }
  }, [books, searchQuery, selectedBook]);

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