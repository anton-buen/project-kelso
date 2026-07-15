import { useState, useEffect } from 'react';

export interface HistoryEntry {
  id: string;
  date: string;
  hand: string;
  diagnostic: string;
}

export function useSessionHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('kelso_history');
      if (stored) setHistory(JSON.parse(stored));
    } catch (e) {
      setStorageError(true);
    }
  }, []);

  const saveSession = (hand: string, diagnostic: string) => {
    try {
      const newEntry = {
        id: Date.now().toString(),
        date: new Date().toLocaleString(),
        hand,
        diagnostic
      };
      const updated = [newEntry, ...history];
      setHistory(updated);
      localStorage.setItem('kelso_history', JSON.stringify(updated));
    } catch (e) {
      setStorageError(true);
    }
  };

  return { history, saveSession, storageError };
}