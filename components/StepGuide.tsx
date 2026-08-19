import React from 'react';

export default function StepGuide() {
  const steps = [
    { num: '①', name: '検索' },
    { num: '②', name: '保存' },
    { num: '③', name: 'Kindleで「開く」' },
    { num: '④', name: 'Kindleで「送信」' },
  ];

  return (
    <div className="w-full bg-stone-100 border border-stone-300 rounded-xl p-3 my-2 select-none pointer-events-none">
      <div className="text-xs sm:text-sm font-bold text-stone-800 mb-2.5 text-center sm:text-left">
        💡 かんたん操作手順
      </div>

      <div className="flex items-center justify-between text-center px-0.5">
        {steps.map((step, idx) => (
          <React.Fragment key={idx}>
            <div className="flex flex-col items-center min-w-0">
              {/* 番号（くっきり大きい青文字） */}
              <span className="text-base sm:text-lg font-black text-stone-900 leading-none mb-1">
                {step.num}
              </span>
              {/* 操作名（枠なしの純粋なテキスト） */}
              <span className="text-xs sm:text-sm font-bold text-stone-900 leading-tight">
                {step.name}
              </span>
            </div>

            {/* 進行を表す矢印（ボタン感を出さずに順序を伝える） */}
            {idx < steps.length - 1 && (
              <span className="text-stone-400 text-xs sm:text-sm font-bold shrink-0 mx-0.5">➔</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}