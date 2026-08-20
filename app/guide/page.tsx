import Image from 'next/image';
import Header from '@/components/Header';

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <Header />
      <div className="container mx-auto max-w-md px-4 py-8 space-y-6 text-sm">
        <h1 className="text-lg font-bold text-stone-900 font-serif">使い方</h1>

        <div className="space-y-4">
          {/* STEP 1 */}
          <section className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-3">
            <h2 className="font-bold text-stone-800 text-base">❶ 本を検索し保存する</h2>
            <p className="text-stone-800 leading-relaxed text-base">
              作品を検索します。途中までの入力で出てきた候補を選ぶか、スペースで区切って複数のキーワードを指定し、目的の作品の「保存」ボタンを押します。
            </p>
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
              <Image
                src="/images/p1.png"
                alt="検索"
                width={400}
                height={300}
                className="w-full h-auto object-cover"
                priority
              />
            </div>
          </section>

          {/* STEP 2 */}
          <section className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-3">
            <h2 className="font-bold text-stone-800 text-base">❷ 保存したファイルをKindleで開く</h2>
            <p className="text-stone-800 leading-relaxed text-base">
              ダウンロードが完了すると表示される「開く」ボタンを押して、Kindleアプリで開きます。
            </p>
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
              <Image
                src="/images/p2.png"
                alt="Kindleで開く"
                width={400}
                height={300}
                className="w-full h-auto object-cover"
                priority
              />
            </div>
          </section>

          {/* STEP 3 */}
          <section className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-3">
            <h2 className="font-bold text-stone-800 text-base">❸ Kindleに送信する</h2>
            <p className="text-stone-800 leading-relaxed text-base">
              開いたKindleアプリに表示される灰色の送信ボタンをそのまま押すと、Kindleに送信されます。
            </p>
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
              <Image
                src="/images/p3.png"
                alt="Kindleで送信"
                width={400}
                height={300}
                className="w-full h-auto object-cover"
                priority
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
