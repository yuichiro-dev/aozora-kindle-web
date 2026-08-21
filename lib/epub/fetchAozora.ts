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
