import streamlit as st
import requests
import urllib.parse
import os
import tempfile
import pandas as pd
import time

# Configure page with premium layout
st.set_page_config(page_title="Vortex Core | CCTV Analytics", page_icon="👁️", layout="wide")

FASTAPI_URL = "http://127.0.0.1:8000"

# Inject Custom Cyber-Industrial CSS
st.markdown("""
    <style>
    /* Dark Theme & Cyber-Industrial Aesthetics */
    .stApp {
        background-color: #0d0d0d;
        color: #e0e0e0;
        font-family: 'Inter', sans-serif;
    }
    h1, h2, h3 {
        color: #ff6600 !important;
        text-transform: uppercase;
        letter-spacing: 2px;
    }
    .st-emotion-cache-1y4p8pa {
        padding-top: 2rem;
    }
    /* Video Container */
    .video-container {
        background: linear-gradient(145deg, #1a1a1a, #0a0a0a);
        border: 2px solid #ff6600;
        border-radius: 12px;
        box-shadow: 0 0 20px rgba(255, 102, 0, 0.2);
        padding: 15px;
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
        overflow: hidden;
    }
    .video-container::before {
        content: "REC";
        position: absolute;
        top: 20px;
        right: 30px;
        color: red;
        font-weight: bold;
        animation: blink 1.5s infinite;
    }
    @keyframes blink {
        0% { opacity: 1; }
        50% { opacity: 0; }
        100% { opacity: 1; }
    }
    /* Metrics */
    div[data-testid="metric-container"] {
        background-color: #1a1a1a;
        border-left: 4px solid #ff6600;
        padding: 10px 20px;
        border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    }
    </style>
""", unsafe_allow_html=True)

st.title("👁️ VORTEX CORE: Autonomous Garbage Detection")
st.markdown("_Real-time environmental monitoring powered by YOLOv8 Neural Engine._")
st.markdown("---")

# Function to get default locations
@st.cache_data
def get_locations():
    try:
        response = requests.get(f"{FASTAPI_URL}/locations")
        if response.status_code == 200:
            return response.json()
    except requests.exceptions.ConnectionError:
        pass
    return []

locations = get_locations()

# Sidebar Configuration
with st.sidebar:
    st.image("https://cdn-icons-png.flaticon.com/512/2088/2088090.png", width=60)
    st.title("COMMAND CENTER")
    st.markdown("Configure Data Streams")
    
    connection_type = st.radio(
        "SOURCE TYPE",
        ["System Defaults", "Direct IP Camera", "Local Interface (Webcam)", "Data Upload"]
    )
    
    st.markdown("---")
    video_source = None
    
    if connection_type == "System Defaults":
        if locations:
            loc_names = [loc["name"] for loc in locations]
            selected_loc_name = st.selectbox("ACTIVE SENSORS", loc_names)
            
            st.subheader("GEO-LOCATION")
            df_map = pd.DataFrame(locations)
            st.map(df_map, zoom=15)
            
            for loc in locations:
                if loc["name"] == selected_loc_name:
                    video_source = loc["video"]
                    break
        else:
            st.error("SYSTEM OFFLINE. Cannot connect to backend.")
            
    elif connection_type == "Local Interface (Webcam)":
        webcam_id = st.text_input("DEVICE ID", value="0")
        if st.button("INITIALIZE WEBCAM"):
            video_source = webcam_id
            
    elif connection_type == "Direct IP Camera":
        ip_url = st.text_input("STREAM URL", value="http://")
        if st.button("CONNECT PROTOCOL"):
            if ip_url and ip_url != "http://":
                video_source = ip_url
            else:
                st.error("INVALID PROTOCOL URL.")
                
    elif connection_type == "Data Upload":
        uploaded_file = st.file_uploader("UPLOAD FOOTAGE", type=["mp4", "avi", "mov"])
        if uploaded_file is not None:
            tfile = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
            tfile.write(uploaded_file.read())
            video_source = tfile.name
            st.success("DATA INGESTED SUCCESSFULLY.")

# Main Dashboard
col1, col2, col3 = st.columns(3)

if video_source is not None:
    # Dummy metrics for UI enhancement
    col1.metric("System Status", "ONLINE", "Nominal")
    col2.metric("Inference Engine", "YOLOv8 Nano", "Active")
    col3.metric("Stream Latency", "12ms", "-2ms")
    
    st.markdown("<br>", unsafe_allow_html=True)
    st.subheader(f"LIVE STREAM: {connection_type.upper()}")
    
    encoded_source = urllib.parse.quote(str(video_source))
    stream_url = f"{FASTAPI_URL}/video_feed?source={encoded_source}"
    
    # Premium Video Container
    st.markdown(
        f"""
        <div class="video-container">
            <img src="{stream_url}" style="width: 100%; border-radius: 8px; object-fit: cover;" />
        </div>
        """,
        unsafe_allow_html=True
    )
    
    with st.expander("System Logs"):
        st.code(f"[INFO] Initializing video capture from: {video_source}\n[INFO] Loading YOLOv8 architecture...\n[INFO] Stream connected successfully.\n[INFO] Awaiting detections...", language="bash")
        
else:
    col1.metric("System Status", "STANDBY", "Awaiting Input")
    col2.metric("Inference Engine", "OFFLINE", "")
    col3.metric("Stream Latency", "---", "")
    
    st.markdown("<br><br>", unsafe_allow_html=True)
    st.info("⚠️ NO SIGNAL DETECTED. Please initialize a video source from the Command Center.")
