"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

type Location = { name: string; lat: number; lon: number };

function FlyToZone({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lon], 17, { duration: 0.6 });
  }, [lat, lon, map]);
  return null;
}

function zoneIcon(selected: boolean, accent: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:${selected ? accent : "#333"};
      border:3px solid ${selected ? "#fff" : accent};
      box-shadow:0 0 ${selected ? "14px" : "6px"} ${accent}88;
      ${selected ? "animation:pulse 1.5s infinite;" : ""}
    "></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const ACCENTS: Record<string, string> = {
  "Main Gate": "#00ffcc",
  "Hostel Block": "#ff6600",
  Cafeteria: "#ff0055",
};

type Props = {
  locations: Location[];
  selected: string;
  summary: Record<string, number>;
  onSelect: (name: string) => void;
};

export default function SelectableMap({
  locations,
  selected,
  summary,
  onSelect,
}: Props) {
  const points = locations?.length
    ? locations
    : [{ name: "Campus", lat: 30.517, lon: 76.66 }];

  const active = points.find((p) => p.name === selected) ?? points[0];

  return (
    <MapContainer
      center={[active.lat, active.lon]}
      zoom={16}
      scrollWheelZoom={true}
      className="w-full h-full rounded-lg z-0"
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyToZone lat={active.lat} lon={active.lon} />
      {points.map((loc) => {
        const isSelected = loc.name === selected;
        const fill = summary[loc.name] ?? 0;
        const accent = ACCENTS[loc.name] ?? "#ff6600";
        return (
          <Marker
            key={loc.name}
            position={[loc.lat, loc.lon]}
            icon={zoneIcon(isSelected, accent)}
            eventHandlers={{
              click: () => onSelect(loc.name),
            }}
          >
            <Popup>
              <div className="text-sm font-bold text-[#333]">{loc.name}</div>
              <div className="text-xs text-gray-600">Fill: {fill.toFixed(1)}%</div>
              <button
                type="button"
                className="mt-2 text-xs bg-[#ff6600] text-white px-2 py-1 rounded"
                onClick={() => onSelect(loc.name)}
              >
                Select zone
              </button>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
