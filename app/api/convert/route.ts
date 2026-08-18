import { NextRequest, NextResponse } from 'next/server';
import { unzipSync, zipSync, strToU8, Zippable } from 'fflate';
import iconv from 'iconv-lite';

export const maxDuration = 15;

// --------------------------------------------------
// レート制限ロジック
// --------------------------------------------------
interface RateLimitStore {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitStore>();
const LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 10;

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

// --------------------------------------------------
// ユーティリティ関数
// --------------------------------------------------
async function fetchBuffer(url: string, timeout = 15000): Promise<Buffer> {
  const res = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: '*/*',
    },
    signal: AbortSignal.timeout(timeout),
  });

  if (!res.ok) {
    throw new Error(`ZIPダウンロード失敗: Status ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function extractTxtFromZip(zipBuffer: Buffer): string {
  const unzipped = unzipSync(new Uint8Array(zipBuffer));

  const txtFileName = Object.keys(unzipped).find((fileName) =>
    fileName.toLowerCase().endsWith('.txt')
  );

  if (!txtFileName) {
    throw new Error('ZIP内に .txt ファイルが見つかりませんでした。');
  }

  const contentBuffer = Buffer.from(unzipped[txtFileName]);
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

const RUBY_PATTERN =
  /｜([^《\n]+)《([^》\n]+)》|([\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]+)《([^》\n]+)》/g;
const ANNOTATION_PATTERN = /［＃[^］]+］/g;

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

  let bodyStart =
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
    line = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // C. ルビ処理
    line = line.replace(
      RUBY_PATTERN,
      (match, rubyBase, rubyText, kanji, kanjiRuby) => {
        if (rubyBase !== undefined)
          return `<ruby>${rubyBase}<rt>${rubyText}</rt></ruby>`;
        return `<ruby>${kanji}<rt>${kanjiRuby}</rt></ruby>`;
      }
    );

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
  const bookId = `urn:uuid:${Date.now()}`;

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
    'mimetype': [mimetype, { level: 0 }],
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
  const clientIp = forwardedFor
    ? forwardedFor.split(',')[0].trim()
    : '127.0.0.1';

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
    const { title, author, zipUrl } = await req.json();

    if (!zipUrl) {
      return NextResponse.json(
        { error: 'ZIP URL が指定されていません。' },
        { status: 400 }
      );
    }

    const zipBuffer = await fetchBuffer(zipUrl);
    const rawTxt = extractTxtFromZip(zipBuffer);
    const bodyHtml = parseAozoraTxtToHtml(rawTxt);

    const epubArray = buildEpubBuffer(
      title || '無題',
      author || '作者不明',
      bodyHtml
    );

    return new NextResponse(epubArray as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/epub+zip',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(
          title || 'book'
        )}.epub"`,
        'X-RateLimit-Limit': MAX_REQUESTS.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
      },
    });
  } catch (error: any) {
    console.error('EPUB変換エラー:', error);
    return NextResponse.json(
      { error: error.message || 'EPUBの生成処理に失敗しました。' },
      { status: 500 }
    );
  }
}