'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Trash2 } from 'lucide-react';
import Header from '@/components/Header';

export interface HistoryItem {
  id: string;
  title: string;
  author: string;
  timestamp: number;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setIsMounted(true);
      const saved = localStorage.getItem('aozora_history');
      if (saved) {
        try {
          setHistory(JSON.parse(saved));
        } catch (e) {
          console.error('履歴データの読み込みエラー:', e);
          setHistory([]);
        }
      }
    });
  }, []);

  const handleClearAll = () => {
    if (confirm('保存履歴を消去しますか？\n※保存したファイルは消えません。')) {
      localStorage.removeItem('aozora_history');
      setHistory([]);
      window.dispatchEvent(new Event('history-updated'));
    }
  };

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <Header />
      <div className="container mx-auto max-w-md px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-bold text-stone-900 font-serif">保存履歴</h1>
          {history.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 text-xs font-bold text-stone-500 hover:text-red-600 transition-colors py-1 px-2 rounded cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>履歴を削除</span>
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="text-center py-20 text-stone-400">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-bold text-stone-700">まだ保存した履歴はありません</p>
            <p className="text-xs text-stone-400 mt-1">作品を保存すると自動でここに記録されます</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={`${item.id}-${item.timestamp}`}
                className="p-4 bg-white border border-stone-300 rounded-xl shadow-sm flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-base text-stone-900 leading-snug break-words">
                    {item.title}
                  </h2>
                  <p className="text-xs font-bold text-stone-700 mt-1">{item.author}</p>
                  <p className="text-[10px] text-stone-400 mt-2">
                    {new Date(item.timestamp).toLocaleDateString('ja-JP', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
