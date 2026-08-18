# 青空文庫 Kindle 変換ツール

青空文庫のZIP（TXT）ファイルを、Kindleに最適な縦書き・右開き・右端余白確保済みのEPUB3へ自動変換するNext.js (App Router) アプリケーションです。

## 特徴

- 縦書き（`writing-mode: vertical-rl`）および右開き（`rtl`）の完全サポート
- Kindleの右端吸着を防ぐ物理余白の確保
- 巨大な長編作品もAmazonの処理エラーを防ぐための自動HTML分割（チャンク化）機能
- 目次ページの完全非表示化（1ページ目から直接本文が開きます）

## 動作要件

- Node.js 18+
- インストールされている主要パッケージ: `fflate`, `iconv-lite`
