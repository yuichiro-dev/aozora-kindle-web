import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Analytics } from '@vercel/analytics/react';

const inter = Inter({ subsets: ['latin'] });

const getMetadataBase = (): URL => {
  const rawUrl =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'http://localhost:3000';

  const formattedUrl =
    rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `https://${rawUrl}`;

  try {
    return new URL(formattedUrl);
  } catch {
    // パースに失敗した場合は安全なデフォルト値を返す
    return new URL('http://localhost:3000');
  }
};

const metadataBaseUrl = getMetadataBase();

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl,
  title: {
    default: '青空文庫 Kindle 変換ツール | 縦書き・右開きに無料一括変換',
    template: '%s | 青空文庫 Kindle 変換ツール',
  },
  description:
    '[完全無料・広告なし]青空文庫の作品をKindleで読みやすい縦書き・右開きのEPUB形式へ瞬時に変換。面倒な登録不要でSend to Kindleにも最適です。',
  keywords: [
    '青空文庫',
    '青空Kindle',
    '青空キンドル',
    '青空文庫 EPUB',
    '青空文庫 Kindle 変換',
    '青空文庫 縦書き EPUB',
    '青空文庫 スマホ 読む',
    '青空文庫 変換 無料',
    'Send to Kindle',
    '縦書き 右開き EPUB',
    '青空文庫 電子書籍 変換',
    '青空文庫 ルビ対応',
    'Kindle 縦書き 変換',
  ],
  authors: [{ name: '青空文庫 Kindle 変換ツール' }],
  creator: '青空文庫 Kindle 変換ツール',
  publisher: '青空文庫 Kindle 変換ツール',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: '青空文庫 Kindle 変換ツール | 無料で瞬時に縦書きEPUB変換',
    description:
      '[完全無料・広告なし]青空文庫の作品を縦書き・右開き用のEPUB形式に瞬時に変換してダウンロード。Kindleで快適な縦書き読書を。',
    url: metadataBaseUrl.toString(),
    siteName: '青空文庫 Kindle 変換ツール',
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '青空文庫 to Kindle (EPUB)',
    description:
      '[完全無料・広告なし]青空文庫の作品を縦書き・右開き用のEPUB形式に瞬時に変換してダウンロード。',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
