# 📚 青空保存 to Kindle

> 青空文庫の作品を、Kindleや各種電子書籍リーダーで読みやすい「縦書き・右開き用EPUB形式」に瞬時に変換・ダウンロードできるWebアプリケーションです。

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Live_Demo-000000?style=for-the-badge&logo=vercel)](https://aozora-kindle-web.vercel.app/)

🔗 **Webサイト（ライブデプロイ）**: [https://aozora-kindle-web.vercel.app/](https://aozora-kindle-web.vercel.app/)

---

## ✨ 主な機能

- 📖 **縦書き・右開きEPUB自動生成**  
  青空文庫のルビ（ふりがな）や注記に対応し、Kindle等の電子書籍端末に最適化したファイル形式で変換・保存します。
- ⚡ **高速リアルタイムインクリメンタル検索**  
  作品名・作家名・ひらがな読みでの瞬時フィルタリングに対応。
- 💡 **スマート・レコメンド機能**
  - **ジャンル・系統検索**: 検索した作家に関連するおすすめ作家を自動提示
  - **同世代作家**: データベースにない作家でも生誕年（±10年）から同時代の文豪をピックアップ
  - **デイリーコンテンツ**: 本日の生誕作家・命日作家を自動表示
- 🔄 **作品リストの自動同期**  
  1日1回、青空文庫の最新作品データベースと自動同期されます。
- 📱 **完全レスポンシブ & スマホ最適化**  
  モバイル操作時のキーボード立ち上がり時でも検索結果が見やすい可変レイアウト設計。

---

## 🛠 技術スタック

- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: `useSyncExternalStore` (localStorage同期), `useMemo`
- **Data Processing**: `JSZip`, custom EPUB builder logic
- **Deployment**: Vercel

---

## 🚀 開発（ローカル環境での実行）

### 1. リポジトリのクローン

```bash
git clone [https://github.com/your-username/your-repo-name.git](https://github.com/your-username/your-repo-name.git)
cd your-repo-name
```

### 2. 依存パッケージのインストール

```bash
npm install
```

### 3. 環境変数の設定

ルート直下に `.env.local` を作成します。

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) にアクセスします。

---

## 📦 ビルド & 型チェック

```bash
npm run build
```

---

## 📄 ライセンス

[MIT License](LICENSE)
