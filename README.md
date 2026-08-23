# 青空保存 to Kindle

青空文庫の作品を縦書き・右開きのEPUBに一発変換し、Kindleへ保存・共有できるミニマルなWebアプリ（PWA）です。

ライブデモ：[https://aozora-kindle-web.vercel.app/](https://aozora-kindle-web.vercel.app/)

## 注意事項・仕様

- **対象ファイル**: 青空文庫（aozora.gr.jp）に公式にホストされている作品テキストのみ対応しています。外部サイトのテキストには対応していません。(青空文庫全体の0.5%未満)
- **著者名表示（Kindleアプリ）**: Kindleアプリの「Kindleに送信」経由で開くと、ライブラリ上の著者名が送信先Amazonアカウントの名前で表示されます(Kindleアプリの仕様)

## 主な機能

- **高精度なEPUB変換**: 縦書き・右開きフォーマットに対応。
- **モバイル最適化UI**: PWA / スマホ操作に最適化した固定ボトムナビゲーション。
- **ローカル履歴管理**: LocalStorage を利用した変換履歴の保存・個別消去。
- **高速なインデックス検索**: 著者名・作品名・ひらがな・カタカナ・英語表記によるリアルタイム絞り込み。

## 技術スタック

- **Framework**: Next.js (App Router) / React
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Deployment**: Vercel

## 主要なディレクトリ構成

```text
├── app/
│   ├── layout.tsx         # ルートレイアウト（BottomNavの配置）
│   ├── page.tsx           # メイン検索・変換画面
│   ├── history/
│   │   └── page.tsx       # 変換履歴画面
│   ├── guide/
│   │   └── page.tsx       # 使い方ガイド画面
│   └── api/
│       └── convert/       # EPUB変換API
├── components/
│   └── BottomNav.tsx      # スマホ用ボトムナビゲーション
└── public/
    ├── books.json         # 青空文庫作品インデックス
    └── images/            # ガイド用画像アセット
```

## ローカル開発手順

1. 依存パッケージのインストール

   ```bash
   npm install
   ```

2. 開発サーバーの起動

   ```bash
   npm run dev
   ```

   ブラウザで `http://localhost:3000` を開いて確認します。

3. プロダクションビルドの確認
   ```bash
   npm run build
   npm run start
   ```

## ライセンス

MIT
