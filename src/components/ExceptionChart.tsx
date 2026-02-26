import { useMemo, useState } from "react";
import { Chart, GroupButton } from "@geotab/zenith";
import type { ExceptionChartPoint } from "../types";

interface ExceptionChartProps {
  data: ExceptionChartPoint[];
  visible: boolean;
}

const MODES = [
  { id: "pct", label: "% of Utilization" },
  { id: "hours", label: "Total Hours" },
];

export default function ExceptionChart({ data, visible }: ExceptionChartProps) {
  const [mode, setMode] = useState("pct");

  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    const labels = data.map((d) => d.ruleName);
    const values = data.map((d) => mode === "pct" ? d.avgPct : d.totalHours);

    return {
      labels,
      datasets: [
        {
          label: mode === "pct" ? "Avg Exception % of Utilization" : "Total Exception Hours",
          data: values,
        },
      ],
    };
  }, [data, mode]);

  if (!visible) return null;

  return (
    <div className="fut-chart-panel">
      <div className="fut-chart-toolbar">
        <GroupButton
          items={MODES}
          activeId={mode}
          onChange={setMode}
        />
      </div>
      {data.length === 0 ? (
        <div className="fut-empty-state">
          Select exception rules above to see the breakdown.
        </div>
      ) : chartData ? (
        <div className="fut-chart-wrap">
          <Chart
            type="bar"
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: mode === "pct" ? "% of Utilization" : "Hours",
                  },
                },
              },
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
