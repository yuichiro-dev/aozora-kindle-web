import { MetadataRoute } from 'next';
import { getAllGenreAuthors } from '@/lib/genres';

export default function sitemap(): MetadataRoute.Sitemap {
  // 環境変数が末尾スラッシュ(/)付きでも無しでも自動整形して二重スラッシュ(//)を防ぐ
  const rawBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const baseUrl = rawBaseUrl.replace(/\/+$/, '');

  const authorPages: MetadataRoute.Sitemap = getAllGenreAuthors().map((author) => {
    // 著者名（日本語）をパーセントエンコード
    const fullUrl = `${baseUrl}/authors/${encodeURIComponent(author)}`;

    return {
      url: encodeURI(fullUrl),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    };
  });

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/llms.txt`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    ...authorPages,
  ];
}