import { useEffect, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardData } from "@/types/api";
import { formatNumber } from "@/lib/utils";
import { SEVERITY_PALETTE } from "@/lib/constants";

interface Props {
  buckets: DashboardData["score_histogram"];
  cutoff: number;
}

interface HistogramDatum {
  bucket: string;
  count: number;
  low: number;
  high: number;
  severity: number;
}

function colorFor(severity: number): string {
  const idx = Math.min(
    SEVERITY_PALETTE.length - 1,
    Math.max(0, Math.round(severity * (SEVERITY_PALETTE.length - 1)))
  );
  return SEVERITY_PALETTE[idx];
}

/**
 * Histogram of anomaly scores. Bars are recharts; the X-axis baseline
 * uses the SVG stroke-draw technique (overlaid SVG line) for a
 * reveal-on-mount effect.
 */
export function ScoreHistogram({ buckets, cutoff }: Props) {
  const lineRef = useRef<SVGLineElement>(null);

  useEffect(() => {
    const line = lineRef.current;
    if (!line) return;
    const length = line.getTotalLength();
    line.style.strokeDasharray = `${length}`;
    line.style.strokeDashoffset = `${length}`;
    line.getBoundingClientRect(); // force reflow
    line.style.transition = "stroke-dashoffset 0.9s ease-out";
    line.style.strokeDashoffset = "0";
  }, [buckets.length]);

  const data: HistogramDatum[] = buckets.map((b, i) => ({
    bucket: `${b.bucket_low.toFixed(2)}`,
    count: b.count,
    low: b.bucket_low,
    high: b.bucket_high,
    severity: buckets.length > 1 ? i / (buckets.length - 1) : 0,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle>Score distribution</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Isolation Forest normalized anomaly scores. Cutoff {cutoff.toFixed(4)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="pb-6">
        <div className="relative h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(215 27% 16%)"
                vertical={false}
              />
              <XAxis
                dataKey="bucket"
                stroke="hsl(215 16% 57%)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="hsl(215 16% 57%)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatNumber(v as number)}
              />
              <RTooltip
                cursor={{ fill: "hsl(215 27% 16% / 0.4)" }}
                contentStyle={{
                  background: "hsl(224 71% 6%)",
                  border: "1px solid hsl(215 27% 16%)",
                  borderRadius: "0.5rem",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "hsl(215 16% 70%)" }}
                formatter={(value, _name, item) => {
                  const payload = item.payload as HistogramDatum;
                  return [
                    formatNumber(value as number),
                    `bucket ${payload.low.toFixed(3)} – ${payload.high.toFixed(3)}`,
                  ];
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((d, i) => (
                  <Cell key={i} fill={colorFor(d.severity)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Overlay baseline stroke-draw */}
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
          >
            <line
              ref={lineRef}
              x1="0"
              y1="99%"
              x2="100%"
              y2="99%"
              stroke="hsl(0 72% 51%)"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.7"
            />
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}
