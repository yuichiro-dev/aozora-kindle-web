import { MAX_ZIP_BYTES } from './constants';

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();

  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) {
    return true;
  }

  if (
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)
  ) {
    return true;
  }

  return false;
}

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();

  return host === 'aozora.gr.jp' || host.endsWith('.aozora.gr.jp');
}

function validateUrl(urlStr: string): URL {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(urlStr);
  } catch {
    throw new Error('無効なURL形式です。');
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error('HTTPS以外のプロトコルは許可されていません。');
  }

  if (isPrivateOrLocalHost(parsedUrl.hostname)) {
    throw new Error('許可されていないホストへのアクセスです。');
  }

  if (!isAllowedHost(parsedUrl.hostname)) {
    throw new Error('許可されていないドメインのURLです。');
  }

  return parsedUrl;
}

export async function fetchAozoraZip(urlStr: string, timeout = 15000): Promise<Buffer> {
  let currentUrl = validateUrl(urlStr).toString();

  const maxRedirects = 3;
  let redirectCount = 0;

  while (true) {
    const response = await fetch(currentUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: '*/*',
      },
      signal: AbortSignal.timeout(timeout),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');

      if (!location) {
        throw new Error('リダイレクト先が見つかりません。');
      }

      redirectCount += 1;

      if (redirectCount > maxRedirects) {
        throw new Error('リダイレクト回数が多すぎます。');
      }

      const nextUrl = new URL(location, currentUrl);

      validateUrl(nextUrl.toString());

      currentUrl = nextUrl.toString();

      continue;
    }

    if (!response.ok) {
      throw new Error(`ZIPダウンロード失敗: Status ${response.status}`);
    }

    const contentLength = response.headers.get('content-length');

    if (contentLength && Number(contentLength) > MAX_ZIP_BYTES) {
      throw new Error(`ZIPファイルが大きすぎます（上限: ${MAX_ZIP_BYTES / 1024 / 1024}MB）`);
    }

    const arrayBuffer = await response.arrayBuffer();

    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_ZIP_BYTES) {
      throw new Error(`ZIPファイルが大きすぎます（上限: ${MAX_ZIP_BYTES / 1024 / 1024}MB）`);
    }

    return buffer;
  }
}

export interface GaijiImage {
  jisCode: string;
  filename: string;
  data: Buffer;
  mediaType: string;
}

/**
 * 本文中に出現する外字のJISコード一覧を受け取り、
 * aozora.gr.jp から画像を並列取得する。
 * 重複コードは1回だけ取得し、取得に失敗したものは結果に含めない
 * （呼び出し側の resolveGaiji がテキスト近似にフォールバックする）。
 */
export async function fetchGaijiImages(jisCodes: string[]): Promise<GaijiImage[]> {
  const uniqueCodes = [...new Set(jisCodes)];

  const results = await Promise.all(
    uniqueCodes.map(async (jisCode): Promise<GaijiImage | null> => {
      const match = jisCode.match(/(\d+)-(\d+)-(\d+)/);
      if (!match) return null;

      const [, m, k, t] = match;
      const men = Number(m);
      const ku = String(Number(k)).padStart(2, '0');
      const ten = String(Number(t)).padStart(2, '0');

      // 青空文庫の2パターンのURL（面番号そのまま 1-88 / 水準コード加算 31-88）
      const altMen = men === 1 ? 31 : men === 2 ? 42 : men;

      const candidateUrls = [
        `https://www.aozora.gr.jp/gaiji/${men}-${ku}/${men}-${ku}-${ten}.png`,
        `https://www.aozora.gr.jp/gaiji/${altMen}-${ku}/${altMen}-${ku}-${ten}.png`,
      ];

      for (const url of candidateUrls) {
        try {
          const data = await fetchAozoraZip(url);
          // EPUB内のファイル名は混乱を防ぐため jisCode ベースで統一
          const filename = `gaiji-${jisCode.replace(/[^\d-]/g, '')}.png`;

          return { jisCode, filename, data, mediaType: 'image/png' };
        } catch {
          // 最初のURLで失敗したら次の候補URLを試す
          continue;
        }
      }

      console.warn('[Aozora] gaiji image fetch failed for all candidates:', jisCode);
      return null;
    })
  );

  return results.filter((r): r is GaijiImage => r !== null);
}

/**
 * fetchGaijiImages の結果から、resolveGaiji が使う
 * 「JISコード → ファイル名」の Map を組み立てる。
 */
export function buildGaijiImageMap(images: GaijiImage[]): Map<string, string> {
  return new Map(images.map((img) => [img.jisCode, img.filename]));
}
