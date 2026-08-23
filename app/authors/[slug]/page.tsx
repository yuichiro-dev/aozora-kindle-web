// app/authors/[slug]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import booksData from '@/public/books.json';
import { getAllGenreAuthors, getGenresForAuthor, normalizeAuthorName } from '@/lib/genres';
import AuthorBookList from '@/components/AuthorBookList';
import Header from '@/components/Header';
import Link from 'next/link';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

interface Book {
  id: number;
  title: string;
  author: string;
  zip_url: string | null;
}

const books = booksData as Book[];

function findBooksByAuthor(author: string): Book[] {
  const normalized = normalizeAuthorName(author);
  return books.filter((b) => b.author && normalizeAuthorName(b.author) === normalized);
}

export function generateStaticParams() {
  return getAllGenreAuthors().map((author) => ({ slug: encodeURIComponent(author) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const author = decodeURIComponent(slug);
  const authorBooks = findBooksByAuthor(author);

  if (authorBooks.length === 0) {
    return {};
  }

  const genres = getGenresForAuthor(author);
  const title = `${author}の作品一覧（全${authorBooks.length}作品）`;
  const description = `青空文庫収録の${author}の作品${authorBooks.length}件を、Kindle対応の縦書きEPUBに変換してダウンロードできます。${
    genres.length > 0 ? `ジャンル: ${genres.join('・')}。` : ''
  }`;

  return {
    title,
    description,
    alternates: {
      canonical: `/authors/${slug}`,
    },
    openGraph: {
      title,
      description,
      type: 'website',
    },
  };
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const author = decodeURIComponent(slug);
  const authorBooks = findBooksByAuthor(author);

  if (authorBooks.length === 0) {
    notFound();
  }

  const genres = getGenresForAuthor(author);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${author}の作品一覧`,
    description: `青空文庫収録の${author}の作品をKindle対応EPUBに変換`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: authorBooks.map((book, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Book',
          name: book.title,
          author: { '@type': 'Person', name: author },
          inLanguage: 'ja',
        },
      })),
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'ホーム', item: SITE_URL },
      {
        '@type': 'ListItem',
        position: 2,
        name: author,
        item: `${SITE_URL}/authors/${slug}`,
      },
    ],
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background p-4 md:p-10">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
        <div className="max-w-4xl mx-auto space-y-5">
          <nav className="text-xs text-muted-foreground" aria-label="パンくずリスト">
            <Link href="/" className="hover:underline">
              ホーム
            </Link>
            <span className="mx-1">›</span>
            <span>{author}</span>
          </nav>
          <h1 className="text-xl font-bold text-foreground">
            {author}の作品一覧（青空文庫 → Kindle変換）
          </h1>
          {genres.length > 0 && (
            <p className="text-sm text-muted-foreground">ジャンル: {genres.join('・')}</p>
          )}
          <p className="text-sm text-muted-foreground">
            青空文庫に収録されている{author}の作品、全{authorBooks.length}
            件をKindle対応の縦書きEPUBに変換してダウンロードできます。
          </p>
          <AuthorBookList books={authorBooks} />
        </div>
      </main>
    </>
  );
}
