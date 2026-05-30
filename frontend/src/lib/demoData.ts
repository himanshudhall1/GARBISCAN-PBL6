export type Location = {
  name: string;
  lat: number;
  lon: number;
  video?: string;
  video_file?: string;
};

export const DEMO_LOCATIONS: Location[] = [
  { name: "Main Gate", lat: 30.515, lon: 76.659, video_file: "maingate.mp4" },
  { name: "Hostel Block", lat: 30.517, lon: 76.661, video_file: "hostel.mp4" },
  { name: "Cafeteria", lat: 30.519, lon: 76.66, video_file: "test4.mp4" },
];

export const DEMO_HISTORY: Record<string, { time: string; level: number }[]> = {
  "Main Gate": [
    { time: "09:00", level: 22 },
    { time: "10:00", level: 25 },
    { time: "11:00", level: 30 },
    { time: "12:00", level: 45 },
    { time: "13:00", level: 38 },
    { time: "14:00", level: 28 },
  ],
  "Hostel Block": [
    { time: "09:00", level: 55 },
    { time: "10:00", level: 60 },
    { time: "11:00", level: 75 },
    { time: "12:00", level: 90 },
    { time: "13:00", level: 85 },
    { time: "14:00", level: 72 },
  ],
  Cafeteria: [
    { time: "09:00", level: 35 },
    { time: "10:00", level: 40 },
    { time: "11:00", level: 50 },
    { time: "12:00", level: 70 },
    { time: "13:00", level: 60 },
    { time: "14:00", level: 52 },
  ],
};

export const DEMO_SUMMARY: Record<string, number> = {
  "Main Gate": 31,
  "Hostel Block": 78,
  Cafeteria: 54,
};
