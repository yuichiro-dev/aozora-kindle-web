export default function GuidePage() {
  return (
    <div className="container mx-auto max-w-md px-4 py-8 space-y-6 text-sm">
      <h1 className="text-lg font-bold">使い方</h1>

      <section className="space-y-2">
        <h2 className="font-semibold text-stone-800">1. Kindleへ送る</h2>
        <p className="text-stone-600 leading-relaxed">
          作品を選んでEPUBファイルをダウンロード後、端末の共有メニューから「Kindle」アプリを選択して送信します。
        </p>
        <p className="text-stone-600 leading-relaxed mb-2">以下の公式の説明ページ。</p>
        <a
          href="https://www.amazon.co.jp/sendtokindle/android"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-blue-600 font-medium hover:underline"
        >
          Android用のSend to Kindle ↗
        </a>
      </section>
    </div>
  );
}
