# GARBISCAN

Smart garbage monitoring dashboard — YOLO detection on campus CCTV clips, live charts, and CSV logging.

## Quick start (Windows)

```powershell
cd f:\p\pbl4\capstone\capstone

# First time only
.\setup.ps1

# Every time — opens 2 terminals (backend + frontend)
.\start.ps1
```

Open **http://localhost:3000** → **Command Center** → pick a zone (Main Gate / Hostel Block / Cafeteria).

| Service   | URL                      |
|-----------|--------------------------|
| Dashboard | http://localhost:3000    |
| Backend   | http://localhost:8000    |
| API docs  | http://localhost:8000/docs |

## Manual start (2 terminals)

**Terminal 1 — Backend** (must run from `backend` folder):

```powershell
cd f:\p\pbl4\capstone\capstone
.\start-backend.ps1
```

**Terminal 2 — Frontend:**

```powershell
cd f:\p\pbl4\capstone\capstone
.\start-frontend.ps1
```

## Project layout

```
capstone/
├── assets/
│   ├── model/best.pt      # YOLO weights
│   └── videos/*.mp4       # Zone footage (loops)
├── backend/main.py        # FastAPI + YOLO stream
├── frontend/              # Next.js dashboard
├── data/live_metrics.csv  # Auto-written every 30s
├── start.ps1              # Launch everything
├── setup.ps1              # One-time install
└── requirements.txt
```

## Features

- **Live feed** — MJPEG stream with bounding boxes + fill %
- **Dashboard** — map, line/bar/pie charts, zone cards
- **CSV log** — `data/live_metrics.csv` updated every **30 seconds**
- **Video loop** — if API is down, HTML5 loop from `/videos/*.mp4`

## Background processing (all zones)

On startup the backend runs a **round-robin worker** on all 3 videos:

| Zone | Video |
|------|-------|
| Main Gate | maingate.mp4 |
| Hostel Block | hostel.mp4 |
| Cafeteria | test4.mp4 |

- Each zone gets a new YOLO prediction every ~**7–8 seconds** (default)
- Dashboard polls `/analytics/live` every **1s** — all cards update
- CSV still logs every **30s**
- Browser stream shows **cached frames** (no double inference = smoother)

Tune for your laptop:

```powershell
$env:BG_ZONE_INTERVAL_SEC = "2.5"   # pause between zone cycles
$env:BG_FRAME_SKIP = "6"            # skip frames in video per tick
$env:STREAM_FPS = "10"              # MJPEG refresh rate
$env:CSV_LOG_INTERVAL_SEC = "30"
.\start-backend.ps1
```

Faster PC → lower `BG_ZONE_INTERVAL_SEC`. Slower PC → raise it to `4`.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Could not import module "main"` | Run uvicorn from **`capstone\backend`**, not `frontend` |
| No video / black screen | Start backend first; check `assets\videos\` has `.mp4` files |
| Port in use | `Get-NetTCPConnection -LocalPort 3000,8000` then stop that process |
| Frontend Turbopack crash | Already using `npm run dev` → webpack (`--webpack` in package.json) |

## Requirements

- Python 3.10+
- Node.js 18+
- ~6 GB disk for venv + `node_modules` + PyTorch (via ultralytics)
