"use client";

import { useEffect, useState, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import axios from 'axios';
import { Camera, Map as MapIcon, Info, Settings, UploadCloud, Video, Server, ShieldAlert } from 'lucide-react';

const MapComponent = dynamic(() => import('@/components/Map'), { ssr: false });

const API_BASE = 'http://localhost:8000';
const COLORS = ['#ff6600', '#00ffcc', '#ff0055', '#bb86fc'];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('Map Feed');
  const [locations, setLocations] = useState<any[]>([]);
  const [history, setHistory] = useState<any>({});
  const [summary, setSummary] = useState<any>({});
  
  // Command Center State
  const [sourceType, setSourceType] = useState('System Defaults');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [webcamId, setWebcamId] = useState('0');
  const [ipUrl, setIpUrl] = useState('http://');
  const [uploadPath, setUploadPath] = useState('');
  const [threshold, setThreshold] = useState(80);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch data periodically
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [locRes, histRes, sumRes] = await Promise.all([
          axios.get(`${API_BASE}/locations`),
          axios.get(`${API_BASE}/analytics/history`),
          axios.get(`${API_BASE}/analytics/summary`)
        ]);
        setLocations(locRes.data);
        setHistory(histRes.data);
        setSummary(sumRes.data);
        if (!selectedLocation && locRes.data.length > 0) {
          setSelectedLocation(locRes.data[0].name);
        }
      } catch (e) {
        console.error('Error fetching data', e);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveThreshold = async () => {
    try {
      await axios.post(`${API_BASE}/api/threshold`, { location: selectedLocation, threshold });
      alert('Threshold saved!');
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API_BASE}/upload_video`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadPath(res.data.file_path);
    } catch (e) {
      console.error(e);
      alert('Upload failed');
    }
  };

  // Determine current video source URL for the backend
  const getVideoSourceUrl = () => {
    if (sourceType === 'System Defaults') {
      const loc = locations.find(l => l.name === selectedLocation);
      return loc ? encodeURIComponent(loc.video) : '0';
    } else if (sourceType === 'Local Interface (Webcam)') {
      return encodeURIComponent(webcamId);
    } else if (sourceType === 'Direct IP Camera') {
      return encodeURIComponent(ipUrl);
    } else if (sourceType === 'Data Upload') {
      return encodeURIComponent(uploadPath);
    }
    return '0';
  };

  const streamUrl = `${API_BASE}/video_feed?source=${getVideoSourceUrl()}&location=${selectedLocation}`;

  // Format data for Line Chart
  const lineChartData = useMemo(() => {
    const timestamps = new Set<string>();
    Object.values(history).forEach((locData: any) => locData.forEach((d: any) => timestamps.add(d.time)));
    return Array.from(timestamps).sort().map(time => {
      const point: any = { time };
      Object.keys(history).forEach(loc => {
        const match = history[loc].find((d: any) => d.time === time);
        if (match) point[loc] = match.level;
      });
      return point;
    });
  }, [history]);

  const summaryData = Object.keys(summary).map(key => ({
    name: key,
    value: summary[key]
  }));

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-[#e0e0e0] font-sans selection:bg-[#ff6600] selection:text-white">
      {/* Header */}
      <header className="bg-[#1a1a1a] text-[#ff6600] border-b border-[#333] p-4 flex justify-between items-center shadow-md">
        <h1 className="text-3xl font-bold tracking-[0.2em] flex items-center">
          <ShieldAlert className="mr-3 text-[#ff6600]" /> VORTEX CORE
        </h1>
        <nav className="flex space-x-8 text-sm uppercase tracking-widest font-semibold">
          <button onClick={() => setActiveTab('Home')} className={`hover:text-white transition-colors ${activeTab === 'Home' ? 'text-white border-b border-[#ff6600] pb-1' : ''}`}>Dashboard</button>
          <button onClick={() => setActiveTab('Map Feed')} className={`hover:text-white transition-colors ${activeTab === 'Map Feed' ? 'text-white border-b border-[#ff6600] pb-1' : ''}`}>Command Center</button>
        </nav>
        <div className="flex items-center space-x-2 bg-[#ff6600] text-black px-4 py-1.5 rounded-sm font-bold tracking-widest text-xs uppercase">
          CHITKARA SECURE
        </div>
      </header>

      <main className="p-6 max-w-[1400px] mx-auto">
        {activeTab === 'Home' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <h2 className="text-xl font-bold text-[#ff6600] uppercase tracking-wider mb-2">Live Analytics Overview</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Map Panel */}
              <div className="bg-[#141414] border border-[#333] p-5 rounded-lg shadow-xl hover:border-[#ff6600]/50 transition-colors h-[350px] flex flex-col">
                <h3 className="font-semibold mb-3 text-sm text-gray-400 uppercase tracking-widest flex items-center">
                  <MapIcon className="w-4 h-4 mr-2 text-[#ff6600]"/> Area Sector Map
                </h3>
                <div className="flex-1 rounded-md overflow-hidden ring-1 ring-white/10 relative">
                  <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] z-10"></div>
                  <MapComponent locations={locations} />
                </div>
              </div>

              {/* Line Chart Panel */}
              <div className="bg-[#141414] border border-[#333] p-5 rounded-lg shadow-xl hover:border-[#ff6600]/50 transition-colors h-[350px] flex flex-col">
                <h3 className="font-semibold mb-3 text-sm text-gray-400 uppercase tracking-widest flex items-center">
                  <Camera className="w-4 h-4 mr-2 text-[#ff6600]"/> Garbage Level Trajectory
                </h3>
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="time" stroke="#888" tick={{fill: '#888'}} />
                      <YAxis stroke="#888" tick={{fill: '#888'}} />
                      <RechartsTooltip contentStyle={{backgroundColor: '#1a1a1a', border: '1px solid #333'}} itemStyle={{color: '#fff'}} />
                      <Legend />
                      {Object.keys(history).map((loc, i) => (
                        <Line key={loc} type="monotone" dataKey={loc} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{r: 0}} activeDot={{r: 6}} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bar Chart Panel */}
              <div className="bg-[#141414] border border-[#333] p-5 rounded-lg shadow-xl hover:border-[#ff6600]/50 transition-colors h-[300px] flex flex-col">
                <h3 className="font-semibold mb-3 text-sm text-gray-400 uppercase tracking-widest">Average Toxicity Level (%)</h3>
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summaryData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="name" stroke="#888" tick={{fill: '#888'}} />
                      <YAxis stroke="#888" tick={{fill: '#888'}} />
                      <RechartsTooltip cursor={{fill: '#222'}} contentStyle={{backgroundColor: '#1a1a1a', border: '1px solid #333'}} />
                      <Bar dataKey="value" fill="#ff6600" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pie Chart Panel */}
              <div className="bg-[#141414] border border-[#333] p-5 rounded-lg shadow-xl hover:border-[#ff6600]/50 transition-colors h-[300px] flex flex-col">
                <h3 className="font-semibold mb-3 text-sm text-gray-400 uppercase tracking-widest">Zone Distribution</h3>
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={summaryData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={2} dataKey="value" stroke="none">
                        {summaryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{backgroundColor: '#1a1a1a', border: '1px solid #333'}} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Map Feed' && (
          <div className="animate-in fade-in duration-500">
            <div className="flex flex-col xl:flex-row gap-6">
              
              {/* Left Sidebar: Command Center */}
              <div className="w-full xl:w-80 flex-shrink-0 flex flex-col gap-6">
                <div className="bg-[#141414] border border-[#333] p-6 rounded-lg shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#ff6600] to-transparent"></div>
                  <h3 className="text-xl font-bold mb-6 flex items-center text-[#ff6600] uppercase tracking-widest">
                    <Server className="w-5 h-5 mr-3"/> Terminal
                  </h3>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="text-xs uppercase tracking-widest text-gray-400 mb-2 block">Source Protocol</label>
                      <div className="grid grid-cols-1 gap-2">
                        {['System Defaults', 'Local Interface (Webcam)', 'Direct IP Camera', 'Data Upload'].map(src => (
                          <button 
                            key={src} 
                            onClick={() => setSourceType(src)}
                            className={`text-left px-4 py-3 rounded text-sm font-semibold transition-all border ${sourceType === src ? 'bg-[#ff6600]/10 border-[#ff6600] text-[#ff6600]' : 'bg-[#1a1a1a] border-[#333] text-gray-400 hover:border-gray-500 hover:text-white'}`}
                          >
                            {src}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-[#0d0d0d] p-4 rounded border border-[#222]">
                      {sourceType === 'System Defaults' && (
                        <div>
                          <label className="text-xs uppercase text-gray-500 mb-2 block">Active Sensors</label>
                          <select 
                            className="w-full bg-[#1a1a1a] text-white border border-[#333] p-2.5 rounded focus:border-[#ff6600] focus:ring-1 focus:ring-[#ff6600] outline-none transition-all text-sm"
                            value={selectedLocation}
                            onChange={(e) => setSelectedLocation(e.target.value)}
                          >
                            {locations.map(l => <option key={l.name} value={l.name}>{l.name}</option>)}
                          </select>
                        </div>
                      )}
                      {sourceType === 'Local Interface (Webcam)' && (
                        <div>
                          <label className="text-xs uppercase text-gray-500 mb-2 block">Device ID</label>
                          <input type="text" value={webcamId} onChange={e => setWebcamId(e.target.value)} className="w-full bg-[#1a1a1a] text-white border border-[#333] p-2.5 rounded text-sm outline-none focus:border-[#ff6600]" />
                        </div>
                      )}
                      {sourceType === 'Direct IP Camera' && (
                        <div>
                          <label className="text-xs uppercase text-gray-500 mb-2 block">Stream URL</label>
                          <input type="text" value={ipUrl} onChange={e => setIpUrl(e.target.value)} className="w-full bg-[#1a1a1a] text-white border border-[#333] p-2.5 rounded text-sm outline-none focus:border-[#ff6600]" />
                        </div>
                      )}
                      {sourceType === 'Data Upload' && (
                        <div>
                          <label className="text-xs uppercase text-gray-500 mb-2 block">Upload Footage</label>
                          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="video/*" className="hidden" />
                          <button onClick={() => fileInputRef.current?.click()} className="w-full bg-[#1a1a1a] border border-[#333] text-white p-3 rounded flex items-center justify-center hover:bg-[#222] transition-colors text-sm">
                            <UploadCloud className="w-4 h-4 mr-2" /> {uploadPath ? 'Video Uploaded' : 'Select MP4 File'}
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs uppercase tracking-widest text-gray-400 mb-2 block">Threshold Limits</label>
                      <div className="flex space-x-2">
                        <input 
                          type="number" 
                          value={threshold}
                          onChange={(e) => setThreshold(Number(e.target.value))}
                          className="flex-1 bg-[#1a1a1a] text-white border border-[#333] p-2 rounded focus:border-[#ff6600] outline-none text-center font-mono"
                        />
                        <button onClick={handleSaveThreshold} className="bg-[#ff6600] text-black font-bold px-4 rounded text-sm hover:bg-[#ff8833] transition-colors">SET</button>
                      </div>
                    </div>

                    {sourceType === 'System Defaults' && (
                      <div className="mt-4 p-4 border border-[#333] bg-[#0d0d0d] rounded flex items-center justify-between">
                        <div className="text-xs text-gray-400 uppercase tracking-widest">Current Status</div>
                        <div className={`font-mono font-bold text-sm ${summary[selectedLocation] > threshold ? 'text-red-500' : 'text-green-500'}`}>
                          {summary[selectedLocation]?.toFixed(1) || 0}%
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Main Content: Live Feed */}
              <div className="flex-1 flex flex-col gap-6">
                <div className="bg-[#141414] border border-[#333] p-6 rounded-lg shadow-2xl relative">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center">
                      <Video className="w-5 h-5 mr-3 text-[#ff6600]" /> 
                      LIVE FEED: {sourceType === 'System Defaults' ? selectedLocation : sourceType}
                    </h2>
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-blink"></span>
                      <span className="text-xs font-mono text-red-500 tracking-widest">RECORDING</span>
                    </div>
                  </div>
                  
                  <div className="w-full bg-black border border-[#333] rounded-lg overflow-hidden relative group aspect-video">
                    {/* Cyber Overlay Details */}
                    <div className="absolute top-4 left-4 z-10 font-mono text-xs text-[#00ffcc] opacity-70 pointer-events-none">
                      <div>SYS.VER: 4.9.1</div>
                      <div>LATENCY: 12ms</div>
                      <div>YOLO ENGINE: ONLINE</div>
                    </div>
                    <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-[#ff6600] opacity-50 m-2 rounded-tr-md pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-[#ff6600] opacity-50 m-2 rounded-bl-md pointer-events-none"></div>

                    {/* Video Stream */}
                    {(sourceType === 'System Defaults' || uploadPath || sourceType === 'Local Interface (Webcam)' || sourceType === 'Direct IP Camera') ? (
                      <img 
                        src={streamUrl}
                        alt="Live Stream Offline"
                        className="w-full h-full object-cover opacity-90"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-600">
                        <Video className="w-16 h-16 mb-4 opacity-50" />
                        <span className="uppercase tracking-widest text-sm">AWAITING CONNECTION</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* System Logs */}
                <div className="bg-[#0a0a0a] border border-[#222] p-4 rounded-lg font-mono text-xs text-gray-400 h-32 overflow-y-auto shadow-inner">
                  <div className="text-[#00ffcc] mb-1">$ INIT VORTEX_CORE</div>
                  <div>[SYS] Connection established to backend engine.</div>
                  <div>[YOLO] Initializing object detection layer...</div>
                  <div>[STREAM] Connecting to feed source: {sourceType}</div>
                  <div className="text-gray-500 animate-pulse">_ Waiting for incoming telemetry...</div>
                </div>
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}
