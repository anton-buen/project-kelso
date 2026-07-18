import React from 'react';
import type { HitData } from '../hooks/useSessionTelemetry';

interface TimingGraphProps {
  sessionData: HitData[];
}

/**
 * Renders a heatmap-style timing scatter plot.
 *
 * Each strike is drawn as a semi-transparent vertical bar positioned along a
 * horizontal axis spanning [-200 ms, +200 ms]. Bars stack via `mix-blend-screen`
 * to create additive density clusters. The ±20 ms precision pocket is
 * highlighted as a fixed overlay region.
 *
 * Values outside ±200 ms are clamped to the axis edges rather than clipped.
 */
export function TimingGraph({ sessionData }: TimingGraphProps) {
  const MAX_MS = 200;
  const POCKET_MS = 20;

  return (
    <div className="w-full flex flex-col space-y-3 z-20">
      <div className="flex justify-between text-[9px] font-mono text-zinc-600 tracking-widest px-1 select-none uppercase">
        <span>[-200ms Dragging]</span>
        <span className="text-[#C2D685]/80 font-bold">Target Pocket (±20ms)</span>
        <span>[+200ms Rushing]</span>
      </div>

      <div className="relative w-full h-24 bg-[#0a0a09] border border-zinc-800/60 rounded-xl overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
        <div
          className="absolute top-0 bottom-0 bg-[#C2D685]/[0.05] border-x border-[#C2D685]/20 z-0 pointer-events-none"
          style={{
            left: '40%',
            width: '20%'
          }}
        />

        <div className="absolute top-0 bottom-0 left-1/2 w-[1px] border-l border-dashed border-[#C2D685]/40 z-10 pointer-events-none -translate-x-1/2" />

        {sessionData.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest animate-pulse">
              No telemetry to map.
            </span>
          </div>
        ) : (
          <div className="absolute inset-0 z-20 pointer-events-none">
            {sessionData.map((hit, index) => {
              const clampedDelta = Math.max(-MAX_MS, Math.min(MAX_MS, hit.deltaMs));
              const positionPercent = 50 + (clampedDelta / MAX_MS) * 50;
              const isInPocket = Math.abs(hit.deltaMs) <= POCKET_MS;

              let plotColor = 'bg-[#C2D685] shadow-[0_0_6px_rgba(194,214,133,0.4)]';
              if (!isInPocket) {
                plotColor = hit.deltaMs < 0
                  ? 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]'
                  : 'bg-rose-500 shadow-[0_0_6px_rgba(225,29,72,0.4)]';
              }

              return (
                <div
                  key={hit.timestamp || index}
                  className={`absolute top-0 bottom-0 w-[1.5px] ${plotColor} transition-opacity duration-1000 mix-blend-screen`}
                  style={{
                    left: `${positionPercent}%`,
                    opacity: 0.25,
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
