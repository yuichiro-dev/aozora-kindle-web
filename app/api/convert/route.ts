import booksData from '@/public/books.json';

import { NextRequest, NextResponse } from 'next/server';

import { MAX_REQUESTS } from '@/lib/epub/constants';

import { checkRateLimit, getClientIp } from '@/lib/epub/security';

import { fetchAozoraZip, fetchGaijiImages, buildGaijiImageMap } from '@/lib/epub/fetchAozora';

import { extractDataFromZip } from '@/lib/epub/zip';

import { GAIJI_PATTERN } from '@/lib/epub/aozora/inline';

import { parseAozoraTxtToHtml } from '@/lib/epub/aozora/parser';

import { buildEpubBuffer } from '@/lib/epub/epub/builder';

import type { Book } from '@/lib/epub/types';

export const maxDuration = 20;

const booksMap = new Map<number, Book>((booksData as Book[]).map((book) => [book.id, book]));

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);

  const { success, remaining } = checkRateLimit(clientIp);

  if (!success) {
    return NextResponse.json(
      {
        error: 'リクエストが多すぎます。少し時間をおいてから再度お試しください。',
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': MAX_REQUESTS.toString(),

          'X-RateLimit-Remaining': remaining.toString(),
        },
      }
    );
  }

  try {
    const body = await req.json();

    if (!body || typeof body.id !== 'number' || !Number.isSafeInteger(body.id)) {
      return NextResponse.json(
        {
          error: '不正なリクエストです。',
        },
        {
          status: 400,
        }
      );
    }

    const book = booksMap.get(body.id);

    if (!book || !book.zip_url) {
      return NextResponse.json(
        {
          error: '対象の作品が見つかりません。',
        },
        {
          status: 404,
        }
      );
    }

    const zipBuffer = await fetchAozoraZip(book.zip_url);

    const { text, images } = extractDataFromZip(zipBuffer);

    const jisCodes = [...text.matchAll(GAIJI_PATTERN)]
      .map((m) => m[2])
      .filter((code): code is string => Boolean(code));

    const gaijiImages = await fetchGaijiImages(jisCodes);
    const gaijiImageMap = buildGaijiImageMap(gaijiImages);

    const bodyHtml = parseAozoraTxtToHtml(text, gaijiImageMap);

    // GaijiImage 型から ExtractedImage 型への変換処理
    const gaijiAsExtractedImages = gaijiImages.map((img) => ({
      name: img.filename,
      data: new Uint8Array(img.data),
      mediaType: img.mediaType,
    }));

    const epub = buildEpubBuffer(book.title || '無題', book.author || '作者不明', bodyHtml, [
      ...images,
      ...gaijiAsExtractedImages,
    ]);

    return new NextResponse(epub as unknown as BodyInit, {
      status: 200,

      headers: {
        'Content-Type': 'application/epub+zip',

        'Content-Disposition': `attachment; filename="${encodeURIComponent(
          book.title || 'book'
        )}.epub"`,

        'X-RateLimit-Limit': MAX_REQUESTS.toString(),

        'X-RateLimit-Remaining': remaining.toString(),
      },
    });
  } catch (error: unknown) {
    console.error('EPUB変換エラー:', error);

    return NextResponse.json(
      {
        error: 'EPUBの生成に失敗しました。',
      },
      {
        status: 500,
      }
    );
  }
}
