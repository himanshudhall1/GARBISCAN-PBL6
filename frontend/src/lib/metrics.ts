export type HistoryMap = Record<string, { time: string; level: number }[]>;
export type SummaryMap = Record<string, number>;

export type IntersectionZone = {
  location: string;
  selected_area_px: number;
  garbage_area_px: number;
  intersection_px: number;
  intersection_pct_zone: number;
  intersection_pct_garbage: number;
  fill_level_percent: number;
  timestamp?: string;
};

export type DashboardMetrics = {
  history: HistoryMap;
  summary: SummaryMap;
  thresholds: Record<string, number>;
  intersection: Record<string, IntersectionZone>;
  row_count: number;
  last_updated?: string;
  source: "csv" | "memory";
};
