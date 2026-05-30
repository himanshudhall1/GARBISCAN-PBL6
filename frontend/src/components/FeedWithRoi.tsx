"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Crosshair, RotateCcw, Save } from "lucide-react";
import LiveStream from "./LiveStream";

export type NormRoi = [number, number, number, number];

type Props = {
  location: string;
  apiOnline: boolean;
  streamUrl: string;
  fallbackVideoUrl: string;
  roi: NormRoi;
  editMode: boolean;
  onRoiDraft: (roi: NormRoi) => void;
  onSaveRoi: (roi: NormRoi) => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): NormRoi {
  let a = clamp(Math.min(x1, x2), 0, 1);
  let b = clamp(Math.min(y1, y2), 0, 1);
  let c = clamp(Math.max(x1, x2), 0, 1);
  let d = clamp(Math.max(y1, y2), 0, 1);
  if (c - a < 0.05) c = Math.min(1, a + 0.05);
  if (d - b < 0.05) d = Math.min(1, b + 0.05);
  return [a, b, c, d];
}

function roiStyle(roi: NormRoi): React.CSSProperties {
  const [x1, y1, x2, y2] = roi;
  return {
    left: `${x1 * 100}%`,
    top: `${y1 * 100}%`,
    width: `${(x2 - x1) * 100}%`,
    height: `${(y2 - y1) * 100}%`,
  };
}

export default function FeedWithRoi({
  location,
  apiOnline,
  streamUrl,
  fallbackVideoUrl,
  roi,
  editMode,
  onRoiDraft,
  onSaveRoi,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<NormRoi | null>(null);

  useEffect(() => {
    setDraft(null);
    setDrawing(false);
    setStart(null);
  }, [location]);

  const displayRoi = draft ?? roi;

  const pointerToNorm = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: clamp((clientX - rect.left) / rect.width, 0, 1),
      y: clamp((clientY - rect.top) / rect.height, 0, 1),
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!editMode) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = pointerToNorm(e.clientX, e.clientY);
    setStart(p);
    setDrawing(true);
    setDraft([p.x, p.y, p.x, p.y]);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!editMode || !drawing || !start) return;
    const p = pointerToNorm(e.clientX, e.clientY);
    const next = normalizeRect(start.x, start.y, p.x, p.y);
    setDraft(next);
    onRoiDraft(next);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!editMode || !drawing || !start) return;
    const p = pointerToNorm(e.clientX, e.clientY);
    const next = normalizeRect(start.x, start.y, p.x, p.y);
    setDraft(next);
    onRoiDraft(next);
    setDrawing(false);
    setStart(null);
  };

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className={`relative w-full h-full ${editMode ? "cursor-crosshair" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <LiveStream
          apiOnline={apiOnline}
          streamUrl={streamUrl}
          fallbackVideoUrl={fallbackVideoUrl}
          location={location}
        />

        <div
          className="absolute border-2 border-[#ffb400] bg-[#ffb400]/10 pointer-events-none z-10"
          style={roiStyle(displayRoi)}
        >
          <span className="absolute -top-5 left-0 text-[10px] font-mono text-[#ffb400] uppercase tracking-wider bg-black/70 px-1">
            Selected zone
          </span>
        </div>

        {editMode && (
          <div className="absolute inset-0 bg-black/20 z-[5] pointer-events-none" />
        )}
      </div>

      {editMode && (
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-2 z-20">
          <span className="text-[10px] font-mono text-[#ffb400] bg-black/80 px-2 py-1 rounded flex items-center gap-1">
            <Crosshair className="w-3 h-3" /> Drag on video to draw area
          </span>
          {draft && (
            <>
              <button
                type="button"
                onClick={() => onSaveRoi(draft)}
                className="flex items-center gap-1 text-[10px] font-bold uppercase bg-[#ff6600] text-black px-3 py-1 rounded"
              >
                <Save className="w-3 h-3" /> Save area
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(null);
                  onRoiDraft(roi);
                }}
                className="flex items-center gap-1 text-[10px] uppercase bg-[#333] text-white px-2 py-1 rounded"
              >
                <RotateCcw className="w-3 h-3" /> Undo
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
