import { useState, useEffect } from 'react';
import type { DiagnosticPayload } from './useDiagnosticAgent';

/** A persisted record of a completed diagnostic session. */
export interface SessionRecord {
  /** `crypto.randomUUID()` identifier. */
  id: string;
  /** ISO 8601 timestamp of when the session was saved. */
  date: string;
  /** Hand that was trained in this session. */
  hand: 'LEFT' | 'RIGHT';
  /** Full LLM diagnostic payload for this session. */
  diagnostic: DiagnosticPayload;
}

/**
 * Persists and retrieves session records from `localStorage` under the key
 * `kelso_history`. The ledger is capped at 50 entries (newest first).
 *
 * `localStorage` access is wrapped in a try/catch to handle private-browsing
 * environments where storage may be locked or quota-exceeded.
 */
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

  /**
   * Prepends a new record to the ledger and syncs to `localStorage`.
   * @param hand       - Hand context for the completed session.
   * @param diagnostic - Parsed `DiagnosticPayload` from the analysis step.
   */
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

  /** Removes all records from state and `localStorage`. */
  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('kelso_history');
  };

  return { history, saveSession, clearHistory };
}
