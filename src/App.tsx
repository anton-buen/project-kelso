import { useEffect } from 'react';
import { useHardwareTelemetry } from './hooks/useHardwareTelemetry';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useVisionEngine } from './hooks/useVisionEngine';
import { useSessionTelemetry } from './hooks/useSessionTelemetry';

function App() {
  const { status, errorMsg, videoRef, audioContextRef, analyserRef, poseLandmarkerRef } = useHardwareTelemetry();
  const { isPlaying, toggleEngine, bpm } = useAudioEngine(audioContextRef.current, analyserRef.current);
  
  // Engine B: Vision & Tension Tracking
  const { tensionLevel } = useVisionEngine(videoRef, poseLandmarkerRef.current, isPlaying);
  
  // Engine C/Aggregator: Session Data Logging
  const { sessionData } = useSessionTelemetry(isPlaying, tensionLevel);

  // Listen for Spacebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && status === 'calibrated') {
        toggleEngine();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, toggleEngine]);

  return (
    <div 
      className="min-h-screen bg-neutral-950 text-neutral-200 flex flex-col items-center justify-between p-8 overflow-hidden relative transition-colors duration-500"
      style={{
        // Peripheral Tension Glow
        boxShadow: isPlaying ? `inset 0 0 ${tensionLevel * 2}px ${tensionLevel / 2}px rgba(239, 68, 68, ${tensionLevel / 300})` : 'none'
      }}
    >
      
      <video ref={videoRef} className="hidden" playsInline muted />

      {/* TOP BAR */}
      <div className="w-full max-w-4xl flex justify-between items-start text-xs font-mono text-neutral-600 tracking-widest uppercase z-10">
        <span>[ 14:22 Remaining ]</span>
        <span>Sys_Opt</span>
      </div>

      {/* CENTER STAGE */}
      <div className="flex flex-col items-center justify-center space-y-8 z-10 w-full flex-grow">
        
        {!isPlaying && (
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-light tracking-widest opacity-80 transition-opacity">
              PROJECT-KELSO
            </h1>
            <p className={`text-sm font-mono transition-opacity duration-1000 ${status === 'calibrated' ? 'text-emerald-500/80' : 'text-neutral-500 animate-pulse'}`}>
              {status === 'awaiting_permissions' && "[ Requesting Sensor Access ]"}
              {status === 'initializing_ai' && "[ Downloading Kinematic Models ]"}
              {status === 'calibrated' && "[ Sensors Locked. Press SPACE to begin ]"}
              {status === 'error' && <span className="text-red-500/80">[ SYSTEM FAULT: {errorMsg} ]</span>}
            </p>
          </div>
        )}

        {isPlaying && (
          <div className="text-center space-y-12">
            <div className={`w-32 h-32 border ${tensionLevel > 50 ? 'border-red-900/50' : 'border-neutral-800'} rounded-full flex items-center justify-center opacity-30 mx-auto animate-[pulse_4s_ease-in-out_infinite] transition-colors duration-500`}>
              <div className={`w-24 h-24 border ${tensionLevel > 50 ? 'border-red-800/50' : 'border-neutral-700'} rounded-full flex items-center justify-center transition-colors duration-500`}>
                 <div className={`w-16 h-16 border ${tensionLevel > 50 ? 'border-red-700/50' : 'border-neutral-600'} rounded-full transition-colors duration-500`}></div>
              </div>
            </div>
            
            <p className="text-xs font-mono text-neutral-500 tracking-[0.3em] uppercase">
              Phase 1: Weak-Hand Leveler
            </p>
          </div>
        )}
      </div>

      {/* BOTTOM BAR - NOW TRACKING HITS */}
      <div className="w-full max-w-4xl flex justify-between items-end text-xs font-mono text-neutral-600 tracking-widest z-10">
        <span>[ Hits Logged: {sessionData.length} ]</span>
        <span>[ Target: {bpm} BPM ]</span>
      </div>

    </div>
  );
}

export default App;