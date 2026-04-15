import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

interface CountryEntry {
  country: string;
  count: number;
  flagged_count: number;
}

interface Props {
  title: string;
  description?: string;
  data: CountryEntry[];
}

export function CountryBar({ title, description, data }: Props) {
  const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, 10);
  const maxCount = Math.max(1, ...sorted.map((d) => d.count));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sorted}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(215 27% 16%)"
                horizontal={false}
              />
              <XAxis
                type="number"
                stroke="hsl(215 16% 57%)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatNumber(v as number)}
              />
              <YAxis
                type="category"
                dataKey="country"
                stroke="hsl(215 16% 57%)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={80}
              />
              <RTooltip
                cursor={{ fill: "hsl(215 27% 16% / 0.4)" }}
                contentStyle={{
                  background: "hsl(224 71% 6%)",
                  border: "1px solid hsl(215 27% 16%)",
                  borderRadius: "0.5rem",
                  fontSize: "12px",
                }}
                formatter={(value, _name, item) => {
                  const d = item.payload as CountryEntry;
                  return [
                    `${formatNumber(value as number)} tx (${formatNumber(
                      d.flagged_count
                    )} flagged)`,
                    d.country,
                  ];
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {sorted.map((d) => {
                  const ratio =
                    d.count > 0 ? d.flagged_count / d.count : 0;
                  // Blend color: baseline neutral → primary when high flagged ratio
                  const alpha = 0.35 + Math.min(0.55, ratio * 4);
                  const size = d.count / maxCount;
                  const fill = `hsl(0 72% ${35 + size * 20}% / ${alpha.toFixed(2)})`;
                  return <Cell key={d.country} fill={fill} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
