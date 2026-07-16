import type { HitData } from '../hooks/useSessionTelemetry';

interface TimingGraphProps {
  sessionData: HitData[];
}

export function TimingGraph({ sessionData }: TimingGraphProps) {
  // Filter out any wild outliers for the visual scale
  const MAX_MS = 200;
  
  return (
    <div className="w-full space-y-4">
      <div className="flex justify-between text-[10px] font-mono text-zinc-500 uppercase tracking-widest px-2">
        <span>[ -{MAX_MS}ms Rushing ]</span>
        <span className="text-[#C2D685]">[ Perfect Tempo ]</span>
        <span>[ +{MAX_MS}ms Dragging ]</span>
      </div>

      <div className="relative w-full h-24 bg-[#11120f] border border-[#535C39]/30 rounded-xl overflow-hidden shadow-inner">
        {/* Center Target Line */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px border-l border-dashed border-[#535C39]/80 -translate-x-1/2 z-0" />
        
        {/* Strike Plotting */}
        {sessionData.map((hit, i) => {
          // Clamp the visual mapping between -200 and +200
          let delta = hit.deltaMs;
          if (delta > MAX_MS) delta = MAX_MS;
          if (delta < -MAX_MS) delta = -MAX_MS;
          
          // Map to 0% - 100% width
          const leftPos = 50 + (delta / MAX_MS) * 50;
          
          return (
            <div 
              key={i}
              className="absolute top-0 bottom-0 w-[2px] bg-[#C2D685] mix-blend-screen transition-all duration-300"
              style={{ 
                left: `${leftPos}%`,
                opacity: Math.max(0.2, 1 - (hit.tensionScore / 100)), // Higher tension = more transparent/faded
                boxShadow: '0 0 8px rgba(194, 214, 133, 0.4)'
              }}
            />
          );
        })}
      </div>
      <p className="text-center text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
        Visual Density Map: Bright clusters show neuro-motor consistency
      </p>
    </div>
  );
}