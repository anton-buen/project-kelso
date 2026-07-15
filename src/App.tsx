import { useEffect, useState, useRef } from 'react';
import { useHardwareTelemetry } from './hooks/useHardwareTelemetry';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useVisionEngine } from './hooks/useVisionEngine';
import { useSessionTelemetry } from './hooks/useSessionTelemetry';
import { useDiagnosticAgent } from './hooks/useDiagnosticAgent';
import { useSessionHistory } from './hooks/useSessionHistory';
import ReactMarkdown from 'react-markdown';

function App() {
  const [appPhase, setAppPhase] = useState<'idle' | 'baseline' | 'active' | 'analyzing' | 'complete'>('idle');
  const [targetHand, setTargetHand] = useState<'LEFT' | 'RIGHT' | null>(null);
  const [baselineY, setBaselineY] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Edge Layer Hooks
  const { status, errorMsg, videoRef, audioContextRef, analyserRef, poseLandmarkerRef } = useHardwareTelemetry();
  const { isPlaying, toggleEngine, bpm } = useAudioEngine(audioContextRef.current, analyserRef.current);
  const { tensionLevel, isShouldersVisible, currentShoulderY } = useVisionEngine(
      videoRef, 
      poseLandmarkerRef.current, 
      appPhase === 'active', 
      baselineY,
      targetHand // <--- Added here
    );
  const { sessionData, resetSession } = useSessionTelemetry(isPlaying, tensionLevel);
  
  // Agentic & Data Hooks
  const { diagnostic, analyzeSession } = useDiagnosticAgent();
  const { history, saveSession, storageError } = useSessionHistory();

  const currentYRef = useRef(0);
  useEffect(() => { currentYRef.current = currentShoulderY; }, [currentShoulderY]);

  // The 2-Second Silent Tare
  useEffect(() => {
    if (appPhase === 'baseline') {
      const timer = setTimeout(() => {
        setBaselineY(currentYRef.current);
        setAppPhase('active');
        toggleEngine();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [appPhase, toggleEngine]);

  // Unified Keyboard Controls
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Toggle History Vault
      if (e.code === 'Tab') {
        e.preventDefault();
        setShowHistory(prev => !prev);
        return;
      }

      if (showHistory) return; // Block input if vault is open

      // Deterministic Start (L or R)
      if (appPhase === 'idle' && status === 'calibrated' && isShouldersVisible) {
        if (e.code === 'KeyL' || e.code === 'KeyR') {
          setTargetHand(e.code === 'KeyL' ? 'LEFT' : 'RIGHT');
          resetSession();
          setAppPhase('baseline');
        }
      }

      // End Session (Enter)
      if (e.code === 'Enter' && appPhase === 'active') {
        toggleEngine(); 
        setAppPhase('analyzing');
        const finalDiag = await analyzeSession(sessionData, targetHand!);
        if (finalDiag) saveSession(targetHand!, finalDiag);
        setAppPhase('complete');
      }

      // Reset
      if (e.code === 'Escape' && appPhase === 'complete') {
        setAppPhase('idle');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appPhase, status, isShouldersVisible, toggleEngine, analyzeSession, sessionData, targetHand, saveSession, showHistory, resetSession]);

  return (
    <div 
      className="min-h-screen bg-neutral-950 text-neutral-200 flex flex-col items-center justify-between p-8 overflow-hidden relative transition-colors duration-500"
      style={{ boxShadow: appPhase === 'active' ? `inset 0 0 ${tensionLevel * 2}px ${tensionLevel / 2}px rgba(239, 68, 68, ${tensionLevel / 300})` : 'none' }}
    >
      {/* THE DARK MIRROR */}
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-10 grayscale blur-sm pointer-events-none z-0 transition-opacity duration-1000" playsInline muted />

      {/* TOP BAR */}
      <div className="w-full max-w-4xl flex justify-between items-start text-xs font-mono tracking-widest uppercase z-20 drop-shadow-md">
        <span className="text-neutral-600">[ Tab: Data Vault ]</span>
        <span className={storageError ? "text-red-500" : "text-neutral-600"}>
          {storageError ? "[ Storage Blocked ]" : "Sys_Opt"}
        </span>
      </div>

      {/* DATA VAULT OVERLAY */}
      {showHistory && (
        <div className="absolute inset-0 z-30 bg-neutral-950/95 backdrop-blur-md flex flex-col items-center justify-start p-16 overflow-y-auto">
          <h2 className="text-sm font-mono text-emerald-500 tracking-[0.3em] uppercase mb-8 border-b border-emerald-900 pb-4 w-full max-w-3xl text-left">Historical Analytics Vault</h2>
          <div className="w-full max-w-3xl space-y-6">
            {history.length === 0 ? <p className="text-neutral-600 font-mono text-sm">[ No data recorded. ]</p> : 
              history.map(entry => (
                <div key={entry.id} className="bg-neutral-900/50 border border-neutral-800 p-6 rounded text-left">
                  <div className="flex justify-between text-xs font-mono text-neutral-500 mb-4 border-b border-neutral-800 pb-2">
                    <span>{entry.date}</span>
                    <span>Target: {entry.hand}</span>
                  </div>
                  <div className="text-sm font-mono text-neutral-300 leading-relaxed">
                     <ReactMarkdown components={{ h3: ({node, ...props}) => <strong className="text-emerald-400" {...props}/> }}>{entry.diagnostic}</ReactMarkdown>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* CENTER STAGE ROUTING */}
      <div className="flex flex-col items-center justify-center space-y-8 z-10 w-full flex-grow">
        
        {appPhase === 'analyzing' ? (
          <div className="text-center space-y-4 animate-pulse">
            <p className="text-sm font-mono text-emerald-500/80 tracking-widest uppercase drop-shadow-md">[ Synthesizing Bio-Metrics... ]</p>
          </div>
        ) : appPhase === 'complete' ? (
          <div className="w-full max-w-2xl bg-neutral-900/80 border border-neutral-800 p-8 rounded backdrop-blur-md shadow-2xl">
            <h2 className="text-xs font-mono text-neutral-500 tracking-[0.3em] uppercase mb-6 border-b border-neutral-800 pb-4">Diagnostic Complete [ Target: {targetHand} ]</h2>
            <div className="text-sm font-mono text-neutral-300 leading-relaxed text-left w-full">
              <ReactMarkdown components={{ h3: ({node, ...props}) => <h3 className="text-sm font-bold text-emerald-500 mb-4 tracking-widest uppercase" {...props} />, strong: ({node, ...props}) => <strong className="text-emerald-400/90 font-bold" {...props} />, ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-3 mb-4 marker:text-neutral-600" {...props} />, li: ({node, ...props}) => <li className="pl-2" {...props} /> }}>
                {diagnostic || ''}
              </ReactMarkdown>
            </div>
            <p className="text-xs font-mono text-neutral-600 mt-8 text-center animate-pulse">[ Press ESC to return ]</p>
          </div>
        ) : appPhase === 'baseline' ? (
          <div className="text-center space-y-4">
            <p className="text-sm font-mono text-emerald-500/80 tracking-widest uppercase animate-pulse">[ Capturing Baseline... Relax. ]</p>
          </div>
        ) : appPhase === 'active' ? (
          <div className="text-center space-y-12">
            <div className={`w-32 h-32 border ${tensionLevel > 50 ? 'border-red-900/50' : 'border-neutral-800'} rounded-full flex items-center justify-center opacity-30 mx-auto animate-[pulse_4s_ease-in-out_infinite] transition-colors duration-500`}>
              <div className={`w-24 h-24 border ${tensionLevel > 50 ? 'border-red-800/50' : 'border-neutral-700'} rounded-full flex items-center justify-center transition-colors duration-500`}>
                 <div className={`w-16 h-16 border ${tensionLevel > 50 ? 'border-red-700/50' : 'border-neutral-600'} rounded-full transition-colors duration-500`}></div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-mono text-neutral-500 tracking-[0.3em] uppercase">Phase 1: {targetHand} Hand Leveler</p>
              <p className="text-xs font-mono text-neutral-600 animate-pulse">[ Press ENTER to conclude session ]</p>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-light tracking-widest opacity-80 transition-opacity drop-shadow-lg">PROJECT-KELSO</h1>
            <div className={`text-sm font-mono transition-opacity duration-1000 drop-shadow-md`}>
              {status === 'calibrated' ? (
                isShouldersVisible ? (
                  <p className="text-emerald-500/80">[ Sensors Locked. Press L (Left) or R (Right) ]</p>
                ) : (
                  <p className="text-red-500/80">[ Error: Shoulders Out of Frame ]</p>
                )
              ) : (
                <p className="text-neutral-500 animate-pulse">[ Initializing Systems... ]</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM BAR */}
      <div className="w-full max-w-4xl flex justify-between items-end text-xs font-mono text-neutral-600 tracking-widest z-10 drop-shadow-md">
        <span>[ Hits Logged: {sessionData.length} ]</span>
        <span>[ Target: {bpm} BPM ]</span>
      </div>
    </div>
  );
}

export default App;