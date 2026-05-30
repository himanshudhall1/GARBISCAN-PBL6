import type { NormRoi } from "@/components/FeedWithRoi";

export type ZoneConfigEntry = {
  roi: NormRoi;
  max_threshold: number;
};

export type ZoneConfigMap = Record<string, ZoneConfigEntry>;

export const DEFAULT_ZONE_CONFIG: ZoneConfigMap = {
  "Main Gate": { roi: [0.05, 0.12, 0.58, 0.88], max_threshold: 80 },
  "Hostel Block": { roi: [0.08, 0.18, 0.62, 0.82], max_threshold: 80 },
  Cafeteria: { roi: [0.15, 0.1, 0.78, 0.75], max_threshold: 80 },
};
