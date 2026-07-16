import { useState } from 'react';
import type { HitData } from './useSessionTelemetry';
import type { DiagnosticPayload } from '../components/DiagnosticDashboard';

export function useDiagnosticAgent() {
  // Source of Truth: Strictly typed to our new JSON Schema
  const [diagnostic, setDiagnostic] = useState<DiagnosticPayload | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false); // FIXED: Added missing state declaration

  const analyzeSession = async (sessionData: HitData[], targetHand: 'LEFT' | 'RIGHT') => {
    
    const systemPrompt = `
      You are an expert biomechanics and drum coordination AI. 
      Analyze the provided telemetry data. 
      YOU MUST RESPOND ONLY WITH VALID, PARSABLE JSON. NO MARKDOWN. NO CONVERSATION.
      
      Schema:
      {
        "exercise": "Name of the inferred exercise (e.g., Weak-Hand Leveler)",
        "summary": "A concise 2-sentence biomechanical breakdown.",
        "ce_trend": {
          "direction": "String detailing rushing vs dragging bias.",
          "magnitude": "String detailing mean error and range in ms.",
          "temporal_drift": "String detailing when fatigue or tension occurred."
        }
      }
    `;

    // 1. NO DATA FALLBACK (Must return JSON object, not string)
    if (sessionData.length === 0) {
      const emptyPayload: DiagnosticPayload = {
        exercise: "Unknown",
        summary: "SYSTEM FAULT: No telemetry data collected. Session aborted.",
        ce_trend: { direction: "N/A", magnitude: "0ms", temporal_drift: "N/A" }
      };
      setDiagnostic(emptyPayload);
      return emptyPayload;
    }

    setIsAnalyzing(true);
    
    try {
      // 2. API HANDOFF (Passing the system prompt so the backend knows the schema)
      const response = await fetch('/api/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionData, targetHand, systemPrompt }), 
      });
      
      if (!response.ok) throw new Error('Agentic endpoint failed.');
      
      const data = await response.json();
      
      // 3. SAFE PARSE: Extract the JSON from the backend's string response
      // (This handles if the LLM accidentally wraps it in ```json blocks)
      const cleanedText = data.diagnostic.replace(/```json/gi, '').replace(/```/g, '').trim();
      const payload: DiagnosticPayload = JSON.parse(cleanedText);
      
      setDiagnostic(payload);
      return payload;
      
    } catch (error) {
      console.error("LLM Handoff / Parse Error:", error);
      
      // 4. ARCHITECTURAL MANDATE: Fallback Local Summary (Must return JSON object)
      const avgDelta = sessionData.reduce((acc, hit) => acc + hit.deltaMs, 0) / sessionData.length;
      
      const fallbackPayload: DiagnosticPayload = {
        exercise: `${targetHand} Hand Baseline`,
        summary: `AI AGENT OFFLINE. Executing local mathematical summary. ${sessionData.length} strikes recorded successfully.`,
        ce_trend: {
          direction: avgDelta > 0 ? "Dragging Bias" : "Rushing Bias",
          magnitude: `Mean drift: ${avgDelta > 0 ? '+' : ''}${avgDelta.toFixed(1)}ms`,
          temporal_drift: "Unavailable (Offline)"
        }
      };
      
      setDiagnostic(fallbackPayload);
      return fallbackPayload;
      
    } finally {
      setIsAnalyzing(false);
    }
  };

  return { isAnalyzing, diagnostic, analyzeSession };
}