import cv2
import numpy as np
from fastapi import FastAPI, Query, Request, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import os
import time
import tempfile
from pydantic import BaseModel

app = FastAPI(title="GARBISCAN Analytics Backend")

# Enable CORS to allow Next.js to talk to FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the YOLO model
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "model", "best.pt")
model = YOLO(MODEL_PATH)
model.fuse()

# --- Global State for Analytics ---
# Simulating a database to store metrics
# History stores lists of {time: "HH:MM", level: float} for each location
analytics_history = {
    "Main Gate": [{"time": "10:00", "level": 25}, {"time": "11:00", "level": 30}, {"time": "12:00", "level": 45}, {"time": "13:00", "level": 20}],
    "Hostel Block": [{"time": "10:00", "level": 60}, {"time": "11:00", "level": 75}, {"time": "12:00", "level": 90}, {"time": "13:00", "level": 85}],
    "Cafeteria": [{"time": "10:00", "level": 40}, {"time": "11:00", "level": 50}, {"time": "12:00", "level": 70}, {"time": "13:00", "level": 60}],
}

# Current average levels
analytics_summary = {
    "Main Gate": 30,
    "Hostel Block": 77.5,
    "Cafeteria": 55,
}

# Thresholds
thresholds = {
    "Main Gate": 80,
    "Hostel Block": 80,
    "Cafeteria": 80
}

class ThresholdUpdate(BaseModel):
    location: str
    threshold: int

def update_analytics(source_name: str, garbage_level: float):
    """Updates the in-memory analytics store with new live data."""
    if source_name not in analytics_history:
        analytics_history[source_name] = []
    
    current_time = time.strftime("%H:%M")
    
    # If the minute changed, or we just want to mock continuous data:
    # We will just keep the last 10 entries to avoid memory leak
    if len(analytics_history[source_name]) > 0 and analytics_history[source_name][-1]["time"] == current_time:
        # Average it out for the same minute
        analytics_history[source_name][-1]["level"] = (analytics_history[source_name][-1]["level"] + garbage_level) / 2
    else:
        analytics_history[source_name].append({"time": current_time, "level": garbage_level})
        if len(analytics_history[source_name]) > 10:
            analytics_history[source_name].pop(0)
            
    # Update summary average
    recent_levels = [x["level"] for x in analytics_history[source_name]]
    analytics_summary[source_name] = sum(recent_levels) / len(recent_levels)

def generate_frames(video_source, location_name="Unknown"):
    """
    Generator function to yield MJPEG frames from the video source.
    """
    try:
        if isinstance(video_source, str) and video_source.isdigit():
            video_source = int(video_source)
    except ValueError:
        pass

    cap = cv2.VideoCapture(video_source)
    frame_skip = 2
    frame_count = 0

    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            # If video ends, loop it for demo purposes
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue

        frame_count += 1
        if frame_count % frame_skip != 0:
            continue

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = model(rgb_frame)

        frame_area = frame.shape[0] * frame.shape[1]
        garbage_area = 0

        for result in results:
            for det in result.boxes.data:
                x1, y1, x2, y2, conf, cls = det.tolist()
                label = f"Garbage {conf:.2f}"
                color = (0, 255, 0)
                
                # Calculate area
                box_area = (x2 - x1) * (y2 - y1)
                garbage_area += box_area

                cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
                cv2.putText(frame, label, (int(x1), int(y1) - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        # Calculate garbage percentage
        garbage_percentage = min((garbage_area / frame_area) * 100 * 5, 100) # Multiplier to make it visible
        update_analytics(location_name, garbage_percentage)
        
        # Add overlay for percentage
        overlay_text = f"Garbage Level: {garbage_percentage:.1f}%"
        threshold = thresholds.get(location_name, 80)
        text_color = (0, 0, 255) if garbage_percentage >= threshold else (0, 255, 0)
        cv2.putText(frame, overlay_text, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, text_color, 3)

        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret:
            continue
            
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

    cap.release()

@app.get("/video_feed")
def video_feed(source: str = Query("0"), location: str = Query("Unknown")):
    return StreamingResponse(generate_frames(source, location), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/locations")
def get_locations():
    base_video_dir = os.path.join(os.path.dirname(__file__), "..", "assets", "videos")
    locations = [
        {"name": "Main Gate", "lat": 30.515, "lon": 76.659, "video": os.path.join(base_video_dir, "maingate.mp4")},
        {"name": "Hostel Block", "lat": 30.517, "lon": 76.661, "video": os.path.join(base_video_dir, "hostel.mp4")},
        {"name": "Cafeteria", "lat": 30.519, "lon": 76.660, "video": os.path.join(base_video_dir, "test4.mp4")}
    ]
    return locations

@app.get("/analytics/history")
def get_analytics_history():
    return analytics_history

@app.get("/analytics/summary")
def get_analytics_summary():
    return analytics_summary

@app.post("/api/threshold")
def set_threshold(data: ThresholdUpdate):
    thresholds[data.location] = data.threshold
    return {"status": "success", "threshold": data.threshold}

@app.post("/upload_video")
async def upload_video(file: UploadFile = File(...)):
    # Save the file to a temporary location
    fd, path = tempfile.mkstemp(suffix=".mp4")
    with os.fdopen(fd, 'wb') as f:
        content = await file.read()
        f.write(content)
    return {"status": "success", "file_path": path}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
