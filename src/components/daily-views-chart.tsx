"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/components/i18n-provider";

export function DailyViewsChart({
  series,
  caption,
}: {
  series: { date: string; views: number }[];
  caption: string;
}) {
  const { t, fmtDate, fmtNumber } = useI18n();

  return (
    <figure>
      <div className="h-56 w-full" role="img" aria-label={caption}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(value: string) => {
                const date = new Date(`${value}T00:00:00Z`);
                return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
              }}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(value: number) => fmtNumber(value)}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={56}
              allowDecimals={false}
            />
            <Tooltip
              labelFormatter={(label) => fmtDate(`${String(label)}T00:00:00Z`)}
              formatter={(value) => [fmtNumber(Number(value)), t("admin.labelApprovedViews")]}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="views"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="url(#viewsFill)"
              dot={false}
              activeDot={{ r: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">{caption}</figcaption>
    </figure>
  );
}
