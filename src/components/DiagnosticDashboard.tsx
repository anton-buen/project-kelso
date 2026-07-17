import React, { useState } from 'react';
import type { DiagnosticPayload } from '../hooks/useDiagnosticAgent';
export type { DiagnosticPayload }; 
import type { SessionAggregates, HitData } from '../hooks/useSessionTelemetry';
import { TimingGraph } from './TimingGraph';

interface DiagnosticDashboardProps {
  data: DiagnosticPayload | null;
  aggregates: SessionAggregates;
  bpm: number;
  pattern: string;
  sessionData: HitData[];
  isAnalyzing: boolean;
  targetHand: 'LEFT' | 'RIGHT' | null; // <-- NEW INTERFACE PROP
  onRetry: () => void;
  onClose: () => void;
}

export function DiagnosticDashboard({ data, aggregates, bpm, pattern, sessionData, isAnalyzing, targetHand, onRetry, onClose }: DiagnosticDashboardProps) {
  const [isMathDrawerOpen, setIsMathDrawerOpen] = useState(false);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);

  // --- DETERMINISTIC TIME SPENT CALCULATION ---
  const firstHit = sessionData[0]?.timestamp || 0;
  const lastHit = sessionData[sessionData.length - 1]?.timestamp || 0;
  const elapsedMs = lastHit > firstHit ? lastHit - firstHit : 0;
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const timeString = `${Math.floor(elapsedSec / 60).toString().padStart(2, '0')}:${(elapsedSec % 60).toString().padStart(2, '0')}`;

  // --- DETERMINISTIC FALLBACK LOGIC ---
  const determineLocalBias = (meanOffset: number) => {
    if (Number.isNaN(meanOffset)) return 'AWAITING DATA';
    if (meanOffset < -50) return 'Strongly Rushing';
    if (meanOffset <= -20) return 'Moderately Rushing';
    if (meanOffset > 50) return 'Strongly Dragging';
    if (meanOffset >= 20) return 'Moderately Dragging';
    return 'Neutral';
  };

  const safeData: DiagnosticPayload = data || {
    exercise: targetHand ? `${targetHand} Hand Routine` : 'Unclassified Routine',
    summary: 'Biomechanical telemetry analysis offline.',
    ce_trend: {
      bias_category: determineLocalBias(aggregates.meanOffsetMs), 
      direction: 'Awaiting synchronous computation.',
      magnitude: `${aggregates.meanOffsetMs > 0 ? '+' : ''}${aggregates.meanOffsetMs.toFixed(1)}ms offset baseline.`,
      temporal_drift: 'Stabilized.'
    },
    kelso_metrics: {
      instability_rating: 'AWAITING DATA',
      fatigue_assessment: 'No kinetic breakdown detected.',
      tension_correlation: 'Muscular framework operating within tolerance.'
    }
  };

  // ... (keep getBiasColorToken and getPatternText) ...
  const getBiasColorToken = (category: string) => {
    if (category.includes('Rushing')) return 'text-amber-500 font-bold';
    if (category.includes('Dragging')) return 'text-rose-500 font-bold';
    if (category === 'AWAITING DATA') return 'text-zinc-600 font-light';
    return 'text-[#C2D685] font-light';
  };

  const getPatternText = (p: string) => {
    switch(p) {
      case 'quarter': return '1/4 Note';
      case 'eighth': return '1/8 Note';
      case 'triplet': return '1/3 Triplet';
      case 'sixteenth': return '1/16 Note';
      default: return 'Standard';
    }
  };

  // TACTILE UI TOKENS
  const keycapBase = "group relative inline-flex items-center justify-center bg-[#11120f] border border-zinc-800/60 border-b-black rounded-xl shadow-[0_3px_0_0_rgba(0,0,0,0.8)] hover:bg-[#151613] hover:border-zinc-700/60 active:translate-y-[3px] active:shadow-none transition-all duration-150 ease-out cursor-pointer select-none";
  const keycapPrimary = "group relative inline-flex items-center justify-center bg-[#C2D685]/10 border border-[#C2D685]/20 border-b-[#C2D685]/5 rounded-xl shadow-[0_3px_0_0_rgba(10,10,10,0.9)] hover:bg-[#C2D685]/20 active:translate-y-[3px] active:shadow-none transition-all duration-150 ease-out text-[#C2D685] cursor-pointer";
  const drawerHeaderBase = "w-full flex items-center justify-between p-4 bg-[#151613]/60 border border-zinc-800/40 rounded-xl cursor-pointer select-none transition-all hover:bg-[#1a1b18] active:translate-y-[1px]";

  return (
    <div className="w-full max-w-2xl mx-auto bg-[#11120f]/80 border border-[#535C39]/20 p-6 md:p-10 rounded-[2rem] backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-500 space-y-8 text-left">
      
      {/* ZONE 1: THE HUD */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-6">
        <div className="space-y-2">
          <span className="text-[10px] font-mono tracking-widest uppercase text-zinc-500">
            Session Diagnostics
          </span>
          <h2 className="text-3xl font-light tracking-tight text-zinc-100 leading-none uppercase">
            {safeData.exercise}
          </h2>
          <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-zinc-500 pt-1">
            <span>{bpm} BPM</span>
            <span className="w-1 h-1 rounded-full bg-zinc-700" />
            <span>{getPatternText(pattern)} Grid</span>
            <span className="w-1 h-1 rounded-full bg-zinc-700" />
            <span className="text-[#98A869]">TIME: {timeString}</span> {/* NEW: TIME SPENT */}
          </div>
        </div>
        
        <div className="flex items-center justify-center px-4 py-2 rounded-xl bg-white/[0.02] border border-white/5 shrink-0 select-none">
          <span className="text-[10px] font-mono tracking-widest text-zinc-400">
            TOTAL STRIKES // {aggregates.totalStrikes}
          </span>
        </div>
      </div>

      {/* ZONE 2: THE KINETIC CANVAS */}
      <div className="space-y-3 pt-2">
        <span className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest pl-1">
          Strike Telemetry Map
        </span>
        <TimingGraph sessionData={sessionData} />
      </div>

      {/* ZONE 3: THE TACTILE DRAWERS */}
      <div className="space-y-4 pt-4 border-t border-white/5">
        
        {/* Drawer A */}
        <div className="space-y-2">
          <button onClick={() => setIsMathDrawerOpen(!isMathDrawerOpen)} className={drawerHeaderBase}>
            <span className="text-[10px] font-mono tracking-widest uppercase text-zinc-300">[=] View Biomechanical Breakdown</span>
            <span className="text-[10px] font-mono text-zinc-500">{isMathDrawerOpen ? '[↑]' : '[↓]'}</span>
          </button>
          
          <div className={`grid transition-all duration-300 ease-in-out ${isMathDrawerOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden">
              <div className="p-4 bg-black/20 border border-zinc-800/30 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-6 font-mono">
                <div className="space-y-4">
                  <span className="block text-[9px] text-zinc-600 tracking-widest uppercase border-b border-zinc-800 pb-1">Rhythmic Mechanics</span>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Mean Offset (CE):</span>
                    <span className="text-xl text-zinc-200 font-medium">{Number.isNaN(aggregates.meanOffsetMs) ? '0' : `${aggregates.meanOffsetMs > 0 ? '+' : ''}${aggregates.meanOffsetMs.toFixed(1)}`}ms</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Instability (SD):</span>
                    <span className="text-xl text-zinc-200 font-medium">{Number.isNaN(aggregates.stdDevMs) ? '0.0' : aggregates.stdDevMs.toFixed(1)}ms</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Normalized CV:</span>
                    <span className="text-xl text-zinc-200 font-medium">{Number.isNaN(aggregates.tempoNormalizedCV) ? '0.00' : aggregates.tempoNormalizedCV.toFixed(2)}%</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <span className="block text-[9px] text-zinc-600 tracking-widest uppercase border-b border-zinc-800 pb-1">Kinetic Rigidity</span>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Avg Tension Load:</span>
                    <span className="text-xl text-zinc-200 font-medium">{Number.isNaN(aggregates.averageTension) ? '0.0' : aggregates.averageTension.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Tension Variance:</span>
                    <span className="text-xl text-zinc-200 font-medium">{Number.isNaN(aggregates.tensionVariance) ? '0.0' : aggregates.tensionVariance.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Fatigue Index:</span>
                    <span className="text-xl text-zinc-200 font-medium">{Number.isNaN(aggregates.driftSlope) ? '0.0000' : aggregates.driftSlope.toFixed(4)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Drawer B */}
        <div className="space-y-2">
          <button onClick={() => setIsAiDrawerOpen(!isAiDrawerOpen)} className={drawerHeaderBase}>
            <span className="text-[10px] font-mono tracking-widest uppercase text-zinc-300">[=] View Synaptic Diagnostics Log</span>
            <span className="text-[10px] font-mono text-zinc-500">{isAiDrawerOpen ? '[↑]' : '[↓]'}</span>
          </button>
          
          <div className={`grid transition-all duration-300 ease-in-out ${isAiDrawerOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden">
              <div className="p-5 bg-black/20 border border-zinc-800/30 rounded-xl space-y-4 text-xs">
                <div className="space-y-1">
                  <span className="block text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Neuro-Motor Summary</span>
                  <p className="text-zinc-400 font-light font-sans leading-relaxed">{safeData.summary}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-800/40">
                  <div className="space-y-1">
                    <span className="block text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Fatigue Assessment</span>
                    <p className="text-zinc-400 font-light font-sans leading-relaxed">{safeData.kelso_metrics.fatigue_assessment}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="block text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Tension Correlation</span>
                    <p className="text-zinc-400 font-light font-sans leading-relaxed">{safeData.kelso_metrics.tension_correlation}</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-zinc-800/40 space-y-1">
                  <span className="block text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Coordination Dynamics Classification</span>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/[0.02] border border-zinc-800 rounded-md font-mono text-[10px] text-zinc-300">
                    STATUS // <span className="text-[#C2D685] font-medium uppercase">{safeData.kelso_metrics.instability_rating}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex flex-col sm:flex-row gap-6 justify-center pt-8 border-t border-white/5">
        
        <button 
          onClick={onRetry}
          disabled={isAnalyzing}
          className={`${keycapPrimary} h-14 px-8 min-w-[10rem] ${isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {/* Symbol state */}
          <span className="group-hover:hidden text-2xl font-light leading-none mb-1">
            {isAnalyzing ? '⋯' : '↻'}
          </span>
          {/* Hover state */}
          <span className="hidden group-hover:block text-[11px] font-mono font-bold uppercase tracking-[0.2em]">
            {isAnalyzing ? 'Fetching' : 'Refresh'}
          </span>
        </button>

        <button onClick={onClose} className={`${keycapBase} h-14 px-8 min-w-[10rem]`}>
          {/* Symbol state */}
          <span className="group-hover:hidden text-xl font-light leading-none text-zinc-500">
            ↵
          </span>
          {/* Hover state */}
          <span className="hidden group-hover:block text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400">
            PRACTICE
          </span>
        </button>
        
      </div>
    </div>
  );
}