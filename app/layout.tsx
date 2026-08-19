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
    default: '青空保存 to Kindle | 青空文庫を保存してKindleで読む',
    template: '%s | 青空保存 to Kindle',
  },
  description:
    '[完全無料・広告なし] 青空文庫の本を保存して、すぐにKindleで読めます。面倒な会員登録・ログイン不要で、縦書き・右開き対応のEPUB形式へ一括変換。Send to Kindleにも最適です。',
  keywords: [
    '青空保存 to Kindle',
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
  authors: [{ name: '青空保存 to Kindle' }],
  creator: '青空保存 to Kindle',
  publisher: '青空保存 to Kindle',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: '青空保存 to Kindle | 青空文庫を保存してKindleで読む',
    description:
      '[完全無料・登録不要・広告なし] 青空文庫の本を保存して、すぐにKindleで読めます。縦書き・右開きのEPUB形式に対応。',
    url: metadataBaseUrl.toString(),
    siteName: '青空保存 to Kindle',
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '青空保存 to Kindle | 青空文庫を保存してKindleで読む',
    description: '[完全無料・登録不要・広告なし] 青空文庫の本を保存して、すぐにKindleで読めます。',
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
