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

interface ExtractedImage {
  name: string;
  data: Uint8Array;
  mediaType: string;
}

const LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 10;
const MAX_ZIP_BYTES = 20 * 1024 * 1024;
const MAX_TEXT_BYTES = 10 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 50;

const RUBY_PATTERN =
  /｜([^《\n]+)《([^》\n]+)》|([\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF〆々〆〇ヶ]+)《([^》\n]+)》/g;
const ANNOTATION_PATTERN = /［＃[^］]+］/g;
const IMAGE_ANNOTATION_PATTERN = /［＃(?:.+?図|挿絵|画像)（([^,、）]+)(?:[、,][^）]+)?）入る］/g;

const rateLimitMap = new Map<string, RateLimitStore>();
const booksMap = new Map<number, Book>((booksData as Book[]).map((b) => [b.id, b]));

function zenToHanDigits(str: string): string {
  return str.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
}

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
        nextHost === '::1' ||
        nextHost.startsWith('10.') ||
        nextHost.startsWith('192.168.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(nextHost) ||
        nextHost.endsWith('.local')
      ) {
        throw new Error('不正なリダイレクト先が検知されました。');
      }

      const nextIsAllowed = allowedDomains.some(
        (domain) => nextHost === domain || nextHost.endsWith(`.${domain}`)
      );
      if (!nextIsAllowed) {
        throw new Error('リダイレクト先が許可ドメイン外です。');
      }

      currentUrl = nextUrl.toString();
      continue;
    }

    break;
  }

  if (!res.ok) {
    throw new Error(`ZIPダウンロード失敗: Status ${res.status}`);
  }

  const contentLength = res.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_ZIP_BYTES) {
    throw new Error(`ZIPファイルが大きすぎます（上限: ${MAX_ZIP_BYTES / 1024 / 1024}MB）`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);

  if (buf.length > MAX_ZIP_BYTES) {
    throw new Error(`ZIPファイルが大きすぎます（上限: ${MAX_ZIP_BYTES / 1024 / 1024}MB）`);
  }

  return buf;
}

function extractDataFromZip(zipBuffer: Buffer): { text: string; images: ExtractedImage[] } {
  let txtFileName: string | null = null;
  const images: ExtractedImage[] = [];

  const unzipped = unzipSync(new Uint8Array(zipBuffer), {
    filter(file) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.txt')) {
        if (txtFileName === null) {
          if (file.originalSize > MAX_TEXT_BYTES) {
            throw new Error(
              `展開後の予測テキストサイズが大きすぎます（上限: ${MAX_TEXT_BYTES / 1024 / 1024}MB）`
            );
          }
          if (file.size > 0 && file.originalSize / file.size > MAX_COMPRESSION_RATIO) {
            throw new Error('Zip Bombの可能性が検知されたため処理を中断しました。');
          }
          txtFileName = file.name;
        }
        return true;
      }

      const ext = lower.split('.').pop() || '';
      if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
        return true;
      }

      return false;
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

  for (const [filePath, u8Data] of Object.entries(unzipped)) {
    if (filePath === txtFileName) continue;
    const fileName = filePath.split('/').pop() || filePath;
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
      const mediaType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
      images.push({
        name: fileName,
        data: u8Data,
        mediaType,
      });
    }
  }

  return { text, images };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const escapeHtml = escapeXml;

type InlineStyle =
  | 'sesame_dot'
  | 'white_sesame_dot'
  | 'black_circle'
  | 'white_circle'
  | 'black_up-pointing_triangle'
  | 'white_up-pointing_triangle'
  | 'bullseye'
  | 'fisheye'
  | 'saltire'
  | 'sesame_dot_after'
  | 'white_sesame_dot_after'
  | 'black_circle_after'
  | 'white_circle_after'
  | 'black_up-pointing_triangle_after'
  | 'white_up-pointing_triangle_after'
  | 'bullseye_after'
  | 'fisheye_after'
  | 'saltire_after'
  | 'underline_solid'
  | 'underline_double'
  | 'underline_dotted'
  | 'underline_dashed'
  | 'underline_wave'
  | 'overline_solid'
  | 'overline_double'
  | 'overline_dotted'
  | 'overline_dashed'
  | 'overline_wave'
  | 'futoji'
  | 'shatai';

interface BlockState {
  type:
    | 'indent'
    | 'chitsuki'
    | 'chiyose'
    | 'burasage'
    | 'jizume'
    | 'emphasis'
    | 'underline'
    | 'overline'
    | 'bold'
    | 'italic'
    | 'heading'
    | 'keigakomi'
    | 'yokogumi'
    | 'caption'
    | 'dai'
    | 'sho';
  className?: string;
  level?: 1 | 2 | 3;
  tag?: 'h2' | 'h3' | 'h4';
  amount?: number;
  wrapIndent?: number;
}

function blockTags(state: BlockState): { open: string; close: string } {
  switch (state.type) {
    case 'heading':
      return {
        open: `<${state.tag} class="${state.className}">`,
        close: `</${state.tag}>`,
      };
    case 'chitsuki':
      return {
        open: `<div class="chitsuki_0" style="text-align:right; margin-right: 0em">`,
        close: '</div>',
      };
    case 'chiyose': {
      const n = state.amount ?? 0;
      return {
        open: `<div class="chitsuki_${n}" style="text-align:right; margin-right: ${n}em">`,
        close: '</div>',
      };
    }
    case 'burasage': {
      const wrap = state.wrapIndent ?? 0;
      const indent = state.amount ?? 0;
      const textIndent = indent - wrap;
      return {
        open: `<div class="burasage" style="margin-left: ${wrap}em; text-indent: ${textIndent}em;">`,
        close: '</div>',
      };
    }
    case 'jizume': {
      const n = state.amount ?? 0;
      return { open: `<div class="jizume_${n}" style="width: ${n}em">`, close: '</div>' };
    }
    case 'dai': {
      const n = state.amount ?? 1;
      const sizeMap: Record<number, string> = { 1: 'large', 2: 'x-large' };
      const size = sizeMap[n] ?? 'xx-large';
      return {
        open: `<div class="dai${n}" style="font-size: ${size};">`,
        close: '</div>',
      };
    }
    case 'sho': {
      const n = state.amount ?? 1;
      const sizeMap: Record<number, string> = { 1: 'small', 2: 'x-small' };
      const size = sizeMap[n] ?? 'xx-small';
      return {
        open: `<div class="sho${n}" style="font-size: ${size};">`,
        close: '</div>',
      };
    }
    case 'caption':
      return { open: '<div class="caption">', close: '</div>' };
    case 'emphasis':
    case 'underline':
    case 'overline':
      return { open: `<em class="${state.className}">`, close: '</em>' };
    default:
      return { open: `<div class="${state.className}">`, close: '</div>' };
  }
}

const FORWARD_EMPHASIS: Array<{ suffix: string; className: InlineStyle }> = [
  { suffix: '傍点', className: 'sesame_dot' },
  { suffix: '白ゴマ傍点', className: 'white_sesame_dot' },
  { suffix: '丸傍点', className: 'black_circle' },
  { suffix: '白丸傍点', className: 'white_circle' },
  { suffix: '黒三角傍点', className: 'black_up-pointing_triangle' },
  { suffix: '白三角傍点', className: 'white_up-pointing_triangle' },
  { suffix: '二重丸傍点', className: 'bullseye' },
  { suffix: '蛇の目傍点', className: 'fisheye' },
  { suffix: 'ばつ傍点', className: 'saltire' },
];

const FORWARD_UNDERLINES: Array<{ suffix: string; className: InlineStyle }> = [
  { suffix: '傍線', className: 'underline_solid' },
  { suffix: '二重傍線', className: 'underline_double' },
  { suffix: '鎖線', className: 'underline_dotted' },
  { suffix: '破線', className: 'underline_dashed' },
  { suffix: '波線', className: 'underline_wave' },
];

const LEFT_EMPHASIS: Array<{ suffix: string; className: InlineStyle }> = [
  { suffix: '傍点', className: 'sesame_dot_after' },
  { suffix: '白ゴマ傍点', className: 'white_sesame_dot_after' },
  { suffix: '丸傍点', className: 'black_circle_after' },
  { suffix: '白丸傍点', className: 'white_circle_after' },
  { suffix: '黒三角傍点', className: 'black_up-pointing_triangle_after' },
  { suffix: '白三角傍点', className: 'white_up-pointing_triangle_after' },
  { suffix: '二重丸傍点', className: 'bullseye_after' },
  { suffix: '蛇の目傍点', className: 'fisheye_after' },
  { suffix: 'ばつ傍点', className: 'saltire_after' },
];

const LEFT_UNDERLINES: Array<{ suffix: string; className: InlineStyle }> = [
  { suffix: '傍線', className: 'overline_solid' },
  { suffix: '二重傍線', className: 'overline_double' },
  { suffix: '鎖線', className: 'overline_dotted' },
  { suffix: '破線', className: 'overline_dashed' },
  { suffix: '波線', className: 'overline_wave' },
];

function headingInfo(levelText: string): {
  level: 1 | 2 | 3;
  tag: 'h2' | 'h3' | 'h4';
  className: string;
} | null {
  if (levelText === '大見出し') {
    return { level: 1, tag: 'h2', className: 'o-midashi' };
  }
  if (levelText === '中見出し') {
    return { level: 2, tag: 'h3', className: 'naka-midashi' };
  }
  if (levelText === '小見出し') {
    return { level: 3, tag: 'h4', className: 'ko-midashi' };
  }
  return null;
}

function applyRubyAndEscape(text: string): string {
  let result = '';
  let lastIndex = 0;

  RUBY_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(RUBY_PATTERN)) {
    const index = match.index ?? 0;
    result += escapeHtml(text.slice(lastIndex, index));

    const rubyBase = match[1] ?? match[3];
    const rubyText = match[2] ?? match[4];

    result += `<ruby>${escapeHtml(rubyBase)}<rp>（</rp><rt>${escapeHtml(
      rubyText
    )}</rt><rp>）</rp></ruby>`;

    lastIndex = index + match[0].length;
  }

  result += escapeHtml(text.slice(lastIndex));
  return result;
}

function applyForwardReferenceAnnotations(line: string): string {
  let working = zenToHanDigits(line);

  const matches = [...working.matchAll(ANNOTATION_PATTERN)];

  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const raw = match[0];
    const index = match.index ?? -1;
    if (index < 0) continue;

    const body = raw.slice(2, -1);

    const headingMatch = body.match(/^「(.+?)」は(同行|窓)?(大|中|小)見出し$/);
    if (headingMatch) {
      const target = headingMatch[1];
      const formType = headingMatch[2];
      const info = headingInfo(`${headingMatch[3]}見出し`);
      if (!info) continue;

      const before = working.slice(0, index);
      if (!before.endsWith(target)) continue;

      const targetStart = index - target.length;
      const renderedTarget = applyRubyAndEscape(target);
      const headingClass =
        formType === '同行'
          ? `dogyo-${info.className}`
          : formType === '窓'
            ? `mado-${info.className}`
            : info.className;

      const replacement = `[[AOZORA_HEADING:${info.tag}:${headingClass}:${encodeURIComponent(
        renderedTarget
      )}]]`;

      working = working.slice(0, targetStart) + replacement + working.slice(index + raw.length);
      continue;
    }

    const mamaRubyMatch = body.match(/^「(.+?)」に「ママ」の注記$/);
    if (mamaRubyMatch) {
      const target = mamaRubyMatch[1];
      const before = working.slice(0, index);
      if (before.endsWith(target)) {
        const targetStart = index - target.length;
        const replacement = `[[AOZORA_HTML:${encodeURIComponent(
          `<ruby><rb>${escapeHtml(target)}</rb><rp>（</rp><rt>ママ</rt><rp>）</rp></ruby>`
        )}]]`;
        working = working.slice(0, targetStart) + replacement + working.slice(index + raw.length);
        continue;
      }
    }

    const leftMatch = body.match(/^「(.+?)」の左に(.+)$/);
    const normalMatch = body.match(/^「(.+?)」に(.+)$/);

    const target = leftMatch?.[1] ?? normalMatch?.[1];
    const styleName = leftMatch?.[2] ?? normalMatch?.[2];

    if (!target || !styleName) continue;

    const style = (
      leftMatch
        ? [...LEFT_EMPHASIS, ...LEFT_UNDERLINES]
        : [...FORWARD_EMPHASIS, ...FORWARD_UNDERLINES]
    ).find((item) => item.suffix === styleName);

    if (!style) continue;

    const before = working.slice(0, index);
    if (!before.endsWith(target)) continue;

    const targetStart = index - target.length;
    const replacement = `[[AOZORA_INLINE:${style.className}:${encodeURIComponent(target)}]]`;

    working = working.slice(0, targetStart) + replacement + working.slice(index + raw.length);
  }

  interface SimpleForwardRule {
    re: RegExp;
    getClassName: (match: RegExpExecArray) => string;
  }

  const simplePatterns: SimpleForwardRule[] = [
    { re: /「(.+?)」は太字/, getClassName: () => 'futoji' },
    { re: /「(.+?)」は斜体/, getClassName: () => 'shatai' },
    { re: /「(.+?)」は縦中横/, getClassName: () => 'tcy' },
    { re: /「(.+?)」は行右小書き/, getClassName: () => 'superscript' },
    { re: /「(.+?)」は行左小書き/, getClassName: () => 'subscript' },
    { re: /「(.+?)」は上付き小文字/, getClassName: () => 'superscript' },
    { re: /「(.+?)」は下付き小文字/, getClassName: () => 'subscript' },
    { re: /「(.+?)」は(\d+)段階大きな文字/, getClassName: (m) => `dai${m[2]}` },
    { re: /「(.+?)」は(\d+)段階小さな文字/, getClassName: (m) => `sho${m[2]}` },
    { re: /「(.+?)」はキャプション/, getClassName: () => 'caption' },
  ];

  for (const { re, getClassName } of simplePatterns) {
    const annotationRe = new RegExp(`［＃${re.source}］`, 'g');
    let m: RegExpExecArray | null;

    while ((m = annotationRe.exec(working)) !== null) {
      const rawTarget = m[1];
      const className = getClassName(m);
      const start = m.index;
      const before = working.slice(0, start);

      if (!before.endsWith(rawTarget)) continue;

      const targetStart = start - rawTarget.length;
      const replacement = `[[AOZORA_INLINE:${className}:${encodeURIComponent(rawTarget)}]]`;

      working = working.slice(0, targetStart) + replacement + working.slice(start + m[0].length);

      annotationRe.lastIndex = 0;
    }
  }

  return working;
}

function renderInline(line: string): string {
  let working = applyForwardReferenceAnnotations(line);

  // 画像注記の置換処理
  working = working.replace(IMAGE_ANNOTATION_PATTERN, (_match, fileName) => {
    const cleanFileName = fileName.trim();
    return `[[AOZORA_HTML:${encodeURIComponent(
      `<div class="illust"><img src="../images/${escapeXml(cleanFileName)}" alt="" /></div>`
    )}]]`;
  });

  // インライン文字サイズ指定（大/小）
  working = working.replace(
    /［＃(\d+)段階大きな文字］([\s\S]+?)［＃大きな文字終わり］/g,
    (_m, digits, content) => {
      const n = Number(digits);
      const sizeMap: Record<number, string> = { 1: 'large', 2: 'x-large' };
      const size = sizeMap[n] ?? 'xx-large';
      return `[[AOZORA_HTML:${encodeURIComponent(
        `<span class="dai${n}" style="font-size: ${size};">${renderInline(content)}</span>`
      )}]]`;
    }
  );
  working = working.replace(
    /［＃(\d+)段階小さな文字］([\s\S]+?)［＃小さな文字終わり］/g,
    (_m, digits, content) => {
      const n = Number(digits);
      const sizeMap: Record<number, string> = { 1: 'small', 2: 'x-small' };
      const size = sizeMap[n] ?? 'xx-small';
      return `[[AOZORA_HTML:${encodeURIComponent(
        `<span class="sho${n}" style="font-size: ${size};">${renderInline(content)}</span>`
      )}]]`;
    }
  );

  const rangePatterns: Array<{
    start: string;
    end: string;
    className: string;
    tag?: string;
  }> = [
    { start: '傍点', end: '傍点終わり', className: 'sesame_dot', tag: 'em' },
    { start: '白ゴマ傍点', end: '白ゴマ傍点終わり', className: 'white_sesame_dot', tag: 'em' },
    { start: '丸傍点', end: '丸傍点終わり', className: 'black_circle', tag: 'em' },
    { start: '白丸傍点', end: '白丸傍点終わり', className: 'white_circle', tag: 'em' },
    {
      start: '黒三角傍点',
      end: '黒三角傍点終わり',
      className: 'black_up-pointing_triangle',
      tag: 'em',
    },
    {
      start: '白三角傍点',
      end: '白三角傍点終わり',
      className: 'white_up-pointing_triangle',
      tag: 'em',
    },
    { start: '二重丸傍点', end: '二重丸傍点終わり', className: 'bullseye', tag: 'em' },
    { start: '蛇の目傍点', end: '蛇の目傍点終わり', className: 'fisheye', tag: 'em' },
    { start: 'ばつ傍点', end: 'ばつ傍点終わり', className: 'saltire', tag: 'em' },

    { start: '左に傍点', end: '左に傍点終わり', className: 'sesame_dot_after', tag: 'em' },
    {
      start: '左に白ゴマ傍点',
      end: '左に白ゴマ傍点終わり',
      className: 'white_sesame_dot_after',
      tag: 'em',
    },
    { start: '左に丸傍点', end: '左に丸傍点終わり', className: 'black_circle_after', tag: 'em' },
    {
      start: '左に白丸傍点',
      end: '左に白丸傍点終わり',
      className: 'white_circle_after',
      tag: 'em',
    },
    {
      start: '左に黒三角傍点',
      end: '左に黒三角傍点終わり',
      className: 'black_up-pointing_triangle_after',
      tag: 'em',
    },
    {
      start: '左に白三角傍点',
      end: '左に白三角傍点終わり',
      className: 'white_up-pointing_triangle_after',
      tag: 'em',
    },
    {
      start: '左に二重丸傍点',
      end: '左に二重丸傍点終わり',
      className: 'bullseye_after',
      tag: 'em',
    },
    { start: '左に蛇の目傍点', end: '左に蛇の目傍点終わり', className: 'fisheye_after', tag: 'em' },
    { start: '左にばつ傍点', end: '左にばつ傍点終わり', className: 'saltire_after', tag: 'em' },

    { start: '傍線', end: '傍線終わり', className: 'underline_solid', tag: 'em' },
    { start: '二重傍線', end: '二重傍線終わり', className: 'underline_double', tag: 'em' },
    { start: '鎖線', end: '鎖線終わり', className: 'underline_dotted', tag: 'em' },
    { start: '破線', end: '破線終わり', className: 'underline_dashed', tag: 'em' },
    { start: '波線', end: '波線終わり', className: 'underline_wave', tag: 'em' },

    { start: '左に傍線', end: '左に傍線終わり', className: 'overline_solid', tag: 'em' },
    { start: '左に二重傍線', end: '左に二重傍線終わり', className: 'overline_double', tag: 'em' },
    { start: '左に鎖線', end: '左に鎖線終わり', className: 'overline_dotted', tag: 'em' },
    { start: '左に破線', end: '左に破線終わり', className: 'overline_dashed', tag: 'em' },
    { start: '左に波線', end: '左に波線終わり', className: 'overline_wave', tag: 'em' },

    { start: '太字', end: '太字終わり', className: 'futoji', tag: 'span' },
    { start: '斜体', end: '斜体終わり', className: 'shatai', tag: 'span' },
    { start: '縦中横', end: '縦中横終わり', className: 'tcy', tag: 'span' },
    { start: '行右小書き', end: '行右小書き終わり', className: 'superscript', tag: 'sup' },
    { start: '行左小書き', end: '行左小書き終わり', className: 'subscript', tag: 'sub' },
    { start: '上付き小文字', end: '上付き小文字終わり', className: 'superscript', tag: 'sup' },
    { start: '下付き小文字', end: '下付き小文字終わり', className: 'subscript', tag: 'sub' },

    { start: '割り注', end: '割り注終わり', className: 'warichu', tag: 'span' },
    { start: 'キャプション', end: 'キャプション終わり', className: 'caption', tag: 'span' },
  ];

  for (const range of rangePatterns) {
    const startToken = `［＃${range.start}］`;
    const endToken = `［＃${range.end}］`;
    const startIndex = working.indexOf(startToken);
    if (startIndex === -1) continue;

    const contentStart = startIndex + startToken.length;
    const endIndex = working.indexOf(endToken, contentStart);
    if (endIndex === -1) continue;

    const before = working.slice(0, startIndex);
    const content = working.slice(contentStart, endIndex);
    const after = working.slice(endIndex + endToken.length);

    const rendered =
      range.className === 'warichu'
        ? `<span class="warichu">（${renderInline(content)}）</span>`
        : `<${range.tag} class="${range.className}">${renderInline(content)}</${range.tag}>`;

    working = before + `[[AOZORA_HTML:${encodeURIComponent(rendered)}]]` + after;
  }

  // AOZORA_INLINE プレースホルダーの解決
  working = working.replace(
    /\[\[AOZORA_INLINE:([^:\]]+):([^\]]+)\]\]/g,
    (_match, className, encodedTarget) => {
      const target = decodeURIComponent(encodedTarget);
      let html = '';
      if (className === 'tcy') {
        html = `<span class="tcy">${applyRubyAndEscape(target)}</span>`;
      } else if (className === 'superscript') {
        html = `<sup class="superscript">${applyRubyAndEscape(target)}</sup>`;
      } else if (className === 'subscript') {
        html = `<sub class="subscript">${applyRubyAndEscape(target)}</sub>`;
      } else if (className === 'caption') {
        html = `<span class="caption">${applyRubyAndEscape(target)}</span>`;
      } else if (className.startsWith('dai') || className.startsWith('sho')) {
        const n = Number(className.replace(/\D/g, '')) || 1;
        const isDai = className.startsWith('dai');
        const sizeMap: Record<number, string> = isDai
          ? { 1: 'large', 2: 'x-large' }
          : { 1: 'small', 2: 'x-small' };
        const size = sizeMap[n] ?? (isDai ? 'xx-large' : 'xx-small');
        html = `<span class="${className}" style="font-size: ${size};">${applyRubyAndEscape(
          target
        )}</span>`;
      } else {
        html = `<em class="${className}">${applyRubyAndEscape(target)}</em>`;
      }
      return `[[AOZORA_HTML:${encodeURIComponent(html)}]]`;
    }
  );

  // 見出しプレースホルダーの解決
  working = working.replace(
    /\[\[AOZORA_HEADING:([^:]+):([^:]+):([^\]]+)\]\]/g,
    (_match, tag, className, encodedTarget) =>
      `[[AOZORA_HTML:${encodeURIComponent(
        `<${tag} class="${className}">${decodeURIComponent(encodedTarget)}</${tag}>`
      )}]]`
  );

  // 未対応注記の可視ノート化
  working = working.replace(ANNOTATION_PATTERN, (raw) => {
    console.warn('[Aozora] unsupported inline annotation:', raw);
    return `[[AOZORA_HTML:${encodeURIComponent(`<span class="notes">${escapeHtml(raw)}</span>`)}]]`;
  });

  // 残った生のテキスト部分のみルビ化＆HTMLエスケープ
  working = applyRubyAndEscape(working);

  // すべての AOZORA_HTML プレースホルダーを一括で元に戻す（ネスト対応）
  while (working.includes('[[AOZORA_HTML:')) {
    working = working.replace(/\[\[AOZORA_HTML:([^\]]+)\]\]/g, (_match, encodedHtml) =>
      decodeURIComponent(encodedHtml)
    );
  }

  return working;
}

function parseBlockStart(annotation: string): BlockState | null {
  const cleanAnno = zenToHanDigits(annotation);

  const indent = cleanAnno.match(/^ここから(\d+)字下げ$/);
  if (indent) {
    return { type: 'indent', className: `jisage-${Number(indent[1])}` };
  }

  const burasageOtsu = cleanAnno.match(/^ここから(\d+)字下げ、折り返して(\d+)字下げ$/);
  if (burasageOtsu) {
    return {
      type: 'burasage',
      amount: Number(burasageOtsu[1]),
      wrapIndent: Number(burasageOtsu[2]),
    };
  }

  const burasageTentsuki = cleanAnno.match(/^ここから改行天付き、折り返して(\d+)字下げ$/);
  if (burasageTentsuki) {
    return { type: 'burasage', amount: 0, wrapIndent: Number(burasageTentsuki[1]) };
  }

  if (cleanAnno === 'ここから地付き') {
    return { type: 'chitsuki' };
  }

  const chiyoseBlock = cleanAnno.match(/^ここから地から(\d+)字上げ$/);
  if (chiyoseBlock) {
    return { type: 'chiyose', amount: Number(chiyoseBlock[1]) };
  }

  const jizumeBlock = cleanAnno.match(/^ここから(\d+)字詰め$/);
  if (jizumeBlock) {
    return { type: 'jizume', amount: Number(jizumeBlock[1]) };
  }

  const daiBlock = cleanAnno.match(/^ここから(\d+)段階大きな文字$/);
  if (daiBlock) {
    return { type: 'dai', amount: Number(daiBlock[1]) };
  }
  const shoBlock = cleanAnno.match(/^ここから(\d+)段階小さな文字$/);
  if (shoBlock) {
    return { type: 'sho', amount: Number(shoBlock[1]) };
  }

  if (cleanAnno === 'ここからキャプション') {
    return { type: 'caption' };
  }

  const heading = cleanAnno.match(/^ここから(大|中|小)見出し$/);
  if (heading) {
    const info = headingInfo(`${heading[1]}見出し`);
    if (!info) return null;
    return {
      type: 'heading',
      level: info.level,
      tag: info.tag,
      className: info.className,
    };
  }

  if (cleanAnno === 'ここから傍点') return { type: 'emphasis', className: 'sesame_dot' };
  if (cleanAnno === 'ここから白ゴマ傍点')
    return { type: 'emphasis', className: 'white_sesame_dot' };
  if (cleanAnno === 'ここから丸傍点') return { type: 'emphasis', className: 'black_circle' };
  if (cleanAnno === 'ここから白丸傍点') return { type: 'emphasis', className: 'white_circle' };
  if (cleanAnno === 'ここから黒三角傍点')
    return { type: 'emphasis', className: 'black_up-pointing_triangle' };
  if (cleanAnno === 'ここから白三角傍点')
    return { type: 'emphasis', className: 'white_up-pointing_triangle' };
  if (cleanAnno === 'ここから二重丸傍点') return { type: 'emphasis', className: 'bullseye' };
  if (cleanAnno === 'ここから蛇の目傍点') return { type: 'emphasis', className: 'fisheye' };
  if (cleanAnno === 'ここからばつ傍点') return { type: 'emphasis', className: 'saltire' };

  if (cleanAnno === 'ここから傍線') return { type: 'underline', className: 'underline_solid' };
  if (cleanAnno === 'ここから二重傍線') return { type: 'underline', className: 'underline_double' };
  if (cleanAnno === 'ここから鎖線') return { type: 'underline', className: 'underline_dotted' };
  if (cleanAnno === 'ここから破線') return { type: 'underline', className: 'underline_dashed' };
  if (cleanAnno === 'ここから波線') return { type: 'underline', className: 'underline_wave' };

  if (cleanAnno === 'ここから左に傍点') return { type: 'emphasis', className: 'sesame_dot_after' };
  if (cleanAnno === 'ここから左に傍線') return { type: 'overline', className: 'overline_solid' };

  if (cleanAnno === 'ここから太字') return { type: 'bold', className: 'futoji' };
  if (cleanAnno === 'ここから斜体') return { type: 'italic', className: 'shatai' };
  if (cleanAnno === 'ここから罫囲み') return { type: 'keigakomi', className: 'keigakomi' };
  if (cleanAnno === 'ここから横組み') return { type: 'yokogumi', className: 'yokogumi' };

  return null;
}

function isBlockEnd(annotation: string): boolean {
  const cleanAnno = zenToHanDigits(annotation);
  return (
    /^ここで(大|中|小)見出し終わり$/.test(cleanAnno) ||
    /^ここで\d+字下げ終わり$/.test(cleanAnno) ||
    cleanAnno === 'ここで字下げ終わり' ||
    cleanAnno === 'ここで地付き終わり' ||
    cleanAnno === 'ここで字上げ終わり' ||
    cleanAnno === 'ここで字詰め終わり' ||
    cleanAnno === 'ここで大きな文字終わり' ||
    cleanAnno === 'ここで小さな文字終わり' ||
    cleanAnno === 'ここでキャプション終わり' ||
    cleanAnno === 'ここで傍点終わり' ||
    cleanAnno === 'ここで白ゴマ傍点終わり' ||
    cleanAnno === 'ここで丸傍点終わり' ||
    cleanAnno === 'ここで白丸傍点終わり' ||
    cleanAnno === 'ここで黒三角傍点終わり' ||
    cleanAnno === 'ここで白三角傍点終わり' ||
    cleanAnno === 'ここで二重丸傍点終わり' ||
    cleanAnno === 'ここで蛇の目傍点終わり' ||
    cleanAnno === 'ここでばつ傍点終わり' ||
    cleanAnno === 'ここで傍線終わり' ||
    cleanAnno === 'ここで二重傍線終わり' ||
    cleanAnno === 'ここで鎖線終わり' ||
    cleanAnno === 'ここで破線終わり' ||
    cleanAnno === 'ここで波線終わり' ||
    cleanAnno === 'ここで太字終わり' ||
    cleanAnno === 'ここで斜体終わり' ||
    cleanAnno === 'ここで罫囲み終わり' ||
    cleanAnno === 'ここで横組み終わり'
  );
}

function blockEndType(annotation: string): BlockState['type'] | null {
  const cleanAnno = zenToHanDigits(annotation);

  if (/ここで(大|中|小)見出し終わり$/.test(cleanAnno)) return 'heading';
  if (/ここで\d+字下げ終わり$/.test(cleanAnno) || cleanAnno === 'ここで字下げ終わり') return null;

  if (cleanAnno === 'ここで地付き終わり') return 'chitsuki';
  if (cleanAnno === 'ここで字上げ終わり') return 'chiyose';
  if (cleanAnno === 'ここで字詰め終わり') return 'jizume';
  if (cleanAnno === 'ここで大きな文字終わり') return 'dai';
  if (cleanAnno === 'ここで小さな文字終わり') return 'sho';
  if (cleanAnno === 'ここでキャプション終わり') return 'caption';

  if (cleanAnno.includes('傍点終わり')) return 'emphasis';
  if (cleanAnno.includes('傍線終わり')) {
    return cleanAnno.includes('左に') ? 'overline' : 'underline';
  }
  if (cleanAnno === 'ここで太字終わり') return 'bold';
  if (cleanAnno === 'ここで斜体終わり') return 'italic';
  if (cleanAnno === 'ここで罫囲み終わり') return 'keigakomi';
  if (cleanAnno === 'ここで横組み終わり') return 'yokogumi';

  return null;
}

const CHITSUKI_INLINE = /［＃地付き］/;
const CHIYOSE_INLINE = /［＃地から(\d+|[０-９]+)字上げ］/;

function tryRenderTrailingAlignment(line: string): string[] | null {
  const cleanLine = zenToHanDigits(line);
  const chitsukiMatch = cleanLine.match(CHITSUKI_INLINE);
  const chiyoseMatch = cleanLine.match(CHIYOSE_INLINE);

  const candidates = [chitsukiMatch, chiyoseMatch].filter((m): m is RegExpMatchArray => m !== null);
  if (candidates.length === 0) return null;

  const match = candidates.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))[0];
  const index = match.index ?? -1;
  if (index < 0) return null;

  const prefix = cleanLine.slice(0, index);
  const suffix = cleanLine.slice(index + match[0].length);
  const isChiyose = match === chiyoseMatch;
  const amount = isChiyose ? Number((chiyoseMatch as RegExpMatchArray)[1]) : 0;

  const out: string[] = [];
  if (prefix.trim() !== '') {
    out.push(`<p>${renderInline(prefix)}</p>`);
  }
  out.push(
    `<div class="chitsuki_${amount}" style="text-align:right; margin-right: ${amount}em">${renderInline(
      suffix
    )}</div>`
  );
  return out;
}

function renderNormalLine(line: string): string {
  let working = zenToHanDigits(line);
  let inlineIndent = 0;

  const inlineIndentMatches = [...working.matchAll(/［＃(\d+)字下げ］/g)];
  for (const match of inlineIndentMatches) {
    inlineIndent = Math.max(inlineIndent, Number(match[1]));
  }
  working = working.replace(/［＃\d+字下げ］/g, '');

  const content = renderInline(working);

  if (content.trim() === '') {
    return '<p><br/></p>';
  }

  if (content.trim().startsWith('<div')) {
    return content;
  }

  let result = `<p>${content}</p>`;

  if (inlineIndent > 0) {
    result = `<div class="jisage-${inlineIndent}">${result}</div>`;
  }

  return result;
}

function parseAozoraTxtToHtml(rawTxt: string): string {
  const lines = rawTxt.split(/\r?\n/);

  const dividerRegex = /^[-―─]{10,}\s*$/;
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

  const bodyLines = lines.slice(bodyStart);
  const htmlResult: string[] = ['<div class="main"><div class="chapter">'];

  const blockStack: BlockState[] = [];
  let inPageCenter = false;
  let inToc = false;

  const closeBlock = (expectedType: BlockState['type'] | null) => {
    if (blockStack.length === 0) {
      console.warn('[Aozora] block end without start:', expectedType);
      return;
    }

    const top = blockStack[blockStack.length - 1];
    const isIndentFamily = top.type === 'indent' || top.type === 'burasage';

    if (expectedType && top.type !== expectedType && !(expectedType === null && isIndentFamily)) {
      console.warn('[Aozora] mismatched block end:', {
        expected: expectedType,
        actual: top.type,
      });
      return;
    }

    blockStack.pop();
    htmlResult.push(blockTags(top).close);
  };

  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i];
    const trimmed = line.trim();

    if (trimmed.includes('［＃ここから目次］') || trimmed.includes('［＃目次］')) {
      inToc = true;
      continue;
    }
    if (trimmed.includes('［＃ここで目次終わり］')) {
      inToc = false;
      continue;
    }
    if (inToc) continue;

    if (
      trimmed.includes('［＃ページの左右中央］') ||
      trimmed.includes('［＃ここからページの左右中央］')
    ) {
      inPageCenter = true;
      htmlResult.push('<div class="page-center">');
      continue;
    }

    if (trimmed.includes('［＃ここでページの左右中央終わり］')) {
      if (inPageCenter) {
        htmlResult.push('</div>');
        inPageCenter = false;
      }
      continue;
    }

    if (trimmed === '［＃改ページ］' || trimmed === '［＃改丁］' || trimmed === '［＃改見開き］') {
      if (inPageCenter) {
        htmlResult.push('</div>');
        inPageCenter = false;
      }
      htmlResult.push('<div class="page-break"></div>');
      continue;
    }

    if (trimmed === '［＃改段］') {
      htmlResult.push('<span class="notes">［＃改段］</span>');
      continue;
    }

    // 単独行の画像注釈判定
    const standaloneImageMatch = trimmed.match(
      /^［＃(?:.+?図|挿絵|画像)（([^,、）]+)(?:[、,][^）]+)?）入る］$/
    );
    if (standaloneImageMatch) {
      const fileName = standaloneImageMatch[1].trim();
      htmlResult.push(
        `<div class="illust"><img src="../images/${escapeXml(fileName)}" alt="" /></div>`
      );
      continue;
    }

    const annotations = [...trimmed.matchAll(ANNOTATION_PATTERN)].map((m) => m[0].slice(2, -1));

    if (annotations.length === 1 && trimmed === `［＃${annotations[0]}］`) {
      const annotation = annotations[0];
      const state = parseBlockStart(annotation);

      if (state) {
        const { open } = blockTags(state);
        htmlResult.push(open);
        blockStack.push(state);
        continue;
      }

      if (isBlockEnd(annotation)) {
        closeBlock(blockEndType(annotation));
        continue;
      }

      console.warn('[Aozora] unsupported block annotation:', trimmed);
      htmlResult.push(`<span class="notes">${escapeHtml(trimmed)}</span>`);
      continue;
    }

    const headingForward = line.match(/［＃「(.+?)」は(同行|窓)?(大|中|小)見出し］/) ?? null;

    if (headingForward) {
      const [, target, formType, levelText] = headingForward;
      const info = headingInfo(`${levelText}見出し`);

      if (info && line.trim().endsWith(headingForward[0])) {
        const targetStart = line.lastIndexOf(target);
        if (targetStart >= 0) {
          const prefix = line.slice(0, targetStart);
          const indentMatch = zenToHanDigits(prefix).match(/［＃(\d+)字下げ］/);
          const indent = indentMatch ? Number(indentMatch[1]) : 0;

          const headingClass =
            formType === '同行'
              ? `dogyo-${info.className}`
              : formType === '窓'
                ? `mado-${info.className}`
                : info.className;

          const renderedHeading = `<${info.tag} class="${headingClass}">${renderInline(
            target
          )}</${info.tag}>`;

          if (indent > 0) {
            htmlResult.push(`<div class="jisage-${indent}">${renderedHeading}</div>`);
          } else {
            htmlResult.push(renderedHeading);
          }
          continue;
        }
      }
    }

    const headingOpenClose = trimmed.match(
      /^［＃((?:同行|窓)?(大|中|小)見出し)］(.+)［＃\1終わり］$/
    );
    if (headingOpenClose) {
      const [, fullLevel, levelChar, content] = headingOpenClose;
      const info = headingInfo(`${levelChar}見出し`);
      if (info) {
        const className = fullLevel.startsWith('同行')
          ? `dogyo-${info.className}`
          : fullLevel.startsWith('窓')
            ? `mado-${info.className}`
            : info.className;
        htmlResult.push(`<${info.tag} class="${className}">${renderInline(content)}</${info.tag}>`);
        continue;
      }
    }

    const alignmentResult = tryRenderTrailingAlignment(line);
    if (alignmentResult) {
      htmlResult.push(...alignmentResult);
      continue;
    }

    const rendered = renderNormalLine(line);

    htmlResult.push(rendered);
  }

  while (blockStack.length > 0) {
    const state = blockStack.pop()!;
    console.warn('[Aozora] unclosed block at EOF:', state);
    htmlResult.push(blockTags(state).close);
  }

  if (inPageCenter) {
    htmlResult.push('</div>');
  }

  htmlResult.push('</div></div>');
  return htmlResult.join('');
}

// --------------------------------------------------
// EPUB3 ZIP 構築
// --------------------------------------------------
function buildEpubBuffer(
  title: string,
  author: string,
  bodyHtml: string,
  images: ExtractedImage[]
): Uint8Array {
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
ruby rp {
  display: none;
}

.o-midashi {
  font-size: 1.4em;
  font-weight: bold;
  margin: 1em 0;
}
.naka-midashi {
  font-size: 1.2em;
  font-weight: bold;
  margin: 1em 0;
}
.ko-midashi {
  font-size: 1.05em;
  font-weight: bold;
  margin: 1em 0;
}

.dogyo-o-midashi,
.dogyo-naka-midashi,
.dogyo-ko-midashi {
  display: inline;
  font-weight: bold;
  margin: 0;
}

.mado-o-midashi,
.mado-naka-midashi,
.mado-ko-midashi {
  display: inline;
  font-weight: bold;
  margin: 0;
}

.jisage-1 { margin-inline-start: 1em; }
.jisage-2 { margin-inline-start: 2em; }
.jisage-3 { margin-inline-start: 3em; }
.jisage-4 { margin-inline-start: 4em; }
.jisage-5 { margin-inline-start: 5em; }
.jisage-6 { margin-inline-start: 6em; }
.jisage-7 { margin-inline-start: 7em; }
.jisage-8 { margin-inline-start: 8em; }
.jisage-9 { margin-inline-start: 9em; }
.jisage-10 { margin-inline-start: 10em; }
.jisage-11 { margin-inline-start: 11em; }
.jisage-12 { margin-inline-start: 12em; }
.jisage-13 { margin-inline-start: 13em; }
.jisage-14 { margin-inline-start: 14em; }
.jisage-15 { margin-inline-start: 15em; }
.jisage-16 { margin-inline-start: 16em; }
.jisage-17 { margin-inline-start: 17em; }
.jisage-18 { margin-inline-start: 18em; }
.jisage-19 { margin-inline-start: 19em; }
.jisage-20 { margin-inline-start: 20em; }

.sesame_dot,
.white_sesame_dot,
.black_circle,
.white_circle,
.black_up-pointing_triangle,
.white_up-pointing_triangle,
.bullseye,
.fisheye,
.saltire,
.sesame_dot_after,
.white_sesame_dot_after,
.black_circle_after,
.white_circle_after,
.black_up-pointing_triangle_after,
.white_up-pointing_triangle_after,
.bullseye_after,
.fisheye_after,
.saltire_after {
  text-emphasis-style: sesame;
  -webkit-text-emphasis-style: sesame;
}

.sesame_dot { text-emphasis-style: dot; -webkit-text-emphasis-style: dot; }
.white_sesame_dot { text-emphasis-style: open-dot; -webkit-text-emphasis-style: open-dot; }
.black_circle { text-emphasis-style: filled circle; -webkit-text-emphasis-style: filled circle; }
.white_circle { text-emphasis-style: open circle; -webkit-text-emphasis-style: open circle; }
.black_up-pointing_triangle { text-emphasis-style: filled triangle; -webkit-text-emphasis-style: filled triangle; }
.white_up-pointing_triangle { text-emphasis-style: open triangle; -webkit-text-emphasis-style: open triangle; }
.bullseye { text-emphasis-style: double-circle; -webkit-text-emphasis-style: double-circle; }
.fisheye { text-emphasis-style: "◉"; -webkit-text-emphasis-style: "◉"; }
.saltire { text-emphasis-style: "×"; -webkit-text-emphasis-style: "×"; }

.sesame_dot_after,
.white_sesame_dot_after,
.black_circle_after,
.white_circle_after,
.black_up-pointing_triangle_after,
.white_up-pointing_triangle_after,
.bullseye_after,
.fisheye_after,
.saltire_after {
  text-emphasis-position: under left;
  -webkit-text-emphasis-position: under left;
}
.sesame_dot_after { text-emphasis-style: dot; -webkit-text-emphasis-style: dot; }
.white_sesame_dot_after { text-emphasis-style: open-dot; -webkit-text-emphasis-style: open-dot; }
.black_circle_after { text-emphasis-style: filled circle; -webkit-text-emphasis-style: filled circle; }
.white_circle_after { text-emphasis-style: open circle; -webkit-text-emphasis-style: open circle; }
.black_up-pointing_triangle_after { text-emphasis-style: filled triangle; -webkit-text-emphasis-style: filled triangle; }
.white_up-pointing_triangle_after { text-emphasis-style: open triangle; -webkit-text-emphasis-style: open triangle; }
.bullseye_after { text-emphasis-style: double-circle; -webkit-text-emphasis-style: double-circle; }
.fisheye_after { text-emphasis-style: "◉"; -webkit-text-emphasis-style: "◉"; }
.saltire_after { text-emphasis-style: "×"; -webkit-text-emphasis-style: "×"; }

.underline_solid { text-decoration-line: underline; text-decoration-style: solid; }
.underline_double { text-decoration-line: underline; text-decoration-style: double; }
.underline_dotted { text-decoration-line: underline; text-decoration-style: dotted; }
.underline_dashed { text-decoration-line: underline; text-decoration-style: dashed; }
.underline_wave { text-decoration-line: underline; text-decoration-style: wavy; }

.overline_solid { text-decoration-line: overline; text-decoration-style: solid; }
.overline_double { text-decoration-line: overline; text-decoration-style: double; }
.overline_dotted { text-decoration-line: overline; text-decoration-style: dotted; }
.overline_dashed { text-decoration-line: overline; text-decoration-style: dashed; }
.overline_wave { text-decoration-line: overline; text-decoration-style: wavy; }

.futoji { font-weight: bold; }
.shatai { font-style: italic; }
.tcy {
  text-combine-upright: all;
  -webkit-text-combine: horizontal;
  -epub-text-combine: horizontal;
}
.warichu { font-size: 0.65em; }
.superscript { vertical-align: super; font-size: 0.6em; }
.subscript { vertical-align: sub; font-size: 0.6em; }

.keigakomi {
  border: solid 1px;
  padding: 0.5em;
}
.yokogumi {
  writing-mode: horizontal-tb;
  -webkit-writing-mode: horizontal-tb;
  -epub-writing-mode: horizontal-tb;
}

.illust {
  text-align: center;
  margin: 1em 0;
}
.illust img {
  max-width: 100%;
  height: auto;
}

.caption {
  display: block;
  font-size: 0.85em;
  text-align: center;
  margin: 0.5em 0;
}

.page-center { text-align: center; }
.page-break {
  page-break-before: always;
  break-before: page;
}
.notes {
  font-size: 0.75em;
  color: #666;
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

  const imageManifestItems = images
    .map(
      (img, idx) =>
        `<item id="img-${idx}" href="images/${escapeXml(img.name)}" media-type="${img.mediaType}"/>`
    )
    .join('\n    ');

  const zipFiles: Zippable = {
    mimetype: [mimetype, { level: 0 }],
    'META-INF/container.xml': strToU8(containerXml),
    'item/style/style.css': strToU8(css),
    'item/xhtml/p-001.xhtml': strToU8(xhtmlContent),
  };

  for (const img of images) {
    zipFiles[`item/images/${img.name}`] = img.data;
  }

  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="ja">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">${bookId}</dc:identifier>
    <dc:title>${safeTitle}</dc:title>
    <dc:creator id="aut">${safeAuthor}</dc:creator>
    <meta refines="#aut" property="role" scheme="marc:relators">aut</meta>
    <meta refines="#aut" property="file-as">${safeAuthor}</meta>
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
    const { text: rawTxt, images } = extractDataFromZip(zipBuffer);
    const bodyHtml = parseAozoraTxtToHtml(rawTxt);

    const epubArray = buildEpubBuffer(title || '無題', author || '作者不明', bodyHtml, images);

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
