"""Robust read/write for live_metrics.csv (handles legacy 4-column rows)."""

from __future__ import annotations

import csv
import os
import shutil
from typing import Any

CSV_HEADERS = [
    "timestamp",
    "location",
    "selected_area_px",
    "garbage_area_px",
    "intersection_px",
    "intersection_pct_zone",
    "intersection_pct_garbage",
    "fill_level_percent",
    "threshold_percent",
]


def clamp_percent(value: Any, default: float = 0.0) -> float:
    try:
        v = float(value)
    except (TypeError, ValueError):
        return default
    if not (0 <= v <= 100):
        return default
    return round(v, 2)


def row_from_values(vals: list[str]) -> dict[str, Any] | None:
    if len(vals) < 4:
        return None
    location = vals[1].strip()
    if not location:
        return None

    if len(vals) >= 9:
        pct_zone = clamp_percent(vals[5])
        pct_garbage = clamp_percent(vals[6])
        fill = clamp_percent(vals[7], default=pct_zone)
        return {
            "timestamp": vals[0],
            "location": location,
            "selected_area_px": round(float(vals[2] or 0), 1),
            "garbage_area_px": round(float(vals[3] or 0), 1),
            "intersection_px": round(float(vals[4] or 0), 1),
            "intersection_pct_zone": pct_zone,
            "intersection_pct_garbage": pct_garbage,
            "fill_level_percent": fill,
            "threshold_percent": max(1, min(100, int(float(vals[8] or 80)))),
        }

    fill = clamp_percent(vals[2])
    thresh = max(1, min(100, int(float(vals[3] or 80))))
    return {
        "timestamp": vals[0],
        "location": location,
        "selected_area_px": 0.0,
        "garbage_area_px": 0.0,
        "intersection_px": 0.0,
        "intersection_pct_zone": fill,
        "intersection_pct_garbage": 0.0,
        "fill_level_percent": fill,
        "threshold_percent": thresh,
    }


def read_all_rows(csv_path: str) -> list[dict[str, Any]]:
    if not os.path.isfile(csv_path):
        return []
    rows: list[dict[str, Any]] = []
    with open(csv_path, newline="", encoding="utf-8") as handle:
        reader = csv.reader(handle)
        try:
            next(reader)
        except StopIteration:
            return []
        for vals in reader:
            parsed = row_from_values(vals)
            if parsed:
                rows.append(parsed)
    return rows


def migrate_csv_file(csv_path: str) -> int:
    """Rewrite CSV with correct headers; returns number of rows kept."""
    rows = read_all_rows(csv_path)
    if not rows:
        return 0
    backup = csv_path + ".bak"
    if os.path.isfile(csv_path):
        shutil.copy2(csv_path, backup)
    with open(csv_path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_HEADERS)
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)


def write_row(csv_path: str, row: dict[str, Any], write_header: bool) -> None:
    with open(csv_path, "a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_HEADERS)
        if write_header:
            writer.writeheader()
        writer.writerow({k: row.get(k, "") for k in CSV_HEADERS})
