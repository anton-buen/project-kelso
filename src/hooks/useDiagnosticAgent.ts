import { useState } from 'react';
import type { HitData } from './useSessionTelemetry';

export function useDiagnosticAgent() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);

  const analyzeSession = async (sessionData: HitData[], targetHand: string) => {
    if (sessionData.length === 0) {
      const errorStr = "[ SYSTEM FAULT: No telemetry data collected. ]";
      setDiagnostic(errorStr);
      return errorStr;
    }

    setIsAnalyzing(true);
    
    try {
      // Handing off to the Agentic Backend
      const response = await fetch('/api/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionData, targetHand }),
      });
      
      if (!response.ok) throw new Error('Agentic endpoint failed.');
      
      const data = await response.json();
      
      // Update UI AND return for the Data Vault
      setDiagnostic(data.diagnostic);
      return data.diagnostic;
      
    } catch (error) {
      console.error("LLM Handoff Error:", error);
      
      // ARCHITECTURAL MANDATE: Fallback Local Summary
      const avgDelta = sessionData.reduce((acc, hit) => acc + hit.deltaMs, 0) / sessionData.length;
      const peakTension = Math.max(...sessionData.map(hit => hit.tensionScore));
      
      const fallbackString = `[ AI AGENT OFFLINE ]\n\nExecuting Local Summary:\n- Target Hand: ${targetHand}\n- Hits Logged: ${sessionData.length}\n- Avg Timing Drift: ${avgDelta > 0 ? '+' : ''}${avgDelta.toFixed(1)}ms\n- Peak Tension Score: ${peakTension.toFixed(0)}/100`;
      
      // Update UI AND return for the Data Vault
      setDiagnostic(fallbackString);
      return fallbackString;
      
    } finally {
      setIsAnalyzing(false);
    }
  };

  return { isAnalyzing, diagnostic, analyzeSession };
}