export type BookHistoryItem = {
  id: string;
  title: string;
  author: string;
  timestamp: number;
};

const HISTORY_KEY = 'aozora_history';

export function saveToHistory(id: string | number, title: string, author: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const currentHistory: BookHistoryItem[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');

    const stringId = String(id);

    const updated: BookHistoryItem[] = [
      {
        id: stringId,
        title,
        author,
        timestamp: Date.now(),
      },
      ...currentHistory.filter((item) => item.id !== stringId),
    ].slice(0, 20);

    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));

    window.dispatchEvent(new Event('history-updated'));
  } catch (error) {
    console.error('履歴の保存に失敗しました:', error);
  }
}

export function getHistoryMap(): Record<string, number> {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = localStorage.getItem(HISTORY_KEY);

    if (!raw) {
      return {};
    }

    const parsed: BookHistoryItem[] = JSON.parse(raw);

    const map: Record<string, number> = {};

    parsed.forEach((item) => {
      map[String(item.id)] = item.timestamp;
    });

    return map;
  } catch (error) {
    console.error('履歴の読み込みに失敗しました:', error);

    return {};
  }
}

export function formatHistoryDate(timestamp: number): string {
  const date = new Date(timestamp);

  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}
