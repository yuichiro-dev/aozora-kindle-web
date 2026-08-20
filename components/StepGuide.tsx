import React from 'react';

export default function StepGuide() {
  const steps = [
    { num: '❶', name: '検索し保存' },
    { num: '❷', name: 'Kindleで「開く」' },
    { num: '❸', name: 'Kindleで「送信」' },
  ];

  return (
    <div className="w-full bg-stone-100 border border-stone-300 rounded-xl p-3.5 sm:p-4 my-2 select-none pointer-events-none">
      <div className="text-sm sm:text-base font-bold text-stone-900 mb-3 text-center sm:text-left">
        💡 かんたん操作手順
      </div>

      <div className="flex items-center justify-between">
        {steps.map((step, idx) => (
          <React.Fragment key={idx}>
            {/* 各ステップを均等幅(flex-1)にし、完全に中央揃え */}
            <div className="flex-1 flex flex-col items-center justify-center text-center px-0.5">
              {/* 番号（くっきり大きい黒文字） */}
              <span className="text-lg sm:text-xl font-black text-stone-900 leading-none mb-1">
                {step.num}
              </span>
              {/* 操作名 */}
              <span className="text-xs sm:text-sm font-bold text-stone-900 leading-tight">
                {step.name}
              </span>
            </div>

            {/* 進行を表す矢印 */}
            {idx < steps.length - 1 && (
              <span className="text-stone-400 text-sm sm:text-base font-bold shrink-0">➔</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
