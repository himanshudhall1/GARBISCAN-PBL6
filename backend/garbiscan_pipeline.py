"""Continuous video loops + delayed inference (video never stops)."""

from __future__ import annotations

import os
import threading
import time
from typing import Callable

import cv2
import numpy as np

from csv_io import clamp_percent
from intersection import compute_zone_intersection, roi_to_pixels
from zone_config import get_roi

# Video: smooth continuous loop for all zones
VIDEO_LOOP_FPS = int(os.getenv("VIDEO_LOOP_FPS", "18"))

# Inference: delay only here — does not block video
INFERENCE_DELAY_SEC = float(os.getenv("INFERENCE_DELAY_SEC", "0.4"))
BG_ZONE_INTERVAL_SEC = float(os.getenv("BG_ZONE_INTERVAL_SEC", "1.5"))
STREAM_FPS = int(os.getenv("STREAM_FPS", "15"))

_worker_running = False
_preview_lock = threading.Lock()
_preview_jpeg: dict[str, bytes] = {}

_frame_lock = threading.Lock()
_latest_frame: dict[str, np.ndarray] = {}
_last_boxes: dict[str, list[tuple[float, float, float, float]]] = {}
_last_metrics: dict[str, dict] = {}

_caps: dict[str, cv2.VideoCapture] = {}


def compose_display_frame(
    frame: np.ndarray,
    location_name: str,
    boxes: list[tuple[float, float, float, float]],
    metrics: dict | None,
) -> np.ndarray:
    """Smooth playback frame + last prediction overlay (boxes stay until next run)."""
    out = frame.copy()
    h, w = out.shape[:2]
    roi_norm = get_roi(location_name)
    rx1, ry1, rx2, ry2 = roi_to_pixels(roi_norm, w, h)
    cv2.rectangle(out, (rx1, ry1), (rx2, ry2), (255, 180, 0), 2)

    for x1, y1, x2, y2 in boxes:
        cv2.rectangle(out, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 2)

    fill = clamp_percent((metrics or {}).get("intersection_pct_zone", 0))
    thresh = (metrics or {}).get("threshold", 80)
    color = (0, 0, 255) if fill >= thresh else (0, 255, 0)
    cv2.putText(
        out,
        f"{location_name} | Zone n garbage: {fill:.1f}%",
        (12, 28),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.75,
        color,
        2,
    )
    if metrics and metrics.get("intersection_px", 0) > 0:
        cv2.putText(
            out,
            f"Overlap: {int(metrics['intersection_px'])} px",
            (12, 58),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (0, 255, 255),
            2,
        )
    return out


def run_inference(
    frame: np.ndarray,
    location_name: str,
    yolo,
    delay_sec: float,
) -> tuple[dict, list[tuple[float, float, float, float]]]:
    h, w = frame.shape[:2]
    garbage_boxes: list[tuple[float, float, float, float]] = []

    if yolo and yolo is not False:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = yolo(rgb, verbose=False)
        if delay_sec > 0:
            time.sleep(delay_sec)
        for result in results:
            for det in result.boxes.data:
                x1, y1, x2, y2, conf, _cls = det.tolist()
                garbage_boxes.append((x1, y1, x2, y2))
    else:
        garbage_boxes = [
            (w * 0.12, h * 0.2, w * 0.32, h * 0.45),
            (w * 0.55, h * 0.35, w * 0.78, h * 0.62),
        ]
        if delay_sec > 0:
            time.sleep(delay_sec * 0.5)

    metrics = compute_zone_intersection(location_name, w, h, garbage_boxes)
    metrics["fill_level_percent"] = clamp_percent(metrics["fill_level_percent"])
    metrics["intersection_pct_zone"] = clamp_percent(metrics["intersection_pct_zone"])
    metrics["intersection_pct_garbage"] = clamp_percent(metrics["intersection_pct_garbage"])
    metrics["timestamp"] = time.strftime("%Y-%m-%d %H:%M:%S")
    return metrics, garbage_boxes


def set_preview(location: str, frame: np.ndarray) -> None:
    ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    if not ok:
        return
    with _preview_lock:
        _preview_jpeg[location] = buf.tobytes()


def get_preview(location: str) -> bytes | None:
    with _preview_lock:
        return _preview_jpeg.get(location)


def _video_loop(name: str, cap: cv2.VideoCapture) -> None:
    """Each zone: read & loop video continuously — never wait on YOLO."""
    interval = 1.0 / max(VIDEO_LOOP_FPS, 1)
    while _worker_running:
        ok, frame = cap.read()
        if not ok:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue

        with _frame_lock:
            _latest_frame[name] = frame
            boxes = list(_last_boxes.get(name, []))
            metrics = dict(_last_metrics.get(name, {}))

        display = compose_display_frame(frame, name, boxes, metrics)
        set_preview(name, display)
        time.sleep(interval)


def _inference_loop(
    names: list[str],
    load_model: Callable,
    on_metrics: Callable[[str, dict], None],
    get_threshold: Callable[[str], int],
) -> None:
    """Round-robin predictions with artificial delay — video keeps running."""
    yolo = load_model()
    idx = 0
    print(
        f"[BG] Inference delay={INFERENCE_DELAY_SEC}s, "
        f"zone gap={BG_ZONE_INTERVAL_SEC}s, video={VIDEO_LOOP_FPS}fps"
    )

    while _worker_running:
        active = [n for n in names if n in _latest_frame]
        if not active:
            time.sleep(0.3)
            continue

        name = active[idx % len(active)]
        idx += 1

        with _frame_lock:
            frame = _latest_frame.get(name)
        if frame is None:
            time.sleep(0.2)
            continue

        snap = frame.copy()
        metrics, boxes = run_inference(snap, name, yolo, INFERENCE_DELAY_SEC)
        metrics["threshold"] = get_threshold(name)

        with _frame_lock:
            _last_boxes[name] = boxes
            _last_metrics[name] = metrics

        on_metrics(name, metrics)
        time.sleep(BG_ZONE_INTERVAL_SEC)


def start_background_worker(
    location_videos: dict[str, str],
    video_dir: str,
    resolve_path: Callable[[str], str],
    load_model: Callable,
    on_metrics: Callable[[str, dict], None],
    get_threshold: Callable[[str], int] | None = None,
) -> None:
    global _worker_running, _caps

    if _worker_running:
        return
    _worker_running = True

    if get_threshold is None:
        get_threshold = lambda _n: 80

    names = list(location_videos.keys())
    for name in names:
        path = resolve_path(os.path.join(video_dir, location_videos[name]))
        cap = cv2.VideoCapture(path)
        if cap.isOpened():
            _caps[name] = cap
            threading.Thread(
                target=_video_loop,
                args=(name, cap),
                daemon=True,
                name=f"video-{name}",
            ).start()
            print(f"[VIDEO] Loop started: {name}")
        else:
            print(f"[VIDEO] Failed: {path}")

    threading.Thread(
        target=_inference_loop,
        args=(names, load_model, on_metrics, get_threshold),
        daemon=True,
        name="garbiscan-inference",
    ).start()


def stop_background_worker() -> None:
    global _worker_running
    _worker_running = False
    for cap in _caps.values():
        cap.release()
    _caps.clear()
