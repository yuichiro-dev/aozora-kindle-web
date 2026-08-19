import React from 'react';

export default function StepGuide() {
  const steps = [
    { num: '1', title: '検索', desc: '作品・著者を検索' },
    { num: '2', title: 'ダウンロード', desc: '「開く」を選択' },
    { num: '3', title: 'ファイル共有', desc: 'Kindleアプリを指定' },
    { num: '4', title: 'Kindleで開く', desc: '送信ボタンを押す' },
  ];

  return (
    <div className="w-full bg-stone-100/60 border border-stone-200/60 rounded-xl p-3 my-2 select-none pointer-events-none">
      <div className="text-[11px] font-medium text-stone-500 mb-2 text-center sm:text-left">
        💡 Kindleへの取り込み手順
      </div>

      <div className="flex items-center justify-between text-stone-600 px-1">
        {steps.map((step, idx) => (
          <React.Fragment key={idx}>
            <div className="flex flex-col items-center text-center">
              <span className="text-[9px] font-semibold text-stone-400 uppercase tracking-wider">
                STEP {step.num}
              </span>
              <span className="text-xs font-bold text-stone-700 leading-tight mt-0.5">
                {step.title}
              </span>
              <span className="text-[10px] text-stone-400 mt-0.5 hidden sm:inline">
                {step.desc}
              </span>
            </div>

            {/* ステップ間の矢印 */}
            {idx < steps.length - 1 && <span className="text-stone-300 text-xs font-bold">→</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
