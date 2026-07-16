import { useState, useEffect, useRef } from 'react';

export function useAudioEngine(audioContext: AudioContext | null, analyser: AnalyserNode | null) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm] = useState(120); // Default training tempo

  const schedulerTimerRef = useRef<number | null>(null);
  const nextStartTimeRef = useRef<number>(0); // Accurate Web Audio clock time (seconds)
  const nextClickTimeMsRef = useRef<number>(0); // Wall clock time (milliseconds)
  const clickTimesQueueRef = useRef<number[]>([]); // Tracks planned click times for matching

  // Core Toggle: Handles Audio Context state and session play state
  const toggleEngine = () => {
    if (!audioContext) return;
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    setIsPlaying(prev => !prev);
  };

  // 1. THE METRONOME SCHEDULER (Direct-to-Soundcard Pipeline)
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
    const scheduleAheadTime = 0.1; // Look ahead 100ms
    
    // Sync initial clocks
    nextStartTimeRef.current = audioContext.currentTime + 0.05;
    nextClickTimeMsRef.current = Date.now() + 50;

    const scheduler = () => {
      while (nextStartTimeRef.current < audioContext.currentTime + scheduleAheadTime) {
        // Schedule Oscillator click
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.frequency.setValueAtTime(1000, nextStartTimeRef.current); // 1kHz target click
        gain.gain.setValueAtTime(0.4, nextStartTimeRef.current);
        gain.gain.exponentialRampToValueAtTime(0.001, nextStartTimeRef.current + 0.05); // Short snappy snap

        osc.start(nextStartTimeRef.current);
        osc.stop(nextStartTimeRef.current + 0.06);

        // Record exactly when this click is scheduled to play in wall-clock time
        clickTimesQueueRef.current.push(nextClickTimeMsRef.current);

        // Advance schedules
        nextStartTimeRef.current += clickIntervalSec;
        nextClickTimeMsRef.current += clickIntervalSec * 1000;
      }
    };

    // Keep the audio thread fed every 25ms
    schedulerTimerRef.current = window.setInterval(scheduler, 25);

    return () => {
      if (schedulerTimerRef.current) {
        clearInterval(schedulerTimerRef.current);
      }
    };
  }, [isPlaying, bpm, audioContext]);

  // 2. THE RATE-OF-ATTACK TRANSIENT ENGINE
  useEffect(() => {
    if (!isPlaying || !analyser || !audioContext) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animationFrameId: number;
    
    let lastVolume = 0;
    let lastHitTime = 0; 
    const DEBOUNCE_MS = 150; // Prevents double-triggering from desk echo

    const checkTransients = () => {
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume in the upper 70% of the frequency spectrum
      // Desk taps and finger snaps are highly transient (high-frequency)
      let highFreqSum = 0;
      const startBin = Math.floor(bufferLength * 0.3);
      for (let i = startBin; i < bufferLength; i++) {
        highFreqSum += dataArray[i];
      }
      const currentVolume = highFreqSum / (bufferLength - startBin);

      // DERIVATIVE CALCULATION: How quickly did the volume rise?
      const rateOfAttack = currentVolume - lastVolume;
      lastVolume = currentVolume;

      const now = Date.now();

      // Trigger if the volume spikes vertically, ignoring constant hums
      if (rateOfAttack > 10 && (now - lastHitTime) > DEBOUNCE_MS) {
        // Garbage-collect old clicks from queue
        const windowLimit = now - 1000;
        clickTimesQueueRef.current = clickTimesQueueRef.current.filter(t => t > windowLimit);

        if (clickTimesQueueRef.current.length > 0) {
          // Find the closest scheduled metronome click to match this tap
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

          // Reject accidental spikes far away from the tempo window (+/- 250ms)
          if (Math.abs(deltaMs) < 250) {
            lastHitTime = now;
            
            // Dispatch target hit event
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
  }, [isPlaying, analyser, audioContext, bpm]);

  return { isPlaying, toggleEngine, bpm };
}