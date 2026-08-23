// lib/genres.ts
export interface GenreGroup {
  name: string;
  authors: string[];
}

export const GENRE_GROUPS: GenreGroup[] = [
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

/**
 * 空白・全角スペースを除去して比較用に正規化する。
 * books.json の author 表記ゆれ（"夏目 漱石" 等）を吸収する。
 */
export function normalizeAuthorName(name: string): string {
  return name.replace(/[\s\u3000・.,-]+/g, '');
}

/** GENRE_GROUPSに登場する著者を重複無しで一覧化する */
export function getAllGenreAuthors(): string[] {
  const set = new Set<string>();
  for (const group of GENRE_GROUPS) {
    for (const author of group.authors) {
      set.add(author);
    }
  }
  return [...set];
}

/** 著者名から、その著者が属するジャンル名一覧を返す */
export function getGenresForAuthor(author: string): string[] {
  const normalized = normalizeAuthorName(author);
  return GENRE_GROUPS.filter((g) =>
    g.authors.some((a) => normalizeAuthorName(a) === normalized)
  ).map((g) => g.name);
}
