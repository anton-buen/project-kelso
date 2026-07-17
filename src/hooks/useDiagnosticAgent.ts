import { useState } from 'react';
import type { SessionAggregates } from './useSessionTelemetry';

export interface DiagnosticPayload {
  exercise: string;
  summary: string;
  ce_trend: {
    bias_category: 'Strongly Dragging' | 'Moderately Dragging' | 'Neutral' | 'Moderately Rushing' | 'Strongly Rushing';
    direction: string;
    magnitude: string;
    temporal_drift: string;
  };
  kelso_metrics: {
    instability_rating: 'Stable' | 'Critical Fluctuation' | 'Degrading';
    fatigue_assessment: string;
    tension_correlation: string;
  };
}

export function useDiagnosticAgent() {
  const [diagnostic, setDiagnostic] = useState<DiagnosticPayload | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeSession = async (
    aggregates: SessionAggregates,
    targetHand: 'LEFT' | 'RIGHT'
  ): Promise<DiagnosticPayload | null> => {
    setIsAnalyzing(true);

    const systemPrompt = `
      You are a clinical biomechanics AI specialized in neuro-motor rhythm analysis based on the Kelso HKB coordination dynamics model.
      Analyze the following session aggregates for a user's ${targetHand} hand and return a strict JSON object.
      
      SESSION METRICS:
      - Total Strikes: ${aggregates.totalStrikes}
      - Constant Error (Mean Offset): ${aggregates.meanOffsetMs.toFixed(2)}ms
      - Motor Instability (StdDev): ${aggregates.stdDevMs.toFixed(2)}ms
      - Tempo-Normalized CV: ${aggregates.tempoNormalizedCV.toFixed(2)}%
      - Precision Zone (±20ms): ${aggregates.precisionZonePercentage.toFixed(2)}%
      - Fatigue Index (Drift Slope): ${aggregates.driftSlope.toFixed(4)}
      - Average Tension Load: ${aggregates.averageTension.toFixed(2)}
      - Tension Variance: ${aggregates.tensionVariance.toFixed(2)}

      RULES FOR CLASSIFICATION:
      1. bias_category: Base this strictly on the Mean Offset. > +30ms is Dragging. < -30ms is Rushing. Apply 'Strongly' if magnitude exceeds 70ms. 'Neutral' if within ±15ms.
      2. instability_rating: If CV > 15% AND Tension Variance is high, classify as 'Critical Fluctuation'. If slope is consistently drifting, 'Degrading'. Otherwise 'Stable'.
      
      OUTPUT FORMAT:
      You must respond ONLY with a raw, stringified JSON object matching this exact schema:
      {
        "exercise": "Short title of the detected pattern",
        "summary": "A detailed clinical paragraph analyzing the user's motor control, utilizing the provided precision and CV percentages.",
        "ce_trend": {
          "bias_category": "Strongly Dragging" | "Moderately Dragging" | "Neutral" | "Moderately Rushing" | "Strongly Rushing",
          "direction": "Brief description of the bias trajectory",
          "magnitude": "Brief text quantifying the offset and spread",
          "temporal_drift": "Brief analysis of the drift slope indicating fatigue or stability"
        },
        "kelso_metrics": {
          "instability_rating": "Stable" | "Critical Fluctuation" | "Degrading",
          "fatigue_assessment": "1 sentence evaluating physical breakdown based on drift slope",
          "tension_correlation": "1 sentence evaluating if tension spikes correlated with timing variance"
        }
      }
    `;

    try {
      // NOTE: Replace this fetch block with your specific LLM endpoint (OpenAI, Gemini, etc.)
      const response = await fetch('/api/llm/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: systemPrompt })
      });

      if (!response.ok) throw new Error(`LLM API returned status ${response.status}`);

      const rawText = await response.text();
      
      // Strip markdown code blocks if the LLM hallucinates them around the JSON
      const cleanedJson = rawText.replace(/```json\n?|\n?```/g, '').trim();
      const payload = JSON.parse(cleanedJson) as DiagnosticPayload;

      setDiagnostic(payload);
      return payload;

    } catch (error) {
      console.error("[System] Diagnostic Agent failed to parse biomechanical payload:", error);
      // We do not crash the app. We return null, allowing the UI to show a failure state or standard fallback.
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  return { diagnostic, isAnalyzing, analyzeSession };
}