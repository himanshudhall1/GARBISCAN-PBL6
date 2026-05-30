"""Persistent per-zone ROI + max threshold (survives restarts)."""

from __future__ import annotations

import json
import os
from typing import Any

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "..", "data")
CONFIG_PATH = os.path.join(DATA_DIR, "zone_config.json")

DEFAULT_ROIS: dict[str, list[float]] = {
    "Main Gate": [0.05, 0.12, 0.58, 0.88],
    "Hostel Block": [0.08, 0.18, 0.62, 0.82],
    "Cafeteria": [0.15, 0.10, 0.78, 0.75],
}

DEFAULT_MAX_THRESHOLD = 80

_cache: dict[str, dict[str, Any]] | None = None


def _default_config() -> dict[str, dict[str, Any]]:
    return {
        name: {"roi": roi[:], "max_threshold": DEFAULT_MAX_THRESHOLD}
        for name, roi in DEFAULT_ROIS.items()
    }


def _normalize_roi(roi: list[float]) -> tuple[float, float, float, float]:
    x1, y1, x2, y2 = roi
    if x1 > x2:
        x1, x2 = x2, x1
    if y1 > y2:
        y1, y2 = y2, y1
    x1 = max(0.0, min(1.0, x1))
    y1 = max(0.0, min(1.0, y1))
    x2 = max(0.0, min(1.0, x2))
    y2 = max(0.0, min(1.0, y2))
    if x2 - x1 < 0.05:
        x2 = min(1.0, x1 + 0.05)
    if y2 - y1 < 0.05:
        y2 = min(1.0, y1 + 0.05)
    return (x1, y1, x2, y2)


def load_config() -> dict[str, dict[str, Any]]:
    global _cache
    os.makedirs(DATA_DIR, exist_ok=True)
    if os.path.isfile(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, encoding="utf-8") as handle:
                raw = json.load(handle)
            merged = _default_config()
            for name, entry in raw.items():
                if isinstance(entry, dict) and "roi" in entry:
                    merged[name] = {
                        "roi": list(_normalize_roi(entry["roi"])),
                        "max_threshold": int(
                            entry.get("max_threshold", DEFAULT_MAX_THRESHOLD)
                        ),
                    }
            _cache = merged
            return merged
        except (json.JSONDecodeError, OSError, TypeError, ValueError):
            pass
    _cache = _default_config()
    save_config(_cache)
    return _cache


def save_config(config: dict[str, dict[str, Any]]) -> None:
    global _cache
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as handle:
        json.dump(config, handle, indent=2)
    _cache = config


def get_all_config() -> dict[str, dict[str, Any]]:
    return load_config()


def get_roi(location: str) -> tuple[float, float, float, float]:
    cfg = load_config()
    entry = cfg.get(location) or cfg.get("Main Gate") or _default_config()["Main Gate"]
    return _normalize_roi(entry["roi"])


def get_max_threshold(location: str) -> int:
    cfg = load_config()
    entry = cfg.get(location, {})
    return int(entry.get("max_threshold", DEFAULT_MAX_THRESHOLD))


def update_zone(
    location: str,
    roi: list[float] | None = None,
    max_threshold: int | None = None,
) -> dict[str, Any]:
    cfg = load_config()
    if location not in cfg:
        cfg[location] = {
            "roi": list(DEFAULT_ROIS.get(location, [0.1, 0.1, 0.9, 0.9])),
            "max_threshold": DEFAULT_MAX_THRESHOLD,
        }
    if roi is not None:
        cfg[location]["roi"] = list(_normalize_roi(roi))
    if max_threshold is not None:
        cfg[location]["max_threshold"] = max(1, min(100, int(max_threshold)))
    save_config(cfg)
    return cfg[location]


def sync_thresholds_dict(thresholds: dict[str, int]) -> None:
    """Apply saved max thresholds into runtime dict."""
    for name, entry in load_config().items():
        thresholds[name] = int(entry.get("max_threshold", DEFAULT_MAX_THRESHOLD))
