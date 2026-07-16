import { useState, useEffect } from 'react';
import type { DiagnosticPayload } from '../components/DiagnosticDashboard';

export interface SessionRecord {
  id: string;
  date: string;
  hand: 'LEFT' | 'RIGHT';
  diagnostic: DiagnosticPayload;
}

export function useSessionHistory() {
  const [history, setHistory] = useState<SessionRecord[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('kelso_history');
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Storage locked.");
    }
  }, []);

  const saveSession = (hand: 'LEFT' | 'RIGHT', diagnostic: DiagnosticPayload) => {
    const newRecord: SessionRecord = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      hand,
      diagnostic
    };
    const updatedHistory = [newRecord, ...history].slice(0, 50);
    setHistory(updatedHistory);
    localStorage.setItem('kelso_history', JSON.stringify(updatedHistory));
  };

  // ARCHITECTURAL UPDATE: Safe Deletion
  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('kelso_history');
  };

  return { history, saveSession, clearHistory };
}