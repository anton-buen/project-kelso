import { useState, useEffect } from 'react';

// The shape of our clinical data payload
export interface HitData {
  deltaMs: number;
  tension: number;
  tensionScore: number;
  timestamp: number;
}

export function useSessionTelemetry(isPlaying: boolean, currentTension: number) {
  // SOURCE OF TRUTH: The array holding the user's performance data
  const [sessionData, setSessionData] = useState<HitData[]>([]);
  
  // ... rest of your hook remains the same

  // The architectural fix: A dedicated method to safely clear the state
  const resetSession = () => {
    setSessionData([]);
  };

  // Listens for transient strikes from the Audio Engine
  useEffect(() => {
    // Assuming your audio engine dispatches a custom event when a hit is registered
    const handlePhysicalHit = (event: Event) => {
      if (!isPlaying) return;

      const customEvent = event as CustomEvent<{ deltaMs: number }>;
      
      setSessionData(prev => [...prev, {
        deltaMs: customEvent.detail.deltaMs,
        tension: currentTension,      
        tensionScore: currentTension, 
        timestamp: Date.now()
      }]);
    };

    window.addEventListener('kelso-hit', handlePhysicalHit);
    
    return () => {
      window.removeEventListener('kelso-hit', handlePhysicalHit);
    };
  }, [isPlaying, currentTension]);

  return { sessionData, resetSession };
}
// --- KELSO BIOMECHANICAL MATH ENGINE ---

export interface SessionAggregates {
  totalStrikes: number;
  meanOffsetMs: number;
  stdDevMs: number;
  tempoNormalizedCV: number;
  precisionZonePercentage: number;
  driftSlope: number;
  averageTension: number;
  tensionVariance: number;
}

export function calculateSessionAggregates(sessionData: HitData[], bpm: number): SessionAggregates {
  const n = sessionData.length;
  
  if (n === 0) {
    return {
      totalStrikes: 0, meanOffsetMs: 0, stdDevMs: 0, 
      tempoNormalizedCV: 0, precisionZonePercentage: 0, 
      driftSlope: 0, averageTension: 0, tensionVariance: 0
    };
  }

  let sumOffset = 0;
  let sumTension = 0;
  let precisionCount = 0;

  sessionData.forEach(hit => {
    sumOffset += hit.deltaMs;
    sumTension += (hit.tension || 0);
    if (Math.abs(hit.deltaMs) <= 20) precisionCount++; 
  });

  const meanOffsetMs = sumOffset / n;
  const averageTension = sumTension / n;
  const precisionZonePercentage = (precisionCount / n) * 100;

  let sumOffsetSqDiff = 0;
  let sumTensionSqDiff = 0;

  sessionData.forEach(hit => {
    sumOffsetSqDiff += Math.pow(hit.deltaMs - meanOffsetMs, 2);
    sumTensionSqDiff += Math.pow((hit.tension || 0) - averageTension, 2);
  });

  const stdDevMs = n > 1 ? Math.sqrt(sumOffsetSqDiff / n) : 0;
  const tensionVariance = n > 1 ? sumTensionSqDiff / n : 0;

  const targetIntervalMs = 60000 / bpm;
  const tempoNormalizedCV = targetIntervalMs > 0 ? (stdDevMs / targetIntervalMs) * 100 : 0;

  let driftSlope = 0;
  if (n > 1) {
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    sessionData.forEach((hit, i) => {
      sumX += i;
      sumY += hit.deltaMs;
      sumXY += (i * hit.deltaMs);
      sumX2 += (i * i);
    });
    
    const denominator = (n * sumX2) - (sumX * sumX);
    if (denominator !== 0) {
      driftSlope = ((n * sumXY) - (sumX * sumY)) / denominator;
    }
  }

  return {
    totalStrikes: n,
    meanOffsetMs,
    stdDevMs,
    tempoNormalizedCV,
    precisionZonePercentage,
    driftSlope,
    averageTension,
    tensionVariance
  };
}