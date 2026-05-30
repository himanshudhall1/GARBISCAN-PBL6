"""Zone ROI vs garbage detection box intersection."""

from __future__ import annotations

from typing import Iterable

from zone_config import get_roi as get_zone_roi


def roi_to_pixels(
    roi_norm: tuple[float, float, float, float], width: int, height: int
) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = roi_norm
    return (
        int(x1 * width),
        int(y1 * height),
        int(x2 * width),
        int(y2 * height),
    )


def box_area(x1: float, y1: float, x2: float, y2: float) -> float:
    return max(0.0, x2 - x1) * max(0.0, y2 - y1)


def intersect_boxes(
    ax1: float, ay1: float, ax2: float, ay2: float,
    bx1: float, by1: float, bx2: float, by2: float,
) -> float:
    ix1 = max(ax1, bx1)
    iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)
    if ix2 <= ix1 or iy2 <= iy1:
        return 0.0
    return (ix2 - ix1) * (iy2 - iy1)


def compute_zone_intersection(
    location: str,
    frame_width: int,
    frame_height: int,
    garbage_boxes: Iterable[tuple[float, float, float, float]],
) -> dict:
    """
    Intersection of selected zone ROI and all garbage bounding boxes.
    Returns pixel areas and percentages for CSV + dashboard.
    """
    roi_norm = get_zone_roi(location)
    rx1, ry1, rx2, ry2 = roi_to_pixels(roi_norm, frame_width, frame_height)
    selected_area_px = box_area(rx1, ry1, rx2, ry2)

    garbage_area_px = 0.0
    intersection_px = 0.0
    boxes_inside = 0

    for x1, y1, x2, y2 in garbage_boxes:
        ga = box_area(x1, y1, x2, y2)
        garbage_area_px += ga
        inter = intersect_boxes(rx1, ry1, rx2, ry2, x1, y1, x2, y2)
        if inter > 0:
            intersection_px += inter
            boxes_inside += 1

    intersection_pct_zone = (
        (intersection_px / selected_area_px) * 100 if selected_area_px > 0 else 0.0
    )
    intersection_pct_garbage = (
        (intersection_px / garbage_area_px) * 100 if garbage_area_px > 0 else 0.0
    )

    return {
        "location": location,
        "roi_pixels": (rx1, ry1, rx2, ry2),
        "selected_area_px": round(selected_area_px, 1),
        "garbage_area_px": round(garbage_area_px, 1),
        "intersection_px": round(intersection_px, 1),
        "intersection_pct_zone": round(min(intersection_pct_zone, 100.0), 2),
        "intersection_pct_garbage": round(min(intersection_pct_garbage, 100.0), 2),
        "detection_count": boxes_inside,
        "fill_level_percent": round(min(intersection_pct_zone, 100.0), 2),
    }
