import type { IntersectionZone } from "@/lib/metrics";

export function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/** Single source of truth: zone ∩ garbage % (same as video overlay & CSV). */
export function zoneIntersectionPct(ix?: IntersectionZone): number {
  if (!ix) return 0;
  return clampPct(ix.intersection_pct_zone ?? ix.fill_level_percent);
}

export function buildSummaryFromIntersection(
  intersection: Record<string, IntersectionZone>
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(intersection).map(([zone, data]) => [
      zone,
      zoneIntersectionPct(data),
    ])
  );
}
