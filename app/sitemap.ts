import { MetadataRoute } from 'next';
import { getAllGenreAuthors } from '@/lib/genres';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const authorPages: MetadataRoute.Sitemap = getAllGenreAuthors().map((author) => ({
    url: `${baseUrl}/authors/${encodeURIComponent(author)}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

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
