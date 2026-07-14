import { useState, useEffect, useRef } from 'react';

export type HitData = {
  timestamp: number;
  deltaMs: number;
  tensionScore: number;
};

export function useSessionTelemetry(isPlaying: boolean, currentTension: number) {
  const [sessionData, setSessionData] = useState<HitData[]>([]);
  // We use a ref to track tension so the event listener always has the latest value 
  // without needing to re-bind on every frame.
  const tensionRef = useRef(currentTension);

  useEffect(() => {
    tensionRef.current = currentTension;
  }, [currentTension]);

  useEffect(() => {
    if (!isPlaying) return;

    const handleTap = (e: Event) => {
      const customEvent = e as CustomEvent;
      
      const newHit: HitData = {
        timestamp: customEvent.detail.timestamp,
        deltaMs: customEvent.detail.delta,
        tensionScore: tensionRef.current
      };

      // Add to our running session array
      setSessionData(prev => [...prev, newHit]);
    };

    window.addEventListener('kelso-tap', handleTap);
    
    return () => {
      window.removeEventListener('kelso-tap', handleTap);
    };
  }, [isPlaying]);

  return { sessionData };
}