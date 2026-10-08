import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import { format, fd } from "../utils/engine";

const dd = (n) => +n.toFixed(1) + "d";

export default function TrendChart({
  parameter,
  history,
  forecast,
  color,
  index,
  stepDays = 1,
}) {
  const canvasRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Destroy existing chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const h = history.slice(-60);
    const fc = forecast || [];
    const sd = stepDays;

    const a = [
      ...h.map((x) => Number(x?.[parameter.k])),
      ...fc.map(() => null),
    ];
    const b = [
      ...h.slice(0, -1).map(() => null),
      Number(h.at(-1)?.[parameter.k]),
      ...fc.map((x) => Number(x?.[parameter.k])),
    ];

    const fmtTs = (x) => {
      if (!x) return "";
      const z = new Date(x);
      return Number.isNaN(z.getTime())
        ? ""
        : z.toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
    };

    const lb = [
      ...h.map(
        (x, j) => fmtTs(x.timestamp) || "-" + dd((h.length - 1 - j) * sd),
      ),
      ...fc.map((x, j) => fmtTs(x.timestamp) || "+" + dd((j + 1) * sd)),
    ];

    chartInstance.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: lb,
        datasets: [
          {
            label: "Measured",
            data: a,
            borderColor: "#0f9d76",
            backgroundColor: "#0f9d7614",
            fill: true,
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
          {
            label: "Forecast",
            data: b,
            borderColor: color || "#0f9d76",
            borderWidth: 2.5,
            borderDash: [7, 5],
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) =>
                c.parsed.y == null
                  ? null
                  : `${c.dataset.label}: ${format(c.parsed.y)} ${parameter.u}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 10 }, maxTicksLimit: 8 },
          },
          y: { grid: { color: "#edf1f1" }, ticks: { font: { size: 10 } } },
        },
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [history, forecast, parameter, color, stepDays]);

  return <canvas ref={canvasRef} id={`c${index}`} />;
}
