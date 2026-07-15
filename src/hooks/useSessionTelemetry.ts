import { useState, useEffect } from 'react';

// The shape of our clinical data payload
export interface HitData {
  deltaMs: number;
  tensionScore: number;
  timestamp: number;
}

export function useSessionTelemetry(isPlaying: boolean, currentTension: number) {
  // SOURCE OF TRUTH: The array holding the user's performance data
  const [sessionData, setSessionData] = useState<HitData[]>([]);

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
        tensionScore: currentTension, // Captured exactly at the moment of impact
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