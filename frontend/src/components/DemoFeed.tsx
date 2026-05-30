"use client";

type Props = {
  location: string;
  fillLevel: number;
  threshold: number;
};

export default function DemoFeed({ location, fillLevel, threshold }: Props) {
  const alert = fillLevel > threshold;

  return (
    <div className="relative w-full h-full min-h-[280px] bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#1a1208] overflow-hidden">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,102,0,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,102,0,0.15) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,102,0,0.12),transparent_55%)]" />

      <div className="absolute top-[18%] left-[12%] w-28 h-20 border-2 border-[#00ffcc] rounded-sm shadow-[0_0_12px_rgba(0,255,204,0.4)]">
        <span className="absolute -top-5 left-0 text-[10px] font-mono text-[#00ffcc]">BIN-A</span>
      </div>
      <div className="absolute top-[42%] right-[18%] w-32 h-24 border-2 border-[#ff6600] rounded-sm shadow-[0_0_12px_rgba(255,102,0,0.45)]">
        <span className="absolute -top-5 left-0 text-[10px] font-mono text-[#ff6600]">BIN-B</span>
      </div>
      <div className="absolute bottom-[22%] left-[38%] w-24 h-16 border-2 border-[#ff0055] rounded-sm opacity-80">
        <span className="absolute -top-5 left-0 text-[10px] font-mono text-[#ff0055]">BIN-C</span>
      </div>

      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
        <div className="font-mono text-xs text-[#00ffcc] space-y-0.5">
          <div>ZONE: {location.toUpperCase()}</div>
          <div>FILL: {fillLevel.toFixed(1)}%</div>
          <div>MODEL: YOLOv8 · DEMO</div>
        </div>
        <div
          className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-widest ${
            alert ? "bg-red-600/90 text-white" : "bg-green-700/90 text-white"
          }`}
        >
          {alert ? "Threshold exceeded" : "Normal"}
        </div>
      </div>

      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#ff6600] to-transparent animate-pulse" />
    </div>
  );
}
