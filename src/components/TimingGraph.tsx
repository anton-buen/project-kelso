import type { HitData } from '../hooks/useSessionTelemetry';

interface TimingGraphProps {
  sessionData: HitData[];
}

export function TimingGraph({ sessionData }: TimingGraphProps) {
  const MAX_MS = 200;
  
  return (
    <div className="w-full space-y-4">
      <div className="flex justify-between text-[10px] font-mono text-zinc-500 uppercase tracking-widest px-2">
        <span>[ -{MAX_MS}ms Rushing ]</span>
        <span className="text-[#C2D685] font-bold shadow-sm">[ Perfect Tempo ]</span>
        <span>[ +{MAX_MS}ms Dragging ]</span>
      </div>

      {/* Subtle Bias Gradient Background */}
      <div className="relative w-full h-24 bg-[#0a0a09] border border-[#535C39]/30 rounded-xl overflow-hidden shadow-inner bg-[linear-gradient(90deg,rgba(255,255,255,0.01)_0%,rgba(194,214,133,0.04)_50%,rgba(255,255,255,0.01)_100%)]">
        
        {/* Highly Visible Perfect Tempo Center Line */}
        <div className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-[#C2D685] shadow-[0_0_12px_rgba(194,214,133,0.8)] -translate-x-1/2 z-10" />
        
        {/* Strike Plotting - Razor Thin Lines */}
        {sessionData.map((hit, i) => {
          let delta = hit.deltaMs;
          if (delta > MAX_MS) delta = MAX_MS;
          if (delta < -MAX_MS) delta = -MAX_MS;
          
          const leftPos = 50 + (delta / MAX_MS) * 50;
          
          return (
            <div 
              key={i}
              className="absolute top-0 bottom-0 w-px bg-[#E7FF9E] mix-blend-screen transition-all duration-300 z-20"
              style={{ 
                left: `${leftPos}%`,
                opacity: Math.max(0.15, 1 - (hit.tensionScore / 100)),
                boxShadow: '0 0 4px rgba(194, 214, 133, 0.3)'
              }}
            />
          );
        })}
      </div>
      <p className="text-center text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
        Visual Density Map: Thin clusters show neuro-motor consistency
      </p>
    </div>
  );
}