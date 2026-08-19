import booksData from '@/public/books.json';
import { NextRequest, NextResponse } from 'next/server';
import { unzipSync, zipSync, strToU8, Zippable } from 'fflate';
import iconv from 'iconv-lite';
import crypto from 'crypto';

export const maxDuration = 20;

interface Book {
  id: number;
  title: string;
  author: string;
  zip_url: string | null;
}

interface RateLimitStore {
  count: number;
  resetTime: number;
}

const LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 10;
const MAX_ZIP_BYTES = 20 * 1024 * 1024;
const MAX_TEXT_BYTES = 10 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 50;

const RUBY_PATTERN =
  /｜([^《\n]+)《([^》\n]+)》|([\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]+)《([^》\n]+)》/g;
const ANNOTATION_PATTERN = /［＃[^］]+］/g;

const rateLimitMap = new Map<string, RateLimitStore>();
const booksMap = new Map<number, Book>((booksData as Book[]).map((b) => [b.id, b]));

function cleanupRateLimitMap(now: number) {
  if (rateLimitMap.size < 5000) return;
  for (const [ip, record] of rateLimitMap) {
    if (now > record.resetTime) rateLimitMap.delete(ip);
  }
}

function checkRateLimit(ip: string): { success: boolean; remaining: number } {
  const now = Date.now();
  cleanupRateLimitMap(now);
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + LIMIT_WINDOW_MS,
    });
    return { success: true, remaining: MAX_REQUESTS - 1 };
  }

  if (record.count >= MAX_REQUESTS) {
    return { success: false, remaining: 0 };
  }

  record.count += 1;
  return { success: true, remaining: MAX_REQUESTS - record.count };
}

async function fetchBuffer(urlStr: string, timeout = 15000): Promise<Buffer> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlStr);
  } catch {
    throw new Error('無効なURL形式です。');
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error('HTTPS以外のプロトコルは許可されていません。');
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
    hostname.endsWith('.local')
  ) {
    throw new Error('許可されていないホストへのアクセスです。');
  }

  const allowedDomains = ['aozora.gr.jp'];
  const isAllowed = allowedDomains.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  );

  if (!isAllowed) {
    throw new Error('許可されていないドメインのURLです。');
  }

  let currentUrl = urlStr;
  let res: Response;
  let redirectCount = 0;
  const maxRedirects = 3;

  while (true) {
    res = await fetch(currentUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: '*/*',
      },
      signal: AbortSignal.timeout(timeout),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) {
        throw new Error('リダイレクト先が見つかりません。');
      }

      redirectCount++;
      if (redirectCount > maxRedirects) {
        throw new Error('リダイレクト回数が多すぎます。');
      }

      const nextUrl = new URL(location, currentUrl);

      if (nextUrl.protocol !== 'https:') {
        throw new Error('リダイレクト先がHTTPSではありません。');
      }

      const nextHost = nextUrl.hostname.toLowerCase();
      if (
        nextHost === 'localhost' ||
        nextHost === '127.0.0.1' ||
        nextHost.startsWith('10.') ||
        nextHost.startsWith('192.168.')
      ) {
        throw new Error('不正なリダイレクト先が検知されました。');
      }

      currentUrl = nextUrl.toString();
      continue;
    }
    break;
  }

  if (!res!.ok) {
    throw new Error(`ZIPダウンロード失敗: Status ${res!.status}`);
  }

  const contentLength = res!.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_ZIP_BYTES) {
    throw new Error(`ZIPファイルが大きすぎます（上限: ${MAX_ZIP_BYTES / 1024 / 1024}MB）`);
  }

  const arrayBuffer = await res!.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);
  if (buf.length > MAX_ZIP_BYTES) {
    throw new Error(`ZIPファイルが大きすぎます（上限: ${MAX_ZIP_BYTES / 1024 / 1024}MB）`);
  }

  return buf;
}

function extractTxtFromZip(zipBuffer: Buffer): string {
  let txtFileName: string | null = null;

  const unzipped = unzipSync(new Uint8Array(zipBuffer), {
    filter(file) {
      if (!file.name.toLowerCase().endsWith('.txt')) return false;
      if (txtFileName !== null) return false;

      if (file.originalSize > MAX_TEXT_BYTES) {
        throw new Error(
          `展開後の予測テキストサイズが大きすぎます（上限: ${MAX_TEXT_BYTES / 1024 / 1024}MB）`
        );
      }

      if (file.size > 0) {
        const ratio = file.originalSize / file.size;
        if (ratio > MAX_COMPRESSION_RATIO) {
          throw new Error(
            '異常な高圧縮率のファイル（Zip Bombの可能性）が検知されたため処理を中断しました。'
          );
        }
      }

      txtFileName = file.name;
      return true;
    },
  });

  if (!txtFileName) {
    throw new Error('ZIP内に有効な .txt ファイルが見つかりませんでした。');
  }

  const contentBuffer = Buffer.from(unzipped[txtFileName]);

  if (contentBuffer.length > MAX_TEXT_BYTES) {
    throw new Error(`展開後のテキストが大きすぎます（上限: ${MAX_TEXT_BYTES / 1024 / 1024}MB）`);
  }

  let text = iconv.decode(contentBuffer, 'Shift_JIS');
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  return text;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// --------------------------------------------------
// 青空文庫テキストの1ファイルパース処理
// --------------------------------------------------
function parseAozoraTxtToHtml(rawTxt: string): string {
  const lines = rawTxt.split(/\r?\n/);

  // 1. ヘッダー切り落とし
  const dividerRegex = /^[-―─-]{10,}\s*$/;
  let firstDividerIdx = -1;
  let secondDividerIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (dividerRegex.test(lines[i].trim())) {
      if (firstDividerIdx === -1) {
        firstDividerIdx = i;
      } else {
        secondDividerIdx = i;
        break;
      }
    }
  }

  const bodyStart =
    secondDividerIdx !== -1
      ? secondDividerIdx + 1
      : firstDividerIdx !== -1
        ? firstDividerIdx + 1
        : 0;

  // 2. フッター切り落とし
  let bodyEnd = lines.length;
  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('底本：') || line.startsWith('［＃本文終わり］')) {
      bodyEnd = i;
      break;
    }
  }

  const bodyLines = lines.slice(bodyStart, bodyEnd);
  const htmlResult: string[] = ['<div class="main"><div class="chapter">'];
  let inPageCenter = false;

  for (let i = 0; i < bodyLines.length; i++) {
    let line = bodyLines[i];
    const trimmed = line.trim();

    // A. ブロック命令判定
    if (
      trimmed.includes('［＃ページの左右中央］') ||
      trimmed.includes('［＃ここからページの左右中央］')
    ) {
      inPageCenter = true;
      htmlResult.push('<div class="page-center">');
      continue;
    }
    if (trimmed.includes('［＃ここでページの左右中央終わり］')) {
      inPageCenter = false;
      htmlResult.push('</div>');
      continue;
    }

    if (trimmed.includes('［＃改ページ］') || trimmed.includes('［＃改丁］')) {
      if (inPageCenter) {
        htmlResult.push('</div>');
        inPageCenter = false;
      }
      htmlResult.push('<div class="page-break"></div>');
      continue;
    }

    // B. XML特殊文字のエスケープ
    line = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // C. ルビ処理
    line = line.replace(RUBY_PATTERN, (match, rubyBase, rubyText, kanji, kanjiRuby) => {
      if (rubyBase !== undefined) return `<ruby>${rubyBase}<rt>${rubyText}</rt></ruby>`;
      return `<ruby>${kanji}<rt>${kanjiRuby}</rt></ruby>`;
    });

    // D. 外字文字救出 (［＃「...」は〜］)
    line = line.replace(/［＃「([^」]+)」[^］]*］/g, '$1');

    const isHeading = /［＃.*見出し］/.test(line);
    line = line.replace(ANNOTATION_PATTERN, '');

    // E. HTML構造の出力
    if (line.trim() === '') {
      if (!inPageCenter) {
        htmlResult.push('<p><br/></p>');
      }
    } else if (isHeading) {
      htmlResult.push(`<h2 class="main-title">${line.trim()}</h2>`);
    } else {
      htmlResult.push(`<p>${line}</p>`);
    }
  }

  if (inPageCenter) {
    htmlResult.push('</div>');
  }

  htmlResult.push('</div></div>');
  return htmlResult.join('');
}

// --------------------------------------------------
// EPUB3 ZIP 構築（1ファイル構成）
// --------------------------------------------------
function buildEpubBuffer(title: string, author: string, bodyHtml: string): Uint8Array {
  const safeTitle = escapeXml(title);
  const safeAuthor = escapeXml(author);
  const bookId = `urn:uuid:${crypto.randomUUID()}`;

  const mimetype = strToU8('application/epub+zip');
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="item/standard.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

  const css = `@charset "UTF-8";
@page {
  margin: 0;
}
html {
  writing-mode: vertical-rl;
  -webkit-writing-mode: vertical-rl;
  -epub-writing-mode: vertical-rl;
}
body {
  writing-mode: vertical-rl;
  -webkit-writing-mode: vertical-rl;
  -epub-writing-mode: vertical-rl;
  font-family: "Hiragino Mincho ProN", "Yu Mincho", "MS Mincho", serif;
  line-height: 1.8;
  margin: 0;
  padding: 0;
}
.main {
  box-sizing: border-box;
  padding-block-start: 1.8em !important;
  padding-inline-start: 1.2em !important;
  padding-inline-end: 1.2em !important;
}
.chapter {
  display: block;
}
p {
  text-indent: 1em;
  margin: 0;
  padding: 0;
}
ruby rt {
  font-size: 0.5em;
}
.main-title {
  text-align: center;
  font-size: 1.4em;
  font-weight: bold;
  margin: 2em 0;
}
.page-break {
  page-break-before: always;
  break-before: page;
}`;

  const xhtmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="ja" lang="ja">
<head>
  <meta charset="UTF-8"/>
  <title>${safeTitle}</title>
  <link rel="stylesheet" type="text/css" href="../style/style.css"/>
</head>
<body>
${bodyHtml}
</body>
</html>`;

  const zipFiles: Zippable = {
    mimetype: [mimetype, { level: 0 }],
    'META-INF/container.xml': strToU8(containerXml),
    'item/style/style.css': strToU8(css),
    'item/xhtml/p-001.xhtml': strToU8(xhtmlContent),
  };

  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="ja">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">${bookId}</dc:identifier>
    <dc:title>${safeTitle}</dc:title>
    <dc:creator>${safeAuthor}</dc:creator>
    <dc:language>ja</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
    <meta property="page-progression-direction">rtl</meta>
    <meta property="primary-writing-mode">vertical-rl</meta>
  </metadata>
  <manifest>
    <item id="style" href="style/style.css" media-type="text/css"/>
    <item id="p-001" href="xhtml/p-001.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine page-progression-direction="rtl">
    <itemref idref="p-001"/>
  </spine>
</package>`;

  zipFiles['item/standard.opf'] = strToU8(opf);

  return zipSync(zipFiles);
}

// --------------------------------------------------
// APIハンドラー
// --------------------------------------------------
export async function POST(req: NextRequest) {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';

  const { success, remaining } = checkRateLimit(clientIp);

  if (!success) {
    return NextResponse.json(
      { error: 'リクエストが多すぎます。少し時間をおいてから再度お試しください。' },
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
      return NextResponse.json({ error: '不正なリクエストです。' }, { status: 400 });
    }

    const book = booksMap.get(body.id);
    if (!book || !book.zip_url) {
      return NextResponse.json({ error: '対象の作品が見つかりません。' }, { status: 404 });
    }

    const title = book.title;
    const author = book.author;

    const zipBuffer = await fetchBuffer(book.zip_url);
    const rawTxt = extractTxtFromZip(zipBuffer);
    const bodyHtml = parseAozoraTxtToHtml(rawTxt);

    const epubArray = buildEpubBuffer(title || '無題', author || '作者不明', bodyHtml);

    return new NextResponse(epubArray as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/epub+zip',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(title || 'book')}.epub"`,
        'X-RateLimit-Limit': MAX_REQUESTS.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
      },
    });
  } catch (error: unknown) {
    console.error('EPUB変換エラー:', error);
    return NextResponse.json({ error: 'EPUBの生成に失敗しました。' }, { status: 500 });
  }
}
