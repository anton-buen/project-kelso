export interface DiagnosticPayload {
  exercise: string;
  summary: string;
  ce_trend: {
    direction: string;
    magnitude: string;
    temporal_drift: string;
  };
}

interface DiagnosticDashboardProps {
  targetHand: 'LEFT' | 'RIGHT';
  data: DiagnosticPayload | null;
}

export function DiagnosticDashboard({ targetHand, data }: DiagnosticDashboardProps) {
  if (!data) return null;

  return (
    <div className="text-left w-full space-y-8 font-sans selection:bg-[#C2D685]/30">
      
      {/* Header Area */}
      <div className="flex justify-between items-end border-b border-white/5 pb-4">
        <div>
          <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Session Analysis</h3>
          <p className="text-lg font-light text-zinc-200">{data.exercise}</p>
        </div>
        <span className="text-[10px] font-mono font-bold bg-white/5 text-zinc-300 px-3 py-1.5 rounded-full uppercase tracking-widest border border-white/10">
          {targetHand} Hand
        </span>
      </div>

      {/* Summary - NOW SCROLLABLE */}
      <div className="space-y-2">
        <h4 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Neuro-Motor Summary</h4>
        <div className="max-h-28 overflow-y-auto pr-3 custom-scrollbar">
          <p className="text-sm text-zinc-300 leading-relaxed font-light">
            {data.summary}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Constant Error (CE) Trend</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl">
            <span className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Direction</span>
            <span className="text-sm text-zinc-200 font-medium">{data.ce_trend.direction}</span>
          </div>
          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl">
            <span className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Magnitude</span>
            <span className="text-sm text-[#C2D685] font-medium">{data.ce_trend.magnitude}</span>
          </div>
          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl">
            <span className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Temporal Drift</span>
            <span className="text-sm text-zinc-200 font-medium">{data.ce_trend.temporal_drift}</span>
          </div>
        </div>
      </div>
    </div>
  );
}