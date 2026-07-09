import { useRef, useState, useCallback } from 'react';

export function useAudioEngine(audioContext: AudioContext | null, analyser: AnalyserNode | null) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(90); // Default tempo for Weak-Hand Leveler
  
  const nextNoteTimeRef = useRef(0);
  const timerIDRef = useRef<number | null>(null);
  
  // Basic Transient Detection (Volume Threshold)
  const checkTransients = useCallback(() => {
    if (!analyser) return;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(dataArray);
    
    let maxVolume = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const volume = Math.abs(dataArray[i] - 128); // 128 is silence in 8-bit
      if (volume > maxVolume) maxVolume = volume;
    }

    // If volume spikes above threshold (e.g., a hard tap), log it.
    // In the future, we will compare this timestamp to nextNoteTimeRef to calculate Constant Error (CE)
    if (maxVolume > 40) {
      console.log("Transient detected (Tap!) - Vol:", maxVolume);
    }
    
    if (isPlaying) {
      requestAnimationFrame(checkTransients);
    }
  }, [analyser, isPlaying]);

  // Metronome Click Generator
  const scheduleNote = useCallback((time: number) => {
    if (!audioContext) return;
    const osc = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    
    osc.frequency.value = 800; // Crisp "tick" sound
    envelope.gain.value = 1;
    envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.05); // Quick fade
    
    osc.connect(envelope);
    envelope.connect(audioContext.destination);
    
    osc.start(time);
    osc.stop(time + 0.05);
  }, [audioContext]);

  // Audio Scheduler Loop
  const scheduler = useCallback(() => {
    if (!audioContext) return;
    
    // Lookahead window for precise timing
    while (nextNoteTimeRef.current < audioContext.currentTime + 0.1) {
      scheduleNote(nextNoteTimeRef.current);
      // Advance time by quarter note based on BPM
      nextNoteTimeRef.current += 60.0 / bpm; 
    }
    
    timerIDRef.current = window.setTimeout(scheduler, 25);
  }, [audioContext, bpm, scheduleNote]);

  const toggleEngine = useCallback(() => {
    if (!audioContext) return;
    
    if (isPlaying) {
      setIsPlaying(false);
      if (timerIDRef.current) window.clearTimeout(timerIDRef.current);
    } else {
      // Browser requires resuming context on first user interaction
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      setIsPlaying(true);
      nextNoteTimeRef.current = audioContext.currentTime + 0.05;
      scheduler();
      checkTransients(); // Start listening for taps
    }
  }, [audioContext, isPlaying, scheduler, checkTransients]);

  return { isPlaying, toggleEngine, bpm };
}