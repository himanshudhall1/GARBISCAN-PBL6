"use client";

import { AlertTriangle, MapPin, CheckCircle2 } from "lucide-react";
import type { IntersectionZone } from "@/lib/metrics";
import { zoneIntersectionPct } from "@/lib/zoneMetrics";

export type ZoneMeta = {
  name: string;
  tagline: string;
  accent: string;
};

export const ZONE_META: ZoneMeta[] = [
  { name: "Main Gate", tagline: "Campus entry · Cam A", accent: "#00ffcc" },
  { name: "Hostel Block", tagline: "Residential · Cam B", accent: "#ff6600" },
  { name: "Cafeteria", tagline: "Food court · Cam C", accent: "#ff0055" },
];

type Props = {
  zones: string[];
  selected: string;
  intersection: Record<string, IntersectionZone>;
  thresholdFor: (zone: string) => number;
  onSelect: (zone: string) => void;
};

export default function ZoneSelector({
  zones,
  selected,
  intersection,
  thresholdFor,
  onSelect,
}: Props) {
  return (
    <div className="space-y-2">
      <label className="text-xs uppercase tracking-widest text-gray-400 flex items-center gap-2">
        <MapPin className="w-3.5 h-3.5 text-[#ff6600]" />
        Select surveillance area
      </label>
      <div className="grid grid-cols-1 gap-2">
        {zones.map((zone) => {
          const meta = ZONE_META.find((z) => z.name === zone);
          const ix = intersection[zone];
          const pct = zoneIntersectionPct(ix);
          const limit = thresholdFor(zone);
          const alert = pct > limit;
          const isSelected = selected === zone;

          return (
            <button
              key={zone}
              type="button"
              onClick={() => onSelect(zone)}
              className={`relative w-full text-left p-3.5 rounded-lg border transition-all duration-200 ${
                isSelected
                  ? "border-[#ff6600] bg-[#ff6600]/10 shadow-[0_0_20px_rgba(255,102,0,0.15)]"
                  : "border-[#333] bg-[#1a1a1a] hover:border-gray-500 hover:bg-[#222]"
              }`}
            >
              {isSelected && (
                <span className="absolute top-2 right-2 text-[#ff6600]">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              )}
              <div className="flex items-start gap-3">
                <div
                  className="w-1.5 self-stretch rounded-full shrink-0"
                  style={{ backgroundColor: meta?.accent ?? "#ff6600" }}
                />
                <div className="flex-1 min-w-0 pr-6">
                  <p
                    className={`font-bold text-sm uppercase tracking-wide ${
                      isSelected ? "text-[#ff6600]" : "text-white"
                    }`}
                  >
                    {zone}
                  </p>
                  {ix ? (
                    <p className="text-[10px] text-gray-500 mt-0.5 font-mono">
                      overlap {ix.intersection_px.toLocaleString()} px · garbage{" "}
                      {ix.intersection_pct_garbage.toFixed(1)}% of bins
                    </p>
                  ) : (
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {meta?.tagline ?? "Waiting for feed…"}
                    </p>
                  )}
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[9px] uppercase text-gray-500 tracking-wider">
                        Zone ∩ garbage
                      </p>
                      <p
                        className={`font-mono text-2xl font-bold leading-none mt-0.5 ${
                          alert ? "text-red-500" : "text-[#00ffcc]"
                        }`}
                      >
                        {pct.toFixed(1)}%
                      </p>
                    </div>
                    {alert ? (
                      <span className="flex items-center gap-1 text-[10px] text-red-400 uppercase shrink-0">
                        <AlertTriangle className="w-3 h-3" /> Alert
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-500 uppercase shrink-0">
                        Normal
                      </span>
                    )}
                  </div>
                  <div className="mt-2 h-1.5 bg-[#0d0d0d] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: alert ? "#ef4444" : meta?.accent ?? "#00ffcc",
                      }}
                    />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
