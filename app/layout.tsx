import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Analytics } from '@vercel/analytics/react';
import BottomNav from '@/components/BottomNav';

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

export const viewport: Viewport = {
  themeColor: '#1c1917',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl,
  title: {
    default: '青空保存 to Kindle | 青空文庫を保存してKindleで読む',
    template: '%s | 青空保存 to Kindle',
  },
  description: '青空文庫の作品を縦書きEPUBでKindleに保存するツール。',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '青空保存',
  },
  keywords: [
    '青空保存 to Kindle',
    '青空文庫',
    '青空Kindle',
    '青空キンドル',
    '青空文庫 EPUB',
    '青空文庫 Kindle 変換',
    '縦書き 右開き EPUB',
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
    description: '青空文庫の作品を縦書きEPUBでKindleに保存するツール。',
    url: metadataBaseUrl.toString(),
    siteName: '青空保存 to Kindle',
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '青空保存 to Kindle | 青空文庫を保存してKindleで読む',
    description: '青空文庫の作品を縦書きEPUBでKindleに保存するツール。',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={`${inter.className} bg-stone-50 text-stone-900 min-h-screen flex flex-col`}>
        {/* ボトムナビの高さ＋Safe Area分（80px程度）を下に確保 */}
        <main className="flex-1 pb-20 md:pb-0">{children}</main>

        {/* スマホ時のみ表示されるボトムナビ */}
        <BottomNav />
        <Analytics />
      </body>
    </html>
  );
}
