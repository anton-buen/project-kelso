import type { HitData } from '../hooks/useSessionTelemetry';

interface TimingGraphProps {
  sessionData: HitData[];
}

export function TimingGraph({ sessionData }: TimingGraphProps) {
  if (sessionData.length === 0) return null;

  // We map the visual error limits from -200ms (Left / Rushing) to +200ms (Right / Dragging)
  const LIMIT = 200;

  return (
    <div className="w-full mt-6 space-y-3 z-20">
      <div className="flex justify-between text-[10px] font-mono text-neutral-500 tracking-wider">
        <span>[ -200ms RUSHING ]</span>
        <span className="text-emerald-500 font-bold">[ PERFECT TEMPO ]</span>
        <span>[ +200ms DRAGGING ]</span>
      </div>

      {/* THE GRAPH CONTAINER */}
      <div className="relative w-full h-24 bg-neutral-950 border border-neutral-800/60 rounded overflow-hidden shadow-inner">
        
        {/* CENTER AXIS: Dotted target beat */}
        <div className="absolute top-0 bottom-0 left-1/2 w-[1px] border-l border-dashed border-emerald-500/40 z-10" />

        {/* DOUBLE EXPOSURE PLOTS */}
        {sessionData.map((hit, index) => {
          // Calculate percentage position along the timeline
          // Clamp values to our -200ms to +200ms window
          const clampedDelta = Math.max(-LIMIT, Math.min(LIMIT, hit.deltaMs));
          const positionPercent = 50 + (clampedDelta / LIMIT) * 50;

          return (
            <div
              key={index}
              className="absolute top-0 bottom-0 w-[2px] bg-emerald-400 transition-opacity duration-1000"
              style={{
                left: `${positionPercent}%`,
                // Every individual stroke is highly translucent (opacity: 0.15).
                // When they cluster together, the opacities stack up to create a bright "exposure" glow.
                opacity: 0.15, 
                boxShadow: '0 0 6px rgba(52, 211, 153, 0.4)'
              }}
            />
          );
        })}
      </div>

      <p className="text-[9px] font-mono text-neutral-600 text-center uppercase tracking-[0.2em] pt-1">
        Visual Density Map: Bright clusters show your neuro-motor consistency
      </p>
    </div>
  );
}