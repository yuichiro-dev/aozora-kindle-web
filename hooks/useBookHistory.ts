'use client';

import { useCallback, useEffect, useState } from 'react';

import { getHistoryMap, saveToHistory } from '@/lib/bookHistory';

type UseBookHistoryResult = {
  savedHistoryMap: Record<string, number>;
  saveHistory: (id: string | number, title: string, author: string) => void;
};

export function useBookHistory(): UseBookHistoryResult {
  const [savedHistoryMap, setSavedHistoryMap] = useState<Record<string, number>>(getHistoryMap);

  const syncHistory = useCallback(() => {
    setSavedHistoryMap(getHistoryMap());
  }, []);

  useEffect(() => {
    window.addEventListener('history-updated', syncHistory);

    window.addEventListener('storage', syncHistory);

    return () => {
      window.removeEventListener('history-updated', syncHistory);

      window.removeEventListener('storage', syncHistory);
    };
  }, [syncHistory]);

  const saveHistory = useCallback((id: string | number, title: string, author: string) => {
    saveToHistory(id, title, author);
  }, []);

  return {
    savedHistoryMap,
    saveHistory,
  };
}
