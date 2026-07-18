import { useState } from 'react';
import type { SessionAggregates } from './useSessionTelemetry';

/**
 * Structured response contract returned by the `/api/diagnostic` endpoint.
 * All fields are populated by the LLM; `AWAITING DATA` values are used as
 * typed sentinels for the fallback UI state in `DiagnosticDashboard`.
 */
export interface DiagnosticPayload {
  exercise: string;
  summary: string;
  ce_trend: {
    bias_category: 'Strongly Dragging' | 'Moderately Dragging' | 'Neutral' | 'Moderately Rushing' | 'Strongly Rushing' | 'AWAITING DATA';
    direction: string;
    magnitude: string;
    temporal_drift: string;
  };
  kelso_metrics: {
    instability_rating: 'Stable' | 'Critical Fluctuation' | 'Degrading' | 'AWAITING DATA';
    fatigue_assessment: string;
    tension_correlation: string;
  };
}

/**
 * Sends session aggregates to the `/api/diagnostic` serverless endpoint and
 * parses the LLM response into a `DiagnosticPayload`.
 *
 * **JSON extraction** — the raw response text is scanned with `/\{[\s\S]*\}/`
 * before `JSON.parse`. This guards against upstream models prepending
 * conversational text, BOM characters, or trailing sentences outside the
 * JSON block.
 *
 * On any failure the hook returns `null` and sets `diagnostic` to its previous
 * value, allowing the UI to display the deterministic `safeData` fallback
 * without crashing.
 */
export function useDiagnosticAgent() {
  const [diagnostic, setDiagnostic] = useState<DiagnosticPayload | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  /**
   * @param aggregates  - Computed session aggregates from `calculateSessionAggregates`.
   * @param targetHand  - Hand context forwarded to the backend prompt template.
   * @param bpm         - Session tempo.
   * @param pattern     - Active subdivision pattern.
   * @returns           Parsed `DiagnosticPayload` on success, `null` on failure.
   */
  const analyzeSession = async (
    aggregates: SessionAggregates,
    targetHand: 'LEFT' | 'RIGHT',
    bpm: number,
    pattern: string
  ): Promise<DiagnosticPayload | null> => {
    setIsAnalyzing(true);

    try {
      const response = await fetch('/api/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aggregates, targetHand, bpm, pattern })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Status ${response.status} - ${errorText}`);
      }

      const rawText = await response.text();

      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("[AI PARSING FAILURE] Raw response missing valid JSON object block:", rawText);
        throw new Error("No valid bracketed JSON schema found in LLM stream.");
      }

      const payload = JSON.parse(jsonMatch[0]) as DiagnosticPayload;

      setDiagnostic(payload);
      return payload;

    } catch (err: any) {
      console.error(`[AI DIAGNOSTIC FAILURE] Agent rejected the payload.`);
      console.error(`Reason:`, err.message || err);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  return { diagnostic, isAnalyzing, analyzeSession };
}
