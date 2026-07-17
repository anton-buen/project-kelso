import React from 'react';
import type { HitData } from '../hooks/useSessionTelemetry';

interface TimingGraphProps {
  sessionData: HitData[];
}

export function TimingGraph({ sessionData }: TimingGraphProps) {
  const MAX_MS = 200;

  return (
    <div className="w-full flex flex-col space-y-6">
      
      {/* LEGEND */}
      <div className="flex justify-between w-full text-[9px] font-mono text-zinc-600 uppercase tracking-widest px-2 whitespace-nowrap">
        <span>[-200ms Rush]</span>
        <span className="text-[#C2D685]/50">[ True Center ]</span>
        <span>[+200ms Drag]</span>
      </div>

      {/* GRAPH CONTAINER */}
      <div className="relative w-full rounded-2xl bg-black/40 border border-white/5 overflow-hidden flex items-center justify-center h-48">
        
        {/* Zero-Axis */}
        <div className="absolute inset-x-0 h-[1px] bg-[#C2D685]/15 z-0" />

        {sessionData.length === 0 ? (
          <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest animate-pulse z-10">
            Awaiting kinetic telemetry...
          </span>
        ) : (
          <div className="absolute inset-0 flex items-center justify-between px-4 z-10">
            {sessionData.map((hit, index) => {
              const percentage = Math.max(-100, Math.min(100, (hit.deltaMs / MAX_MS) * 100));
              const isRushing = hit.deltaMs < 0;

              return (
                <div key={index} className="flex flex-col items-center h-full justify-center group relative w-3 cursor-crosshair">
                  <div 
                    className={`w-1 rounded-full transition-all duration-300 ${
                      isRushing ? 'bg-amber-500/80 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'bg-rose-500/80 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
                    }`}
                    style={{ 
                      height: `${Math.abs(percentage)}%`,
                      transform: `translateY(${percentage / 2}%)`
                    }}
                  />
                  {/* Micro-hover tooltips */}
                  <span className="absolute bottom-4 opacity-0 group-hover:opacity-100 transition-opacity bg-[#11120f] border border-zinc-800 text-[10px] font-mono text-zinc-300 px-2 py-1 rounded shadow-xl z-20 pointer-events-none whitespace-nowrap">
                    {hit.deltaMs > 0 ? '+' : ''}{Math.round(hit.deltaMs)}ms
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}