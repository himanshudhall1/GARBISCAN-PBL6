"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Map as MapIcon,
  Video,
  Server,
  ShieldAlert,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { DEMO_LOCATIONS, DEMO_HISTORY, DEMO_SUMMARY } from "@/lib/demoData";
import type {
  DashboardMetrics,
  HistoryMap,
  IntersectionZone,
  SummaryMap,
} from "@/lib/metrics";
import type { NormRoi } from "@/components/FeedWithRoi";
import { DEFAULT_ZONE_CONFIG, type ZoneConfigMap } from "@/lib/zoneConfig";
import {
  buildSummaryFromIntersection,
  clampPct,
  zoneIntersectionPct,
} from "@/lib/zoneMetrics";

const MapComponent = dynamic(() => import("@/components/Map"), { ssr: false });
const AnalyticsCharts = dynamic(() => import("@/components/AnalyticsCharts"), {
  ssr: false,
});
const FeedWithRoi = dynamic(() => import("@/components/FeedWithRoi"), { ssr: false });
const ZoneSelector = dynamic(() => import("@/components/ZoneSelector"), { ssr: false });
const SelectableMap = dynamic(() => import("@/components/SelectableMap"), { ssr: false });

const API_BASE = "http://localhost:8000";

function sanitizeIntersection(
  ix: Record<string, IntersectionZone>
): Record<string, IntersectionZone> {
  return Object.fromEntries(
    Object.entries(ix).map(([k, v]) => {
      const pct = zoneIntersectionPct(v);
      return [
        k,
        {
          ...v,
          intersection_pct_zone: pct,
          fill_level_percent: pct,
          intersection_pct_garbage: clampPct(v.intersection_pct_garbage),
        },
      ];
    })
  );
}

type LocationRow = {
  name: string;
  lat: number;
  lon: number;
  video?: string;
  video_file?: string;
};

function videoFileName(loc?: LocationRow): string {
  if (loc?.video_file) return loc.video_file;
  if (loc?.video) {
    const parts = loc.video.split(/[/\\]/);
    return parts[parts.length - 1] || "hostel.mp4";
  }
  return "hostel.mp4";
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("Home");
  const [locations, setLocations] = useState<LocationRow[]>(DEMO_LOCATIONS);
  const [history, setHistory] = useState<HistoryMap>(DEMO_HISTORY);
  const [summary, setSummary] = useState<SummaryMap>(DEMO_SUMMARY);
  const [intersection, setIntersection] = useState<Record<string, IntersectionZone>>({});
  const [thresholdsByZone, setThresholdsByZone] = useState<Record<string, number>>({});
  const [csvMeta, setCsvMeta] = useState({ row_count: 0, last_updated: "", source: "memory" });
  const [apiOnline, setApiOnline] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("Main Gate");
  const [threshold, setThreshold] = useState(80);
  const [zoneConfig, setZoneConfig] = useState<ZoneConfigMap>(DEFAULT_ZONE_CONFIG);
  const [editRoiMode, setEditRoiMode] = useState(false);
  const [roiDraft, setRoiDraft] = useState<NormRoi | null>(null);
  const [logs, setLogs] = useState<string[]>([
    "[SYS] GARBISCAN dashboard ready.",
  ]);

  const pushLog = (line: string) => {
    setLogs((prev) => [line, ...prev].slice(0, 8));
  };

  const applyDashboardMetrics = useCallback((metrics: DashboardMetrics) => {
    setHistory(metrics.history);
    const ix = sanitizeIntersection(metrics.intersection ?? {});
    setIntersection(ix);
    setSummary(buildSummaryFromIntersection(ix));
    setThresholdsByZone(metrics.thresholds);
    setCsvMeta({
      row_count: metrics.row_count,
      last_updated: metrics.last_updated ?? "",
      source: metrics.source,
    });
  }, []);

  const loadZoneConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/zone-config`, { cache: "no-store" });
      if (!res.ok) return;
      const data: ZoneConfigMap = await res.json();
      setZoneConfig({ ...DEFAULT_ZONE_CONFIG, ...data });
    } catch {
      /* keep defaults */
    }
  }, []);

  const refreshFromApi = useCallback(async () => {
    try {
      const health = await fetch(`${API_BASE}/health`, { cache: "no-store" });
      if (!health.ok) throw new Error("health failed");

      const [locRes, dashRes] = await Promise.all([
        fetch(`${API_BASE}/locations`, { cache: "no-store" }),
        fetch(`${API_BASE}/analytics/dashboard`, { cache: "no-store" }),
      ]);

      if (!locRes.ok || !dashRes.ok) throw new Error("api failed");

      const locs = await locRes.json();
      const metrics: DashboardMetrics = await dashRes.json();

      setLocations(locs);
      applyDashboardMetrics(metrics);
      await loadZoneConfig();
      setApiOnline(true);
      return true;
    } catch {
      setApiOnline(false);
      return false;
    }
  }, [applyDashboardMetrics, loadZoneConfig]);

  useEffect(() => {
    refreshFromApi().then((ok) => {
      pushLog(
        ok
          ? "[CSV] Dashboard synced from live_metrics.csv"
          : "[API] Offline — demo data + video loop."
      );
    });
    const interval = setInterval(refreshFromApi, 10000);
    return () => clearInterval(interval);
  }, [refreshFromApi]);

  // Live poll: every YOLO frame updates memory — UI syncs ~1×/sec
  useEffect(() => {
    if (!apiOnline) return;

    const pollLive = async () => {
      try {
        const res = await fetch(`${API_BASE}/analytics/live`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        const ix = sanitizeIntersection(data.intersection ?? {});
        setIntersection(ix);
        setSummary(buildSummaryFromIntersection(ix));
        if (data.history) setHistory(data.history);
        if (data.thresholds) setThresholdsByZone(data.thresholds);
      } catch {
        /* ignore transient errors */
      }
    };

    pollLive();
    const id = setInterval(pollLive, 1000);
    return () => clearInterval(id);
  }, [apiOnline]);

  useEffect(() => {
    const cfg = zoneConfig[selectedLocation];
    if (cfg?.max_threshold != null) setThreshold(cfg.max_threshold);
    else if (thresholdsByZone[selectedLocation] != null) {
      setThreshold(thresholdsByZone[selectedLocation]);
    }
    setRoiDraft(null);
    setEditRoiMode(false);
  }, [selectedLocation, zoneConfig, thresholdsByZone]);

  const currentRoi: NormRoi =
    roiDraft ?? zoneConfig[selectedLocation]?.roi ?? DEFAULT_ZONE_CONFIG["Main Gate"].roi;

  const handleSaveZoneSettings = async (roiOverride?: NormRoi) => {
    const roi = roiOverride ?? roiDraft ?? currentRoi;
    const body = { roi, max_threshold: threshold };
    try {
      const res = await fetch(
        `${API_BASE}/api/zone-config/${encodeURIComponent(selectedLocation)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) throw new Error("save failed");
      const data = await res.json();
      setZoneConfig((prev) => ({
        ...prev,
        [selectedLocation]: data.config,
      }));
      setThresholdsByZone((prev) => ({
        ...prev,
        [selectedLocation]: threshold,
      }));
      setRoiDraft(null);
      setEditRoiMode(false);
      pushLog(`[CFG] ${selectedLocation}: area + max threshold ${threshold}% saved`);
    } catch {
      pushLog("[CFG] Save failed — is backend running?");
    }
  };

  const selectedLoc = useMemo(
    () => locations.find((l) => l.name === selectedLocation),
    [locations, selectedLocation]
  );

  const videoFile = videoFileName(selectedLoc);
  const fallbackVideoUrl = `${API_BASE}/videos/${videoFile}`;
  const streamUrl = useMemo(() => {
    if (!apiOnline) return "";
    const source = selectedLoc?.video || videoFile;
    return `${API_BASE}/video_feed?source=${encodeURIComponent(source)}&location=${encodeURIComponent(selectedLocation)}`;
  }, [apiOnline, selectedLoc, videoFile, selectedLocation]);

  const handleSelectZone = (zone: string) => {
    setSelectedLocation(zone);
    const ix = intersection[zone];
    if (ix) {
      pushLog(
        `[IX] ${zone}: ${zoneIntersectionPct(ix).toFixed(1)}% · ${ix.intersection_px}px overlap`
      );
    } else {
      pushLog(`[ZONE] Area selected: ${zone}`);
    }
  };

  const handleSaveThreshold = () => handleSaveZoneSettings();

  const zones =
    Object.keys(intersection).length > 0
      ? Object.keys(intersection)
      : Object.keys(DEMO_SUMMARY);
  const zoneThreshold = (zone: string) => thresholdsByZone[zone] ?? threshold;
  const selectedIx = intersection[selectedLocation];
  const fillLevel = zoneIntersectionPct(selectedIx);

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-[#e0e0e0] font-sans selection:bg-[#ff6600] selection:text-white">
      <header className="bg-[#1a1a1a] text-[#ff6600] border-b border-[#333] p-4 flex flex-wrap gap-4 justify-between items-center shadow-md">
        <h1 className="text-2xl md:text-3xl font-bold tracking-[0.15em] flex items-center">
          <ShieldAlert className="mr-3 text-[#ff6600]" /> GARBISCAN
        </h1>
        <nav className="flex space-x-6 text-sm uppercase tracking-widest font-semibold">
          <button
            onClick={() => setActiveTab("Home")}
            className={`hover:text-white transition-colors ${activeTab === "Home" ? "text-white border-b border-[#ff6600] pb-1" : ""}`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("Map Feed")}
            className={`hover:text-white transition-colors ${activeTab === "Map Feed" ? "text-white border-b border-[#ff6600] pb-1" : ""}`}
          >
            Command Center
          </button>
        </nav>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-mono px-2 py-1 rounded border ${
              apiOnline
                ? "border-green-600 text-green-400"
                : "border-[#ff6600] text-[#ff6600]"
            }`}
          >
            {apiOnline ? "ALL ZONES LIVE" : "VIDEO LOOP"}
          </span>
          <div className="bg-[#ff6600] text-black px-3 py-1 rounded-sm font-bold tracking-widest text-xs uppercase">
            CHITKARA
          </div>
        </div>
      </header>

      <main className="p-6 max-w-[1400px] mx-auto">
        {activeTab === "Home" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-xl font-bold text-[#ff6600] uppercase tracking-wider">
                Live Analytics Overview
              </h2>
              {csvMeta.last_updated && (
                <p className="text-[10px] font-mono text-gray-500">
                  CSV · {csvMeta.row_count} rows · updated {csvMeta.last_updated}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {zones.map((zone) => {
                const val = zoneIntersectionPct(intersection[zone]);
                const high = val > zoneThreshold(zone);
                return (
                  <div
                    key={zone}
                    className="bg-[#141414] border border-[#333] rounded-lg p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-widest">{zone}</p>
                      <p
                        className={`text-2xl font-bold font-mono ${high ? "text-red-500" : "text-[#00ffcc]"}`}
                      >
                        {val.toFixed(1)}%
                      </p>
                    </div>
                    {high ? (
                      <AlertTriangle className="text-red-500 w-8 h-8" />
                    ) : (
                      <Activity className="text-[#00ffcc] w-8 h-8" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#141414] border border-[#333] p-5 rounded-lg shadow-xl h-[350px] flex flex-col">
                <h3 className="font-semibold mb-3 text-sm text-gray-400 uppercase tracking-widest flex items-center">
                  <MapIcon className="w-4 h-4 mr-2 text-[#ff6600]" /> Area Sector Map
                </h3>
                <div className="flex-1 min-h-[240px] rounded-md overflow-hidden ring-1 ring-white/10">
                  <MapComponent locations={locations} />
                </div>
              </div>
              <AnalyticsCharts history={history} summary={summary} />
            </div>
          </div>
        )}

        {activeTab === "Map Feed" && (
          <div className="flex flex-col xl:flex-row gap-6">
            <div className="w-full xl:w-80 flex-shrink-0">
              <div className="bg-[#141414] border border-[#333] p-6 rounded-lg shadow-2xl">
                <h3 className="text-xl font-bold mb-5 flex items-center text-[#ff6600] uppercase tracking-widest">
                  <Server className="w-5 h-5 mr-3" /> Terminal
                </h3>

                <div className="space-y-5">
                  <ZoneSelector
                    zones={zones}
                    selected={selectedLocation}
                    intersection={intersection}
                    thresholdFor={zoneThreshold}
                    onSelect={handleSelectZone}
                  />

                  <div className="space-y-3">
                    <label className="text-xs uppercase text-gray-400 block">
                      Max threshold — alert above {threshold}%
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                      className="w-full accent-[#ff6600]"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={threshold}
                        onChange={(e) =>
                          setThreshold(Math.min(100, Math.max(1, Number(e.target.value))))
                        }
                        className="flex-1 bg-[#1a1a1a] text-white border border-[#333] p-2 rounded text-center font-mono text-sm"
                      />
                      <span className="text-gray-500 self-center text-sm">%</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setEditRoiMode((v) => !v)}
                      className={`w-full py-2.5 rounded text-xs font-bold uppercase tracking-wider border ${
                        editRoiMode
                          ? "bg-[#ffb400]/20 border-[#ffb400] text-[#ffb400]"
                          : "bg-[#1a1a1a] border-[#333] text-gray-300 hover:border-[#ff6600]"
                      }`}
                    >
                      {editRoiMode ? "Done drawing" : "Edit selected area"}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveZoneSettings}
                      className="w-full py-2.5 rounded text-xs font-bold uppercase bg-[#ff6600] text-black hover:bg-[#ff8833]"
                    >
                      Save area + threshold
                    </button>
                  </div>

                  <div className="p-4 border border-[#333] bg-[#0d0d0d] rounded space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400 uppercase">Zone ∩ Garbage</span>
                      <span
                        className={`font-mono font-bold text-lg ${fillLevel > zoneThreshold(selectedLocation) ? "text-red-500" : "text-[#00ffcc]"}`}
                      >
                        {fillLevel.toFixed(1)}%
                      </span>
                    </div>
                    {selectedIx ? (
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-gray-400">
                        <div className="bg-[#141414] p-2 rounded border border-[#222]">
                          <div className="text-gray-500">Selected area</div>
                          <div className="text-white">
                            {selectedIx.selected_area_px.toLocaleString()} px
                          </div>
                        </div>
                        <div className="bg-[#141414] p-2 rounded border border-[#222]">
                          <div className="text-gray-500">Garbage area</div>
                          <div className="text-green-400">
                            {selectedIx.garbage_area_px.toLocaleString()} px
                          </div>
                        </div>
                        <div className="bg-[#141414] p-2 rounded border border-[#ff6600]/40 col-span-2">
                          <div className="text-[#ff6600]">Zone ∩ garbage (live)</div>
                          <div className="text-white text-lg font-bold mt-0.5">
                            {fillLevel.toFixed(1)}%
                          </div>
                          <div className="text-gray-500 mt-1">
                            {selectedIx.intersection_px.toLocaleString()} px overlap ·{" "}
                            {selectedIx.intersection_pct_garbage.toFixed(1)}% of garbage bins
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-500">
                        Start live feed to compute zone ∩ garbage overlap.
                      </p>
                    )}
                  </div>

                  <p className="text-[10px] text-gray-500 font-mono">
                    {csvMeta.last_updated
                      ? `CSV live · ${csvMeta.row_count} rows · ${csvMeta.last_updated}`
                      : "CSV: capstone/data/live_metrics.csv (every 30s)"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-4 min-w-0">
              <div className="bg-[#141414] border border-[#333] p-4 rounded-lg h-[200px] sm:h-[220px] flex flex-col">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-1">
                  <MapIcon className="w-3 h-3 text-[#ff6600]" />
                  Tap a pin or pick a zone — map syncs with feed
                </p>
                <div className="flex-1 min-h-0 rounded-md overflow-hidden ring-1 ring-[#ff6600]/30">
                  <SelectableMap
                    locations={locations}
                    selected={selectedLocation}
                    summary={buildSummaryFromIntersection(intersection)}
                    onSelect={handleSelectZone}
                  />
                </div>
              </div>

              <div className="bg-[#141414] border border-[#333] p-6 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-white uppercase tracking-widest flex items-center">
                    <Video className="w-5 h-5 mr-2 text-[#ff6600]" />
                    Live Feed — {selectedLocation}
                  </h2>
                  <span className="text-xs font-mono text-red-500 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    {apiOnline ? "YOLO DETECTING" : "LOOP PLAYBACK"}
                  </span>
                </div>

                <div className="w-full aspect-video border border-[#333] rounded-lg overflow-hidden bg-black">
                  <FeedWithRoi
                    key={selectedLocation}
                    location={selectedLocation}
                    apiOnline={apiOnline}
                    streamUrl={streamUrl}
                    fallbackVideoUrl={fallbackVideoUrl}
                    roi={currentRoi}
                    editMode={editRoiMode}
                    onRoiDraft={setRoiDraft}
                    onSaveRoi={(roi) => {
                      setRoiDraft(roi);
                      void handleSaveZoneSettings(roi);
                    }}
                  />
                </div>
              </div>

              <div className="bg-[#0a0a0a] border border-[#222] p-4 rounded-lg font-mono text-xs text-gray-400 space-y-1 max-h-36 overflow-y-auto">
                {logs.map((line, i) => (
                  <div key={i} className={i === 0 ? "text-[#00ffcc]" : ""}>
                    {line}
                  </div>
                ))}
                <div>
                  [ZONE] {selectedLocation} @ {fillLevel.toFixed(1)}% · video: {videoFile}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
