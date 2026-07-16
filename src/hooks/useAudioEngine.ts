import { useState, useEffect, useRef } from 'react';

export type RhythmPattern = 'quarter' | 'eighth' | 'triplet' | 'sixteenth';

export function useAudioEngine(
  audioContext: AudioContext | null, 
  analyser: AnalyserNode | null,
  bpm: number,
  pattern: RhythmPattern
) {
  const [isPlaying, setIsPlaying] = useState(false);

  const schedulerTimerRef = useRef<number | null>(null);
  const nextStartTimeRef = useRef<number>(0); 
  const nextClickTimeMsRef = useRef<number>(0); 
  const clickTimesQueueRef = useRef<number[]>([]); 

  const toggleEngine = () => {
    if (!audioContext) return;
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    setIsPlaying(prev => !prev);
  };

  // 1. THE METRONOME SCHEDULER (Subdivision-Aware Target Queue)
  useEffect(() => {
    if (!isPlaying || !audioContext) {
      if (schedulerTimerRef.current) {
        clearInterval(schedulerTimerRef.current);
        schedulerTimerRef.current = null;
      }
      clickTimesQueueRef.current = [];
      return;
    }

    const clickIntervalSec = 60 / bpm;
    const quarterMs = clickIntervalSec * 1000;
    const scheduleAheadTime = 0.1; 
    
    nextStartTimeRef.current = audioContext.currentTime + 0.05;
    nextClickTimeMsRef.current = Date.now() + 50;

    const scheduler = () => {
      while (nextStartTimeRef.current < audioContext.currentTime + scheduleAheadTime) {
        // Schedule physical metronome audio on the quarter notes only
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.frequency.setValueAtTime(880, nextStartTimeRef.current); 
        gain.gain.setValueAtTime(0.3, nextStartTimeRef.current);
        gain.gain.exponentialRampToValueAtTime(0.001, nextStartTimeRef.current + 0.04); 

        osc.start(nextStartTimeRef.current);
        osc.stop(nextStartTimeRef.current + 0.05);

        // Populate target matching queue with pattern-specific subdivisions
        const baseTime = nextClickTimeMsRef.current;
        if (pattern === 'quarter') {
          clickTimesQueueRef.current.push(baseTime);
        } else if (pattern === 'eighth') {
          clickTimesQueueRef.current.push(baseTime, baseTime + quarterMs / 2);
        } else if (pattern === 'triplet') {
          clickTimesQueueRef.current.push(
            baseTime, 
            baseTime + quarterMs / 3, 
            baseTime + (quarterMs * 2) / 3
          );
        } else if (pattern === 'sixteenth') {
          clickTimesQueueRef.current.push(
            baseTime, 
            baseTime + quarterMs / 4, 
            baseTime + quarterMs / 2, 
            baseTime + (quarterMs * 3) / 4
          );
        }

        nextStartTimeRef.current += clickIntervalSec;
        nextClickTimeMsRef.current += quarterMs;
      }
    };

    schedulerTimerRef.current = window.setInterval(scheduler, 25);

    return () => {
      if (schedulerTimerRef.current) {
        clearInterval(schedulerTimerRef.current);
      }
    };
  }, [isPlaying, bpm, pattern, audioContext]);

  // 2. THE RATE-OF-ATTACK TRANSIENT ENGINE
  useEffect(() => {
    if (!isPlaying || !analyser || !audioContext) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animationFrameId: number;
    
    let lastVolume = 0;
    let lastHitTime = 0; 
    const DEBOUNCE_MS = 120; 

    const checkTransients = () => {
      analyser.getByteFrequencyData(dataArray);
      
      let highFreqSum = 0;
      const startBin = Math.floor(bufferLength * 0.3);
      for (let i = startBin; i < bufferLength; i++) {
        highFreqSum += dataArray[i];
      }
      const currentVolume = highFreqSum / (bufferLength - startBin);

      const rateOfAttack = currentVolume - lastVolume;
      lastVolume = currentVolume;

      const now = Date.now();

      if (rateOfAttack > 10 && (now - lastHitTime) > DEBOUNCE_MS) {
        const windowLimit = now - 1000;
        clickTimesQueueRef.current = clickTimesQueueRef.current.filter(t => t > windowLimit);

        if (clickTimesQueueRef.current.length > 0) {
          let closestClick = clickTimesQueueRef.current[0];
          let minDiff = Math.abs(now - closestClick);

          for (let i = 1; i < clickTimesQueueRef.current.length; i++) {
            const diff = Math.abs(now - clickTimesQueueRef.current[i]);
            if (diff < minDiff) {
              minDiff = diff;
              closestClick = clickTimesQueueRef.current[i];
            }
          }

          const deltaMs = now - closestClick;

          // Calculate matching window based on active subdivision
          const clickIntervalSec = 60 / bpm;
          let subInterval = clickIntervalSec;
          if (pattern === 'eighth') subInterval = clickIntervalSec / 2;
          else if (pattern === 'triplet') subInterval = clickIntervalSec / 3;
          else if (pattern === 'sixteenth') subInterval = clickIntervalSec / 4;

          const matchWindowMs = (subInterval * 1000) / 2;

          if (Math.abs(deltaMs) < matchWindowMs) {
            lastHitTime = now;
            
            const hitEvent = new CustomEvent('kelso-hit', {
              detail: { deltaMs }
            });
            window.dispatchEvent(hitEvent);
          }
        }
      }

      animationFrameId = requestAnimationFrame(checkTransients);
    };

    animationFrameId = requestAnimationFrame(checkTransients);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, analyser, audioContext, bpm, pattern]);

  return { isPlaying, toggleEngine };
}