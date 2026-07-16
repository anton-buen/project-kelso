import { useEffect, useState, useRef } from 'react';
import { useHardwareTelemetry } from './hooks/useHardwareTelemetry';
import { useAudioEngine } from './hooks/useAudioEngine';
import type { RhythmPattern } from './hooks/useAudioEngine';
import { useVisionEngine } from './hooks/useVisionEngine';
import { useSessionTelemetry } from './hooks/useSessionTelemetry';
import { useDiagnosticAgent } from './hooks/useDiagnosticAgent';
import { useSessionHistory } from './hooks/useSessionHistory';
import { TimingGraph } from './components/TimingGraph';
import { DiagnosticDashboard } from './components/DiagnosticDashboard';

const LOADING_REMARKS = [
  "Slick-talking your webcam...",
  "Tensioning drumheads...",
  "Negotiating with your OS...",
  "Warming up the AI...",
  "Tuning the metronome...",
  "Calibrating acoustics...",
  "Measuring the temp. in your room...",
  "Asking your left hand to behave...",
  "Counting the pixels in screen...",
  "Aligning physical coordinates...",
  "Pre-heating the oven...",
  "Asking your right hand to behave...",
  "Measuring the speed of light...",
  "Asking your neighbors to be quiet...",
  "This should be the last message...",
  "Well, this is awkward...",
  "Still loading...",
  "Almost there, promise...",
  "Just a few more seconds...",
  "If you can read this, you're patient...",
  "If you can read this, you're very patient...",
  "If you can read this, you're extremely patient..."
];
export default function App() {
  const [isBooted, setIsBooted] = useState(false);

  // Gating the hardware hooks behind explicit intent to protect webcam privacy.
  if (!isBooted) {
    return <LandingScreen onBoot={() => setIsBooted(true)} />;
  }

  return <KelsoWorkspace />;
}

// ==========================================
// 1. THE LANDING SCREEN (Zero Hardware Hooks)
// ==========================================
function LandingScreen({ onBoot }: { onBoot: () => void }) {
  return (
    <div className="min-h-screen bg-[#0a0a09] text-zinc-200 flex flex-col items-center justify-center p-6 overflow-hidden relative font-sans selection:bg-[#C2D685]/30">
      
      <div className="z-10 w-full max-w-xl flex flex-col items-center justify-center flex-grow transition-all duration-500">
        
        {/* Seamless Header - Aligns perfectly with the Workspace header */}
        <div className="text-center space-y-4 opacity-90 mb-12">
          <h1 className="text-2xl font-light tracking-tight text-zinc-100">Project Kelso</h1>
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em] animate-in fade-in duration-1000 delay-300">
            Learning Drums Without Drums
          </p>
        </div>

        <button 
          onClick={onBoot}
          className="group relative inline-flex items-center justify-center px-8 py-4 rounded-full bg-white/5 border border-white/10 hover:bg-[#E7FF9E] hover:text-[#0e0f0c] hover:border-[#E7FF9E] transition-all duration-500 active:scale-95 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-1000 delay-500"
        >
          <span className="relative z-10 text-[10px] font-mono uppercase tracking-widest font-bold transition-colors duration-500">
            Practice
          </span>
        </button>
      </div>

      {/* Auxiliary Links */}
      <div className="absolute bottom-10 flex gap-8 text-[10px] font-mono text-zinc-600 uppercase tracking-widest animate-in fade-in duration-1000 delay-700">
        <a href="https://github.com/your-repo/project-kelso" target="_blank" rel="noreferrer" className="hover:text-zinc-400 transition-colors">
          [ Repository ]
        </a>
        <a href="mailto:feedback@projectkelso.com" className="hover:text-zinc-400 transition-colors">
          [ Feedback ]
        </a>
      </div>
    </div>
  );
}

// ==========================================
// 2. THE CORE WORKSPACE (Hardware Engaged)
// ==========================================
function KelsoWorkspace() {
  const [appPhase, setAppPhase] = useState<'idle' | 'baseline' | 'countdown' | 'active' | 'analyzing' | 'complete'>('idle');
  const [countdownVal, setCountdownVal] = useState(5);
  const [targetHand, setTargetHand] = useState<'LEFT' | 'RIGHT' | null>(null);
  const [baselineY, setBaselineY] = useState<number | null>(null);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  
  const [bpm, setBpm] = useState(120);
  const [pattern, setPattern] = useState<any>('quarter'); // Mapped loosely to avoid import issues from snippet cutoffs
  
  // Minimalist Remarks
  const LOADING_REMARKS = ["Synthesizing Agent...", "Formatting Ledger...", "Uploading Telemetry...", "Aligning Coordinates..."];
  const [loadingText, setLoadingText] = useState(LOADING_REMARKS[0]);

  const [alignmentProgress, setAlignmentProgress] = useState(0);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Hardware hooks only fire when this component mounts!
  const { status, videoRef, audioContextRef, analyserRef, poseLandmarkerRef } = useHardwareTelemetry();
  const { isPlaying, toggleEngine } = useAudioEngine(audioContextRef.current, analyserRef.current, bpm, pattern);
  
  const { tensionLevel, isShouldersVisible, currentShoulderY } = useVisionEngine(
    videoRef, poseLandmarkerRef.current, appPhase === 'active', baselineY, targetHand
  );
  
  const { sessionData, resetSession } = useSessionTelemetry(isPlaying, tensionLevel);
  const { diagnostic, analyzeSession } = useDiagnosticAgent();
  const { history, saveSession, clearHistory } = useSessionHistory();

  const currentYRef = useRef(0);
  useEffect(() => { currentYRef.current = currentShoulderY; }, [currentShoulderY]);

  // POSTURE ALIGNMENT LOCK
  useEffect(() => {
    let timer: number;
    if (appPhase === 'idle' && status === 'calibrated' && !isUnlocked) {
      if (isShouldersVisible) {
        timer = window.setInterval(() => {
          setAlignmentProgress(prev => {
            if (prev >= 100) {
              setIsUnlocked(true);
              return 100;
            }
            return prev + 2; 
          });
        }, 100);
      } else {
        setAlignmentProgress(0); 
      }
    }
    return () => clearInterval(timer);
  }, [appPhase, status, isShouldersVisible, isUnlocked]);

  // LOADING REMARKS
  useEffect(() => {
    let interval: number;
    if (appPhase === 'baseline' || appPhase === 'analyzing') {
      interval = window.setInterval(() => {
        setLoadingText(LOADING_REMARKS[Math.floor(Math.random() * LOADING_REMARKS.length)]);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [appPhase]);

  // BASELINE -> COUNTDOWN
  useEffect(() => {
    if (appPhase === 'baseline') {
      const timer = setTimeout(() => {
        setAppPhase('countdown');
        toggleEngine(); 
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [appPhase, toggleEngine]);

  // COUNTDOWN -> ACTIVE
  useEffect(() => {
    let timer: number;
    if (appPhase === 'countdown') {
      timer = window.setInterval(() => {
        setCountdownVal(prev => {
          if (prev <= 1) {
            setBaselineY(currentYRef.current);
            setAppPhase('active');
            return 5; 
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [appPhase]);

  // SESSION CONCLUDE
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.code === 'Enter' && appPhase === 'active') {
        toggleEngine(); 
        setAppPhase('analyzing');
        const finalDiag = await analyzeSession(sessionData, targetHand!);
        if (finalDiag) saveSession(targetHand!, finalDiag);
        setAppPhase('complete');
      }
      if (e.code === 'Escape' && appPhase === 'complete') {
        setAppPhase('idle');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appPhase, toggleEngine, analyzeSession, sessionData, targetHand, saveSession]);

  const triggerStart = (hand: 'LEFT' | 'RIGHT') => {
    setIsSettingsOpen(false);
    setIsVaultOpen(false);
    setTargetHand(hand);
    resetSession();
    setCountdownVal(5);
    setAppPhase('baseline');
  };

  const getAmbientGlow = () => {
    if (appPhase !== 'active') return 'none';
    if (!isShouldersVisible) return 'inset 0 0 100px rgba(245, 158, 11, 0.15)';
    if (tensionLevel > 30) return `inset 0 0 ${tensionLevel * 3}px rgba(239, 68, 68, ${tensionLevel / 150})`;
    return 'inset 0 0 50px rgba(194, 214, 133, 0.03)';
  };

  const getPatternText = (p: string) => {
    switch(p) {
      case 'quarter': return '1/4';
      case 'eighth': return '1/8';
      case 'triplet': return '1/3';
      case 'sixteenth': return '1/16';
      default: return '1/4';
    }
  };

  return (
    <div 
      className="min-h-screen bg-[#0a0a09] text-zinc-200 flex flex-col items-center justify-center p-6 overflow-hidden relative font-sans selection:bg-[#C2D685]/30 animate-in fade-in duration-1000"
      style={{ boxShadow: getAmbientGlow(), transition: 'box-shadow 0.3s ease-out' }}
    >
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-[0.03] grayscale blur-xl pointer-events-none z-0" playsInline muted />

      <div className="z-10 w-full max-w-xl flex flex-col items-center justify-center flex-grow transition-all duration-500">
        
        {appPhase === 'idle' && !isVaultOpen && (
          <>
            <div className="text-center space-y-4 opacity-90 mb-12">
              <h1 className="text-2xl font-light tracking-tight text-zinc-100">Project Kelso</h1>
              {/* Ghost Subtitle */}
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] opacity-0 pointer-events-none">
                Learning Drums Without Drums
              </p>
            </div>
            {/* Ghost Button */}
            <div className="px-8 py-4 border border-transparent opacity-0 pointer-events-none">
              <span className="text-[10px] font-mono uppercase tracking-widest font-bold">
                Initiate Workspace
              </span>
            </div>
          </>
        )}
        
        {(appPhase === 'baseline' || appPhase === 'analyzing') && (
          <div className="text-center space-y-6">
            <div className="w-8 h-8 border-[1px] border-[#535C39] border-t-[#C2D685] rounded-full animate-spin mx-auto" />
            <p className="text-[10px] font-mono text-[#98A869] uppercase tracking-widest animate-pulse h-4">{loadingText}</p>
          </div>
        )}

        {appPhase === 'countdown' && (
          <div className="text-center w-full max-w-sm mx-auto animate-in zoom-in-95 duration-300">
            <div className="relative flex flex-col justify-center items-center mx-auto w-64 h-64 rounded-full bg-black/40 border border-[#535C39]/30 backdrop-blur-md">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4">
                {targetHand === 'LEFT' ? 'L' : 'R'} • {getPatternText(pattern)} • {bpm} BPM
              </span>
              <span className="text-[5rem] font-sans font-extralight text-zinc-100 leading-none">
                {countdownVal}
              </span>
              <span className="text-[10px] font-mono text-[#C2D685] uppercase tracking-widest mt-6 animate-pulse">
                Prepare
              </span>
            </div>
          </div>
        )}

        {appPhase === 'active' && (
          <div className="text-center space-y-10 w-full max-w-sm mx-auto animate-in zoom-in-95 duration-300">
            <div 
              className={`relative flex flex-col justify-center items-center mx-auto w-64 h-64 rounded-full bg-black/40 border backdrop-blur-md transition-all duration-500 ease-out ${
                !isShouldersVisible ? 'border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.15)]' : 
                tensionLevel > 40 ? 'border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.2)]' : 
                'border-white/5'
              }`}
            >
              <div 
                className="absolute inset-0 rounded-full transition-all duration-200 ease-linear"
                style={{
                  boxShadow: tensionLevel > 40 ? `inset 0 0 ${tensionLevel}px rgba(239,68,68,0.15)` : 'none',
                  transform: `scale(${1 + (tensionLevel / 400)})`,
                }}
              />

              {/* REFINED CLINICAL FONT */}
              <span className="text-[4.5rem] font-sans font-extralight tracking-widest text-zinc-100 z-10 leading-none mb-6">
                {targetHand === 'LEFT' ? 'L' : 'R'}
              </span>
              
              <div className="z-10 min-h-[40px] flex items-center justify-center">
                {!isShouldersVisible ? (
                  <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest bg-amber-500/10 px-4 py-1.5 rounded-full border border-amber-500/20">
                    Align Posture
                  </span>
                ) : tensionLevel > 40 ? (
                  <span className="text-[10px] font-mono text-red-500 uppercase tracking-widest bg-red-500/10 px-4 py-1.5 rounded-full border border-red-500/20">
                    High Tension
                  </span>
                ) : (
                  <div className="flex flex-col items-center">
                    <span className="text-xl font-medium text-[#C2D685] leading-none mb-1">{sessionData.length}</span>
                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Strikes</span>
                  </div>
                )}
              </div>
            </div>

            <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest animate-pulse">
              Press <kbd className="px-1.5 py-0.5 bg-zinc-800/50 rounded-sm border border-zinc-700/50 text-zinc-400">Enter</kbd> to conclude
            </p>
          </div>
        )}

        {appPhase === 'complete' && (
          <div className="w-full bg-[#11120f]/95 border border-[#535C39]/30 p-8 md:p-12 rounded-[2rem] backdrop-blur-xl shadow-2xl text-left animate-in slide-in-from-bottom-4 duration-500">
            <DiagnosticDashboard data={diagnostic} targetHand={targetHand!} />
            <div className="mt-10 pt-8 border-t border-[#535C39]/20">
              <span className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-6">Strike Telemetry Map</span>
              <TimingGraph sessionData={sessionData} />
            </div>
            <div className="mt-10 pt-6 border-t border-white/5 text-center">
              <button 
                onClick={() => { setAppPhase('idle'); setIsUnlocked(false); setAlignmentProgress(0); }} 
                className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors active:scale-95"
              >
                Return to Practice
              </button>
            </div>
          </div>
        )}

        {isVaultOpen && appPhase === 'idle' && (
          <div className="w-full max-w-sm mx-auto bg-[#11120f]/95 border border-[#535C39]/30 p-6 rounded-[2rem] backdrop-blur-xl shadow-2xl text-left animate-in zoom-in-95 duration-200 mt-8">
            <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-4">
              <h2 className="text-[10px] font-mono text-zinc-300 uppercase tracking-widest">Data Ledger</h2>
              <div className="flex gap-4 items-center">
                <span className="text-[10px] font-mono text-zinc-500">{history.length} LOGS</span>
                {history.length > 0 && (
                  <button onClick={clearHistory} className="text-[10px] font-mono text-red-500/70 hover:text-red-400 uppercase tracking-widest transition-all active:scale-95">
                    [ Wipe ]
                  </button>
                )}
              </div>
            </div>
            
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              {history.length === 0 ? (
                <p className="text-[10px] font-mono text-zinc-600 text-center py-8 uppercase tracking-widest">No telemetry found.</p>
              ) : (
                history.map(entry => (
                  <div key={entry.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 transition-colors hover:bg-white/[0.04]">
                    <div className="flex justify-between items-center text-[9px] text-zinc-500 mb-1">
                      <span className="font-mono uppercase tracking-widest">{new Date(entry.date).toLocaleDateString()}</span>
                      <span className="text-[#98A869] font-mono uppercase tracking-widest">{entry.hand}</span>
                    </div>
                    <div className="text-xs text-zinc-400 line-clamp-2 font-light">
                      {entry.diagnostic?.summary || "Legacy data block."}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* SMART DOCK */}
      {appPhase === 'idle' && (
        <div className="absolute bottom-8 left-0 w-full flex flex-col items-center z-20 px-4">
          
          {isSettingsOpen && !isVaultOpen && (
            <div className="mb-6 p-6 w-full max-w-xs bg-[#151613]/95 border border-white/10 rounded-3xl backdrop-blur-xl shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
              <div className="space-y-8">
                
                <div className="space-y-3">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Rhythm</label>
                  <div className="flex justify-between gap-2">
                    {['quarter', 'eighth', 'triplet', 'sixteenth'].map((p) => (
                      <button
                        key={p} onClick={() => setPattern(p)}
                        className={`group relative flex-1 h-10 flex items-center justify-center rounded-xl text-[10px] font-mono transition-all overflow-hidden active:scale-90 ${
                          pattern === p ? 'bg-[#E7FF9E] text-[#0e0f0c]' : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                        }`}
                      >
                        <span className="group-hover:opacity-0 transition-opacity absolute text-lg leading-none -mt-1">
                          {p === 'quarter' ? '·' : p === 'eighth' ? '··' : p === 'triplet' ? '···' : '····'}
                        </span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute font-bold">
                          {p === 'quarter' ? '1/4' : p === 'eighth' ? '1/8' : p === 'triplet' ? '1/3' : '1/16'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Target Tempo</label>
                    <span className="text-xs font-mono text-[#C2D685]">{bpm} BPM</span>
                  </div>
                  <input type="range" min="60" max="180" step="5" value={bpm} onChange={(e) => setBpm(parseInt(e.target.value))}
                    className="w-full accent-[#98A869] bg-zinc-800 rounded-full h-1 appearance-none cursor-pointer"
                  />
                  <div className="w-full flex justify-between px-1">
                    {[60, 90, 120, 150, 180].map(tick => <div key={tick} className="w-[1px] h-1.5 bg-zinc-700" />)}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center p-2 bg-[#151613]/90 rounded-full border border-white/10 shadow-2xl backdrop-blur-xl">
            
            <button onClick={() => { setIsSettingsOpen(!isSettingsOpen); setIsVaultOpen(false); }} className={`p-4 rounded-full transition-all active:scale-90 ${isSettingsOpen ? 'bg-white/10 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8v3h-3v10h-2V10H8V7z" /></svg>
            </button>

            <div className="w-px h-6 bg-white/10 mx-2" />

            {status !== 'calibrated' ? (
              <div className="px-6 py-2 text-xs text-zinc-500 flex items-center gap-2">
                <div className="w-3 h-3 border border-[#535C39] border-t-[#C2D685] rounded-full animate-spin" />
                Hardware Lock
              </div>
            ) : isUnlocked ? (
              <div className="flex gap-2 px-1 animate-in zoom-in-95 duration-200">
                <button onClick={() => triggerStart('LEFT')} className="group flex items-center justify-center h-10 px-4 rounded-full bg-[#E7FF9E] text-[#0e0f0c] font-semibold transition-all hover:px-6 active:scale-95">
                  <span className="group-hover:hidden text-sm">L</span>
                  <span className="hidden group-hover:block text-xs uppercase tracking-wider">Left</span>
                </button>
                <button onClick={() => triggerStart('RIGHT')} className="group flex items-center justify-center h-10 px-4 rounded-full bg-[#E7FF9E] text-[#0e0f0c] font-semibold transition-all hover:px-6 active:scale-95">
                  <span className="group-hover:hidden text-sm">R</span>
                  <span className="hidden group-hover:block text-xs uppercase tracking-wider">Right</span>
                </button>
              </div>
            ) : (
              <div className="px-6 py-1.5 flex items-center gap-3">
                <div className="relative w-4 h-4 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path className="text-zinc-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                    <path className={`${!isShouldersVisible ? 'text-red-500' : 'text-[#C2D685]'} transition-all duration-100 ease-linear`} strokeDasharray={`${alignmentProgress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                  </svg>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">
                  {!isShouldersVisible ? 'Hold Posture' : 'Aligning...'}
                </span>
              </div>
            )}

            <div className="w-px h-6 bg-white/10 mx-2" />

            <button onClick={() => { setIsVaultOpen(!isVaultOpen); setIsSettingsOpen(false); }} className={`p-4 rounded-full transition-all active:scale-90 ${isVaultOpen ? 'bg-white/10 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 14h6m-6 4h6m-6-8h2" /></svg>
            </button>

          </div>
        </div>
      )}
    </div>
  );
}