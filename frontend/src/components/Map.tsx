"use client";

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';

// Fix for default marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Location {
  name: string;
  lat: number;
  lon: number;
}

export default function MapComponent({ locations }: { locations: Location[] }) {
  const points = locations?.length ? locations : [{ name: "Campus", lat: 30.517, lon: 76.66 }];
  const center: [number, number] = [points[0].lat, points[0].lon];

  return (
    <MapContainer center={center} zoom={16} scrollWheelZoom={false} className="w-full h-full rounded-lg shadow-md border-2 border-[#8b6d4b]">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((loc) => (
        <Marker key={loc.name} position={[loc.lat, loc.lon]}>
          <Popup>
            <div className="font-bold text-[#4a3b2c]">{loc.name}</div>
            <div className="text-sm">Garbage Sensor Active</div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
