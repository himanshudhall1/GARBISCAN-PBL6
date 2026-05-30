"use client";

import { useEffect, useState } from "react";

type Props = {
  streamUrl: string;
  fallbackVideoUrl: string;
  location: string;
  apiOnline: boolean;
};

export default function LiveStream({
  streamUrl,
  fallbackVideoUrl,
  location,
  apiOnline,
}: Props) {
  const [useFallback, setUseFallback] = useState(!apiOnline);
  const [streamKey, setStreamKey] = useState(0);

  useEffect(() => {
    setUseFallback(!apiOnline);
    setStreamKey((k) => k + 1);
  }, [apiOnline, streamUrl, fallbackVideoUrl, location]);

  if (!useFallback && streamUrl) {
    return (
      <img
        key={`stream-${streamKey}`}
        src={streamUrl}
        alt={`YOLO live feed — ${location}`}
        className="w-full h-full object-cover bg-black"
        onError={() => setUseFallback(true)}
      />
    );
  }

  return (
    <video
      key={`video-${fallbackVideoUrl}`}
      src={fallbackVideoUrl}
      autoPlay
      loop
      muted
      playsInline
      className="w-full h-full object-cover bg-black"
      onError={() => {
        /* last resort: parent can show message */
      }}
    />
  );
}
