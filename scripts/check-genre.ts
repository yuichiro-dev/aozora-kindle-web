import books from '../public/books.json' with { type: 'json' };
import { GENRE_GROUPS } from '../lib/genres';

const normalize = (str?: string | null) =>
  str ? str.replace(/[\s\u3000・.,-]+/g, '').toLowerCase() : '';

const counts = new Map<string, number>();
for (const b of books as { author: string | null }[]) {
  if (!b.author) continue;
  const key = normalize(b.author);
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

let hasZero = false;

for (const group of GENRE_GROUPS) {
  for (const author of group.authors) {
    const n = counts.get(normalize(author)) ?? 0;
    if (n === 0) {
      hasZero = true;
      console.warn(`⚠ [${group.name}] ${author}: 0件`);
    }
  }
}

if (hasZero) {
  console.error('\n0件の作者が見つかりました。上記を確認してください。');
  process.exit(1);
} else {
  console.log('✅ 全グループ、全作者が1件以上ヒットしました。');
}
