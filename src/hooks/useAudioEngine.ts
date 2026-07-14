import { useRef, useState, useCallback, useEffect } from 'react';

export function useAudioEngine(audioContext: AudioContext | null, analyser: AnalyserNode | null) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(90); // Default tempo for Weak-Hand Leveler
  
  const nextNoteTimeRef = useRef(0);
  const timerIDRef = useRef<number | null>(null);
  
  // ARCHITECTURAL FIX: Use a ref to track isPlaying state without triggering circular re-renders
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  
  // Basic Transient Detection (Volume Threshold & Delta Calculation)
  const checkTransients = useCallback(() => {
    if (!analyser || !audioContext) return;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(dataArray);
    
    let maxVolume = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const volume = Math.abs(dataArray[i] - 128); // 128 is silence in 8-bit
      if (volume > maxVolume) maxVolume = volume;
    }

    // If a tap is detected
    if (maxVolume > 40) {
      const currentTime = audioContext.currentTime;
      // Calculate delta: Negative means rushing (early), Positive means dragging (late)
      const delta = (currentTime - nextNoteTimeRef.current) * 1000; 
      
      // Prevent logging the same tap multiple times in a 100ms window
      if (Math.abs(delta) < 200) { 
        // Dispatch a custom event so our Aggregator can catch it
        const tapEvent = new CustomEvent('kelso-tap', { 
          detail: { delta, volume: maxVolume, timestamp: Date.now() } 
        });
        window.dispatchEvent(tapEvent);
      }
    }
    
    // Check the ref instead of state to avoid circular dependency
    if (isPlayingRef.current) {
      requestAnimationFrame(checkTransients);
    }
  }, [analyser, audioContext]);

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
      
      // Using a micro-delay (requestAnimationFrame) ensures isPlayingRef 
      // updates before checkTransients fires, keeping the audio loop stable.
      requestAnimationFrame(checkTransients);
    }
  }, [audioContext, isPlaying, scheduler, checkTransients]);

  return { isPlaying, toggleEngine, bpm };
}