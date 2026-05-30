"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Camera } from "lucide-react";

const COLORS = ["#ff6600", "#00ffcc", "#ff0055", "#bb86fc"];
const CHART_HEIGHT = 260;

type HistoryMap = Record<string, { time: string; level: number }[]>;
type SummaryMap = Record<string, number>;

type Props = {
  history: HistoryMap;
  summary: SummaryMap;
};

export default function AnalyticsCharts({ history, summary }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const lineChartData = useMemo(() => {
    const timestamps = new Set<string>();
    Object.values(history).forEach((locData) =>
      locData.forEach((d) => timestamps.add(d.time))
    );
    return Array.from(timestamps)
      .sort()
      .map((time) => {
        const point: Record<string, string | number> = { time };
        Object.keys(history).forEach((loc) => {
          const match = history[loc].find((d) => d.time === time);
          if (match) point[loc] = match.level;
        });
        return point;
      });
  }, [history]);

  const summaryData = useMemo(
    () => Object.keys(summary).map((key) => ({ name: key, value: summary[key] })),
    [summary]
  );

  const chartArea = (children: ReactNode) => (
    <div className="w-full" style={{ height: CHART_HEIGHT }}>
      {mounted ? children : null}
    </div>
  );

  return (
    <>
      <div className="bg-[#141414] border border-[#333] p-5 rounded-lg shadow-xl hover:border-[#ff6600]/50 transition-colors h-[350px] flex flex-col">
        <h3 className="font-semibold mb-3 text-sm text-gray-400 uppercase tracking-widest flex items-center">
          <Camera className="w-4 h-4 mr-2 text-[#ff6600]" /> Garbage Level Trajectory
        </h3>
        {chartArea(
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="time" stroke="#888" tick={{ fill: "#888" }} />
              <YAxis stroke="#888" tick={{ fill: "#888" }} />
              <RechartsTooltip
                contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333" }}
                itemStyle={{ color: "#fff" }}
              />
              <Legend />
              {Object.keys(history).map((loc, i) => (
                <Line
                  key={loc}
                  type="monotone"
                  dataKey={loc}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 0 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-[#141414] border border-[#333] p-5 rounded-lg shadow-xl hover:border-[#ff6600]/50 transition-colors h-[300px] flex flex-col">
        <h3 className="font-semibold mb-3 text-sm text-gray-400 uppercase tracking-widest">
          Average Toxicity Level (%)
        </h3>
        {chartArea(
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={summaryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" stroke="#888" tick={{ fill: "#888" }} />
              <YAxis stroke="#888" tick={{ fill: "#888" }} />
              <RechartsTooltip
                cursor={{ fill: "#222" }}
                contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333" }}
              />
              <Bar dataKey="value" fill="#ff6600" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-[#141414] border border-[#333] p-5 rounded-lg shadow-xl hover:border-[#ff6600]/50 transition-colors h-[300px] flex flex-col">
        <h3 className="font-semibold mb-3 text-sm text-gray-400 uppercase tracking-widest">
          Zone Distribution
        </h3>
        {chartArea(
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <PieChart>
              <Pie
                data={summaryData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {summaryData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip
                contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333" }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </>
  );
}
