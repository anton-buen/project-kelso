import { useEffect, useState, useRef } from 'react';
import { useHardwareTelemetry } from './hooks/useHardwareTelemetry';
import { useAudioEngine } from './hooks/useAudioEngine';
import type { RhythmPattern } from './hooks/useAudioEngine';
import { useVisionEngine } from './hooks/useVisionEngine';
import { useSessionTelemetry, calculateSessionAggregates } from './hooks/useSessionTelemetry';
import { useDiagnosticAgent } from './hooks/useDiagnosticAgent';
import { useSessionHistory } from './hooks/useSessionHistory';
import { DiagnosticDashboard } from './components/DiagnosticDashboard';

export default function App() {
  const [appPhase, setAppPhase] = useState<'landing' | 'idle' | 'baseline' | 'countdown' | 'active' | 'analyzing' | 'complete'>('landing');
  const [countdownVal, setCountdownVal] = useState(5);
  const [targetHand, setTargetHand] = useState<'LEFT' | 'RIGHT' | null>(null);
  const [baselineY, setBaselineY] = useState<number | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVaultOpen, setIsVaultOpen] = useState(false);

  const [bpm, setBpm] = useState(120);
  const [pattern, setPattern] = useState<RhythmPattern>('quarter');

  const LOADING_REMARKS = [
    "Wiping your webcam...",
    "The brain treats drumming as just muscles and nerves negotiating stability",
    "Warming up the AI...",
    "Muscle tension shrinks your brain’s timing windows. Relax.",
    "Tuning the metronome...",
    "Calibrating acoustics...",
    "Rhythmic drift isn’t just sloppy timing; it’s a non‑linear neural shift",
    "Pre-heating the oven...",
    "Humans have two rhythms: moving limbs together or alternating them.",
    "Still loading...",
    "Almost there, promise...",
    "Speed up alternating hand movements, and your brain flips into a new rhythm",
    "Just a few more seconds...",
    "Right before your rhythm slips at high speed, your body hits 'critical fluctuations'",
    "If you can read this, you're extremely patient..."
  ];

  const [loadingText, setLoadingText] = useState(LOADING_REMARKS[0]);
  const [alignmentProgress, setAlignmentProgress] = useState(0);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isAtLanding, setIsAtLanding] = useState(true);

  const { status, videoRef, audioContextRef, analyserRef, poseLandmarkerRef } = useHardwareTelemetry(appPhase !== 'landing');
  const { isPlaying, toggleEngine } = useAudioEngine(audioContextRef.current, analyserRef.current, bpm, pattern);

  const { tensionLevel, isShouldersVisible, currentShoulderY } = useVisionEngine(
    videoRef, poseLandmarkerRef.current, appPhase === 'active', baselineY, targetHand
  );

  const { sessionData, resetSession } = useSessionTelemetry(isPlaying, tensionLevel);
  const { diagnostic, isAnalyzing, analyzeSession } = useDiagnosticAgent();
  const { history, saveSession, clearHistory } = useSessionHistory();

  const currentYRef = useRef(0);
  useEffect(() => { currentYRef.current = currentShoulderY; }, [currentShoulderY]);

  const triggerRecalibrate = () => {
    setAlignmentProgress(0);
    setIsUnlocked(false);
    if (appPhase !== 'idle') {
      if (isPlaying) toggleEngine();
      setAppPhase('idle');
    }
  };

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

  useEffect(() => {
    let interval: number;
    if (appPhase === 'baseline' || appPhase === 'analyzing') {
      let currentIndex = 0;
      interval = window.setInterval(() => {
        currentIndex = (currentIndex + 1) % LOADING_REMARKS.length;
        setLoadingText(LOADING_REMARKS[currentIndex]);
      }, 2500);
    } else {
      setLoadingText(LOADING_REMARKS[0]);
    }

    return () => clearInterval(interval);
  }, [appPhase]);

  useEffect(() => {
    if (appPhase === 'baseline') {
      const timer = setTimeout(() => {
        setAppPhase('countdown');
        toggleEngine();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [appPhase, toggleEngine]);

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

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.code === 'Enter' && appPhase === 'active') {
        toggleEngine();
        setAppPhase('analyzing');

        const aggregates = calculateSessionAggregates(sessionData, bpm);
        const finalDiag = await analyzeSession(aggregates, targetHand!, bpm, pattern);

        if (finalDiag) saveSession(targetHand!, finalDiag);
        setAppPhase('complete');
      }

      if (e.key === 'Escape') {
        if (['baseline', 'countdown', 'active', 'analyzing'].includes(appPhase)) {
          console.warn("[System] Hardware interlock active. Abort suppressed.");
          return;
        }

        if (isPlaying) toggleEngine();
        setIsAtLanding(true);
        setAppPhase('landing');
        setIsUnlocked(false);
        setAlignmentProgress(0);
        setIsVaultOpen(false);
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appPhase, toggleEngine, analyzeSession, sessionData, targetHand, saveSession, isPlaying, bpm, pattern]);

  const triggerStart = (hand: 'LEFT' | 'RIGHT') => {
    setIsSettingsOpen(false);
    setIsVaultOpen(false);
    setTargetHand(hand);
    resetSession();
    setCountdownVal(5);
    setAppPhase('baseline');
  };

  const getAmbientGlow = () => {
    if (appPhase === 'landing') return 'none';
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

  const keycapBase = "group relative inline-flex items-center justify-center bg-[#11120f] border border-zinc-800/60 border-b-black rounded-xl shadow-[0_3px_0_0_rgba(0,0,0,0.8)] hover:bg-[#151613] hover:border-zinc-700/60 active:translate-y-[3px] active:shadow-none transition-all duration-150 ease-out cursor-pointer";
  const keycapPrimary = "group relative inline-flex items-center justify-center bg-[#C2D685]/10 border border-[#C2D685]/20 border-b-[#C2D685]/5 rounded-xl shadow-[0_3px_0_0_rgba(10,10,10,0.9)] hover:bg-[#C2D685]/20 active:translate-y-[3px] active:shadow-none transition-all duration-150 ease-out text-[#C2D685] cursor-pointer";

  return (
    <div
      className="min-h-screen bg-[#0a0a09] text-zinc-200 flex flex-col items-center justify-between p-6 overflow-hidden relative font-sans selection:bg-[#C2D685]/30 animate-in fade-in duration-1000"
      style={{ boxShadow: getAmbientGlow(), transition: 'box-shadow 0.3s ease-out' }}
    >
      {appPhase !== 'landing' && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover opacity-[0.03] grayscale blur-xl pointer-events-none z-0 -scale-x-100"
          playsInline
          muted
        />
      )}

      <header className="w-full max-w-2xl z-20 flex justify-end items-center h-12">
        {appPhase === 'idle' && !isAtLanding && (
          <div className="flex items-center gap-4 animate-in fade-in duration-500">
            <button
              onClick={triggerRecalibrate}
              className={`${keycapBase} h-9 px-4 min-w-[3rem] overflow-hidden`}
            >
              <span className="group-hover:hidden text-sm font-light leading-none">⟳</span>
              <span className="hidden group-hover:block text-[9px] font-mono uppercase tracking-widest text-zinc-400 whitespace-nowrap">Recalibrate</span>
            </button>
            <button
              onClick={() => {
                setIsAtLanding(true);
                setAppPhase('landing');
                setIsUnlocked(false);
                setAlignmentProgress(0);
              }}
              className={`${keycapBase} h-9 px-4 min-w-[3rem] overflow-hidden`}
            >
              <span className="group-hover:hidden text-[10px] font-mono font-bold text-zinc-500">✕</span>
              <span className="hidden group-hover:block text-[9px] font-mono uppercase tracking-widest text-zinc-400 whitespace-nowrap">ESC</span>
            </button>
          </div>
        )}
      </header>

      <div className="z-10 w-full max-w-2xl flex flex-col items-center justify-center flex-grow transition-all duration-500">

        {appPhase === 'landing' && (
          <div className="w-full flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-700 ease-out space-y-16 mt-[-4rem]">

            <div
              className="absolute inset-0 bg-[url('https://media.giphy.com/media/GeimqsH0TLDt4tScGw/giphy.gif')] bg-cover bg-center opacity-10 pointer-events-none z-0 mix-blend-luminosity scale-140"
              style={{ filter: 'contrast(1.3) brightness(0.6) saturate(0.1)' }}
            />
            <div className="text-center space-y-5">
              <h1 className="text-4xl font-light tracking-tight text-zinc-100">Project Kelso</h1>
              <p className="text-[10px] font-mono text-[#98A869] uppercase tracking-[0.3em]">
                Learning Drums Without Drums!
              </p>
            </div>

            <div className="flex items-center gap-6">
              <a
                href="https://github.com/anton-buen/project-kelso"
                target="_blank"
                rel="noreferrer"
                className={`${keycapBase} h-12 px-6 min-w-[5rem]`}
              >
                <span className="group-hover:hidden text-lg font-light leading-none">{`</>`}</span>
                <span className="hidden group-hover:block text-[10px] font-mono uppercase tracking-widest text-zinc-400">Repo</span>
              </a>

              <button
                onClick={() => {
                  setIsAtLanding(false);
                  setAppPhase('idle');
                }}
                className={`${keycapPrimary} h-14 px-8 min-w-[8rem]`}
              >
                <span className="group-hover:hidden text-xl font-light leading-none">►</span>
                <span className="hidden group-hover:block text-[11px] font-mono font-bold uppercase tracking-[0.2em]">Practice</span>
              </button>

              <a
                href="https://tally.so/r/vGvjNg"
                className={`${keycapBase} h-12 px-6 min-w-[5rem]`}
              >
                <span className="group-hover:hidden text-sm font-mono font-bold">@</span>
                <span className="hidden group-hover:block text-[10px] font-mono uppercase tracking-widest text-zinc-400">Feedback</span>
              </a>
            </div>
          </div>
        )}

        {appPhase === 'idle' && !isVaultOpen && (
          <div className="text-center space-y-2 mb-12 animate-in fade-in duration-500 max-w-sm mx-auto">
            <h1 className="text-xl font-light tracking-tight text-zinc-100 opacity-90">Posture Alignment</h1>
            <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.1em]">
              Please ensure your shoulders are level<br /> 
              and visible within the frame.
            </p>
          </div>
        )}

        {(appPhase === 'baseline' || appPhase === 'analyzing') && (
          <div className="text-center space-y-6">
            <div className="w-8 h-8 border-[1px] border-[#535C39] border-t-[#C2D685] rounded-full animate-spin mx-auto" />
            <p className="text-[10px] font-mono text-[#98A869] uppercase tracking-widest animate-pulse h-4">
              {loadingText}
            </p>
          </div>
        )}

        {appPhase === 'countdown' && (
          <div className="text-center w-full max-w-sm mx-auto animate-in zoom-in-95 duration-300">
            <div className="relative flex flex-col justify-center items-center mx-auto w-64 h-64 rounded-full bg-black/20 border border-[#535C39]/20 backdrop-blur-sm">
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
            <div className={`relative flex flex-col justify-center items-center mx-auto w-64 h-64 rounded-full bg-black/20 border backdrop-blur-sm transition-all duration-500 ease-out ${
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
              Press <kbd className={`${keycapBase} px-2 py-1 mx-1 text-zinc-300 text-[8px]`}>Enter</kbd> to conclude
            </p>
          </div>
        )}

        {appPhase === 'complete' && (
          <DiagnosticDashboard
            data={diagnostic}
            aggregates={calculateSessionAggregates(sessionData, bpm)}
            bpm={bpm}
            pattern={pattern}
            sessionData={sessionData}
            isAnalyzing={isAnalyzing}
            targetHand={targetHand}
            onRetry={async () => {
              const currentAggs = calculateSessionAggregates(sessionData, bpm);
              await analyzeSession(currentAggs, targetHand!, bpm, pattern);
            }}
            onClose={() => {
              sessionStorage.clear();
              setAppPhase('idle');
              setIsUnlocked(false);
              setAlignmentProgress(0);
            }}
          />
        )}

        {isVaultOpen && appPhase === 'idle' && (
          <div className="w-full max-w-sm mx-auto bg-[#11120f]/80 border border-[#535C39]/20 p-6 rounded-[2rem] backdrop-blur-xl text-left animate-in zoom-in-95 duration-200 mt-8">
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
                  <div key={entry.id} className="p-3 rounded-xl bg-[#151613] border border-white/5 transition-colors hover:bg-white/[0.04]">
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

      {appPhase === 'idle' && (
        <div className="absolute bottom-8 left-0 w-full flex flex-col items-center z-20 px-4">

          {isSettingsOpen && !isVaultOpen && (
            <div className="mb-6 p-6 w-full max-w-xs bg-[#11120f]/90 border border-zinc-800/50 rounded-[2rem] backdrop-blur-xl shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
              <div className="space-y-8">

                <div className="space-y-4">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Rhythm</label>
                  <div className="flex justify-between gap-3">
                    {(['quarter', 'eighth', 'triplet', 'sixteenth'] as RhythmPattern[]).map((p) => (
                      <button
                        key={p} onClick={() => setPattern(p)}
                        className={`${keycapBase} flex-1 h-12 ${pattern === p ? '!border-[#C2D685]/30 !text-[#C2D685]' : ''}`}
                      >
                        <span className="group-hover:hidden text-lg leading-none -mt-1">
                          {p === 'quarter' ? '·' : p === 'eighth' ? '··' : p === 'triplet' ? '···' : '····'}
                        </span>
                        <span className="hidden group-hover:block text-[10px] font-mono font-bold">
                          {p === 'quarter' ? '1/4' : p === 'eighth' ? '1/8' : p === 'triplet' ? '1/3' : '1/16'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Tempo</label>
                    <span className="text-[10px] font-mono text-[#C2D685] bg-[#C2D685]/10 px-2 py-1 rounded-md">{bpm} BPM</span>
                  </div>
                  <input type="range" min="60" max="180" step="5" value={bpm} onChange={(e) => setBpm(parseInt(e.target.value))}
                    className="w-full accent-[#C2D685] bg-zinc-800 rounded-full h-1 appearance-none cursor-pointer"
                  />
                  <div className="w-full flex justify-between px-1">
                    {[60, 90, 120, 150, 180].map(tick => <div key={tick} className="w-[1px] h-1.5 bg-zinc-700" />)}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center p-2 bg-[#11120f]/90 rounded-full border border-zinc-800/50 shadow-2xl backdrop-blur-xl">

            <button onClick={() => { setIsSettingsOpen(!isSettingsOpen); setIsVaultOpen(false); }} className={`p-4 rounded-full transition-all active:scale-95 ${isSettingsOpen ? 'bg-white/5 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8v3h-3v10h-2V10H8V7z" /></svg>
            </button>

            <div className="w-px h-6 bg-zinc-800 mx-2" />

            {status !== 'calibrated' ? (
              <div className="px-6 py-2 text-[10px] font-mono text-zinc-500 flex items-center gap-2 uppercase tracking-widest">
                <div className="w-3 h-3 border border-[#535C39] border-t-[#C2D685] rounded-full animate-spin" />
                Hardware Lock
              </div>
            ) : isUnlocked ? (
              <div className="flex gap-3 px-2 animate-in zoom-in-95 duration-200">
                <button onClick={() => triggerStart('LEFT')} className={`${keycapPrimary} h-10 px-4 min-w-[3.5rem]`}>
                  <span className="group-hover:hidden text-sm font-mono font-bold">← L</span>
                  <span className="hidden group-hover:block text-[10px] font-mono uppercase tracking-wider font-bold">Left</span>
                </button>
                <button onClick={() => triggerStart('RIGHT')} className={`${keycapPrimary} h-10 px-4 min-w-[3.5rem]`}>
                  <span className="group-hover:hidden text-sm font-mono font-bold">R →</span>
                  <span className="hidden group-hover:block text-[10px] font-mono uppercase tracking-wider font-bold">Right</span>
                </button>
              </div>
            ) : (
              <div className="px-6 py-1.5 flex items-center gap-3">
                <div className="relative w-4 h-4 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path className="text-zinc-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                    <path className={`${!isShouldersVisible ? 'text-zinc-600' : 'text-[#C2D685]'} transition-all duration-100 ease-linear`} strokeDasharray={`${alignmentProgress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                  </svg>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">
                  {!isShouldersVisible ? 'Hold Posture' : 'Aligning...'}
                </span>
              </div>
            )}

            <div className="w-px h-6 bg-zinc-800 mx-2" />

            <button onClick={() => { setIsVaultOpen(!isVaultOpen); setIsSettingsOpen(false); }} className={`p-4 rounded-full transition-all active:scale-95 ${isVaultOpen ? 'bg-white/5 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 14h6m-6 4h6m-6-8h2" /></svg>
            </button>

          </div>
        </div>
      )}

      {appPhase === 'landing' && (
        <footer className="w-full h-12 flex items-end justify-center pb-4 z-20 gap-4">
          <span className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest">
            v2.0.26 // Production
          </span>
          <span className="text-[9px] font-mono text-zinc-800 uppercase tracking-widest">|</span>
          <a 
            href="https://github.com/anton-buen" 
            target="_blank" 
            rel="noreferrer" 
            className="text-[9px] font-mono text-zinc-600 hover:text-[#C2D685] uppercase tracking-widest transition-colors"
          >
            Built by Anton
          </a>
        </footer>
      )}
    </div>
  );
}
