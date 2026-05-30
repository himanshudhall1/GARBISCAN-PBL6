import csv
import os
import tempfile
import time
from contextlib import asynccontextmanager
from threading import Thread

os.environ.setdefault("YOLO_VERBOSE", "False")

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from csv_io import CSV_HEADERS, clamp_percent, migrate_csv_file, read_all_rows
from garbiscan_pipeline import (
    BG_ZONE_INTERVAL_SEC,
    INFERENCE_DELAY_SEC,
    VIDEO_LOOP_FPS,
    get_preview,
    start_background_worker,
    STREAM_FPS,
)
from zone_config import get_all_config, sync_thresholds_dict, update_zone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VIDEO_DIR = os.path.join(BASE_DIR, "..", "assets", "videos")
MODEL_PATH = os.path.join(BASE_DIR, "..", "assets", "model", "best.pt")
DATA_DIR = os.path.join(BASE_DIR, "..", "data")
CSV_PATH = os.path.join(DATA_DIR, "live_metrics.csv")

model = None

# Latest intersection metrics per zone (also restored from CSV on startup)
intersection_latest: dict[str, dict] = {}

analytics_history = {
    "Main Gate": [
        {"time": "10:00", "level": 25},
        {"time": "11:00", "level": 30},
        {"time": "12:00", "level": 45},
        {"time": "13:00", "level": 20},
    ],
    "Hostel Block": [
        {"time": "10:00", "level": 60},
        {"time": "11:00", "level": 75},
        {"time": "12:00", "level": 90},
        {"time": "13:00", "level": 85},
    ],
    "Cafeteria": [
        {"time": "10:00", "level": 40},
        {"time": "11:00", "level": 50},
        {"time": "12:00", "level": 70},
        {"time": "13:00", "level": 60},
    ],
}

analytics_summary = {
    "Main Gate": 30.0,
    "Hostel Block": 77.5,
    "Cafeteria": 55.0,
}

thresholds = {
    "Main Gate": 80,
    "Hostel Block": 80,
    "Cafeteria": 80,
}

LOCATION_VIDEOS = {
    "Main Gate": "maingate.mp4",
    "Hostel Block": "hostel.mp4",
    "Cafeteria": "test4.mp4",
}


class ThresholdUpdate(BaseModel):
    location: str
    threshold: int


class ZoneConfigUpdate(BaseModel):
    roi: list[float] | None = None
    max_threshold: int | None = None


def load_model():
    global model
    if model is not None:
        return model
    try:
        from ultralytics import YOLO

        model = YOLO(MODEL_PATH)
        model.fuse()
        print("[YOLO] Model loaded:", MODEL_PATH)
    except Exception as exc:
        print("[YOLO] Model load failed, using mock detections:", exc)
        model = False
    return model


def resolve_video_path(source: str) -> str:
    if os.path.isfile(source):
        return os.path.abspath(source)
    candidate = os.path.join(VIDEO_DIR, source)
    if os.path.isfile(candidate):
        return os.path.abspath(candidate)
    return os.path.abspath(source)


def _intersection_from_metrics(loc: str, metrics: dict) -> dict:
    fill = clamp_percent(metrics.get("fill_level_percent", 0))
    return {
        "location": loc,
        "selected_area_px": metrics.get("selected_area_px", 0),
        "garbage_area_px": metrics.get("garbage_area_px", 0),
        "intersection_px": metrics.get("intersection_px", 0),
        "intersection_pct_zone": clamp_percent(metrics.get("intersection_pct_zone", fill)),
        "intersection_pct_garbage": clamp_percent(metrics.get("intersection_pct_garbage", 0)),
        "fill_level_percent": fill,
        "timestamp": metrics.get("timestamp", ""),
    }


def hydrate_from_csv():
    """Load last known intersection + summary from CSV (next session memory)."""
    global intersection_latest
    rows = read_all_rows(CSV_PATH)
    for row in rows:
        loc = row["location"]
        fill = clamp_percent(row["fill_level_percent"])
        intersection_latest[loc] = _intersection_from_metrics(loc, row)
        analytics_summary[loc] = fill


def load_metrics_from_csv(max_points_per_location: int = 60):
    """Parse live_metrics.csv into dashboard history + latest summary per zone."""
    rows = read_all_rows(CSV_PATH)
    if not rows:
        live = _live_payload()
        return {
            **live,
            "row_count": 0,
            "source": "memory",
        }

    history: dict[str, list[dict]] = {}
    summary: dict[str, float] = {}
    thresh_map: dict[str, int] = {}
    intersection: dict[str, dict] = {}
    last_updated = None

    for row in rows:
        loc = row["location"]
        level = clamp_percent(row["fill_level_percent"])
        ts = row["timestamp"]
        last_updated = ts
        time_label = ts.split(" ")[-1][:5] if " " in ts else ts[:5]

        history.setdefault(loc, []).append({"time": time_label, "level": level})
        summary[loc] = level
        thresh_map[loc] = row["threshold_percent"]
        intersection[loc] = _intersection_from_metrics(loc, row)

    for loc in history:
        history[loc] = history[loc][-max_points_per_location:]

    return {
        "history": history,
        "summary": summary,
        "thresholds": thresh_map,
        "intersection": intersection,
        "row_count": len(rows),
        "last_updated": last_updated,
        "source": "csv",
    }


def _live_payload() -> dict:
    """In-memory metrics from the latest YOLO frames (0–100% only)."""
    intersection = {}
    summary = {}
    for loc, raw in intersection_latest.items():
        intersection[loc] = _intersection_from_metrics(loc, raw)
        pct = clamp_percent(
            intersection[loc].get(
                "intersection_pct_zone",
                intersection[loc].get("fill_level_percent", 0),
            )
        )
        summary[loc] = pct
        intersection[loc]["fill_level_percent"] = pct
    return {
        "history": analytics_history,
        "summary": summary,
        "thresholds": dict(thresholds),
        "intersection": intersection,
    }


def append_metrics_to_csv():
    os.makedirs(DATA_DIR, exist_ok=True)
    if os.path.isfile(CSV_PATH):
        with open(CSV_PATH, encoding="utf-8") as handle:
            header = handle.readline().strip()
        if header != ",".join(CSV_HEADERS):
            migrate_csv_file(CSV_PATH)

    file_exists = os.path.isfile(CSV_PATH)
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")

    with open(CSV_PATH, "a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_HEADERS)
        if not file_exists:
            writer.writeheader()
        for location in LOCATION_VIDEOS:
            metrics = intersection_latest.get(location, {})
            level = clamp_percent(
                metrics.get(
                    "intersection_pct_zone",
                    analytics_summary.get(location, 0),
                )
            )
            writer.writerow(
                {
                    "timestamp": timestamp,
                    "location": location,
                    "selected_area_px": metrics.get("selected_area_px", 0),
                    "garbage_area_px": metrics.get("garbage_area_px", 0),
                    "intersection_px": metrics.get("intersection_px", 0),
                    "intersection_pct_zone": level,
                    "intersection_pct_garbage": clamp_percent(
                        metrics.get("intersection_pct_garbage", 0)
                    ),
                    "fill_level_percent": level,
                    "threshold_percent": thresholds.get(location, 80),
                }
            )


CSV_LOG_INTERVAL_SEC = int(os.getenv("CSV_LOG_INTERVAL_SEC", "30"))


def csv_logger_loop():
    while True:
        time.sleep(CSV_LOG_INTERVAL_SEC)
        try:
            append_metrics_to_csv()
            print(f"[CSV] Logged metrics -> {CSV_PATH}")
        except Exception as exc:
            print("[CSV] Write error:", exc)


@asynccontextmanager
async def lifespan(_: FastAPI):
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(VIDEO_DIR, exist_ok=True)
    sync_thresholds_dict(thresholds)
    if os.path.isfile(CSV_PATH):
        with open(CSV_PATH, encoding="utf-8") as handle:
            header = handle.readline().strip()
        if header != ",".join(CSV_HEADERS):
            n = migrate_csv_file(CSV_PATH)
            print(f"[CSV] Migrated {n} rows to new column format")
    hydrate_from_csv()
    Thread(target=csv_logger_loop, daemon=True).start()
    load_model()

    def on_zone_metrics(name: str, metrics: dict) -> None:
        fill = clamp_percent(
            metrics.get("intersection_pct_zone", metrics.get("fill_level_percent", 0))
        )
        metrics["intersection_pct_zone"] = fill
        metrics["fill_level_percent"] = fill
        intersection_latest[name] = metrics
        analytics_summary[name] = fill
        update_analytics(name, fill)

    start_background_worker(
        LOCATION_VIDEOS,
        VIDEO_DIR,
        resolve_video_path,
        load_model,
        on_zone_metrics,
        get_threshold=lambda n: thresholds.get(n, 80),
    )

    yield


app = FastAPI(title="GARBISCAN Analytics Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if os.path.isdir(VIDEO_DIR):
    app.mount("/videos", StaticFiles(directory=VIDEO_DIR), name="videos")


def update_analytics(source_name: str, garbage_level: float):
    if source_name not in analytics_history:
        analytics_history[source_name] = []

    current_time = time.strftime("%H:%M")

    if (
        analytics_history[source_name]
        and analytics_history[source_name][-1]["time"] == current_time
    ):
        prev = analytics_history[source_name][-1]["level"]
        analytics_history[source_name][-1]["level"] = (prev + garbage_level) / 2
    else:
        analytics_history[source_name].append(
            {"time": current_time, "level": garbage_level}
        )
        if len(analytics_history[source_name]) > 20:
            analytics_history[source_name].pop(0)

    # Summary for UI = latest reading only (history keeps averages for charts)
    analytics_summary[source_name] = clamp_percent(garbage_level)


def generate_preview_stream(location_name: str):
    """MJPEG from background cache — no duplicate YOLO on the HTTP stream."""
    interval = 1.0 / max(STREAM_FPS, 1)
    while True:
        jpeg = get_preview(location_name)
        if jpeg:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n"
            )
        time.sleep(interval)


@app.get("/health")
def health():
    zones_active = list(intersection_latest.keys())
    return {
        "status": "ok",
        "model_loaded": model is not None and model is not False,
        "background_zones": zones_active,
        "bg_interval_sec": BG_ZONE_INTERVAL_SEC,
        "inference_delay_sec": INFERENCE_DELAY_SEC,
        "video_loop_fps": VIDEO_LOOP_FPS,
        "csv_path": CSV_PATH,
        "videos_dir": VIDEO_DIR,
    }


@app.get("/video_feed")
def video_feed(source: str = Query("hostel.mp4"), location: str = Query("Unknown")):
    zone = location if location in LOCATION_VIDEOS else "Main Gate"
    return StreamingResponse(
        generate_preview_stream(zone),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@app.get("/locations")
def get_locations():
    locations = []
    for name, filename in LOCATION_VIDEOS.items():
        lat_lon = {
            "Main Gate": (30.515, 76.659),
            "Hostel Block": (30.517, 76.661),
            "Cafeteria": (30.519, 76.660),
        }
        lat, lon = lat_lon[name]
        video_path = os.path.join(VIDEO_DIR, filename)
        locations.append(
            {
                "name": name,
                "lat": lat,
                "lon": lon,
                "video": video_path,
                "video_file": filename,
            }
        )
    return locations


@app.get("/analytics/history")
def get_analytics_history():
    return load_metrics_from_csv()["history"]


@app.get("/analytics/summary")
def get_analytics_summary():
    return load_metrics_from_csv()["summary"]


@app.get("/analytics/dashboard")
def get_analytics_dashboard():
    """Dashboard: live memory merged with CSV history."""
    csv_data = load_metrics_from_csv()
    live = _live_payload()
    for loc, level in live["summary"].items():
        if level > 0 or loc not in csv_data["summary"]:
            csv_data["summary"][loc] = level
            csv_data["intersection"][loc] = live["intersection"].get(
                loc, csv_data["intersection"].get(loc, {})
            )
    csv_data["history"] = live["history"]
    csv_data["source"] = "live+csv"
    return csv_data


@app.get("/analytics/live")
def get_analytics_live():
    """Latest prediction per zone — poll every ~1s from UI."""
    live = _live_payload()
    live["updated_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
    return live


@app.get("/analytics/intersection")
def get_intersection_latest():
    """Latest zone ∩ garbage metrics (memory + CSV)."""
    return {
        "zones": _live_payload()["intersection"],
        "csv_path": CSV_PATH,
    }


@app.get("/api/zone-config")
def get_zone_config():
    return get_all_config()


@app.put("/api/zone-config/{location}")
def put_zone_config(location: str, data: ZoneConfigUpdate):
    if data.roi is not None and len(data.roi) != 4:
        raise HTTPException(
            status_code=400,
            detail="roi must have 4 values [x1, y1, x2, y2]",
        )
    entry = update_zone(location, roi=data.roi, max_threshold=data.max_threshold)
    if data.max_threshold is not None:
        thresholds[location] = entry["max_threshold"]
    return {"status": "success", "location": location, "config": entry}


@app.post("/api/threshold")
def set_threshold(data: ThresholdUpdate):
    level = max(1, min(100, data.threshold))
    thresholds[data.location] = level
    update_zone(data.location, max_threshold=level)
    return {"status": "success", "threshold": level}


@app.post("/upload_video")
async def upload_video(file: UploadFile = File(...)):
    fd, path = tempfile.mkstemp(suffix=".mp4")
    with os.fdopen(fd, "wb") as handle:
        content = await file.read()
        handle.write(content)
    return {"status": "success", "file_path": path}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
